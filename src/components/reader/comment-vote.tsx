"use client";

// Голос за комментарий (±1). Оптимистично; сервер возвращает авторитетный счёт. Ресинк при смене пропсов
// (router.refresh после соседних мутаций). Гость → login. Свой комментарий → только счёт (без кнопок).

import { useState } from "react";
import { usePathname } from "next/navigation";

export function CommentVote({
  commentId,
  initialScore,
  initialMyVote,
  isAuthed,
  canVote,
}: {
  commentId: string;
  initialScore: number;
  initialMyVote: 1 | -1 | 0;
  isAuthed: boolean;
  canVote: boolean;
}) {
  const pathname = usePathname();
  // Ресинк с серверными пропсами — через remount по key в родителе (CommentItem), не через эффект.
  const [score, setScore] = useState(initialScore);
  const [myVote, setMyVote] = useState<1 | -1 | 0>(initialMyVote);
  const [busy, setBusy] = useState(false);

  function goLogin() {
    window.location.assign(`/login?next=${encodeURIComponent((pathname || "/") + "#comments")}`);
  }

  async function vote(value: 1 | -1) {
    if (busy) return;
    if (!isAuthed) return goLogin();
    const prev = { score, myVote };
    const nextVote = myVote === value ? 0 : value;
    setMyVote(nextVote);
    setScore(score + (nextVote - myVote));
    setBusy(true);
    try {
      const res = await fetch(`/api/comments/${commentId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (res.status === 401) return goLogin();
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json().catch(() => ({}))) as { score?: number; myVote?: number };
      if (typeof data.score === "number") setScore(data.score);
      if (data.myVote === 1 || data.myVote === -1 || data.myVote === 0) setMyVote(data.myVote);
    } catch {
      setScore(prev.score);
      setMyVote(prev.myVote);
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] text-[length:var(--type-small)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50";
  const pressed = "border-[var(--accent)] text-[var(--accent)]";

  if (!canVote) {
    return (
      <span className="inline-flex items-center gap-1 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
        <span aria-hidden="true">▲</span>
        <span className="tabular-nums">{score}</span>
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1" aria-label="Оценка комментария">
      <button
        type="button"
        onClick={() => vote(1)}
        disabled={busy}
        aria-pressed={myVote === 1}
        aria-label="Полезный комментарий"
        className={`${btn} ${myVote === 1 ? pressed : "text-[var(--foreground)]"}`}
      >
        <span aria-hidden="true">▲</span>
      </button>
      <span
        aria-live="polite"
        className="min-w-5 text-center text-[length:var(--type-small)] tabular-nums text-[var(--foreground)]"
      >
        {score}
      </span>
      <button
        type="button"
        onClick={() => vote(-1)}
        disabled={busy}
        aria-pressed={myVote === -1}
        aria-label="Бесполезный комментарий"
        className={`${btn} ${myVote === -1 ? pressed : "text-[var(--foreground)]"}`}
      >
        <span aria-hidden="true">▼</span>
      </button>
    </div>
  );
}
