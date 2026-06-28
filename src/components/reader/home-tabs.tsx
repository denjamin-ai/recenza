"use client";

// Табы главной: Лента / Каталог / Подписки → ?tab=. Прочие параметры (tag/complexity) сохраняются.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { key: "feed", label: "Лента" },
  { key: "catalog", label: "Каталог" },
  { key: "subscriptions", label: "Подписки" },
] as const;

export function HomeTabs({ active }: { active: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();

  function href(tab: string): string {
    const p = new URLSearchParams(sp.toString());
    p.set("tab", tab);
    return `${pathname}?${p.toString()}`;
  }

  // Навигационные табы (меняют ?tab= = переход), поэтому семантика nav + aria-current,
  // а не ARIA-виджет tablist/tab (тот подразумевает tabpanel + стрелочную навигацию).
  return (
    <nav aria-label="Разделы ленты" className="flex gap-1 border-b border-[var(--border)]">
      {TABS.map((t) => {
        const selected = active === t.key;
        return (
          <Link
            key={t.key}
            aria-current={selected ? "page" : undefined}
            href={href(t.key)}
            scroll={false}
            className={`-mb-px inline-flex h-10 items-center border-b-2 px-3 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              selected
                ? "border-[var(--accent)] font-medium text-[var(--foreground)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
