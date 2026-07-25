// Нижняя панель действий ReviewPage (Фаза 7), завязана на POV (D1, серверная роль).
// Ревьюер: «Нужны правки» / «Одобрить» (только пока ревью открыто).
// Автор: «Опубликовать» / «Отправить v{N+1}».
// ⚠️ Фаза 13: «Опубликовать» больше НЕ требует всех approve — публикация свободна.
// ⚠️ Фаза 14: кнопка «Сменить ведущего» снята вместе с самой ролью; «ревью открыто» считается
// по токену `reviewClosedAt`, а не по оси публикации (ревью опубликованной главы — штатный сценарий).
"use client";

import { isReviewOpen } from "@/lib/review-status";
import type { ReviewStatus, RevisionStatus, Verdict } from "@/types";

export function ActionBar({
  pov,
  status,
  reviewStatus,
  reviewClosedAt,
  reviewerCount,
  openThreadCount,
  allApproved,
  anyChanges,
  myVerdict,
  nextRevision,
  busy,
  onApprove,
  onRequestChanges,
  onSubmitRevision,
  onPublish,
}: {
  pov: "author" | "reviewer";
  status: RevisionStatus;
  reviewStatus: ReviewStatus;
  reviewClosedAt: number | null;
  reviewerCount: number;
  openThreadCount: number;
  allApproved: boolean;
  anyChanges: boolean;
  myVerdict: Verdict | null;
  nextRevision: number;
  busy: boolean;
  onApprove: () => void;
  onRequestChanges: () => void;
  onSubmitRevision: () => void;
  onPublish: () => void;
}) {
  const active = isReviewOpen(reviewStatus, reviewClosedAt);

  return (
    <div className="flex min-h-[60px] items-center gap-2 border-t border-[var(--border)] bg-[var(--background)] px-3 py-2 sm:px-5">
      <div className="hidden min-w-0 flex-1 items-center gap-3 text-[length:var(--type-small)] sm:flex">
        {active ? (
          <>
            <span className="tabular-nums text-[var(--muted-foreground)]">
              {openThreadCount} открытых · {reviewerCount} реценз.
            </span>
            {allApproved && <span className="font-medium text-[var(--success)]">все одобрили</span>}
            {anyChanges && !allApproved && <span className="font-medium text-[var(--warning)]">есть запрос правок</span>}
          </>
        ) : (
          <span className="text-[var(--muted-foreground)]">
            {status === "published" ? "Глава опубликована." : "Глава не на ревью."}
          </span>
        )}
      </div>

      {pov === "author" ? (
        <>
          {/* Фаза 13: публикация свободна — кнопка доступна автору всегда, пока версия не опубликована. */}
          {status !== "published" && (
            <button
              type="button"
              onClick={onPublish}
              disabled={busy}
              className="inline-flex min-h-9 items-center whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--success)] px-3 font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              Опубликовать
            </button>
          )}
          {active && (
            <button
              type="button"
              onClick={onSubmitRevision}
              disabled={busy}
              title="Отправить новую ревизию на повторное ревью"
              className="inline-flex min-h-9 items-center whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              Отправить v{nextRevision}
            </button>
          )}
        </>
      ) : active ? (
        <>
          <button
            type="button"
            onClick={onRequestChanges}
            disabled={busy}
            className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-[var(--radius-sm)] border px-3 font-medium disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              myVerdict === "request-changes"
                ? "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]"
                : "border-[var(--border)] text-[var(--warning)] hover:bg-[var(--warning-bg)]"
            }`}
          >
            Нужны правки
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-[var(--radius-sm)] px-3 font-medium disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
              myVerdict === "approve"
                ? "bg-[var(--success)] text-[var(--accent-foreground)]"
                : "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)] hover:opacity-90"
            }`}
          >
            Одобрить
          </button>
        </>
      ) : (
        <span className="text-[length:var(--type-small)] italic text-[var(--muted-foreground)]">
          Голосование закрыто.
        </span>
      )}
    </div>
  );
}
