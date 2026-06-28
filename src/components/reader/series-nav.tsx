"use client";

// Правый рельс ридера: список глав блога + вложенный ToC активной главы (scroll-spy через
// IntersectionObserver). Одна глава → только ToC (CLAUDE.md/README §3). Якоря заголовков —
// те же id, что ставит BlockRenderer (blockAnchorId), ToC и заголовок из одного источника.

import { useEffect, useState } from "react";
import Link from "next/link";

export interface ChapterLink {
  slug: string;
  title: string;
  href: string;
  active: boolean;
}

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function SeriesNav({
  chapterLinks,
  headings,
}: {
  chapterLinks: ChapterLink[];
  headings: TocHeading[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;
    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  const showChapters = chapterLinks.length > 1;

  return (
    <nav aria-label="Навигация по блогу" className="flex flex-col gap-6 text-[length:var(--type-small)]">
      {showChapters && (
        <div>
          <p className="mb-2 font-medium text-[var(--muted-foreground)]">Главы</p>
          <ul className="space-y-0.5">
            {chapterLinks.map((c) => (
              <li key={c.slug}>
                <Link
                  href={c.href}
                  aria-current={c.active ? "page" : undefined}
                  className={`block rounded-[var(--radius-sm)] px-2 py-1 transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    c.active ? "font-medium text-[var(--accent)]" : "text-[var(--foreground)]"
                  }`}
                >
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {headings.length > 0 && (
        <div>
          <p className="mb-2 font-medium text-[var(--muted-foreground)]">Содержание</p>
          <ul className="space-y-0.5">
            {headings.map((h) => (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  aria-current={activeId === h.id ? "location" : undefined}
                  className={`block rounded-[var(--radius-sm)] px-2 py-1 transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    h.level === 3 ? "pl-4" : ""
                  } ${activeId === h.id ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
