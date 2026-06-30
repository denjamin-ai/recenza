// Нижняя панель действий ReviewPage (Фаза 7), завязана на POV (D1, серверная роль).
// Ревьюер: «Нужны правки» / «Одобрить» (только активный статус). Автор: «Сменить ведущего» /
// «Опубликовать» (при всех approve) / «Отправить v{N+1}».
"use client";

import type { RevisionStatus, Verdict } from "@/types";

export function ActionBar({
  pov,
  status,
  reviewerCount,
  openThreadCount,
  allApproved,
  anyChanges,
  myVerdict,
  nextRevision,
  canChangePrimary,
  busy,
  onApprove,
  onRequestChanges,
  onSubmitRevision,
  onPublish,
  onRequestPrimaryChange,
}: {
  pov: "author" | "reviewer";
  status: RevisionStatus;
  reviewerCount: number;
  openThreadCount: number;
  allApproved: boolean;
  anyChanges: boolean;
  myVerdict: Verdict | null;
  nextRevision: number;
  canChangePrimary: boolean;
  busy: boolean;
  onApprove: () => void;
  onRequestChanges: () => void;
  onSubmitRevision: () => void;
  onPublish: () => void;
  onRequestPrimaryChange: () => void;
}) {
  const active = status === "under-review" || status === "changes-requested";

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
          <button
            type="button"
            onClick={onRequestPrimaryChange}
            disabled={!canChangePrimary || busy}
            className="hidden min-h-9 items-center px-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--foreground)] hover:underline disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:inline-flex"
          >
            Сменить ведущего
          </button>
          {allApproved && active && (
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
