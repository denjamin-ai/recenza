"use client";

// Клиентская обвязка секции комментариев: композер (или login-prompt / notice блокировки), список
// текущей ревизии, спойлер «прошлые версии». Данные приходят с сервера (RSC); после мутаций —
// router.refresh() в startTransition (фоновое обновление без перемонтажа Suspense-границы, CLAUDE gotcha).
// Слушает событие фрагмент-якоря от FragmentCommentButton (фильтр по своей главе).

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CommentItem } from "./comment-item";
import { CommentComposer } from "./comment-composer";
import type { CommentView } from "@/lib/queries/comments";
import type { CommentAnchor } from "@/types";

export interface FragmentAnchorDetail {
  chapterSlug: string;
  blockId: string;
  quote?: string;
}

export function CommentsSection({
  blogSlug,
  chapterSlug,
  sectionId,
  current,
  older,
  total,
  canComment,
  blockedReason,
  isAuthed,
  viewerId,
}: {
  blogSlug: string;
  chapterSlug: string;
  sectionId: string;
  current: CommentView[];
  older: CommentView[];
  total: number;
  canComment: boolean;
  blockedReason: string | null;
  isAuthed: boolean;
  viewerId: string | null;
}) {
  const router = useRouter();
  const [pendingAnchor, setPendingAnchor] = useState<CommentAnchor | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  // Фрагмент-якорь из прозы: ловим событие, если оно про нашу главу и комментировать можно.
  useEffect(() => {
    if (!canComment) return;
    function onAnchor(e: Event) {
      const detail = (e as CustomEvent<FragmentAnchorDetail>).detail;
      if (!detail || detail.chapterSlug !== chapterSlug) return;
      setPendingAnchor({ blockId: detail.blockId, ...(detail.quote ? { quote: detail.quote } : {}) });
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.addEventListener("recenza:comment-anchor", onAnchor as EventListener);
    return () => window.removeEventListener("recenza:comment-anchor", onAnchor as EventListener);
  }, [canComment, chapterSlug, sectionId]);

  return (
    <div className="mt-4">
      {/* Композер / приглашение войти / уведомление о блокировке */}
      {canComment ? (
        <CommentComposer
          blogSlug={blogSlug}
          chapterSlug={chapterSlug}
          isAuthed={isAuthed}
          anchor={pendingAnchor}
          onClearAnchor={() => setPendingAnchor(null)}
          onPosted={() => {
            setPendingAnchor(null);
            refresh();
          }}
        />
      ) : !isAuthed ? (
        <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          <a
            href={`/login?next=${encodeURIComponent(`/blog/${blogSlug}/${chapterSlug}#${sectionId}`)}`}
            className="font-medium text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]"
          >
            Войдите
          </a>
          , чтобы оставить комментарий.
        </p>
      ) : blockedReason ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          {blockedReason}
        </p>
      ) : null}

      {/* Список текущей ревизии */}
      {current.length > 0 ? (
        <ul className="mt-6 space-y-6">
          {current.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              blogSlug={blogSlug}
              chapterSlug={chapterSlug}
              isAuthed={isAuthed}
              viewerId={viewerId}
              onChanged={refresh}
            />
          ))}
        </ul>
      ) : (
        total === 0 && (
          <p className="mt-6 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            Пока нет комментариев. Будьте первым.
          </p>
        )
      )}

      {/* Спойлер «прошлые версии» */}
      {older.length > 0 && (
        <details className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2">
          <summary className="cursor-pointer text-[length:var(--type-small)] text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]">
            Комментарии к прошлым версиям ({older.length})
          </summary>
          <ul className="mt-4 space-y-6">
            {older.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                blogSlug={blogSlug}
                chapterSlug={chapterSlug}
                isAuthed={isAuthed}
                viewerId={viewerId}
                onChanged={refresh}
                versionBadge={c.revision}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
