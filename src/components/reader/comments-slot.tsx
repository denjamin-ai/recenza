// Якорный слот для публичных комментариев (контракт места) — реализация в Фазе 8.
// id="comments" нужен для deep-link из уведомлений/якорей; ключ ревизии передаётся пропсами на будущее.

export function CommentsSlot({ revision }: { revision: number }) {
  return (
    <section
      id="comments"
      aria-label="Комментарии"
      data-revision={revision}
      className="mt-12 border-t border-[var(--border)] pt-8"
    >
      <h2 className="text-[length:var(--type-h4)]">Комментарии</h2>
      <p className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
        Обсуждение скоро будет доступно.
      </p>
    </section>
  );
}
