// Переходы «Предыдущая / Следующая глава» под текстом главы (Фаза 15, З-23 + замечание владельца №1).
// До неё перехода между главами не было вообще: единственными путями оставались правый рельс
// SeriesNav (только на lg+), мобильный <details> и крошки.
//
// Данные берутся из уже загруженного `blog.chapters` — новых запросов ноль.
// ⚠️ Ссылки всегда канонические (`/blog/{blog}/{chapter}`), даже когда читатель пришёл из
// архивного режима `?v=N`: соседняя глава архивной версии не имеет, и уводить в `?v=` нельзя.

import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";

export interface ChapterPagerItem {
  slug: string;
  title: string;
  href: string;
}

const tile =
  "group flex min-h-[44px] flex-1 flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--border)] px-4 py-3 transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
const eyebrow =
  "flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]";

export function ChapterPager({
  prev,
  next,
}: {
  prev: ChapterPagerItem | null;
  next: ChapterPagerItem | null;
}) {
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Навигация по главам"
      className="mt-10 flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row"
    >
      {prev ? (
        <Link href={prev.href} rel="prev" className={tile}>
          <span className={eyebrow}>
            <IconChevronLeft className="h-3.5 w-3.5" />
            Предыдущая глава
          </span>
          <span className="text-[var(--foreground)] transition-colors group-hover:text-[var(--accent)]">
            {prev.title}
          </span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" aria-hidden="true" />
      )}

      {next ? (
        <Link href={next.href} rel="next" className={`${tile} sm:text-right`}>
          <span className={`${eyebrow} sm:justify-end`}>
            Следующая глава
            <IconChevronRight className="h-3.5 w-3.5" />
          </span>
          <span className="text-[var(--foreground)] transition-colors group-hover:text-[var(--accent)]">
            {next.title}
          </span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" aria-hidden="true" />
      )}
    </nav>
  );
}
