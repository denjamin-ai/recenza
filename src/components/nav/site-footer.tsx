// Минимальный подвал сайта (Фаза 15, З-28). Подвал с тэглайном был убран в ui-feedback-6 П4;
// здесь возвращается не он, а служебная навигация: о платформе · как стать ревьюером · доска.
// RSC, без клиентского JS. В админ-портале не рендерится (там свой fullscreen-каркас).

import Link from "next/link";

const link =
  "inline-flex min-h-[36px] items-center rounded-[var(--radius-sm)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border)]">
      <div className="mx-auto flex w-full max-w-[var(--max-content)] flex-wrap items-center justify-between gap-4 px-6 py-8 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
        <p>© 2026 Recenza</p>
        <nav aria-label="Служебные ссылки" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/about" className={link}>
            О платформе
          </Link>
          <Link href="/board" className={link}>
            Как стать ревьюером
          </Link>
          <Link href="/feed.xml" className={link}>
            RSS
          </Link>
        </nav>
      </div>
    </footer>
  );
}
