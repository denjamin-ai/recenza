// Карточка ленты: одна глава (последняя публикация) — блог · заголовок · автор · дата · навыки.

import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { FeedItemView } from "@/lib/queries/types";

export function ChapterFeedCard({ item }: { item: FeedItemView }) {
  const skills = item.skills.slice(0, 4);
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4 transition-colors hover:border-[var(--accent)]">
      <Link
        href={`/blog/${item.blogSlug}/${item.chapterSlug}`}
        className="block rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">{item.blogTitle}</p>
        <h3 className="mt-1 text-[length:var(--type-h4)]">{item.chapterTitle}</h3>
      </Link>
      {item.summary && (
        <p className="mt-2 line-clamp-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          {item.summary}
        </p>
      )}
      {skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <li
              key={s}
              className="rounded-[var(--radius-pill)] border border-[var(--accent)] px-2 py-0.5 text-[length:var(--type-small)] text-[var(--accent)]"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between text-[length:var(--type-small)] text-[var(--muted-foreground)]">
        <Link
          href={`/u/${item.author.slug}`}
          className="rounded-[var(--radius-sm)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {item.author.displayName}
        </Link>
        {item.publishedAt && <time>{formatDate(item.publishedAt)}</time>}
      </div>
    </article>
  );
}
