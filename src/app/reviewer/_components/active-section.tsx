// Таб «Мои ревью» (Фаза 14.6) — взятое в работу, СГРУППИРОВАННОЕ ПО БЛОГАМ (требование владельца:
// ревьюер ведёт блог целиком, а не россыпь глав). Подписи статусов — только из review-status.ts,
// локальных словарей заводить нельзя (CLAUDE.md §Две оси состояния).

import Link from "next/link";
import type { ActiveReviewGroup } from "@/lib/queries/review";
import { reviewMeta } from "@/lib/review-status";
import { reviewerReviewHref } from "@/lib/review-links";
import { plural } from "@/lib/plural";

export function ActiveSection({ groups }: { groups: ActiveReviewGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-6">
        <p className="text-[var(--muted-foreground)]">Вы пока не взяли ни одной заявки.</p>
        <p className="mt-1 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Загляните в «Очередь» — там ждут главы, которым нужен ревьюер.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section
          key={g.blogSlug}
          className="rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-5"
        >
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[length:var(--type-h4)]">{g.blogTitle}</h2>
            <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
              {g.authorName} · {g.items.length} {plural(g.items.length, "глава", "главы", "глав")}
            </p>
          </header>

          <ul className="mt-4 flex flex-col gap-2">
            {g.items.map((it) => {
              const meta = reviewMeta(it.reviewStatus);
              return (
                <li key={it.chapterId}>
                  <Link
                    href={reviewerReviewHref(it.chapterId)}
                    className="flex min-h-9 flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] p-3 transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{it.chapterTitle}</span>
                      <span className="block truncate text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                        версия {it.revisionNumber}
                        {it.openThreadCount > 0
                          ? ` · ${it.openThreadCount} ${plural(it.openThreadCount, "открытый тред", "открытых треда", "открытых тредов")}`
                          : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {it.myVerdict === null ? (
                        <span className="rounded-[var(--radius-sm)] bg-[var(--warning-bg)] px-1.5 py-0.5 text-[length:var(--type-small)] font-semibold uppercase tracking-wider text-[var(--warning)]">
                          ваш ход
                        </span>
                      ) : (
                        <span
                          className={`rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[length:var(--type-small)] ${
                            it.myVerdict === "approve"
                              ? "bg-[var(--success-bg)] text-[var(--success)]"
                              : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                          }`}
                        >
                          {it.myVerdict === "approve" ? "вы одобрили" : "вы просили правки"}
                        </span>
                      )}
                      {meta && (
                        <span
                          className={`rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[length:var(--type-small)] font-semibold uppercase tracking-wider ${meta.cls}`}
                        >
                          {meta.label}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
