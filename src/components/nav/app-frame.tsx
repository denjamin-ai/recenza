// Оболочка публичных/пользовательских страниц: skip-link + шапка сайта (SiteNav) + main + подвал.
// Рендерится в layout'ах групп (reader)/author/reviewer. В админ-портале НЕ используется — там
// своя fullscreen-обвязка без шапки сайта (README §11.8).

import { SiteNav } from "@/components/nav/site-nav";

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-[var(--bg-elevated)] focus:px-4 focus:py-2 focus:ring-2 focus:ring-[var(--accent)]"
      >
        К содержимому
      </a>

      <SiteNav />

      <main id="main" tabIndex={-1} className="w-full flex-1 focus:outline-none">
        {children}
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="mx-auto w-full max-w-[var(--max-article)] px-6 py-8 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Recenza — девблог с редакционным ревью.
        </div>
      </footer>
    </>
  );
}
