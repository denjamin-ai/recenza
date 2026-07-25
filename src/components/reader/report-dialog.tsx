"use client";

// Жалоба модератору (Фаза 15, З-51) — по прототипу `shared/components.jsx:1286-1341` ReportDialog:
// радио-причины из общего каталога + необязательный комментарий модератору.
//
// Одна обёртка на все три цели (комментарий / блог / ревью), а не три копии диалога: одна
// валидация, один текст, один локатор для e2e. Гостю кнопка не рендерится вовсе — роут ответил
// бы 401, а intent-replay для жалобы не предусмотрен.

import { useEffect, useRef, useState } from "react";
import { IconX } from "@/components/icons";
import {
  MAX_REPORT_NOTE,
  REPORT_DIALOG_TITLE,
  REPORT_REASONS,
  type ReportReason,
} from "@/lib/reports";
import type { ReportTargetType } from "@/types";

export interface ReportTarget {
  targetType: ReportTargetType;
  targetId: string;
  /** Только для `review`: на кого жалоба (участник сессии). */
  aboutHandle?: string;
  /** Цитата цели в шапке диалога — что именно репортим. */
  excerpt?: string;
}

export function ReportButton({ target, className }: { target: ReportTarget; className?: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]" role="status">
        Жалоба отправлена
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "rounded-[var(--radius-sm)] text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        }
      >
        Пожаловаться
      </button>
      {open && (
        <ReportDialog
          target={target}
          onClose={() => setOpen(false)}
          onDone={() => {
            setDone(true);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function ReportDialog({
  target,
  onClose,
  onDone,
}: {
  target: ReportTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0].id);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: target.targetType,
          targetId: target.targetId,
          reason,
          note: note.trim() || undefined,
          aboutHandle: target.aboutHandle,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось отправить жалобу.");
        return;
      }
      onDone();
    } catch {
      setError("Не удалось отправить жалобу.");
    } finally {
      setPending(false);
    }
  }

  const title = REPORT_DIALOG_TITLE[target.targetType];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-[440px] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-elevated)] focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--type-h4)] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          {target.excerpt && (
            <p className="line-clamp-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
              «{target.excerpt}»
            </p>
          )}

          <fieldset>
            <legend className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Причина
            </legend>
            <div className="flex flex-col gap-1">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.id}
                  className="flex min-h-[36px] cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] px-1 transition-colors hover:bg-[var(--muted)]"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="text-[length:var(--type-small)]">{r.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="report-note"
              className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"
            >
              Комментарий модератору{" "}
              <span className="font-normal normal-case">— необязательно</span>
            </label>
            <textarea
              id="report-note"
              rows={3}
              value={note}
              maxLength={MAX_REPORT_NOTE}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Что не так?"
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[length:var(--type-small)] leading-relaxed focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-[length:var(--type-small)] text-[var(--danger)]">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] rounded-[var(--radius-md)] px-3 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="inline-flex min-h-[36px] items-center rounded-[var(--radius-md)] bg-[var(--danger)] px-4 text-[length:var(--type-small)] font-medium text-[var(--danger-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Отправить жалобу
          </button>
        </div>
      </div>
    </div>
  );
}
