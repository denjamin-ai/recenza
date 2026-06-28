// Каркас кабинета ревьюера (по прототипу reviewer/reviewer-inbox.jsx). Фаза 4: плитки + секции-заглушки.
// Наполнение — Фаза 7 (review-flow) и Фаза 9 (приглашения/согласие/рейтинг).

const TILES = [
  { label: "Приглашения", value: "—" },
  { label: "Ваш ход", value: "—" },
  { label: "Активные ревью", value: "—" },
  { label: "Ваш рейтинг", value: "—" },
] as const;

function StubSection({ title, note }: { title: string; note: string }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-5">
      <h2 className="text-[length:var(--type-h4)]">{title}</h2>
      <p className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">{note}</p>
    </section>
  );
}

export function ReviewerInboxShell({ displayName }: { displayName: string }) {
  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <header>
        <h1>Кабинет ревьюера</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">{displayName} · Приглашения и ревью</p>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {TILES.map((t) => (
          <div
            key={t.label}
            className="rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4"
          >
            <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">{t.label}</p>
            <p className="mt-1 font-display text-[length:var(--type-h3)] text-[var(--foreground)]">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-4">
        <StubSection title="Входящие приглашения" note="Приглашения на ревью с процентом совпадения навыков — Фаза 9." />
        <StubSection title="Активные ревью" note="Главы в работе, команда и прогресс вердиктов — Фаза 7." />
      </div>
    </div>
  );
}
