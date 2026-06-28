// Каркас кабинета автора (по прототипу author/author-portal.jsx). Фаза 4: навигация + секции-заглушки,
// без бизнес-функционала. Наполнение — Фаза 6 (кабинет/редактор/портфолио) и Фаза 9 (подбор ревьюеров).

function StubSection({ title, note }: { title: string; note: string }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-5">
      <h2 className="text-[length:var(--type-h4)]">{title}</h2>
      <p className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">{note}</p>
    </section>
  );
}

export function AuthorPortalShell({ displayName }: { displayName: string }) {
  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <header>
        <h1>Кабинет автора</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          {displayName}, здесь будут ваши блоги, главы и взаимодействие с ревью.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-4">
        <StubSection title="Запросы ревьюеров" note="Статусы запросов админу (на рассмотрении / одобрен / отклонён) — Фаза 9." />
        <StubSection title="Оцените ревьюеров" note="Приватная оценка ревьюеров после публикации (1–5 звёзд) — Фаза 9." />
        <StubSection title="Снято с ревью" note="Главы, снятые ревьюером из-за несовпадения навыков — Фаза 9." />
      </div>

      <section className="mt-10">
        <h2 className="text-[length:var(--type-h4)]">Мои блоги</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Плитка «создать» идёт первой (Фаза 6 — реальное создание блога). */}
          <div className="flex min-h-[7rem] items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] p-5 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            + Создать блог (Фаза 6)
          </div>
        </div>
      </section>
    </div>
  );
}
