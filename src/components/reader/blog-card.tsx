// Карточка блога для каталога/закладок/профиля.

import Link from "next/link";
import { CoverImage } from "@/components/reader/cover-image";
import type { BlogCardView } from "@/lib/queries/types";

export function BlogCard({ blog }: { blog: BlogCardView }) {
  const tags = blog.tags.slice(0, 3);
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] transition-colors hover:border-[var(--accent)]">
      <Link
        href={`/blog/${blog.slug}`}
        aria-label={blog.title}
        className="block rounded-t-[var(--radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-[var(--border)]">
          <CoverImage src={blog.coverUrl} alt={blog.title} />
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <li
                key={t}
                className="rounded-[var(--radius-pill)] bg-[var(--muted)] px-2 py-0.5 text-[length:var(--type-small)] text-[var(--muted-foreground)]"
              >
                {t}
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/blog/${blog.slug}`}
          className="rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <h3 className="text-[length:var(--type-h4)]">{blog.title}</h3>
        </Link>
        {blog.summary && (
          <p className="line-clamp-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            {blog.summary}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          <Link
            href={`/u/${blog.author.slug}`}
            className="rounded-[var(--radius-sm)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {blog.author.displayName}
          </Link>
          <span className="tabular-nums">
            {blog.chapterCount > 0 ? `${blog.chapterCount} глав` : null}
            {blog.chapterCount > 0 && blog.rating > 0 ? " · " : null}
            {blog.rating > 0 ? `★ ${blog.rating.toFixed(1)}` : null}
          </span>
        </div>
      </div>
    </article>
  );
}
