// Слой чтения публичных комментариев (Фаза 8) — RSC-safe (без "use client").
// Счёт голосов — SUM на чтении (как engagement.ts); anchor — через parseJson (try/catch → null).
// Дерево ≤2 уровней (гейтится на API); soft-deleted узел держим как tombstone ТОЛЬКО при живых потомках.

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blogs,
  chapterReviewers,
  chapterRevisions,
  chapters,
  commentVotes,
  publicComments,
  reviewerHistory,
  users,
} from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import type { CommentAnchor } from "@/types";

/** Окно правки комментария — 15 минут (серверная истина; PATCH-роут проверяет идентично). */
export const EDIT_WINDOW_S = 900;

export interface CommentAuthorView {
  id: string;
  handle: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  /** Автор блога, в котором оставлен комментарий → бейдж «автор» (Ф13: вместо роли — факт). */
  isBlogAuthor: boolean;
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
  /** Заполнены ТОЛЬКО в blog-режиме (merged-секция «Весь блог», ui-feedback-4 П8). */
  chapterSlug?: string;
  chapterTitle?: string;
}

export interface ChapterCommentsView {
  current: CommentView[]; // top-level ревизии ≥ текущей (ответы вложены)
  older: CommentView[]; // top-level ревизии < текущей → спойлер «прошлые версии»
  total: number; // число живых узлов (для «Комментарии N»)
  canComment: boolean;
  blockedReason: string | null; // причина для UI (null у гостя — это login-prompt, а не ошибка)
  /** blog-режим (Ф13): главы, где зритель рецензировал — композер их не предлагает. */
  conflictedChapterSlugs?: string[];
}

/** Минимальный снимок зрителя для гейтинга/myVote/canEdit. Строится из PublicUser. */
export interface CommentViewer {
  id: string;
  handle: string;
  commentingBlocked: boolean;
}

/**
 * Единый гейтинг-предикат (binding, CLAUDE.md).
 *
 * ⚠️ Фаза 13 — ОБА ролевых запрета сняты:
 *   • «ревьюер никогда не комментирует» (З-08) заменён на КОНФЛИКТ ИНТЕРЕСОВ: нельзя комментировать
 *     именно ту главу, которую ты ревьюишь или ревьюил (в остальных блогах ревьюер — обычный читатель);
 *   • «автор комментирует только свой блог» снят целиком — DoD фазы требует, чтобы ЛЮБОЙ аккаунт
 *     читал и комментировал (автор перестал быть изолированной ролью).
 * Остаются: гость/админ — нельзя (null viewer, это login-prompt, а не ошибка); commentingBlocked.
 *
 * @param conflicted — зритель участвует/участвовал в ревью этой главы (считается запросом к БД:
 *   chapter_reviewers ∪ reviewer_history). Вызывающий обязан передать его для целевой главы;
 *   POST-роут перевыводит признак сам и не доверяет клиенту.
 */
export function commentGate(
  viewer: CommentViewer | null,
  opts: { conflicted?: boolean } = {},
): { canComment: boolean; blockedReason: string | null } {
  if (!viewer) return { canComment: false, blockedReason: null }; // гость/админ → login-prompt
  if (viewer.commentingBlocked) return { canComment: false, blockedReason: "Комментирование ограничено." };
  if (opts.conflicted) {
    return {
      canComment: false,
      blockedReason: "Вы рецензировали эту главу — публичное обсуждение недоступно.",
    };
  }
  return { canComment: true, blockedReason: null };
}

/**
 * Главы блога, где зритель участвует/участвовал в ревью (конфликт интересов, Ф13).
 * Один запрос на блог: назначения текущего ревью + исторический кредит.
 * Пустой Set для гостя/админа и для тех, кто ничего не рецензировал.
 */
export async function getConflictedChapterIds(
  viewerHandle: string | null,
  chapterIds: string[],
): Promise<Set<string>> {
  if (!viewerHandle || chapterIds.length === 0) return new Set();
  const [assigned, credited] = await Promise.all([
    db
      .select({ chapterId: chapterReviewers.chapterId })
      .from(chapterReviewers)
      .where(
        and(
          eq(chapterReviewers.handle, viewerHandle),
          inArray(chapterReviewers.chapterId, chapterIds),
        ),
      ),
    db
      .select({ chapterId: reviewerHistory.chapterId })
      .from(reviewerHistory)
      .where(
        and(
          eq(reviewerHistory.handle, viewerHandle),
          inArray(reviewerHistory.chapterId, chapterIds),
        ),
      ),
  ]);
  return new Set([...assigned, ...credited].map((r) => r.chapterId));
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
        // Блог скрытого автора не принимает новые комментарии (цель не резолвится → 404).
        eq(users.canAuthor, true),
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

/** Сырые поля комментария для сборщика треда (общие для chapter- и blog-режимов). */
const commentSelection = {
  id: publicComments.id,
  parentId: publicComments.parentId,
  chapterSlug: publicComments.chapterSlug,
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
};

interface RawCommentRow {
  id: string;
  parentId: string | null;
  chapterSlug: string;
  revision: number;
  text: string;
  anchor: string | null;
  editedAt: number | null;
  deletedAt: number | null;
  createdAt: number;
  authorId: string | null;
  authorHandle: string | null;
  authorSlug: string | null;
  authorName: string | null;
  authorAvatar: string | null;
}

interface AssembleOpts {
  viewer: CommentViewer | null;
  gate: { canComment: boolean; blockedReason: string | null };
  blogAuthorId: string;
  /** Текущая published-ревизия главы комментария (blog-режим — по своей главе). */
  revisionFor: (chapterSlug: string) => number;
  /** blog-режим: подписи глав для eyebrow + chapterSlug у узлов (reply-композер). */
  chapterTitles?: Map<string, string>;
}

/** Полный тред главы для ридера: дерево, счёт/мой голос, спойлер старых ревизий, гейтинг. */
export async function getChapterComments(args: {
  blogSlug: string;
  chapterSlug: string;
  chapterId: string;
  currentRevision: number;
  viewer: CommentViewer | null;
  blogAuthorId: string;
}): Promise<ChapterCommentsView> {
  const { blogSlug, chapterSlug, chapterId, currentRevision, viewer, blogAuthorId } = args;
  const conflicted = (await getConflictedChapterIds(viewer?.handle ?? null, [chapterId])).size > 0;
  const gate = commentGate(viewer, { conflicted });

  const rows = (await db
    .select(commentSelection)
    .from(publicComments)
    .leftJoin(users, eq(publicComments.authorId, users.id))
    .where(and(eq(publicComments.blogSlug, blogSlug), eq(publicComments.chapterSlug, chapterSlug)))) as RawCommentRow[];

  return assembleThread(rows, { viewer, gate, blogAuthorId, revisionFor: () => currentRevision });
}

/**
 * Merged-тред режима «Весь блог» (ui-feedback-4 П8, прототип CommentsSection wholeMode):
 * комментарии всех глав блога одним деревом, сквозная сортировка по времени; «старость» комментария
 * считается по ревизии СВОЕЙ главы. Узлы несут chapterSlug/chapterTitle (eyebrow + reply-композер).
 */
export async function getBlogComments(args: {
  blogSlug: string;
  chapters: { id: string; slug: string; title: string; revision: number }[];
  viewer: CommentViewer | null;
  blogAuthorId: string;
}): Promise<ChapterCommentsView> {
  const { blogSlug, chapters, viewer, blogAuthorId } = args;
  // Конфликт интересов — поглавно (Ф13): ревьюер главы 2 остаётся обычным читателем главы 5.
  // Гейт всей секции закрывается, только если конфликтны ВСЕ главы блога; иначе композер
  // ограничивается неконфликтными главами (их список отдаём наружу).
  const conflictedIds = await getConflictedChapterIds(
    viewer?.handle ?? null,
    chapters.map((c) => c.id),
  );
  const conflictedChapterSlugs = chapters.filter((c) => conflictedIds.has(c.id)).map((c) => c.slug);
  const allConflicted = chapters.length > 0 && conflictedChapterSlugs.length === chapters.length;
  const gate = commentGate(viewer, { conflicted: allConflicted });
  if (chapters.length === 0) {
    return {
      current: [],
      older: [],
      total: 0,
      canComment: gate.canComment,
      blockedReason: gate.blockedReason,
      conflictedChapterSlugs,
    };
  }

  const revisions = new Map(chapters.map((c) => [c.slug, c.revision]));
  const titles = new Map(chapters.map((c) => [c.slug, c.title]));

  const rows = (await db
    .select(commentSelection)
    .from(publicComments)
    .leftJoin(users, eq(publicComments.authorId, users.id))
    .where(
      and(
        eq(publicComments.blogSlug, blogSlug),
        inArray(
          publicComments.chapterSlug,
          chapters.map((c) => c.slug),
        ),
      ),
    )) as RawCommentRow[];

  const view = await assembleThread(rows, {
    viewer,
    gate,
    blogAuthorId,
    revisionFor: (slug) => revisions.get(slug) ?? 0,
    chapterTitles: titles,
  });
  return { ...view, conflictedChapterSlugs };
}

/** Общий сборщик треда: голоса, дерево ≤2, tombstone-prune, split current/older. */
async function assembleThread(rows: RawCommentRow[], opts: AssembleOpts): Promise<ChapterCommentsView> {
  const { viewer, gate, blogAuthorId, revisionFor, chapterTitles } = opts;
  const now = Math.floor(Date.now() / 1000);

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
    const isOld = r.revision < revisionFor(r.chapterSlug);
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
            isBlogAuthor: r.authorId === blogAuthorId,
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
      // blog-режим: узел знает свою главу (eyebrow у корней, reply-композер у детей)
      ...(chapterTitles
        ? { chapterSlug: r.chapterSlug, chapterTitle: chapterTitles.get(r.chapterSlug) ?? r.chapterSlug }
        : {}),
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

  const slugById = new Map(rows.map((r) => [r.id, r.chapterSlug] as const));
  const current: CommentView[] = [];
  const older: CommentView[] = [];
  for (const n of prunedRoots) {
    (n.revision < revisionFor(slugById.get(n.id)!) ? older : current).push(n);
  }

  let total = 0;
  (function countLive(nodes: CommentView[]) {
    for (const n of nodes) {
      if (!n.isDeleted) total++;
      countLive(n.children);
    }
  })(prunedRoots);

  return { current, older, total, canComment: gate.canComment, blockedReason: gate.blockedReason };
}
