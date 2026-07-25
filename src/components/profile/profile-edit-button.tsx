"use client";

// «Изменить профиль» на своём /u/[slug] (Ф13.7) — модалка с той же формой, что и /settings.
// ⚠️ Реверс ui-feedback-6 П3 (решение владельца): кнопку когда-то убрали с профиля, теперь она
// возвращена — но канонический адрес редактирования всё равно /settings, модалка лишь короткий путь.

import { useEffect, useRef, useState } from "react";
import { ProfileForm } from "./profile-form";
import type { LinkItem } from "@/types";

export function ProfileEditButton({
  initial,
  isReviewer,
}: {
  initial: { displayName: string; bio: string | null; links: LinkItem[]; competencies: string[] };
  isReviewer: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      >
        Изменить профиль
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--overlay)] p-0 sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Изменить профиль"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 focus-visible:outline-none sm:rounded-[var(--radius-xl)]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-[length:var(--type-h4)] font-bold">
                Изменить профиль
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <ProfileForm
              initial={initial}
              isReviewer={isReviewer}
              onDone={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
