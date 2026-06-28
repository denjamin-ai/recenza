"use client";

// Панель реакций в конце главы: голос ±1 (по главе), закладка (по блогу), подписка (на автора).
// Оптимистичные апдейты; гость → редирект на /login?next=…&intent=… (реплей после входа).
// Все мутации — авторизованный API (server-side: CSRF same-origin + auth + ownership + rate-limit).

import { useState } from "react";
import { usePathname } from "next/navigation";
import { encodeIntent, type Intent } from "@/lib/intent";

interface InitialState {
  score: number;
  myVote: 1 | -1 | 0;
  isBookmarked: boolean;
  bookmarkCount: number;
  isFollowing: boolean;
}

export function EngagementBar({
  chapterId,
  blogId,
  authorId,
  initial,
  isAuthed,
  canVote,
  canFollow,
}: {
  chapterId: string;
  blogId: string;
  authorId: string;
  initial: InitialState;
  isAuthed: boolean;
  canVote: boolean;
  canFollow: boolean;
}) {
  const pathname = usePathname();
  const [score, setScore] = useState(initial.score);
  const [myVote, setMyVote] = useState<1 | -1 | 0>(initial.myVote);
  const [bookmarked, setBookmarked] = useState(initial.isBookmarked);
  const [bookmarkCount, setBookmarkCount] = useState(initial.bookmarkCount);
  const [following, setFollowing] = useState(initial.isFollowing);
  const [busy, setBusy] = useState(false);

  function goLogin(intent: Intent) {
    const next = encodeURIComponent(pathname || "/");
    const i = encodeURIComponent(encodeIntent(intent));
    window.location.assign(`/login?next=${next}&intent=${i}`);
  }

  async function post(url: string, body: unknown): Promise<Record<string, unknown> | null> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 401) return null; // сессия истекла → обработаем редиректом у вызывающего
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json().catch(() => ({}))) as Record<string, unknown>;
  }

  async function vote(value: 1 | -1) {
    if (busy) return;
    if (!isAuthed) return goLogin({ verb: "vote", id: chapterId, value });

    const prev = { score, myVote };
    // оптимистично
    const nextVote = myVote === value ? 0 : value;
    const delta = nextVote - myVote;
    setMyVote(nextVote);
    setScore(score + delta);
    setBusy(true);
    try {
      const data = await post(`/api/chapters/${chapterId}/vote`, { value });
      if (data == null) return goLogin({ verb: "vote", id: chapterId, value });
      if (typeof data.score === "number") setScore(data.score);
      if (data.myVote === 1 || data.myVote === -1 || data.myVote === 0) setMyVote(data.myVote);
    } catch {
      setMyVote(prev.myVote);
      setScore(prev.score);
    } finally {
      setBusy(false);
    }
  }

  async function toggleBookmark() {
    if (busy) return;
    if (!isAuthed) return goLogin({ verb: "bookmark", id: blogId });

    const prev = { bookmarked, bookmarkCount };
    setBookmarked(!bookmarked);
    setBookmarkCount(bookmarkCount + (bookmarked ? -1 : 1));
    setBusy(true);
    try {
      const data = await post(`/api/bookmarks`, { blogId });
      if (data == null) return goLogin({ verb: "bookmark", id: blogId });
      if (typeof data.bookmarked === "boolean") setBookmarked(data.bookmarked);
      if (typeof data.bookmarkCount === "number") setBookmarkCount(data.bookmarkCount);
    } catch {
      setBookmarked(prev.bookmarked);
      setBookmarkCount(prev.bookmarkCount);
    } finally {
      setBusy(false);
    }
  }

  async function toggleFollow() {
    if (busy) return;
    if (!isAuthed) return goLogin({ verb: "follow", id: authorId });

    const prev = following;
    setFollowing(!following);
    setBusy(true);
    try {
      const data = await post(`/api/follows`, { authorId });
      if (data == null) return goLogin({ verb: "follow", id: authorId });
      if (typeof data.following === "boolean") setFollowing(data.following);
    } catch {
      setFollowing(prev);
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-[length:var(--type-small)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50";
  const pressed = "border-[var(--accent)] text-[var(--accent)]";

  return (
    <div className="mt-8 flex flex-wrap items-center gap-2" aria-label="Реакции">
      {canVote && (
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => vote(1)}
            disabled={busy}
            aria-pressed={myVote === 1}
            aria-label="Полезно"
            className={`${btn} ${myVote === 1 ? pressed : "text-[var(--foreground)]"}`}
          >
            <span aria-hidden="true">▲</span>
          </button>
          <span aria-live="polite" className="min-w-6 text-center text-[length:var(--type-small)] tabular-nums text-[var(--foreground)]">
            {score}
          </span>
          <button
            type="button"
            onClick={() => vote(-1)}
            disabled={busy}
            aria-pressed={myVote === -1}
            aria-label="Не полезно"
            className={`${btn} ${myVote === -1 ? pressed : "text-[var(--foreground)]"}`}
          >
            <span aria-hidden="true">▼</span>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={toggleBookmark}
        disabled={busy}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? "Убрать из закладок" : "В закладки"}
        className={`${btn} ${bookmarked ? pressed : "text-[var(--foreground)]"}`}
      >
        <span aria-hidden="true">{bookmarked ? "★" : "☆"}</span>
        <span>{bookmarkCount}</span>
      </button>

      {canFollow && (
        <button
          type="button"
          onClick={toggleFollow}
          disabled={busy}
          aria-pressed={following}
          className={`${btn} ${following ? pressed : "text-[var(--foreground)]"}`}
        >
          {following ? "Вы подписаны" : "Подписаться на автора"}
        </button>
      )}
    </div>
  );
}
