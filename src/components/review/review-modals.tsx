// Модалки ReviewPage (Фаза 7): PrimaryChangeModal (запрос смены ведущего → админу) и TeamSheet
// (команда ревью с вердиктами; на мобиле). Фаза 12: PublishModal (сейчас / отложенно).
// Паттерн — как SubmitSheet/settings-popover: overlay-токен, role=dialog/aria-modal, Escape, autofocus.
"use client";

import { useEffect, useRef, useState } from "react";
import type { ReviewReviewer } from "@/lib/queries/review";
import { Avatar } from "./review-primitives";

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
}

export function PrimaryChangeModal({
  reviewers,
  primaryHandle,
  busy,
  onClose,
  onSubmit,
}: {
  reviewers: ReviewReviewer[];
  primaryHandle: string | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (toHandle: string, reason: string) => void;
}) {
  const others = reviewers.filter((r) => r.handle !== primaryHandle);
  const [proposed, setProposed] = useState(others[0]?.handle ?? "");
  const [reason, setReason] = useState("");
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEscape(onClose);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Сменить ведущего ревьюера"
        className="w-full max-w-[440px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="text-[length:var(--type-h3)]">Сменить ведущего ревьюера</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="min-h-9 px-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Запрос уйдёт админу. До его решения ведущим остаётся @{primaryHandle}.
        </p>

        {others.length === 0 ? (
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            Нет других ревьюеров для назначения ведущим.
          </p>
        ) : (
          <>
            <p className="mb-1.5 text-[length:var(--type-small)] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Новый ведущий
            </p>
            <div className="mb-4 space-y-1.5">
              {others.map((r) => {
                const sel = proposed === r.handle;
                return (
                  <label
                    key={r.handle}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] border px-2.5 py-2 ${
                      sel ? "border-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--accent)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="proposed-primary"
                      value={r.handle}
                      checked={sel}
                      onChange={() => setProposed(r.handle)}
                      className="accent-[var(--accent)]"
                    />
                    <Avatar handle={r.handle} name={r.displayName} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[length:var(--type-body)] font-medium leading-tight">{r.displayName}</span>
                      <span className="block text-[length:var(--type-small)] text-[var(--muted-foreground)]">@{r.handle}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <label className="mb-1.5 block text-[length:var(--type-small)] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Причина
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Например: текущий ведущий недоступен."
              className="mb-4 w-full resize-none rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 py-2 text-[length:var(--type-body)] focus:border-[var(--accent)] focus:outline-none"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 text-[length:var(--type-body)] font-medium hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => onSubmit(proposed, reason)}
                disabled={!proposed || !reason.trim() || busy}
                className="min-h-9 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 text-[length:var(--type-body)] font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              >
                Отправить запрос
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Локальное время → Unix seconds (datetime-local отдаёт строку без зоны — трактуем как локальную). */
function localInputToUnix(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export function PublishModal({
  chapterTitle,
  scheduledAt,
  busy,
  onClose,
  onPublishNow,
  onSchedule,
  onCancelSchedule,
}: {
  chapterTitle: string;
  scheduledAt: number | null;
  busy: boolean;
  onClose: () => void;
  onPublishNow: () => void;
  onSchedule: (unixSeconds: number) => void;
  onCancelSchedule: () => void;
}) {
  const [when, setWhen] = useState("");
  // «now» фиксируем на открытии модалки (lint react-hooks/purity: Date.now в рендере нельзя);
  // это лишь UX-подсказка — сервер валидирует «в будущем» заново на своём времени.
  const [openedAt] = useState(() => Math.floor(Date.now() / 1000));
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEscape(onClose);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const whenUnix = localInputToUnix(when);
  const whenValid = whenUnix !== null && whenUnix > openedAt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Публикация главы"
        className="w-full max-w-[440px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="text-[length:var(--type-h3)]">Публикация главы</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="min-h-9 px-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-[length:var(--type-small)] text-[var(--muted-foreground)] [text-wrap:pretty]">
          «{chapterTitle}» одобрена всеми ревьюерами. Опубликуйте сейчас или запланируйте время —
          отложенную публикацию выполнит планировщик (одобрения перепроверяются в момент публикации).
        </p>

        {scheduledAt !== null && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--accent)] px-3 py-2 text-[length:var(--type-small)]">
            <span>
              Запланирована на{" "}
              <time dateTime={new Date(scheduledAt * 1000).toISOString()} className="font-medium">
                {new Date(scheduledAt * 1000).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
              </time>
            </span>
            <button
              type="button"
              onClick={onCancelSchedule}
              disabled={busy}
              className="shrink-0 text-[var(--danger)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50"
            >
              Отменить
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onPublishNow}
          disabled={busy}
          className="mb-4 w-full min-h-10 rounded-[var(--radius-sm)] bg-[var(--success)] px-3 font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          Опубликовать сейчас
        </button>

        <label className="mb-1.5 block text-[length:var(--type-small)] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Или запланировать
        </label>
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            aria-label="Дата и время публикации"
            className="min-h-9 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[length:var(--type-body)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => whenUnix !== null && onSchedule(whenUnix)}
            disabled={!whenValid || busy}
            className="min-h-9 shrink-0 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            Запланировать
          </button>
        </div>
        {when && !whenValid && (
          <p className="mt-1.5 text-[length:var(--type-small)] text-[var(--danger)]">Время должно быть в будущем.</p>
        )}
      </div>
    </div>
  );
}

const VERDICT_BADGE: Record<string, { label: string; cls: string }> = {
  approve: { label: "одобрил", cls: "bg-[var(--success-bg)] text-[var(--success)]" },
  "request-changes": { label: "правки", cls: "bg-[var(--warning-bg)] text-[var(--warning)]" },
};

export function TeamSheet({
  reviewers,
  primaryHandle,
  pov,
  onClose,
  onRequestPrimaryChange,
}: {
  reviewers: ReviewReviewer[];
  primaryHandle: string | null;
  pov: "author" | "reviewer";
  onClose: () => void;
  onRequestPrimaryChange: () => void;
}) {
  useEscape(onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--overlay)] p-3 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Команда ревью"
        className="w-full max-w-[440px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[length:var(--type-h3)]">Команда ревью</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="min-h-9 px-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            ✕
          </button>
        </div>
        <ul className="space-y-1.5">
          {reviewers.map((r) => {
            const badge = r.verdict ? VERDICT_BADGE[r.verdict] : null;
            return (
              <li key={r.handle} className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] p-2">
                <Avatar handle={r.handle} name={r.displayName} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[length:var(--type-body)] font-medium">{r.displayName}</p>
                  <p className="truncate text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                    @{r.handle}
                    {r.handle === primaryHandle ? " · ведущий" : ""}
                  </p>
                </div>
                {badge ? (
                  <span className={`rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[length:var(--type-small)] font-semibold uppercase tracking-wider ${badge.cls}`}>
                    {badge.label}
                  </span>
                ) : (
                  <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">ждём</span>
                )}
              </li>
            );
          })}
        </ul>
        {pov === "author" && reviewers.length > 1 && (
          <button
            type="button"
            onClick={onRequestPrimaryChange}
            className="mt-3 min-h-9 text-[length:var(--type-small)] text-[var(--muted-foreground)] underline hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Запросить смену ведущего →
          </button>
        )}
      </div>
    </div>
  );
}
