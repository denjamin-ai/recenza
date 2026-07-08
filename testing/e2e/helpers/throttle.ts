/**
 * Rate-limit действий на сервере: 1 мутация/сек на пользователя (vote/bookmark/follow/apply).
 * Хелпер выдерживает паузу ≥1.1с между мутациями одного и того же ключа (handle),
 * чтобы позитивные тесты не ловили 429. Сами rate-limit тесты паузу НЕ используют.
 */
const lastMutation = new Map<string, number>();

export async function throttleMutation(key: string, minGapMs = 1500): Promise<void> {
  const prev = lastMutation.get(key) ?? 0;
  const wait = prev + minGapMs - Date.now();
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastMutation.set(key, Date.now());
}
