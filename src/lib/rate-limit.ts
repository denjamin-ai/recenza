// In-memory rate-limit логина и реакций (CLAUDE.md §Безопасность).
// Считаем ТОЛЬКО неуспешные попытки: check (read) → при провале record → при успехе clear.
//
// ⚠️ In-memory КОРРЕКТЕН только при одном Node-процессе. Прод (Фаза 12) — один systemd-инстанс
//    на VPS (без cluster/pm2 — зафиксировано в runbook ENVIRONMENTS.md), поэтому вынос в durable-стор
//    отложен в backlog до горизонтального масштабирования. Рестарт процесса сбрасывает окна —
//    это же и аварийный выход, если админ-аккаунт заперли (см. ACCOUNT_MAX_FAILURES ниже).

const WINDOW_MS = 15 * 60 * 1000; // 15 минут
const MAX_FAILURES = 5; // 6-я попытка после 5 провалов → заблокирована (429)

/**
 * Порог для ПЕР-АККАУНТНОГО ведра (аудит ИБ 2026-07-26). IP-лимита мало: адрес клиента —
 * внешний ввод, а распределённый перебор (ботнет/ротация IP) обходит его по построению.
 * Счётчик на handle от IP не зависит вовсе.
 *
 * Порог намеренно ЩЕДРЕЕ IP-шного: цена ошибки — запертый живой пользователь. Обратная сторона
 * (принята владельцем): аккаунт, включая админский, можно запереть на 15 минут снаружи.
 * ⚠️ Аварийный выход для владельца — `sudo systemctl restart recenza`: вёдра живут в памяти
 *    процесса и сбрасываются вместе с ним.
 */
const ACCOUNT_MAX_FAILURES = 15;

type Bucket = { failures: number; resetAt: number };
const store = new Map<string, Bucket>();

/**
 * Ключ клиента для лимитера.
 *
 * ⚠️ БЕЗОПАСНОСТЬ (аудит ИБ 2026-07-26, HIGH): ПЕРВЫЙ хоп `X-Forwarded-For` доверия не заслуживает
 * НИКОГДА — его целиком задаёт клиент. Cloudflare *дописывает* реальный IP к присланному клиентом
 * заголовку, Caddy дописывает свой хоп: подделанное значение так и остаётся слева. Раньше ключом
 * был именно первый хоп — ротация заголовка давала каждой попытке свежее ведро, и лимит логина
 * не срабатывал никогда.
 *
 * Порядок доверия:
 *   1. `CF-Connecting-IP` — Cloudflare ПЕРЕЗАПИСЫВАЕТ его на edge, клиент подделать не может (прод).
 *   2. ПОСЛЕДНИЙ хоп `X-Forwarded-For` — его дописал ближайший прокси. Хуже точности (за CF это
 *      будет edge-адрес), но fail-safe: слипание в общее ведро ограничивает, а не открывает.
 *   3. `"local"` — прямое соединение (dev/тест-стенд).
 */
export function clientKey(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const hops = req.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (hops?.length) return hops[hops.length - 1];

  return "local";
}

/** Можно ли пытаться? Read-only: не инкрементит. retryAfter — секунды до сброса окна. */
export function checkRate(key: string, max = MAX_FAILURES): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const b = store.get(key);
  if (!b || b.resetAt <= now) return { ok: true };
  if (b.failures >= max) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

/** Зафиксировать неуспешную попытку (создаёт/продлевает окно). */
export function recordFailure(key: string): void {
  const now = Date.now();
  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    store.set(key, { failures: 1, resetAt: now + WINDOW_MS });
    sweepLoginStore(now);
    return;
  }
  b.failures += 1;
}

/** Сбросить счётчик после успешного входа. */
export function clearRate(key: string): void {
  store.delete(key);
}

/**
 * Чистка протухших вёдер. Раньше `store` не чистился вовсе (в отличие от actionStore) — вместе с
 * подделываемым ключом это давало неограниченный рост памяти на одном процессе.
 */
function sweepLoginStore(now: number): void {
  if (store.size <= 5000) return;
  for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
}

// Обёртки под IP-ведро (порог 5/15мин) — имена сохранены, поведение прежнее.
export function checkLoginRate(key: string): { ok: boolean; retryAfter?: number } {
  return checkRate(key, MAX_FAILURES);
}
export function recordLoginFailure(key: string): void {
  recordFailure(key);
}
export function clearLoginRate(key: string): void {
  clearRate(key);
}

/** Ведро на КОНКРЕТНЫЙ аккаунт (не зависит от IP). `subject` — handle либо "admin". */
export function accountKey(subject: string): string {
  return `acct:${subject.toLowerCase()}`;
}
export function checkAccountRate(subject: string): { ok: boolean; retryAfter?: number } {
  return checkRate(accountKey(subject), ACCOUNT_MAX_FAILURES);
}

// ───────────────────────────── реакции (голоса/закладки/подписки) ─────────────────────────────
// Лёгкий лимит «не чаще 1/сек на пользователя» (CLAUDE.md §Безопасность: голоса 1/сек, 429 при превышении).
// Combined check+record: вызов И проверяет, И отмечает попытку (это гейт мутации, не read-only).
// ⚠️ in-memory, как и логин-лимит — корректно при одном процессе (см. шапку файла).

const ACTION_WINDOW_MS = 1000;
const actionStore = new Map<string, number>(); // key → timestamp последней допущенной попытки

/**
 * Допустить действие, если с предыдущего прошло ≥1с. При успехе фиксирует время.
 * @returns ok=false + retryAfter(сек) при срабатывании лимита.
 */
export function hitActionRate(key: string, windowMs = ACTION_WINDOW_MS): {
  ok: boolean;
  retryAfter?: number;
} {
  const now = Date.now();
  const last = actionStore.get(key);
  if (last != null && now - last < windowMs) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - last)) / 1000)) };
  }
  actionStore.set(key, now);
  // Грубая защита от роста карты на стенде: периодически чистим протухшие ключи.
  if (actionStore.size > 5000) {
    for (const [k, t] of actionStore) if (now - t > windowMs) actionStore.delete(k);
  }
  return { ok: true };
}
