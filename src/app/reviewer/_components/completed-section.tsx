// Таб «Завершённые» (Фаза 14.6) — опубликованные главы, где ревьюер числится в кредите
// (`reviewer_history`), сгруппированные по блогам. Кредит выдаётся только за `approve`
// (CLAUDE.md §Две оси состояния), поэтому это витрина реально проверенного.
//
// Бейдж уровня здесь — ЛОКАЛЬНЫЙ минимальный чип на токенах: общий компонент бейджа делает
// параллельная подфаза, дублировать его импортом нельзя (разъедутся тексты).

import Link from "next/link";
import type { CompletedReviewGroup } from "@/lib/queries/review";
import type { VerifiedTier } from "@/types";
import { plural } from "@/lib/plural";

const TIER_LABEL: Record<VerifiedTier, string> = {
  independent: "Проверено на Recenza",
  invited: "Проверено приглашённым экспертом",
};

function TierChip({ tier }: { tier: VerifiedTier }) {
  return (
    <span
      className={`shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 text-[length:var(--type-small)] ${
        tier === "independent"
          ? "bg-[var(--success-bg)] text-[var(--success)]"
          : "bg-[var(--muted)] text-[var(--muted-foreground)]"
      }`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

export function CompletedSection({ groups }: { groups: CompletedReviewGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-6">
        <p className="text-[var(--muted-foreground)]">Завершённых ревью пока нет.</p>
        <p className="mt-1 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Глава попадает сюда, когда вы одобрили её, а автор опубликовал.
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
            <h2 className="text-[length:var(--type-h4)]">
              <Link
                href={`/blog/${g.blogSlug}`}
                className="underline-offset-2 hover:text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {g.blogTitle}
              </Link>
            </h2>
            <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
              {g.chapters.length} {plural(g.chapters.length, "глава", "главы", "глав")}
            </p>
          </header>

          <ul className="mt-4 flex flex-col gap-2">
            {g.chapters.map((c) => (
              <li key={c.chapterSlug}>
                <Link
                  href={`/blog/${g.blogSlug}/${c.chapterSlug}`}
                  className="flex min-h-9 flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] p-3 transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.chapterTitle}</span>
                    <span className="block text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                      версия {c.revisionNumber}
                    </span>
                  </span>
                  {c.verifiedTier && <TierChip tier={c.verifiedTier} />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
