// Профиль ревьюера: компетенции + (агрегатный) рейтинг + «что отрецензировал».

import Link from "next/link";
import type { ProfileUser, ReviewedChapterView } from "@/lib/queries/profile";

export function ReviewerProfile({
  user,
  reviewed,
}: {
  user: ProfileUser;
  reviewed: ReviewedChapterView[];
}) {
  return (
    <div className="space-y-12">
      <section aria-label="Компетенции и рейтинг">
        <div className="flex flex-wrap items-center gap-4">
          {user.reviewerRating != null && (
            <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
              ★ {user.reviewerRating.toFixed(1)}
              {user.reviewerRatingsN ? ` · ${user.reviewerRatingsN} оценок` : ""}
            </span>
          )}
        </div>
        {user.competencies.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {user.competencies.map((c) => (
              <li
                key={c}
                className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 py-0.5 text-[length:var(--type-small)] text-[var(--foreground)]"
              >
                {c}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Отрецензированные главы">
        <h2 className="text-[length:var(--type-h3)]">Отрецензировал</h2>
        {reviewed.length > 0 ? (
          <ul className="mt-4 divide-y divide-[var(--border-secondary)] rounded-[var(--radius-lg)] border border-[var(--border)]">
            {reviewed.map((r) => (
              <li key={`${r.blogSlug}/${r.chapterSlug}`}>
                <Link
                  href={`/blog/${r.blogSlug}/${r.chapterSlug}`}
                  className="block px-4 py-3 transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <span className="block text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                    {r.blogTitle}
                  </span>
                  <span className="block text-[var(--foreground)]">{r.chapterTitle}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[var(--muted-foreground)]">Пока нет отрецензированных публичных глав.</p>
        )}
      </section>
    </div>
  );
}
