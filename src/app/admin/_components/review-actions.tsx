"use client";

// Действия админа над главой в ревью (Фаза 10): force-approve (обход гейта all-approve),
// разбор запроса смены ведущего (approve/reject), снятие ревьюера (+ причина).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminMutate } from "@/app/admin/_components/client";
import type { AdminReviewReviewer } from "@/lib/queries/admin";

export function ReviewActions(props: {
  chapterId: string;
  reviewers: AdminReviewReviewer[];
  pendingPrimaryChange: { id: string; fromHandle: string; toHandle: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmForce, setConfirmForce] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function run(action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Не удалось.");
        return;
      }
      after?.();
      router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-3 border-t border-[var(--border-secondary)] pt-3">
      {error && (
        <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]">
          {error}
        </p>
      )}

      {props.pendingPrimaryChange && (
        <div className="rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3">
          <p className="mb-2 text-[length:var(--type-small)] text-[var(--warning)]">
            Запрос смены ведущего: @{props.pendingPrimaryChange.fromHandle} → @{props.pendingPrimaryChange.toHandle}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => adminMutate(`/api/admin/review/${props.chapterId}/primary`, "POST", { action: "approve", requestId: props.pendingPrimaryChange!.id }))}
              className="min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
            >
              Утвердить смену
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => adminMutate(`/api/admin/review/${props.chapterId}/primary`, "POST", { action: "reject", requestId: props.pendingPrimaryChange!.id }))}
              className="min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
            >
              Отклонить
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!confirmForce ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmForce(true)}
            className="min-h-9 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--warning)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
          >
            Force-approve (опубликовать)
          </button>
        ) : (
          <span className="flex items-center gap-2">
            <span className="text-[length:var(--type-small)] text-[var(--foreground)]">Опубликовать в обход гейта?</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => adminMutate(`/api/admin/review/${props.chapterId}/force-approve`, "POST"), () => setConfirmForce(false))}
              className="min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
            >
              Да, опубликовать
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmForce(false)}
              className="min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Отмена
            </button>
          </span>
        )}
      </div>

      {props.reviewers.length > 0 && (
        <div>
          <p className="mb-1.5 text-[0.7rem] uppercase tracking-wider text-[var(--muted-foreground)]">Ревьюеры</p>
          <ul className="space-y-1.5">
            {props.reviewers.map((rv) => (
              <li key={rv.handle} className="flex flex-wrap items-center gap-2 text-[length:var(--type-small)]">
                <span className="text-[var(--foreground)]">{rv.displayName}</span>
                {rv.isPrimary && <span className="text-[0.7rem] text-[var(--accent)]">ведущий</span>}
                {rv.approved && <span className="text-[0.7rem] text-[var(--success)]">approve</span>}
                {removing === rv.handle ? (
                  <span className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Причина (необяз.)"
                      aria-label="Причина снятия"
                      className="h-8 w-44 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2 text-[0.8rem] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    />
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => adminMutate(`/api/admin/review/${props.chapterId}/remove-reviewer`, "POST", { handle: rv.handle, reason: reason || undefined }),
                          () => {
                            setRemoving(null);
                            setReason("");
                          },
                        )
                      }
                      className="min-h-8 rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-2 py-1 text-[0.8rem] text-[var(--danger)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
                    >
                      Снять
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRemoving(null); setReason(""); }}
                      className="min-h-8 rounded-[var(--radius-md)] px-2 py-1 text-[0.8rem] text-[var(--muted-foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      Отмена
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => { setRemoving(rv.handle); setReason(""); }}
                    className="text-[0.7rem] text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--danger)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    снять
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
