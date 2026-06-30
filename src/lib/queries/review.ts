// Запросы ревью-флоу (Фаза 7). getReviewSession — всё для ReviewPage (глава, ревизия, ревьюеры,
// треды+ответы, чат, strip глав). getReviewerQueue — активные ревью в кабинете ревьюера.
// resolveReviewAccess — handler-гард доступа (автор-владелец ИЛИ назначенный ревьюер; иначе 401/403/404).
//
// Доступ к под-роутам ревью: вердикт — только назначенный ревьюер; apply/publish/submit-revision/
// primary-change — только автор; треды/ответы/чат — оба участника. Гейтинг — серверный (CLAUDE.md §POV).

import { cache } from "react";
import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  blogs,
  chapterReviewers,
  chapterRevisions,
  chapters,
  reviewChat,
  threadReplies,
  threads,
  users,
} from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import { getCurrentUser } from "@/lib/auth";
import type { Block, PublicUser, RevisionStatus, Suggestion, ThreadStatus, Verdict } from "@/types";

// ───────────────────────────── view-типы (сериализуемые) ─────────────────────────────

export interface ReviewReviewer {
  handle: string;
  displayName: string;
  slug: string;
  isPrimary: boolean;
  verdict: Verdict | null;
  verdictAt: number | null;
  online: boolean;
}

export interface ReviewThreadReply {
  id: string;
  fromHandle: string;
  fromName: string;
  text: string;
  createdAt: number;
}

export interface ReviewThread {
  id: string;
  blockId: string;
  anchor: string | null;
  status: ThreadStatus;
  fromHandle: string;
  fromName: string;
  text: string;
  suggestion: Suggestion | null;
  createdAt: number;
  replies: ReviewThreadReply[];
}

export interface ReviewChatLine {
  id: string;
  fromHandle: string;
  fromName: string;
  text: string;
  createdAt: number;
}

export interface ReviewChapterLink {
  slug: string;
  title: string;
  order: number;
  status: RevisionStatus;
  active: boolean;
}

export interface ReviewSession {
  blog: {
    id: string;
    slug: string;
    title: string;
    authorId: string;
    authorHandle: string;
    authorName: string;
    authorSlug: string;
  };
  chapter: {
    id: string;
    slug: string;
    title: string;
    order: number;
    primaryHandle: string | null;
    skills: string[];
  };
  revision: {
    id: string;
    number: number;
    status: RevisionStatus;
    summary: string | null;
    blocks: Block[];
    /** Снапшот последней публикации для инлайн-диффа; пусто → глава ещё не публиковалась (дифф «всё ново»). */
    prevBlocks: Block[];
  };
  reviewers: ReviewReviewer[];
  threads: ReviewThread[];
  chat: ReviewChatLine[];
  /** Все главы блога (для strip-навигации). */
  chapters: ReviewChapterLink[];
  /** Все назначенные ревьюеры последней ревизии вынесли вердикт approve (и их ≥1). */
  allApproved: boolean;
  openThreadCount: number;
}

export interface ReviewerQueueItem {
  chapterId: string;
  blogSlug: string;
  chapterSlug: string;
  blogTitle: string;
  chapterTitle: string;
  revisionNumber: number;
  status: RevisionStatus;
  isPrimary: boolean;
  myVerdict: Verdict | null;
  openThreadCount: number;
}

// Константы/ссылки уведомлений — в клиент-безопасном @/lib/review-links; ре-экспорт для сервера.
export { REVIEW_NOTIFY, authorReviewHref, reviewerReviewHref } from "@/lib/review-links";

// ───────────────────────────── getReviewSession ─────────────────────────────

/** Полная сессия ревью по chapterId (без авторизации — гейтинг у вызывающего). null — глава/ревизия не найдена. */
export const getReviewSession = cache(async (chapterId: string): Promise<ReviewSession | null> => {
  const head = (
    await db
      .select({
        chapterId: chapters.id,
        chapterSlug: chapters.slug,
        chapterTitle: chapters.title,
        chapterOrder: chapters.order,
        primaryHandle: chapters.primaryHandle,
        skills: chapters.skills,
        blogId: blogs.id,
        blogSlug: blogs.slug,
        blogTitle: blogs.title,
        authorId: blogs.authorId,
        authorHandle: users.handle,
        authorName: users.displayName,
        authorSlug: users.slug,
      })
      .from(chapters)
      .innerJoin(blogs, eq(blogs.id, chapters.blogId))
      .innerJoin(users, eq(users.id, blogs.authorId))
      .where(eq(chapters.id, chapterId))
      .limit(1)
  )[0];
  if (!head) return null;

  // Последняя ревизия (max number).
  const revRows = await db
    .select({
      id: chapterRevisions.id,
      number: chapterRevisions.number,
      status: chapterRevisions.status,
      summary: chapterRevisions.summary,
      blocks: chapterRevisions.blocks,
      prevBlocks: chapterRevisions.prevBlocks,
    })
    .from(chapterRevisions)
    .where(eq(chapterRevisions.chapterId, chapterId));
  if (revRows.length === 0) return null;
  const rev = revRows.reduce((a, b) => (b.number > a.number ? b : a));

  // Ревьюеры последней ревизии.
  const reviewerRows = await db
    .select({
      handle: chapterReviewers.handle,
      isPrimary: chapterReviewers.isPrimary,
      verdict: chapterReviewers.verdict,
      verdictAt: chapterReviewers.verdictAt,
      online: chapterReviewers.online,
      displayName: users.displayName,
      slug: users.slug,
    })
    .from(chapterReviewers)
    .innerJoin(users, eq(users.handle, chapterReviewers.handle))
    .where(
      and(eq(chapterReviewers.chapterId, chapterId), eq(chapterReviewers.revisionNumber, rev.number)),
    );

  const reviewers: ReviewReviewer[] = reviewerRows
    .map((r) => ({
      handle: r.handle,
      displayName: r.displayName,
      slug: r.slug,
      isPrimary: r.isPrimary,
      verdict: (r.verdict as Verdict | null) ?? null,
      verdictAt: r.verdictAt,
      online: r.online,
    }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  // Треды последней ревизии + ответы.
  const threadRows = await db
    .select({
      id: threads.id,
      blockId: threads.blockId,
      anchor: threads.anchor,
      status: threads.status,
      fromHandle: threads.fromHandle,
      text: threads.text,
      suggestion: threads.suggestion,
      createdAt: threads.createdAt,
      fromName: users.displayName,
    })
    .from(threads)
    .innerJoin(users, eq(users.handle, threads.fromHandle))
    .where(and(eq(threads.chapterId, chapterId), eq(threads.revisionNumber, rev.number)))
    .orderBy(asc(threads.createdAt));

  const threadIds = threadRows.map((t) => t.id);
  const replyRows =
    threadIds.length === 0
      ? []
      : await db
          .select({
            id: threadReplies.id,
            threadId: threadReplies.threadId,
            fromHandle: threadReplies.fromHandle,
            text: threadReplies.text,
            createdAt: threadReplies.createdAt,
            fromName: users.displayName,
          })
          .from(threadReplies)
          .innerJoin(users, eq(users.handle, threadReplies.fromHandle))
          .where(inArray(threadReplies.threadId, threadIds))
          .orderBy(asc(threadReplies.createdAt));

  const repliesByThread = new Map<string, ReviewThreadReply[]>();
  for (const r of replyRows) {
    const arr = repliesByThread.get(r.threadId) ?? [];
    arr.push({ id: r.id, fromHandle: r.fromHandle, fromName: r.fromName, text: r.text, createdAt: r.createdAt });
    repliesByThread.set(r.threadId, arr);
  }

  const threadViews: ReviewThread[] = threadRows.map((t) => ({
    id: t.id,
    blockId: t.blockId,
    anchor: t.anchor,
    status: t.status,
    fromHandle: t.fromHandle,
    fromName: t.fromName,
    text: t.text,
    suggestion: parseJson<Suggestion | null>(t.suggestion, null),
    createdAt: t.createdAt,
    replies: repliesByThread.get(t.id) ?? [],
  }));

  // Чат сессии последней ревизии.
  const chatRows = await db
    .select({
      id: reviewChat.id,
      fromHandle: reviewChat.fromHandle,
      text: reviewChat.text,
      createdAt: reviewChat.createdAt,
      fromName: users.displayName,
    })
    .from(reviewChat)
    .innerJoin(users, eq(users.handle, reviewChat.fromHandle))
    .where(and(eq(reviewChat.chapterId, chapterId), eq(reviewChat.revisionNumber, rev.number)))
    .orderBy(asc(reviewChat.createdAt));

  const chat: ReviewChatLine[] = chatRows.map((c) => ({
    id: c.id,
    fromHandle: c.fromHandle,
    fromName: c.fromName,
    text: c.text,
    createdAt: c.createdAt,
  }));

  // Strip глав блога (статус = последняя ревизия каждой главы).
  const stripRows = await db
    .select({
      chapterId: chapters.id,
      slug: chapters.slug,
      title: chapters.title,
      order: chapters.order,
      revNumber: chapterRevisions.number,
      status: chapterRevisions.status,
    })
    .from(chapters)
    .innerJoin(chapterRevisions, eq(chapterRevisions.chapterId, chapters.id))
    .where(eq(chapters.blogId, head.blogId));

  const latestStrip = new Map<
    string,
    { slug: string; title: string; order: number; revNumber: number; status: RevisionStatus }
  >();
  for (const r of stripRows) {
    const prev = latestStrip.get(r.chapterId);
    if (!prev || r.revNumber > prev.revNumber) {
      latestStrip.set(r.chapterId, {
        slug: r.slug,
        title: r.title,
        order: r.order,
        revNumber: r.revNumber,
        status: r.status,
      });
    }
  }
  const chapterLinks: ReviewChapterLink[] = [...latestStrip.entries()]
    .map(([cid, c]) => ({ slug: c.slug, title: c.title, order: c.order, status: c.status, active: cid === chapterId }))
    .sort((a, b) => a.order - b.order);

  const allApproved =
    reviewers.length > 0 && reviewers.every((r) => r.verdict === "approve");
  const openThreadCount = threadViews.filter((t) => t.status === "open").length;

  return {
    blog: {
      id: head.blogId,
      slug: head.blogSlug,
      title: head.blogTitle,
      authorId: head.authorId,
      authorHandle: head.authorHandle,
      authorName: head.authorName,
      authorSlug: head.authorSlug,
    },
    chapter: {
      id: head.chapterId,
      slug: head.chapterSlug,
      title: head.chapterTitle,
      order: head.chapterOrder,
      primaryHandle: head.primaryHandle,
      skills: parseJson<string[]>(head.skills, []),
    },
    revision: {
      id: rev.id,
      number: rev.number,
      status: rev.status as RevisionStatus,
      summary: rev.summary,
      blocks: parseJson<Block[]>(rev.blocks, []),
      prevBlocks: parseJson<Block[]>(rev.prevBlocks, []),
    },
    reviewers,
    threads: threadViews,
    chat,
    chapters: chapterLinks,
    allApproved,
    openThreadCount,
  };
});

// ───────────────────────────── getReviewerQueue ─────────────────────────────

/** Активные ревью ревьюера: назначен на последнюю ревизию главы в статусе under-review|changes-requested. */
export async function getReviewerQueue(handle: string): Promise<ReviewerQueueItem[]> {
  const assignedRows = await db
    .select({
      chapterId: chapterReviewers.chapterId,
      revisionNumber: chapterReviewers.revisionNumber,
      isPrimary: chapterReviewers.isPrimary,
      verdict: chapterReviewers.verdict,
      chapterSlug: chapters.slug,
      chapterTitle: chapters.title,
      blogSlug: blogs.slug,
      blogTitle: blogs.title,
    })
    .from(chapterReviewers)
    .innerJoin(chapters, eq(chapters.id, chapterReviewers.chapterId))
    .innerJoin(blogs, eq(blogs.id, chapters.blogId))
    .where(eq(chapterReviewers.handle, handle));
  if (assignedRows.length === 0) return [];

  const chapterIds = [...new Set(assignedRows.map((r) => r.chapterId))];

  // Последняя ревизия каждой назначенной главы (number + status).
  const revRows = await db
    .select({
      chapterId: chapterRevisions.chapterId,
      number: chapterRevisions.number,
      status: chapterRevisions.status,
    })
    .from(chapterRevisions)
    .where(inArray(chapterRevisions.chapterId, chapterIds));
  const latest = new Map<string, { number: number; status: RevisionStatus }>();
  for (const r of revRows) {
    const prev = latest.get(r.chapterId);
    if (!prev || r.number > prev.number) latest.set(r.chapterId, { number: r.number, status: r.status });
  }

  // Открытые треды (для счётчика) — только по активным главам последней ревизии.
  const openCountKey = (cid: string, n: number) => `${cid}#${n}`;
  const threadRows = await db
    .select({
      chapterId: threads.chapterId,
      revisionNumber: threads.revisionNumber,
      status: threads.status,
    })
    .from(threads)
    .where(inArray(threads.chapterId, chapterIds));
  const openCounts = new Map<string, number>();
  for (const t of threadRows) {
    if (t.status !== "open") continue;
    const k = openCountKey(t.chapterId, t.revisionNumber);
    openCounts.set(k, (openCounts.get(k) ?? 0) + 1);
  }

  const items: ReviewerQueueItem[] = [];
  for (const row of assignedRows) {
    const lr = latest.get(row.chapterId);
    if (!lr) continue;
    // Только назначения НА последнюю ревизию и в активном статусе.
    if (row.revisionNumber !== lr.number) continue;
    if (lr.status !== "under-review" && lr.status !== "changes-requested") continue;
    items.push({
      chapterId: row.chapterId,
      blogSlug: row.blogSlug,
      chapterSlug: row.chapterSlug,
      blogTitle: row.blogTitle,
      chapterTitle: row.chapterTitle,
      revisionNumber: lr.number,
      status: lr.status,
      isPrimary: row.isPrimary,
      myVerdict: (row.verdict as Verdict | null) ?? null,
      openThreadCount: openCounts.get(openCountKey(row.chapterId, lr.number)) ?? 0,
    });
  }
  return items;
}

/** chapterId по (blogSlug, chapterSlug) — для author-роута ревью (slug-based). null — не найдено. */
export const getChapterIdBySlugs = cache(
  async (blogSlug: string, chapterSlug: string): Promise<string | null> => {
    const row = (
      await db
        .select({ id: chapters.id })
        .from(chapters)
        .innerJoin(blogs, eq(blogs.id, chapters.blogId))
        .where(and(eq(blogs.slug, blogSlug), eq(chapters.slug, chapterSlug)))
        .limit(1)
    )[0];
    return row?.id ?? null;
  },
);

/** handle → users.id для адресации уведомлений (recipientId). Несуществующие handle опускаются. */
export async function userIdsByHandle(handles: string[]): Promise<Map<string, string>> {
  const list = [...new Set(handles)].filter(Boolean);
  if (list.length === 0) return new Map();
  const rows = await db
    .select({ handle: users.handle, id: users.id })
    .from(users)
    .where(inArray(users.handle, list));
  return new Map(rows.map((r) => [r.handle, r.id]));
}

// ───────────────────────────── доступ (handler-гард) ─────────────────────────────

export type ReviewRole = "author" | "reviewer";
export interface ReviewAccess {
  user: PublicUser;
  role: ReviewRole;
  session: ReviewSession;
}

/** true — handle назначен ревьюером на последнюю ревизию сессии. */
export function isAssignedReviewer(handle: string, session: ReviewSession): boolean {
  return session.reviewers.some((r) => r.handle === handle);
}

/**
 * Гард доступа к ревью для API-роутов (`/api/review/**`): автор-владелец ИЛИ назначенный ревьюер.
 * Возвращает ReviewAccess | NextResponse (в хендлере результат нужно вернуть). Админ — не участник (Фаза 10).
 */
export async function resolveReviewAccess(chapterId: string): Promise<ReviewAccess | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const session = await getReviewSession(chapterId);
  if (!session) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });

  if (user.id === session.blog.authorId) return { user, role: "author", session };
  if (user.role === "reviewer" && isAssignedReviewer(user.handle, session)) {
    return { user, role: "reviewer", session };
  }
  return NextResponse.json({ error: "Нет доступа к этому ревью." }, { status: 403 });
}
