// Оглавление блога (Фаза 15, З-26). До неё `/blog/[slug]` молча редиректил на первую главу,
// и у блога не было собственной страницы: ни списка глав, ни точки входа «с начала».
// Режим «Весь блог» (`?mode=whole`) остался как был — оглавление не заменяет его, а добавляется
// третьим представлением: оглавление · одна глава · весь блог подряд.
//
// Контента глав здесь нет (только заголовки и метаданные), поэтому дубликата для поисковика
// страница не создаёт — canonical `/blog/{slug}` остаётся за ней.

import Link from "next/link";
import { CoverImage } from "@/components/reader/cover-image";
import { SkillChips } from "@/components/reader/skill-chips";
import { VerifiedChip, formatVerifiedDate } from "@/components/reader/verified-badge";
import { aggregateBlogTier } from "@/components/reader/blog-reviewer-credit";
import { plural } from "@/lib/plural";
import type { ReadableBlog } from "@/lib/queries/types";
import type { ReactNode } from "react";

export function BlogTocView({
  blog,
  engagementBar,
  reportButton,
}: {
  blog: ReadableBlog;
  engagementBar: ReactNode;
  /** Кнопка «Пожаловаться» (Ф15.4) — гостю не рендерится, поэтому приходит готовым узлом. */
  reportButton?: ReactNode;
}) {
  const chapters = blog.chapters;
  const first = chapters[0];
  const multiChapter = chapters.length > 1;
  // Уровень блога считаем из глав тем же правилом, что и карточка «Блог ревьюили» (independent
  // сильнее invited). Отдельный запрос к `blogs.verified_*` не нужен: это тот же агрегат,
  // а данные глав уже загружены.
  const blogTier = aggregateBlogTier(chapters);
  const blogVerifiedAt = chapters.reduce<number | null>(
    (max, c) => (c.verifiedAt != null && (max === null || c.verifiedAt > max) ? c.verifiedAt : max),
    null,
  );

  return (
    <div className="mx-auto w-full max-w-[var(--max-article)] px-6 py-10">
      <nav
        aria-label="Хлебные крошки"
        className="mb-6 flex flex-wrap items-center gap-1.5 text-[length:var(--type-small)] text-[var(--muted-foreground)]"
      >
        <Link href="/" className="rounded-[var(--radius-sm)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
          Лента
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href={`/u/${blog.author.slug}`}
          className="rounded-[var(--radius-sm)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {blog.author.displayName}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-[var(--foreground)]">{blog.title}</span>
      </nav>

      <header className="mb-8">
        {/* `relative` обязателен: CoverImage рендерит <Image fill>, которому нужен позиционированный
            родитель — иначе Next пишет предупреждение в консоль и картинка «уезжает». */}
        {blog.coverUrl && (
          <div className="relative mb-6 aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
            <CoverImage src={blog.coverUrl} alt={blog.title} />
          </div>
        )}

        <h1 className="text-[length:var(--type-h1)]">{blog.title}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          <span>
            {chapters.length} {plural(chapters.length, "глава", "главы", "глав")}
          </span>
          {blogTier && (
            <>
              <span aria-hidden="true">·</span>
              <VerifiedChip tier={blogTier} size="sm" />
              {blogVerifiedAt && <span>{formatVerifiedDate(blogVerifiedAt)}</span>}
            </>
          )}
        </div>

        {blog.summary && <p className="mt-3 text-[var(--muted-foreground)]">{blog.summary}</p>}

        {blog.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {blog.tags.map((t) => (
              <li
                key={t}
                className="rounded-[var(--radius-pill)] bg-[var(--muted)] px-2 py-0.5 text-[length:var(--type-small)] text-[var(--muted-foreground)]"
              >
                {t}
              </li>
            ))}
          </ul>
        )}

        {engagementBar}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {first && (
            <Link
              href={`/blog/${blog.slug}/${first.slug}`}
              className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-[var(--accent)] px-5 font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              Читать с начала →
            </Link>
          )}
          {multiChapter && (
            <Link
              href={`/blog/${blog.slug}?mode=whole`}
              className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-[var(--border)] px-4 text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Весь блог одной страницей
            </Link>
          )}
          {reportButton}
        </div>
      </header>

      <h2 className="mb-4 text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        Оглавление
      </h2>
      <ol className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {chapters.map((c, i) => (
          <li key={c.id}>
            <Link
              href={`/blog/${blog.slug}/${c.slug}`}
              className="group flex gap-4 px-1 py-4 transition-colors hover:bg-[var(--bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <span className="pt-0.5 text-[length:var(--type-small)] tabular-nums text-[var(--muted-foreground)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              {/* div, а не span: внутри лежит <ul> SkillChips — вложенность span>ul невалидна */}
              <div className="min-w-0 flex-1">
                <span className="block text-[length:var(--type-h4)] transition-colors group-hover:text-[var(--accent)]">
                  {c.title}
                </span>
                {c.summary && (
                  <span className="mt-1 block line-clamp-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                    {c.summary}
                  </span>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {c.verifiedTier && <VerifiedChip tier={c.verifiedTier} size="sm" />}
                  {c.publishedAt && (
                    <span className="text-[0.7rem] text-[var(--muted-foreground)]">
                      {formatVerifiedDate(c.publishedAt)}
                    </span>
                  )}
                  {c.skills.length > 0 && <SkillChips skills={c.skills} />}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
