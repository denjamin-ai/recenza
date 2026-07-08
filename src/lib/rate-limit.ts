// In-memory rate-limit для логина (CLAUDE.md §Безопасность: 5/15мин по x-forwarded-for, 6-я → 429).
// Считаем ТОЛЬКО неуспешные попытки: check (read) → при провале record → при успехе clear.
//
// ⚠️ In-memory КОРРЕКТЕН только при одном Node-процессе. Прод (Фаза 12) — один systemd-инстанс
//    на VPS (без cluster/pm2 — зафиксировано в runbook ENVIRONMENTS.md), поэтому вынос в durable-стор
//    отложен в backlog до горизонтального масштабирования. Рестарт процесса сбрасывает окна — приемлемо.

const WINDOW_MS = 15 * 60 * 1000; // 15 минут
const MAX_FAILURES = 5; // 6-я попытка после 5 провалов → заблокирована (429)

type Bucket = { failures: number; resetAt: number };
const store = new Map<string, Bucket>();

/** Первый хоп `x-forwarded-for` как ключ; fallback `"local"` (прямое соединение на стенде). */
export function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first || "local";
}

/** Можно ли пытаться? Read-only: не инкрементит. retryAfter — секунды до сброса окна. */
export function checkLoginRate(key: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const b = store.get(key);
  if (!b || b.resetAt <= now) return { ok: true };
  if (b.failures >= MAX_FAILURES) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

/** Зафиксировать неуспешную попытку (создаёт/продлевает окно). */
export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    store.set(key, { failures: 1, resetAt: now + WINDOW_MS });
    return;
  }
  b.failures += 1;
}

/** Сбросить счётчик после успешного входа. */
export function clearLoginRate(key: string): void {
  store.delete(key);
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
