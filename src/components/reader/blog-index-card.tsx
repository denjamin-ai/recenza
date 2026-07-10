// Карточка блога главной страницы (прототип feed.jsx BlogIndexCard, ui-feedback-4 П2):
// обложка aspect-video → eyebrow «N глав» → title → summary → автор-lockup с датой → ≤4 тегов.
// Hover: подъём/акцент/зум обложки (паттерн ui-feedback-3 П1). Bookmark-чип прототипа
// не переносим (закладка живёт в ридере; backlog). RSC — без клиентских хуков.

import Link from "next/link";
import { CoverImage } from "@/components/reader/cover-image";
import { IconListLines } from "@/components/icons";
import { plural } from "@/lib/plural";
import type { BlogCardView } from "@/lib/queries/types";

function formatMonthYear(unixSeconds: number | null): string | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toLocaleDateString("ru-RU", { month: "short", year: "numeric" });
}

export function BlogIndexCard({ blog }: { blog: BlogCardView }) {
  const tags = blog.tags.slice(0, 4);
  const published = formatMonthYear(blog.publishedAt);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--foreground)_15%,var(--border))] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      {/* Обложка (или детерминированный градиент-плейсхолдер от slug) */}
      <Link
        href={`/blog/${blog.slug}`}
        aria-label={blog.title}
        tabIndex={-1}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <div className="relative aspect-video w-full overflow-hidden">
          <div className="h-full w-full transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
            <CoverImage src={blog.coverUrl} alt={blog.title} seed={blog.slug} />
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="mb-1.5 inline-flex items-center gap-1.5 text-[0.66rem] font-bold uppercase tracking-wider text-[var(--accent)]">
          <IconListLines className="h-3 w-3" />
          {blog.chapterCount} {plural(blog.chapterCount, "глава", "главы", "глав")}
        </p>

        <Link
          href={`/blog/${blog.slug}`}
          className="rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <h3 className="mb-2 line-clamp-2 font-display text-[19px] font-semibold leading-snug transition-colors group-hover:text-[var(--accent)]">
            {blog.title}
          </h3>
        </Link>

        {blog.summary && (
          <p className="mb-3 line-clamp-3 text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)]">
            {blog.summary}
          </p>
        )}

        <div className="flex-1" />

        {/* Автор-lockup: кружок-инициал + имя + месяц/год первой публикации */}
        <Link
          href={`/u/${blog.author.slug}`}
          className="group/auth -ml-1 mt-2 flex items-center gap-2 rounded-[var(--radius-sm)] px-1 py-1 transition-colors hover:bg-[color-mix(in_srgb,var(--muted)_40%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <span aria-hidden="true" className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--muted)] text-[0.7rem] font-semibold uppercase text-[var(--muted-foreground)]">
            {blog.author.displayName.charAt(0)}
          </span>
          <span className="truncate text-[0.82rem] text-[var(--foreground)] transition-colors group-hover/auth:text-[var(--accent)]">
            {blog.author.displayName}
          </span>
          {published && (
            <span className="shrink-0 text-[0.7rem] tabular-nums text-[var(--muted-foreground)]">· {published}</span>
          )}
        </Link>

        {tags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <li key={t} className="rounded-[var(--radius-pill)] bg-[var(--muted)] px-2 py-0.5 text-[0.72rem] text-[var(--muted-foreground)]">
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
