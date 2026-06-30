// Кабинет ревьюера (Фаза 7 → 9): плитки + входящие приглашения + список активных ревью.
// Приглашения — InvitationCard (accept/decline/flag); активные ревью ведут на /reviewer/review/[id].

import Link from "next/link";
import type { ReviewerQueueItem } from "@/lib/queries/review";
import type { ReviewerInvitationItem } from "@/lib/queries/invitations";
import type { RevisionStatus } from "@/types";
import { InvitationCard } from "./invitation-card";

const STATUS_META: Partial<Record<RevisionStatus, { label: string; cls: string }>> = {
  "under-review": { label: "На ревью", cls: "bg-[var(--info-bg)] text-[var(--info)]" },
  "changes-requested": { label: "Нужны правки", cls: "bg-[var(--warning-bg)] text-[var(--warning)]" },
};

export function ReviewerInboxShell({
  displayName,
  queue,
  invitations,
  rating,
  ratingsN,
}: {
  displayName: string;
  queue: ReviewerQueueItem[];
  invitations: ReviewerInvitationItem[];
  rating: number | null;
  ratingsN: number;
}) {
  const awaitingMe = queue.filter((q) => q.myVerdict === null).length;
  const tiles = [
    { label: "Приглашения", value: String(invitations.length) },
    { label: "Ваш ход", value: String(awaitingMe) },
    { label: "Активные ревью", value: String(queue.length) },
    { label: "Ваш рейтинг", value: rating != null ? `${rating.toFixed(1)} (${ratingsN})` : "—" },
  ];

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <header>
        <h1>Кабинет ревьюера</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">{displayName} · Приглашения и ревью</p>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4"
          >
            <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">{t.label}</p>
            <p className="mt-1 font-display text-[length:var(--type-h3)] text-[var(--foreground)]">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-4">
        <section className="rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-5">
          <h2 className="text-[length:var(--type-h4)]">Входящие приглашения</h2>
          {invitations.length === 0 ? (
            <p className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
              Новых приглашений нет.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {invitations.map((inv) => (
                <InvitationCard key={inv.id} invitation={inv} />
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-5">
          <h2 className="text-[length:var(--type-h4)]">Активные ревью</h2>
          {queue.length === 0 ? (
            <p className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
              Сейчас на вас не назначено активных ревью.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {queue.map((q) => {
                const meta = STATUS_META[q.status];
                return (
                  <li key={q.chapterId}>
                    <Link
                      href={`/reviewer/review/${q.chapterId}`}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] p-3 transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{q.chapterTitle}</span>
                        <span className="block truncate text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                          {q.blogTitle}
                          {q.isPrimary ? " · вы ведущий" : ""}
                          {q.openThreadCount > 0 ? ` · ${q.openThreadCount} открытых` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {q.myVerdict === "approve" && (
                          <span className="rounded-[var(--radius-sm)] bg-[var(--success-bg)] px-1.5 py-0.5 text-[length:var(--type-small)] font-semibold uppercase tracking-wider text-[var(--success)]">
                            одобрено
                          </span>
                        )}
                        {q.myVerdict === null && (
                          <span className="rounded-[var(--radius-sm)] bg-[var(--muted)] px-1.5 py-0.5 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                            ваш ход
                          </span>
                        )}
                        {meta && (
                          <span className={`rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[length:var(--type-small)] font-semibold uppercase tracking-wider ${meta.cls}`}>
                            {meta.label}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
