"use client";

// Клиентская обвязка секции комментариев: композер (или login-prompt / notice блокировки), список
// текущей ревизии, спойлер «прошлые версии». Данные приходят с сервера (RSC); после мутаций —
// router.refresh() в startTransition (фоновое обновление без перемонтажа Suspense-границы, CLAUDE gotcha).
// Слушает событие фрагмент-якоря от FragmentCommentButton.
//
// Два режима (ui-feedback-4 П8):
//  - chapter: секция одной главы (chapterSlug задан, chapters не передан) — поведение Фазы 8;
//  - blog: merged-секция «Весь блог» (chapters заданы) — якорь принимается от ЛЮБОЙ главы блога,
//    целевая глава композера = глава якоря, без якоря — селект «К главе» (default — последняя).
//    Блоговых комментариев нет по построению (chapter_slug NOT NULL) — коммент всегда у главы.

import { startTransition, useEffect, useMemo, useState } from "react";
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
  chapters,
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
  /** chapter-режим: слаг главы секции. В blog-режиме null (главы — в chapters). */
  chapterSlug: string | null;
  /** blog-режим: опубликованные главы блога по порядку (для селекта и фильтра якоря). */
  chapters?: { slug: string; title: string }[];
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
  const blogMode = chapters != null;
  const [pendingAnchor, setPendingAnchor] = useState<(CommentAnchor & { chapterSlug: string }) | null>(null);
  // Целевая глава композера в blog-режиме (селект); якорь её перекрывает.
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const acceptSlugs = useMemo(
    () => new Set(blogMode ? chapters!.map((c) => c.slug) : chapterSlug ? [chapterSlug] : []),
    [blogMode, chapters, chapterSlug],
  );

  const refresh = () => startTransition(() => router.refresh());

  // Фрагмент-якорь из прозы: ловим событие, если оно про главу нашей секции и комментировать можно.
  useEffect(() => {
    if (!canComment) return;
    function onAnchor(e: Event) {
      const detail = (e as CustomEvent<FragmentAnchorDetail>).detail;
      if (!detail || !acceptSlugs.has(detail.chapterSlug)) return;
      setPendingAnchor({
        chapterSlug: detail.chapterSlug,
        blockId: detail.blockId,
        ...(detail.quote ? { quote: detail.quote } : {}),
      });
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.addEventListener("recenza:comment-anchor", onAnchor as EventListener);
    return () => window.removeEventListener("recenza:comment-anchor", onAnchor as EventListener);
  }, [canComment, acceptSlugs, sectionId]);

  // Глава, в которую уйдёт новый top-level коммент.
  const lastChapterSlug = blogMode && chapters!.length > 0 ? chapters![chapters!.length - 1].slug : null;
  const composerSlug = pendingAnchor?.chapterSlug ?? (blogMode ? (selectedSlug ?? lastChapterSlug) : chapterSlug);

  const loginNext = blogMode
    ? `/blog/${blogSlug}?mode=whole#${sectionId}`
    : `/blog/${blogSlug}/${chapterSlug}#${sectionId}`;

  return (
    <div className="mt-4">
      {/* Композер / приглашение войти / уведомление о блокировке */}
      {canComment && composerSlug ? (
        <div>
          {blogMode && !pendingAnchor && chapters!.length > 1 && (
            <label className="mb-2 flex items-center gap-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
              К главе:
              <select
                value={composerSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                className="min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1 text-[length:var(--type-small)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {chapters!.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {/* Без key по composerSlug: смена целевой главы не должна терять набранный текст */}
          <CommentComposer
            blogSlug={blogSlug}
            chapterSlug={composerSlug}
            isAuthed={isAuthed}
            anchor={pendingAnchor ? { blockId: pendingAnchor.blockId, ...(pendingAnchor.quote ? { quote: pendingAnchor.quote } : {}) } : null}
            onClearAnchor={() => setPendingAnchor(null)}
            onPosted={() => {
              setPendingAnchor(null);
              refresh();
            }}
          />
        </div>
      ) : !isAuthed ? (
        <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          <a
            href={`/login?next=${encodeURIComponent(loginNext)}`}
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
              chapterSlug={c.chapterSlug ?? chapterSlug ?? ""}
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
                chapterSlug={c.chapterSlug ?? chapterSlug ?? ""}
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
