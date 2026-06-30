// Слой чтения публичных комментариев (Фаза 8) — RSC-safe (без "use client").
// Счёт голосов — SUM на чтении (как engagement.ts); anchor — через parseJson (try/catch → null).
// Дерево ≤2 уровней (гейтится на API); soft-deleted узел держим как tombstone ТОЛЬКО при живых потомках.

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterRevisions, chapters, commentVotes, publicComments, users } from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import type { CommentAnchor, Role } from "@/types";

/** Окно правки комментария — 15 минут (серверная истина; PATCH-роут проверяет идентично). */
export const EDIT_WINDOW_S = 900;

export interface CommentAuthorView {
  id: string;
  handle: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  role: Role;
}

export interface CommentView {
  id: string;
  parentId: string | null;
  depth: 0 | 1 | 2;
  text: string; // "" у tombstone
  anchor: CommentAnchor | null;
  revision: number;
  createdAt: number;
  editedAt: number | null;
  isDeleted: boolean;
  author: CommentAuthorView | null; // null у tombstone и при удалённом авторе (SET NULL)
  score: number;
  myVote: 1 | -1 | 0;
  canEdit: boolean;
  editExpiresAt: number | null;
  canReply: boolean;
  children: CommentView[];
}

export interface ChapterCommentsView {
  current: CommentView[]; // top-level ревизии ≥ текущей (ответы вложены)
  older: CommentView[]; // top-level ревизии < текущей → спойлер «прошлые версии»
  total: number; // число живых узлов (для «Комментарии N»)
  canComment: boolean;
  blockedReason: string | null; // причина для UI (null у гостя — это login-prompt, а не ошибка)
}

/** Минимальный снимок зрителя для гейтинга/myVote/canEdit. Строится из PublicUser. */
export interface CommentViewer {
  id: string;
  role: Role;
  commentingBlocked: boolean;
}

/**
 * Единый гейтинг-предикат (binding, CLAUDE.md): читатель — везде; автор — только в своём блоге;
 * ревьюер — никогда; заблокированный — никогда; гость/админ — нельзя (null viewer). Сервер перевыводит сам.
 */
export function commentGate(
  viewer: CommentViewer | null,
  blogAuthorId: string,
): { canComment: boolean; blockedReason: string | null } {
  if (!viewer) return { canComment: false, blockedReason: null }; // гость/админ → login-prompt
  if (viewer.commentingBlocked) return { canComment: false, blockedReason: "Комментирование ограничено." };
  if (viewer.role === "reviewer") {
    return { canComment: false, blockedReason: "Ревьюеры не участвуют в публичных обсуждениях." };
  }
  if (viewer.role === "author" && viewer.id !== blogAuthorId) {
    return { canComment: false, blockedReason: "Авторы комментируют только в своих блогах." };
  }
  return { canComment: true, blockedReason: null }; // reader или author-владелец
}

export interface CommentTarget {
  chapterId: string;
  chapterTitle: string;
  blogSlug: string;
  chapterSlug: string;
  blogAuthorId: string;
  currentRevision: number;
}

/**
 * Разрешает (blogSlug, chapterSlug) → цель для записи комментария: id/заголовок главы, автор блога,
 * текущая published-ревизия (наибольший number). null — блог скрыт (автор заблокирован) или нет публикаций.
 * Используется create-роутом, чтобы НЕ доверять клиентской ревизии.
 */
export async function resolveCommentTarget(
  blogSlug: string,
  chapterSlug: string,
): Promise<CommentTarget | null> {
  const rows = await db
    .select({
      chapterId: chapters.id,
      chapterTitle: chapters.title,
      blogSlug: blogs.slug,
      chapterSlug: chapters.slug,
      blogAuthorId: blogs.authorId,
      revNumber: chapterRevisions.number,
    })
    .from(chapters)
    .innerJoin(blogs, eq(chapters.blogId, blogs.id))
    .innerJoin(users, eq(blogs.authorId, users.id))
    .innerJoin(chapterRevisions, eq(chapterRevisions.chapterId, chapters.id))
    .where(
      and(
        eq(blogs.slug, blogSlug),
        eq(chapters.slug, chapterSlug),
        eq(users.isBlocked, false),
        eq(chapterRevisions.status, "published"),
      ),
    );

  if (rows.length === 0) return null;
  let best = rows[0];
  for (const r of rows) if (r.revNumber > best.revNumber) best = r;
  return {
    chapterId: best.chapterId,
    chapterTitle: best.chapterTitle,
    blogSlug: best.blogSlug,
    chapterSlug: best.chapterSlug,
    blogAuthorId: best.blogAuthorId,
    currentRevision: best.revNumber,
  };
}

/** Полный тред главы для ридера: дерево, счёт/мой голос, спойлер старых ревизий, гейтинг. */
export async function getChapterComments(args: {
  blogSlug: string;
  chapterSlug: string;
  currentRevision: number;
  viewer: CommentViewer | null;
  blogAuthorId: string;
}): Promise<ChapterCommentsView> {
  const { blogSlug, chapterSlug, currentRevision, viewer, blogAuthorId } = args;
  const now = Math.floor(Date.now() / 1000);
  const gate = commentGate(viewer, blogAuthorId);

  const rows = await db
    .select({
      id: publicComments.id,
      parentId: publicComments.parentId,
      revision: publicComments.revision,
      text: publicComments.text,
      anchor: publicComments.anchor,
      editedAt: publicComments.editedAt,
      deletedAt: publicComments.deletedAt,
      createdAt: publicComments.createdAt,
      authorId: publicComments.authorId,
      authorHandle: users.handle,
      authorSlug: users.slug,
      authorName: users.displayName,
      authorAvatar: users.avatarUrl,
      authorRole: users.role,
    })
    .from(publicComments)
    .leftJoin(users, eq(publicComments.authorId, users.id))
    .where(and(eq(publicComments.blogSlug, blogSlug), eq(publicComments.chapterSlug, chapterSlug)));

  if (rows.length === 0) {
    return { current: [], older: [], total: 0, canComment: gate.canComment, blockedReason: gate.blockedReason };
  }

  const ids = rows.map((r) => r.id);

  // Счёт голосов (агрегат) + голос зрителя — два запроса, без N+1.
  const scoreRows = await db
    .select({
      commentId: commentVotes.commentId,
      score: sql<number>`coalesce(sum(${commentVotes.value}), 0)`,
    })
    .from(commentVotes)
    .where(inArray(commentVotes.commentId, ids))
    .groupBy(commentVotes.commentId);
  const scoreMap = new Map<string, number>();
  for (const s of scoreRows) scoreMap.set(s.commentId, Number(s.score ?? 0));

  const myVoteMap = new Map<string, 1 | -1>();
  if (viewer) {
    const mine = await db
      .select({ commentId: commentVotes.commentId, value: commentVotes.value })
      .from(commentVotes)
      .where(and(eq(commentVotes.userId, viewer.id), inArray(commentVotes.commentId, ids)));
    for (const v of mine) myVoteMap.set(v.commentId, v.value === 1 ? 1 : -1);
  }

  // Глубина по цепочке parentId (макс 2 хопа; depth = число предков, 0|1|2).
  const byId = new Map(rows.map((r) => [r.id, r] as const));
  function depthOf(row: (typeof rows)[number]): 0 | 1 | 2 {
    let d = 0;
    let cur: (typeof rows)[number] | undefined = row;
    while (cur?.parentId && d < 2) {
      cur = byId.get(cur.parentId);
      if (!cur) break;
      d++;
    }
    return d as 0 | 1 | 2;
  }

  const nodeMap = new Map<string, CommentView>();
  for (const r of rows) {
    const isDeleted = r.deletedAt != null;
    const isOld = r.revision < currentRevision;
    const depth = depthOf(r);
    const isOwn = !!viewer && r.authorId === viewer.id;
    const canEdit = isOwn && !isDeleted && now - r.createdAt < EDIT_WINDOW_S;
    const author: CommentAuthorView | null =
      !isDeleted && r.authorId && r.authorHandle
        ? {
            id: r.authorId,
            handle: r.authorHandle,
            slug: r.authorSlug ?? r.authorHandle,
            displayName: r.authorName ?? r.authorHandle,
            avatarUrl: r.authorAvatar,
            role: (r.authorRole ?? "reader") as Role,
          }
        : null;
    nodeMap.set(r.id, {
      id: r.id,
      parentId: r.parentId,
      depth,
      text: isDeleted ? "" : r.text,
      anchor: isDeleted ? null : parseJson<CommentAnchor | null>(r.anchor, null),
      revision: r.revision,
      createdAt: r.createdAt,
      editedAt: isDeleted ? null : r.editedAt,
      isDeleted,
      author,
      score: isDeleted ? 0 : (scoreMap.get(r.id) ?? 0),
      myVote: isDeleted ? 0 : (myVoteMap.get(r.id) ?? 0),
      canEdit,
      editExpiresAt: canEdit ? r.createdAt + EDIT_WINDOW_S : null,
      canReply: gate.canComment && !isDeleted && !isOld && depth < 2,
      children: [],
    });
  }

  // Сборка дерева: дитя → в children родителя; иначе (top-level / потерянный родитель) → корень.
  const roots: CommentView[] = [];
  for (const r of rows) {
    const node = nodeMap.get(r.id)!;
    const parent = r.parentId ? nodeMap.get(r.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const byCreatedAsc = (a: CommentView, b: CommentView) => a.createdAt - b.createdAt;
  for (const n of nodeMap.values()) n.children.sort(byCreatedAsc);
  roots.sort(byCreatedAsc);

  // Удалённый ЛИСТ опускаем; удалённый узел с живыми потомками остаётся tombstone'ом.
  function prune(nodes: CommentView[]): CommentView[] {
    const kept: CommentView[] = [];
    for (const n of nodes) {
      n.children = prune(n.children);
      if (n.isDeleted && n.children.length === 0) continue;
      kept.push(n);
    }
    return kept;
  }
  const prunedRoots = prune(roots);

  const current: CommentView[] = [];
  const older: CommentView[] = [];
  for (const n of prunedRoots) (n.revision < currentRevision ? older : current).push(n);

  let total = 0;
  (function countLive(nodes: CommentView[]) {
    for (const n of nodes) {
      if (!n.isDeleted) total++;
      countLive(n.children);
    }
  })(prunedRoots);

  return { current, older, total, canComment: gate.canComment, blockedReason: gate.blockedReason };
}
