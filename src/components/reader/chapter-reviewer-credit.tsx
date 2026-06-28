// Кредит ревьюеров в конце главы: текущая версия чипами + прошлые версии за раскрытием (<details>, RSC).

import Link from "next/link";
import type { ChapterReviewerCredit as Credit, ReviewerChip } from "@/lib/queries/reviewer-credit";

function Chip({ chip }: { chip: ReviewerChip }) {
  return (
    <li>
      <Link
        href={`/u/${chip.slug}`}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 py-1 text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <span>{chip.displayName}</span>
        {chip.isPrimary && (
          <span className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-1.5 text-[11px] font-medium text-[var(--accent-foreground)]">
            ведущий
          </span>
        )}
      </Link>
    </li>
  );
}

export function ChapterReviewerCredit({ credit }: { credit: Credit }) {
  if (credit.current.length === 0 && credit.past.length === 0) return null;

  return (
    <section
      aria-label="Ревьюеры главы"
      className="mt-10 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4"
    >
      <h2 className="text-[length:var(--type-h4)]">Эту версию проверяли</h2>
      {credit.current.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {credit.current.map((c) => (
            <Chip key={c.handle} chip={c} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Для текущей версии ревьюеры не указаны.
        </p>
      )}

      {credit.past.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[length:var(--type-small)] text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
            Прошлые версии
          </summary>
          <div className="mt-3 space-y-3">
            {credit.past.map((group) => (
              <div key={group.revision}>
                <p className="mb-1.5 text-[length:var(--type-small)] font-medium text-[var(--muted-foreground)]">
                  к версии v{group.revision}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {group.reviewers.map((c) => (
                    <Chip key={c.handle} chip={c} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
