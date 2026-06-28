"use client";

// Каркас админ-портала (по прототипу admin/admin-portal.jsx, README §11.8). FULLSCREEN: шапка сайта
// не рендерится (admin layout не использует AppFrame). Фаза 4 — сгруппированная навигация + topbar +
// панели-заглушки; наполнение — Фаза 10 (модерация/люди/платформа).

import { useState } from "react";

type TabId =
  | "dashboard"
  | "reports"
  | "review"
  | "recruit"
  | "users"
  | "banners"
  | "donation";

const GROUPS: { label: string | null; items: { id: TabId; label: string }[] }[] = [
  { label: null, items: [{ id: "dashboard", label: "Сводка" }] },
  {
    label: "Модерация",
    items: [
      { id: "reports", label: "Жалобы" },
      { id: "review", label: "Ревью глав" },
      { id: "recruit", label: "Заявки ревьюеров" },
    ],
  },
  { label: "Люди", items: [{ id: "users", label: "Пользователи" }] },
  {
    label: "Платформа",
    items: [
      { id: "banners", label: "Баннеры" },
      { id: "donation", label: "Пожертвования" },
    ],
  },
];

const PANEL_NOTE: Record<TabId, string> = {
  dashboard: "KPI-плитки и очередь «Требует внимания» — Фаза 10.",
  reports: "Очередь жалоб и разбор — Фаза 10.",
  review: "Глобальная очередь глав на ревью и force-approve — Фаза 10.",
  recruit: "Запросы авторов и заявки ревьюеров с публичной доски — Фаза 10.",
  users: "Таблица пользователей, баны и роли — Фаза 10.",
  banners: "Промо-баннеры ленты (карусель) — Фаза 10.",
  donation: "Способы пожертвований (ссылки/QR) — Фаза 10.",
};

const TITLES: Record<TabId, string> = {
  dashboard: "Сводка",
  reports: "Жалобы",
  review: "Ревью глав",
  recruit: "Заявки ревьюеров",
  users: "Пользователи",
  banners: "Баннеры",
  donation: "Пожертвования",
};

export function AdminPortalShell() {
  const [tab, setTab] = useState<TabId>("dashboard");

  async function logout() {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-[var(--bg-elevated)] focus:px-4 focus:py-2 focus:ring-2 focus:ring-[var(--accent)]"
      >
        К содержимому
      </a>

      {/* Боковая навигация */}
      <aside className="flex shrink-0 flex-col border-b border-[var(--border)] bg-[var(--bg-elevated)] md:w-56 md:border-b-0 md:border-r">
        <div className="flex items-baseline gap-2 px-5 py-4">
          <span className="font-display text-[length:var(--type-h4)] font-bold text-[var(--foreground)]">
            Recenza
          </span>
          <span className="rounded-[var(--radius-pill)] border border-[var(--accent)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--accent)]">
            admin
          </span>
        </div>

        <nav
          className="flex-1 px-3 pb-4"
          aria-label="Навигация админ-портала"
          role="tablist"
          aria-orientation="vertical"
        >
          {GROUPS.map((group, gi) => (
            <div key={group.label ?? `g${gi}`} className="mb-3">
              {group.label && (
                <p className="px-2 pb-1 pt-2 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    role="tab"
                    id={`admin-tab-${item.id}`}
                    aria-selected={active}
                    aria-controls="main"
                    className={`mb-0.5 flex min-h-9 w-full items-center rounded-[var(--radius-md)] px-3 py-2 text-left text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                      active
                        ? "bg-[var(--muted)] font-medium text-[var(--foreground)]"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-3 pb-4">
          <button
            type="button"
            onClick={logout}
            className="block w-full rounded-[var(--radius-md)] px-3 py-2 text-left text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Выйти
          </button>
        </div>
      </aside>

      {/* Основная колонка */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-3">
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            Платформа{" "}
            <span aria-hidden="true">·</span>{" "}
            <span className="text-[var(--foreground)]">{TITLES[tab]}</span>
          </p>
          <input
            type="search"
            disabled
            placeholder="Поиск по платформе…"
            aria-label="Поиск по платформе"
            className="h-9 w-56 max-w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 text-[length:var(--type-small)] text-[var(--foreground)] disabled:opacity-60"
          />
        </header>

        <main
          id="main"
          tabIndex={-1}
          role="tabpanel"
          aria-labelledby={`admin-tab-${tab}`}
          className="flex-1 p-6 focus:outline-none"
        >
          <h1 className="text-[length:var(--type-h3)]">{TITLES[tab]}</h1>
          <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-6 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            {PANEL_NOTE[tab]}
          </div>
        </main>
      </div>
    </div>
  );
}
