"use client";

// Композер комментария: создание top-level или ответа (parentId). Может нести якорь-фрагмент (anchor).
// POST /api/comments; сервер штампует ревизию и проверяет гейтинг/глубину. Гость → login.

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { CommentAnchor } from "@/types";

export function CommentComposer({
  blogSlug,
  chapterSlug,
  parentId,
  anchor,
  onClearAnchor,
  isAuthed,
  onPosted,
  onCancel,
  placeholder = "Оставьте комментарий…",
  autoFocus = false,
  submitLabel = "Отправить",
}: {
  blogSlug: string;
  chapterSlug: string;
  parentId?: string;
  anchor?: CommentAnchor | null;
  onClearAnchor?: () => void;
  isAuthed: boolean;
  onPosted?: (id: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  submitLabel?: string;
}) {
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  function goLogin() {
    window.location.assign(`/login?next=${encodeURIComponent((pathname || "/") + "#comments")}`);
  }

  async function submit() {
    const value = text.trim();
    if (!value || busy) return;
    if (!isAuthed) return goLogin();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blogSlug,
          chapterSlug,
          parentId: parentId ?? null,
          text: value,
          anchor: parentId ? null : (anchor ?? null),
        }),
      });
      if (res.status === 401) return goLogin();
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; id?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Не удалось отправить комментарий.");
        return;
      }
      setText("");
      onClearAnchor?.();
      onPosted?.(data.id ?? "");
    } catch {
      setError("Сеть недоступна. Повторите.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      {anchor && (
        <div className="mb-2 flex items-start gap-2 rounded-[var(--radius-md)] border-l-2 border-[var(--accent)] bg-[var(--muted)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          <span className="min-w-0 flex-1">
            К фрагменту{anchor.quote ? <>: «{anchor.quote}»</> : null}
          </span>
          {onClearAnchor && (
            <button
              type="button"
              onClick={onClearAnchor}
              aria-label="Убрать привязку к фрагменту"
              className="shrink-0 rounded-[var(--radius-sm)] px-1 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              ✕
            </button>
          )}
        </div>
      )}
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={3}
        className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[length:var(--type-body)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      />
      {error && (
        <p role="alert" className="mt-1.5 text-[length:var(--type-small)] text-[var(--danger)]">
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !text.trim()}
          className="inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50"
        >
          {busy ? "Отправка…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-[var(--radius-md)] px-3 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Отмена
          </button>
        )}
      </div>
    </div>
  );
}
