// Агрегированный кредит ревьюеров режима «Весь блог» (ui-feedback-4 П8, прототип reader.jsx
// BlogReviewerCredit): ОДНА карточка на блог вместо «Эту версию проверяли» после каждой главы.
// Текущие ревьюеры всех глав — чипами («ведущий», если ведёт хотя бы одну главу); все, кто
// участвовал ранее, — за раскрытием. БЕЗ нового запроса: чистая агрегация section.credit (RSC).

import Link from "next/link";
import type { ReviewerChip } from "@/lib/queries/reviewer-credit";
import type { ReaderSection } from "@/lib/queries/types";

export interface BlogCredit {
  current: ReviewerChip[];
  past: ReviewerChip[]; // участвовали в прошлых версиях и не входят в current
}

/** Чистая агрегация кредитов глав: дедуп по handle, primary — если ведущий хоть в одной главе. */
export function aggregateBlogCredit(sections: ReaderSection[]): BlogCredit {
  const current = new Map<string, ReviewerChip>();
  for (const s of sections) {
    for (const chip of s.credit.current) {
      const prev = current.get(chip.handle);
      if (prev) prev.isPrimary = prev.isPrimary || chip.isPrimary;
      else current.set(chip.handle, { ...chip });
    }
  }
  const past = new Map<string, ReviewerChip>();
  for (const s of sections) {
    for (const group of s.credit.past) {
      for (const chip of group.reviewers) {
        if (current.has(chip.handle) || past.has(chip.handle)) continue;
        past.set(chip.handle, { ...chip, isPrimary: false });
      }
    }
  }
  return { current: [...current.values()], past: [...past.values()] };
}

function Chip({ chip }: { chip: ReviewerChip }) {
  return (
    <li>
      <Link
        href={`/u/${chip.slug}`}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
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

export function BlogReviewerCredit({ sections }: { sections: ReaderSection[] }) {
  const credit = aggregateBlogCredit(sections);
  if (credit.current.length === 0 && credit.past.length === 0) return null;

  return (
    <section
      aria-label="Ревьюеры блога"
      className="mt-12 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4"
    >
      <h2 className="text-[length:var(--type-h4)]">Блог ревьюили</h2>
      {credit.current.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {credit.current.map((c) => (
            <Chip key={c.handle} chip={c} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Для текущих версий ревьюеры не указаны.
        </p>
      )}

      {credit.past.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[length:var(--type-small)] text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
            Все, кто участвовал в ревью · ещё {credit.past.length}
          </summary>
          <ul className="mt-3 flex flex-wrap gap-2 border-l border-[var(--border)] pl-3">
            {credit.past.map((c) => (
              <Chip key={c.handle} chip={c} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
