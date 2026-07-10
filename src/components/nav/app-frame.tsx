// Оболочка публичных/пользовательских страниц: skip-link + шапка сайта (SiteNav) + main.
// Подвал с тэглайном убран (ui-feedback-6 П4). Рендерится в layout'ах групп (reader)/author/
// reviewer. В админ-портале НЕ используется — там своя fullscreen-обвязка без шапки (README §11.8).

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
    </>
  );
}
