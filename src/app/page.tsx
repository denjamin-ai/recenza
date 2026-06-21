import { ThemeToggle } from "@/components/theme-toggle";

const semanticChips = [
  { label: "Опубликовано", fg: "--success", bg: "--success-bg", bd: "--success-border" },
  { label: "Нужны правки", fg: "--warning", bg: "--warning-bg", bd: "--warning-border" },
  { label: "Отклонено", fg: "--danger", bg: "--danger-bg", bd: "--danger-border" },
  { label: "На ревью", fg: "--info", bg: "--info-bg", bd: "--info-border" },
  { label: "Закреплено", fg: "--pin", bg: "--pin-bg", bd: "--pin-border" },
] as const;

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-[var(--bg-elevated)] focus:px-4 focus:py-2 focus:ring-2 focus:ring-[var(--accent)]"
      >
        К содержимому
      </a>

      {/* Шапка-скелет: бренд + переключатель темы (без ролевой навигации — это Фаза 4) */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="mx-auto flex h-16 w-full max-w-[var(--max-content)] items-center justify-between px-6">
          <span className="font-display text-[length:var(--type-h4)] font-bold text-[var(--foreground)]">
            Recenza
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[var(--max-content)] flex-1 px-6 py-16 focus:outline-none"
      >
        <section className="animate-in" style={{ "--index": 0 } as React.CSSProperties}>
          <h1>Дизайн-система Recenza</h1>
          <p className="mt-4 max-w-2xl text-[var(--muted-foreground)]">
            Каркас Фазы 1: дизайн-токены, типографика и тёмная/светлая темы. Спокойная
            редакторская эстетика — serif-заголовки, тонкие границы вместо теней, бирюзовый акцент.
          </p>
        </section>

        {/* Типографическая шкала — стили наследуются из базовых правил globals.css */}
        <section
          className="animate-in mt-14 border-t border-[var(--border-secondary)] pt-10"
          style={{ "--index": 1 } as React.CSSProperties}
        >
          <p className="text-[length:var(--type-small)] uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Типографика
          </p>
          {/* Образец шкалы H1 — не семантический заголовок (на странице один <h1> выше) */}
          <p className="mt-4 font-display text-[length:var(--type-h1)] font-bold leading-[var(--leading-h1)] tracking-[var(--tracking-h1)] text-[var(--foreground)]">
            Заголовок H1 — Lora
          </p>
          <h2 className="mt-4">Заголовок H2 — Lora</h2>
          <h3 className="mt-4">Заголовок H3 — Lora</h3>
          <h4 className="mt-4">Заголовок H4 — Lora</h4>
          <p className="mt-4">
            Основной текст набирается шрифтом Literata с интерлиньяжем 1.75 — намеренно
            serif для длинного чтения статей и глав.
          </p>
          <p className="mt-2 text-[length:var(--type-small)] leading-[var(--leading-small)] text-[var(--muted-foreground)]">
            Вторичный мелкий текст — для подписей, метаданных и служебных пометок.
          </p>
        </section>

        {/* Акцент */}
        <section
          className="animate-in mt-14 border-t border-[var(--border-secondary)] pt-10"
          style={{ "--index": 2 } as React.CSSProperties}
        >
          <p className="text-[length:var(--type-small)] uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Акцент
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <a
              href="#main"
              className="text-[var(--accent)] underline underline-offset-4 transition-colors hover:text-[var(--accent-hover)]"
            >
              Акцентная ссылка
            </a>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            >
              Акцентная кнопка
            </button>
          </div>
        </section>

        {/* Поверхности — границы, не тени */}
        <section
          className="animate-in mt-14 border-t border-[var(--border-secondary)] pt-10"
          style={{ "--index": 3 } as React.CSSProperties}
        >
          <p className="text-[length:var(--type-small)] uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Поверхности
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-6">
              <h4>Вторичная поверхность</h4>
              <p className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                bg-secondary + border-secondary
              </p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
              <h4>Приподнятая поверхность</h4>
              <p className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                bg-elevated + border
              </p>
            </div>
          </div>
        </section>

        {/* Семантические статусы — цвет не единственный сигнификатор (есть текст) */}
        <section
          className="animate-in mt-14 border-t border-[var(--border-secondary)] pt-10"
          style={{ "--index": 4 } as React.CSSProperties}
        >
          <p className="text-[length:var(--type-small)] uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Статусы
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {semanticChips.map((chip) => (
              <span
                key={chip.label}
                className="rounded-[var(--radius-pill)] border px-3 py-1 text-[length:var(--type-small)]"
                style={{
                  color: `var(${chip.fg})`,
                  backgroundColor: `var(${chip.bg})`,
                  borderColor: `var(${chip.bd})`,
                }}
              >
                {chip.label}
              </span>
            ))}
          </div>
        </section>

        {/* Моноширинный — slug / технические поля */}
        <section
          className="animate-in mt-14 border-t border-[var(--border-secondary)] pt-10"
          style={{ "--index": 5 } as React.CSSProperties}
        >
          <p className="text-[length:var(--type-small)] uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Моноширинный
          </p>
          <p className="mt-4">
            Slug главы:{" "}
            <code className="rounded-[var(--radius-sm)] bg-[var(--code-bg)] px-1.5 py-0.5 font-mono">
              recenza/phase-1-tokens
            </code>
          </p>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-8 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Recenza — Фаза 1: архитектура Claude Code + токены.
        </div>
      </footer>
    </>
  );
}
