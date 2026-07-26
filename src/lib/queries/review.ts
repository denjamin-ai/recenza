// Запросы ревью-флоу (Фаза 7). getReviewSession — всё для ReviewPage (глава, ревизия, ревьюеры,
// треды+ответы, чат, strip глав). getReviewerQueue — активные ревью в кабинете ревьюера.
// resolveReviewAccess — handler-гард доступа (автор-владелец ИЛИ назначенный ревьюер; иначе 401/403/404).
//
// Доступ к под-роутам ревью: вердикт — только назначенный ревьюер; apply/submit-revision/
// primary-change — только автор; треды/ответы/чат — оба участника. Гейтинг — серверный (CLAUDE.md §POV).
// ⚠️ Фаза 13: публикация из этого набора ВЫШЛА — это авторское действие над своей главой
// (`/api/author/chapters/[chapterId]/publish`), а не шаг ревью.

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
  reviewerHistory,
  threadReplies,
  threads,
  users,
} from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import { getCurrentUser } from "@/lib/auth";
import { isReviewOpen } from "@/lib/review-status";
import type {
  Block,
  PublicUser,
  VerifiedTier,
  ReviewStatus,
  RevisionStatus,
  Suggestion,
  ThreadStatus,
  Verdict,
} from "@/types";

// ───────────────────────────── view-типы (сериализуемые) ─────────────────────────────

export interface ReviewReviewer {
  handle: string;
  displayName: string;
  slug: string;
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
  reviewStatus: ReviewStatus;
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
    skills: string[];
  };
  revision: {
    id: string;
    number: number;
    /** Ось публикации: draft | published. */
    status: RevisionStatus;
    /** Ось ревью: none | requested | in-review | changes-requested | reviewed. */
    reviewStatus: ReviewStatus;
    /** Ф14: токен закрытия сессии — единственный признак «ревью по этой ревизии завершено». */
    reviewClosedAt: number | null;
    /** Ф14: бейдж ревизии (null — не проверена). */
    verifiedTier: VerifiedTier | null;
    verifiedAt: number | null;
    summary: string | null;
    blocks: Block[];
    /** Снапшот последней публикации для инлайн-диффа; пусто → глава ещё не публиковалась (дифф «всё ново»). */
    prevBlocks: Block[];
    /** Отложенная публикация (Unix seconds); null — не запланирована. */
    scheduledAt: number | null;
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
  reviewStatus: ReviewStatus;
  reviewClosedAt: number | null;
  myVerdict: Verdict | null;
  openThreadCount: number;
}

// Константы/ссылки уведомлений — в клиент-безопасном @/lib/review-links; ре-экспорт для сервера.
export { REVIEW_NOTIFY, authorReviewHref, reviewerInboxHref, reviewerReviewHref } from "@/lib/review-links";

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
      reviewStatus: chapterRevisions.reviewStatus,
      reviewClosedAt: chapterRevisions.reviewClosedAt,
      verifiedTier: chapterRevisions.verifiedTier,
      verifiedAt: chapterRevisions.verifiedAt,
      summary: chapterRevisions.summary,
      blocks: chapterRevisions.blocks,
      prevBlocks: chapterRevisions.prevBlocks,
      scheduledAt: chapterRevisions.scheduledAt,
    })
    .from(chapterRevisions)
    .where(eq(chapterRevisions.chapterId, chapterId));
  if (revRows.length === 0) return null;
  const rev = revRows.reduce((a, b) => (b.number > a.number ? b : a));

  // Ревьюеры последней ревизии.
  const reviewerRows = await db
    .select({
      handle: chapterReviewers.handle,
      verdict: chapterReviewers.verdict,
      verdictAt: chapterReviewers.verdictAt,
      lastSeenAt: chapterReviewers.lastSeenAt,
      displayName: users.displayName,
      slug: users.slug,
    })
    .from(chapterReviewers)
    .innerJoin(users, eq(users.handle, chapterReviewers.handle))
    .where(
      and(eq(chapterReviewers.chapterId, chapterId), eq(chapterReviewers.revisionNumber, rev.number)),
    );

  // online — деривация из heartbeat (POST /api/review/[chapterId]/heartbeat каждые ~30с).
  const presenceThreshold = Math.floor(Date.now() / 1000) - 90;
  const reviewers: ReviewReviewer[] = reviewerRows
    .map((r) => ({
      handle: r.handle,
      displayName: r.displayName,
      slug: r.slug,
      verdict: (r.verdict as Verdict | null) ?? null,
      verdictAt: r.verdictAt,
      online: r.lastSeenAt !== null && r.lastSeenAt >= presenceThreshold,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "ru"));

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
      reviewStatus: chapterRevisions.reviewStatus,
    })
    .from(chapters)
    .innerJoin(chapterRevisions, eq(chapterRevisions.chapterId, chapters.id))
    .where(eq(chapters.blogId, head.blogId));

  const latestStrip = new Map<
    string,
    {
      slug: string;
      title: string;
      order: number;
      revNumber: number;
      status: RevisionStatus;
      reviewStatus: ReviewStatus;
    }
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
        reviewStatus: r.reviewStatus,
      });
    }
  }
  const chapterLinks: ReviewChapterLink[] = [...latestStrip.entries()]
    .map(([cid, c]) => ({
      slug: c.slug,
      title: c.title,
      order: c.order,
      status: c.status,
      reviewStatus: c.reviewStatus,
      active: cid === chapterId,
    }))
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
      skills: parseJson<string[]>(head.skills, []),
    },
    revision: {
      id: rev.id,
      number: rev.number,
      status: rev.status as RevisionStatus,
      reviewStatus: rev.reviewStatus as ReviewStatus,
      reviewClosedAt: rev.reviewClosedAt,
      verifiedTier: rev.verifiedTier,
      verifiedAt: rev.verifiedAt,
      summary: rev.summary,
      blocks: parseJson<Block[]>(rev.blocks, []),
      prevBlocks: parseJson<Block[]>(rev.prevBlocks, []),
      scheduledAt: rev.scheduledAt,
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

  // Последняя ревизия каждой назначенной главы (number + обе оси состояния).
  const revRows = await db
    .select({
      chapterId: chapterRevisions.chapterId,
      number: chapterRevisions.number,
      status: chapterRevisions.status,
      reviewStatus: chapterRevisions.reviewStatus,
      reviewClosedAt: chapterRevisions.reviewClosedAt,
    })
    .from(chapterRevisions)
    .where(inArray(chapterRevisions.chapterId, chapterIds));
  const latest = new Map<
    string,
    { number: number; status: RevisionStatus; reviewStatus: ReviewStatus; reviewClosedAt: number | null }
  >();
  for (const r of revRows) {
    const prev = latest.get(r.chapterId);
    if (!prev || r.number > prev.number) {
      latest.set(r.chapterId, {
        number: r.number,
        status: r.status,
        reviewStatus: r.reviewStatus,
        reviewClosedAt: r.reviewClosedAt,
      });
    }
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
    // Только назначения НА последнюю ревизию и в открытом ревью.
    if (row.revisionNumber !== lr.number) continue;
    if (!isReviewOpen(lr.reviewStatus, lr.reviewClosedAt)) continue;
    items.push({
      chapterId: row.chapterId,
      blogSlug: row.blogSlug,
      chapterSlug: row.chapterSlug,
      blogTitle: row.blogTitle,
      chapterTitle: row.chapterTitle,
      revisionNumber: lr.number,
      status: lr.status,
      reviewStatus: lr.reviewStatus,
      reviewClosedAt: lr.reviewClosedAt,
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

  // Возможность «автор» + владение. ⚠️ Аудит ИБ 2026-07-26: проверка `canAuthor` здесь ОБЯЗАТЕЛЬНА
  // и симметрична ветке ревьюера ниже. Без неё автор со СНЯТОЙ возможностью сохранял полный доступ
  // на запись к /api/review/** — включая threads/[id]/apply, который правит блоки главы, — то есть
  // отзыв возможности переставал действовать вопреки инварианту CLAUDE.md §Гейтинг.
  if (user.canAuthor && user.id === session.blog.authorId) {
    return { user, role: "author", session };
  }
  // Возможность «ревьюер» + фактическое назначение (defense in depth: отзыв возможности админом
  // закрывает доступ, даже если строка chapter_reviewers осталась).
  if (user.isReviewer && isAssignedReviewer(user.handle, session)) {
    return { user, role: "reviewer", session };
  }
  return NextResponse.json({ error: "Нет доступа к этому ревью." }, { status: 403 });
}

// ───────────────────────────── кабинет ревьюера (Фаза 14.6) ─────────────────────────────
//
// Кабинет перестал быть инбоксом приглашений: теперь это три таба — «Очередь» (свободные заявки,
// `getReviewQueue` из review-requests.ts), «Мои ревью» (то, что взято) и «Завершённые» (кредит).
// Группировка активных ревью и завершённых ПО БЛОГАМ — прямое требование владельца: ревьюер ведёт
// не отдельные главы, а блог целиком, и плоский список из 8 глав одного блога был нечитаем.

export interface ActiveReviewGroup {
  blogSlug: string;
  blogTitle: string;
  authorName: string;
  items: ReviewerQueueItem[];
}

/**
 * Активные ревью, сгруппированные по блогам (поверх `getReviewerQueue`).
 * Внутри группы «ваш ход» (без вердикта) поднимается наверх — это то, что ждёт ревьюера.
 */
export async function getReviewerActiveByBlog(handle: string): Promise<ActiveReviewGroup[]> {
  const items = await getReviewerQueue(handle);
  if (items.length === 0) return [];

  const slugs = [...new Set(items.map((i) => i.blogSlug))];
  const authorRows = await db
    .select({ slug: blogs.slug, authorName: users.displayName })
    .from(blogs)
    .innerJoin(users, eq(users.id, blogs.authorId))
    .where(inArray(blogs.slug, slugs));
  const authorBySlug = new Map(authorRows.map((r) => [r.slug, r.authorName]));

  const groups = new Map<string, ActiveReviewGroup>();
  for (const it of items) {
    let g = groups.get(it.blogSlug);
    if (!g) {
      g = {
        blogSlug: it.blogSlug,
        blogTitle: it.blogTitle,
        authorName: authorBySlug.get(it.blogSlug) ?? "",
        items: [],
      };
      groups.set(it.blogSlug, g);
    }
    g.items.push(it);
  }

  for (const g of groups.values()) {
    g.items.sort(
      (a, b) =>
        Number(a.myVerdict !== null) - Number(b.myVerdict !== null) ||
        a.chapterTitle.localeCompare(b.chapterTitle, "ru"),
    );
  }
  return [...groups.values()].sort((a, b) => a.blogTitle.localeCompare(b.blogTitle, "ru"));
}

export interface CompletedReviewChapter {
  chapterSlug: string;
  chapterTitle: string;
  revisionNumber: number;
  /** Бейдж ревизии, за которую выдан кредит; null — ревизия закрылась без бейджа. */
  verifiedTier: VerifiedTier | null;
}

export interface CompletedReviewGroup {
  blogSlug: string;
  blogTitle: string;
  chapters: CompletedReviewChapter[];
}

/**
 * Завершённые ревью: опубликованные главы, где handle числится в кредите (`reviewer_history`),
 * сгруппированные по блогам.
 *
 * Видимость — те же три фильтра, что у `getReadableBlog` (`queries/chapters.ts`): заблокированный
 * автор, снятый `can_author` и скрытый блог убирают контент отовсюду, и публичная витрина «что я
 * отрецензировал» не исключение. Глава должна иметь хотя бы одну published-ревизию, иначе кредита
 * никто не увидит (ревью черновика, который автор так и не опубликовал).
 */
export async function getReviewerCompleted(handle: string): Promise<CompletedReviewGroup[]> {
  const rows = await db
    .select({
      chapterId: reviewerHistory.chapterId,
      revisionNumber: reviewerHistory.revisionNumber,
      chapterSlug: chapters.slug,
      chapterTitle: chapters.title,
      chapterOrder: chapters.order,
      revisionTitle: chapterRevisions.title,
      verifiedTier: chapterRevisions.verifiedTier,
      blogSlug: blogs.slug,
      blogTitle: blogs.title,
    })
    .from(reviewerHistory)
    .innerJoin(chapters, eq(chapters.id, reviewerHistory.chapterId))
    .innerJoin(blogs, eq(blogs.id, chapters.blogId))
    .innerJoin(users, eq(users.id, blogs.authorId))
    .innerJoin(
      chapterRevisions,
      and(
        eq(chapterRevisions.chapterId, reviewerHistory.chapterId),
        eq(chapterRevisions.number, reviewerHistory.revisionNumber),
      ),
    )
    .where(
      and(
        eq(reviewerHistory.handle, handle),
        eq(users.isBlocked, false),
        eq(users.canAuthor, true),
        eq(blogs.hidden, false),
      ),
    );
  if (rows.length === 0) return [];

  const chapterIds = [...new Set(rows.map((r) => r.chapterId))];
  const publishedRows = await db
    .select({ chapterId: chapterRevisions.chapterId })
    .from(chapterRevisions)
    .where(
      and(inArray(chapterRevisions.chapterId, chapterIds), eq(chapterRevisions.status, "published")),
    );
  const published = new Set(publishedRows.map((r) => r.chapterId));

  // Кредит может лежать на нескольких ревизиях одной главы — показываем последнюю проверенную.
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!published.has(r.chapterId)) continue;
    const prev = latest.get(r.chapterId);
    if (!prev || r.revisionNumber > prev.revisionNumber) latest.set(r.chapterId, r);
  }

  const groups = new Map<string, CompletedReviewGroup & { order: Map<string, number> }>();
  for (const r of latest.values()) {
    let g = groups.get(r.blogSlug);
    if (!g) {
      g = { blogSlug: r.blogSlug, blogTitle: r.blogTitle, chapters: [], order: new Map() };
      groups.set(r.blogSlug, g);
    }
    g.order.set(r.chapterSlug, r.chapterOrder);
    g.chapters.push({
      chapterSlug: r.chapterSlug,
      // Заголовок берём из снапшота ревизии (Ф14): бейдж относится к версии, а не к текущему имени.
      chapterTitle: r.revisionTitle ?? r.chapterTitle,
      revisionNumber: r.revisionNumber,
      verifiedTier: r.verifiedTier,
    });
  }

  return [...groups.values()]
    .map((g) => {
      g.chapters.sort((a, b) => (g.order.get(a.chapterSlug) ?? 0) - (g.order.get(b.chapterSlug) ?? 0));
      return { blogSlug: g.blogSlug, blogTitle: g.blogTitle, chapters: g.chapters };
    })
    .sort((a, b) => a.blogTitle.localeCompare(b.blogTitle, "ru"));
}

/**
 * Объём проделанной работы: сколько РАЗНЫХ глав в скольких РАЗНЫХ блогах отрецензировал handle.
 * Пришёл на место снесённого рейтинга ревьюера (Ф14) — считается по кредиту, без фильтров
 * видимости: это личная статистика в приватном кабинете, а не публичная витрина.
 */
export async function getReviewerVolume(handle: string): Promise<{ chapters: number; blogs: number }> {
  const rows = await db
    .select({ chapterId: reviewerHistory.chapterId, blogId: chapters.blogId })
    .from(reviewerHistory)
    .innerJoin(chapters, eq(chapters.id, reviewerHistory.chapterId))
    .where(eq(reviewerHistory.handle, handle));
  return {
    chapters: new Set(rows.map((r) => r.chapterId)).size,
    blogs: new Set(rows.map((r) => r.blogId)).size,
  };
}
