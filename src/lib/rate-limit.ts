// In-memory rate-limit для логина (CLAUDE.md §Безопасность: 5/15мин по x-forwarded-for, 6-я → 429).
// Считаем ТОЛЬКО неуспешные попытки: check (read) → при провале record → при успехе clear.
//
// ⚠️ Память процесса не шарится между serverless-инстансами (Vercel) — в проде окно «течёт».
//    Для Фазы 12 (hardening): вынести в общий стор (Turso-таблица / KV / Upstash). Сейчас (монолит,
//    dev/test-стенд, один процесс) — достаточно и детерминированно для harness/E2E.

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
