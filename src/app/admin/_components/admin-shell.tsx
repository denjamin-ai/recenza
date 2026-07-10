"use client";

// Каркас админ-портала (Фаза 10, rework §11.8). FULLSCREEN: шапка сайта не рендерится (admin layout
// не использует AppFrame). Сгруппированный сайдбар (Модерация/Люди/Платформа) с единым icon-set,
// топбар с крошкой + поиском по пользователям. Экраны — RSC route-сегменты (children); сайдбар —
// навигация <Link> с aria-current (паттерн Фазы 5: nav+aria-current, не tablist).

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  IconGauge,
  IconFlag,
  IconEdit,
  IconUserPlus,
  IconUsers,
  IconImage,
  IconHeart,
  IconListLines,
  IconSearch,
} from "@/components/icons";

type NavItem = { href: string; label: string; Icon: (p: { className?: string }) => ReactNode };
const GROUPS: { label: string | null; items: NavItem[] }[] = [
  { label: null, items: [{ href: "/admin/dashboard", label: "Сводка", Icon: IconGauge }] },
  {
    label: "Модерация",
    items: [
      { href: "/admin/reports", label: "Жалобы", Icon: IconFlag },
      { href: "/admin/review", label: "Ревью глав", Icon: IconEdit },
      { href: "/admin/recruit", label: "Заявки ревьюеров", Icon: IconUserPlus },
    ],
  },
  { label: "Люди", items: [{ href: "/admin/users", label: "Пользователи", Icon: IconUsers }] },
  {
    label: "Платформа",
    items: [
      // «Доска ревьюеров» — вакансии публичной доски /board (ui-feedback-6 П5).
      { href: "/admin/board", label: "Доска ревьюеров", Icon: IconListLines },
      { href: "/admin/banners", label: "Баннеры", Icon: IconImage },
      { href: "/admin/donation", label: "Пожертвования", Icon: IconHeart },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin/dashboard") return pathname === href || pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");

  const active = ALL_ITEMS.find((i) => isActive(pathname, i.href));
  const title = active?.label ?? "Платформа";

  function search(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/admin/users?q=${encodeURIComponent(term)}` : "/admin/users");
  }

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
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-[var(--bg-elevated)] focus:px-4 focus:py-2 focus:ring-2 focus:ring-[var(--accent)]"
      >
        К содержимому
      </a>

      <aside className="flex shrink-0 flex-col border-b border-[var(--border)] bg-[var(--bg-elevated)] md:w-56 md:border-b-0 md:border-r">
        <div className="flex items-baseline gap-2 px-5 py-4">
          <span className="font-display text-[length:var(--type-h4)] font-bold text-[var(--foreground)]">Recenza</span>
          <span className="rounded-[var(--radius-pill)] border border-[var(--accent)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--accent)]">
            admin
          </span>
        </div>

        <nav className="flex-1 px-3 pb-4" aria-label="Навигация админ-портала">
          {GROUPS.map((group, gi) => (
            <div key={group.label ?? `g${gi}`} className="mb-3">
              {group.label && (
                <p className="px-2 pb-1 pt-2 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{group.label}</p>
              )}
              {group.items.map((item) => {
                const act = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={act ? "page" : undefined}
                    className={`mb-0.5 flex min-h-9 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-left text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                      act
                        ? "bg-[var(--muted)] font-medium text-[var(--foreground)]"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <item.Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
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
            Выйти к блогу
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-6 py-3">
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            Платформа <span aria-hidden="true">·</span>{" "}
            <span className="text-[var(--foreground)]">{title}</span>
          </p>
          <form onSubmit={search} className="relative">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск пользователя…"
              aria-label="Поиск пользователя по нику или имени"
              className="h-9 w-56 max-w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] pl-8 pr-3 text-[length:var(--type-small)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />
          </form>
        </header>

        <main id="admin-main" tabIndex={-1} className="flex-1 p-6 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
