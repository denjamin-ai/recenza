// Мелкие клиентские примитивы ReviewPage (Фаза 7): Avatar, Bauble (маркер тредов у блока),
// тон по тредам, Toast (aria-live). Цвета — только токены.
"use client";

import Image from "next/image";
import type { ReviewThread } from "@/lib/queries/review";

export function Avatar({
  name,
  handle,
  size = 20,
  src,
}: {
  name?: string;
  handle: string;
  size?: number;
  /** ui-feedback-5 П2: загруженная аватарка (users.avatarUrl); нет — инициал. */
  src?: string | null;
}) {
  const letter = (name || handle || "?").slice(0, 1).toUpperCase();
  return (
    <span
      title={`@${handle}`}
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-pill)] bg-[var(--muted)] font-semibold text-[var(--muted-foreground)]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {src ? (
        <Image src={src} alt="" width={size} height={size} unoptimized className="h-full w-full object-cover" />
      ) : (
        letter
      )}
    </span>
  );
}

export type Tone = "fix" | "discuss" | "ok";

export const TONE: Record<Tone, { color: string; label: string }> = {
  fix: { color: "var(--danger)", label: "правка предложена" },
  discuss: { color: "var(--info)", label: "обсуждение" },
  ok: { color: "var(--success)", label: "решено" },
};

/** Тон маркера блока: открытая правка → fix; открытое обсуждение → discuss; только решённые → ok. */
export function pickTone(threads: ReviewThread[]): Tone | null {
  const open = threads.filter((t) => t.status === "open");
  if (open.some((t) => t.suggestion)) return "fix";
  if (open.length) return "discuss";
  if (threads.length) return "ok";
  return null;
}

/** Маркер тредов в правом гаттере блока: цвет = тон, число = открытых (или всего). */
export function Bauble({
  threads,
  active,
  onClick,
}: {
  threads: ReviewThread[];
  active: boolean;
  onClick: () => void;
}) {
  const tone = pickTone(threads);
  if (!tone) return null;
  const v = TONE[tone];
  const openCount = threads.filter((t) => t.status === "open").length;
  const label = openCount > 0 ? openCount : threads.length;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${v.label}: ${threads.length} тред(ов). Открыть обсуждение блока.`}
      title={`${v.label} · ${threads.length}`}
      className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-[var(--radius-pill)] border-2 bg-[var(--background)] px-2 py-1 text-[length:var(--type-small)] font-bold tabular-nums transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
        active ? "scale-[1.08] ring-2 ring-[var(--accent)]" : "hover:scale-[1.05]"
      }`}
      style={{ borderColor: v.color, color: v.color, lineHeight: 1 }}
    >
      <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span>{label}</span>
    </button>
  );
}

export interface ToastState {
  text: string;
  kind?: "ok" | "error";
  href?: string;
  hrefLabel?: string;
}

/** Тост — role=status + aria-live (озвучивается скринридером). kind error → предупреждающий тон. */
export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const isError = toast.kind === "error";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-in fixed bottom-4 right-4 z-50 max-w-sm rounded-[var(--radius-lg)] border p-4 ${
        isError
          ? "border-[var(--danger-border)] bg-[var(--danger-bg)]"
          : "border-[var(--border)] bg-[var(--bg-elevated)]"
      }`}
    >
      <p
        className={`text-[length:var(--type-body)] font-medium leading-snug ${
          isError ? "text-[var(--danger)]" : ""
        }`}
      >
        {isError ? "⚠ " : "✓ "}
        {toast.text}
      </p>
      <div className="mt-2 flex items-center justify-end gap-3">
        {toast.href && (
          <a href={toast.href} className="text-[length:var(--type-small)] font-medium text-[var(--accent)] hover:underline">
            {toast.hrefLabel ?? "Перейти →"}
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-[length:var(--type-small)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          закрыть
        </button>
      </div>
    </div>
  );
}
