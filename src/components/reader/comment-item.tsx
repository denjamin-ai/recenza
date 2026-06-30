"use client";

// Одна карточка комментария + рекурсивные ответы (≤2 уровня). Голос, привязка к фрагменту (скролл к
// блоку), ответ, правка (окно 15 мин — серверная истина), мягкое удаление. Текст — текстовый узел React
// (без HTML, XSS-safe). Tombstone удалённого узла с живыми ответами — «[комментарий удалён]».

import { useState } from "react";
import { formatRelativeTime } from "@/lib/format";
import { Avatar } from "@/components/review/review-primitives";
import { CommentVote } from "./comment-vote";
import { CommentComposer } from "./comment-composer";
import type { CommentView } from "@/lib/queries/comments";

function scrollToBlock(blockId: string) {
  const safe = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(blockId) : blockId;
  const el = document.querySelector(`[data-block-id="${safe}"]`);
  if (!el) return; // блок мог исчезнуть в новой ревизии — тихо ничего не делаем
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("blog-fragment-flash");
  window.setTimeout(() => el.classList.remove("blog-fragment-flash"), 1200);
}

export function CommentItem({
  comment,
  blogSlug,
  chapterSlug,
  isAuthed,
  viewerId,
  onChanged,
  versionBadge,
}: {
  comment: CommentView;
  blogSlug: string;
  chapterSlug: string;
  isAuthed: boolean;
  viewerId: string | null;
  onChanged: () => void;
  versionBadge?: number;
}) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = !!viewerId && comment.author?.id === viewerId;
  const canVote = !comment.isDeleted && !isOwner;

  async function saveEdit() {
    const value = editText.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Не удалось сохранить.");
        return;
      }
      setEditing(false);
      onChanged();
    } catch {
      setError("Сеть недоступна. Повторите.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    if (!window.confirm("Удалить комментарий?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" });
      if (res.ok) onChanged();
      else setError("Не удалось удалить. Повторите.");
    } catch {
      setError("Сеть недоступна. Повторите.");
    } finally {
      setBusy(false);
    }
  }

  const actionBtn =
    "inline-flex min-h-9 items-center rounded-[var(--radius-sm)] px-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

  return (
    <li id={`comment-${comment.id}`} className="scroll-mt-24">
      <div className="flex items-start gap-2.5">
        <Avatar name={comment.author?.displayName} handle={comment.author?.handle ?? "?"} size={28} />
        <div className="min-w-0 flex-1">
          {/* шапка */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[length:var(--type-small)]">
            {comment.isDeleted ? (
              <span className="font-medium text-[var(--muted-foreground)]">Комментарий удалён</span>
            ) : (
              <>
                <span className="font-medium text-[var(--foreground)]">
                  {comment.author?.displayName ?? "Аноним"}
                </span>
                {comment.author?.role === "author" && (
                  <span className="rounded-[var(--radius-pill)] border border-[var(--accent)] px-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                    автор
                  </span>
                )}
                {comment.author && (
                  <span className="text-[var(--muted-foreground)]">@{comment.author.handle}</span>
                )}
              </>
            )}
            <span className="text-[var(--muted-foreground)]" aria-hidden="true">
              ·
            </span>
            <time className="text-[var(--muted-foreground)]">{formatRelativeTime(comment.createdAt)}</time>
            {comment.editedAt && (
              <span className="text-[var(--muted-foreground)]">· изменено</span>
            )}
            {versionBadge != null && (
              <span
                className="rounded-[var(--radius-sm)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--warning)]"
                title="Комментарий оставлен к предыдущей версии главы"
              >
                к версии v{versionBadge}
              </span>
            )}
          </div>

          {/* якорь-фрагмент */}
          {comment.anchor && !comment.isDeleted && (
            <button
              type="button"
              onClick={() => comment.anchor && scrollToBlock(comment.anchor.blockId)}
              className="mt-1.5 flex w-full items-start gap-1.5 rounded-[var(--radius-md)] border-l-2 border-[var(--accent)] bg-[var(--muted)] px-3 py-1 text-left text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Перейти к фрагменту в тексте"
            >
              <span aria-hidden="true">↑</span>
              <span className="min-w-0 flex-1 truncate">
                {comment.anchor.quote ? `«${comment.anchor.quote}»` : "к фрагменту"}
              </span>
            </button>
          )}

          {/* тело */}
          {editing ? (
            <div className="mt-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[length:var(--type-body)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              />
              {error && (
                <p role="alert" className="mt-1.5 text-[length:var(--type-small)] text-[var(--danger)]">
                  {error}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={busy || !editText.trim()}
                  className="inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditText(comment.text);
                    setError(null);
                  }}
                  className={actionBtn}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            !comment.isDeleted && (
              <p className="mt-1 whitespace-pre-wrap text-[length:var(--type-body)] leading-[var(--leading-body)] text-[var(--foreground)]">
                {comment.text}
              </p>
            )
          )}

          {/* действия */}
          {!editing && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {!comment.isDeleted && (
                <CommentVote
                  key={`${comment.id}-${comment.score}-${comment.myVote}`}
                  commentId={comment.id}
                  initialScore={comment.score}
                  initialMyVote={comment.myVote}
                  isAuthed={isAuthed}
                  canVote={canVote}
                />
              )}
              {comment.canReply && (
                <button type="button" onClick={() => setReplying((v) => !v)} className={actionBtn}>
                  Ответить
                </button>
              )}
              {comment.canEdit && (
                <button type="button" onClick={() => setEditing(true)} className={actionBtn}>
                  Изменить
                </button>
              )}
              {isOwner && !comment.isDeleted && (
                <button type="button" onClick={remove} disabled={busy} className={actionBtn}>
                  Удалить
                </button>
              )}
            </div>
          )}

          {/* форма ответа */}
          {replying && (
            <CommentComposer
              blogSlug={blogSlug}
              chapterSlug={chapterSlug}
              parentId={comment.id}
              isAuthed={isAuthed}
              autoFocus
              submitLabel="Ответить"
              placeholder="Ваш ответ…"
              onCancel={() => setReplying(false)}
              onPosted={() => {
                setReplying(false);
                onChanged();
              }}
            />
          )}

          {/* ответы */}
          {comment.children.length > 0 && (
            <ul className="mt-4 space-y-4 border-l border-[var(--border)] pl-4">
              {comment.children.map((child) => (
                <CommentItem
                  key={child.id}
                  comment={child}
                  blogSlug={blogSlug}
                  chapterSlug={chapterSlug}
                  isAuthed={isAuthed}
                  viewerId={viewerId}
                  onChanged={onChanged}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
