"use client";

// Фильтр-чипы по тегам → ?tag=. Сохраняет активный таб и прочие параметры. «Все» сбрасывает тег.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function FilterChips({ tags, activeTag }: { tags: string[]; activeTag?: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();

  function href(tag?: string): string {
    const p = new URLSearchParams(sp.toString());
    if (tag) p.set("tag", tag);
    else p.delete("tag");
    return `${pathname}?${p.toString()}`;
  }

  if (tags.length === 0) return null;

  const chip = (selected: boolean) =>
    `inline-flex h-9 items-center rounded-[var(--radius-pill)] border px-3 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
      selected
        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
        : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
    }`;

  return (
    <div className="flex flex-wrap gap-2" aria-label="Фильтр по тегам">
      <Link href={href(undefined)} aria-current={!activeTag ? "page" : undefined} scroll={false} className={chip(!activeTag)}>
        Все
      </Link>
      {tags.map((t) => (
        <Link
          key={t}
          href={href(t)}
          aria-current={activeTag === t ? "page" : undefined}
          scroll={false}
          className={chip(activeTag === t)}
        >
          {t}
        </Link>
      ))}
    </div>
  );
}
