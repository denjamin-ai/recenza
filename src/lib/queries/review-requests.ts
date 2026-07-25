// Заявки на ревью (Фаза 14) — очередь ревьюера, статусы заявок автора, сводка для админа.
//
// Модель: автор оставляет ЗАЯВКУ на главу, ревьюер берёт её сам. Автор нигде не выбирает ревьюеров
// (пикер, приглашения и согласие сняты), поэтому «подбор» перевернулся: раньше считали, какой
// ревьюер подходит автору, теперь — какая заявка подходит ревьюеру. Чистые функции подбора
// (`skillMatch`) переиспользуются как есть — меняются только аргументы местами.

import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blogs,
  chapterReviewers,
  chapterRevisions,
  chapters,
  reviewRequests,
  users,
} from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import { skillMatch } from "@/lib/reviewer-match";
import type { ReviewRequestChannel, ReviewRequestStatus } from "@/types";

export interface QueueRequestItem {
  id: string;
  chapterId: string;
  chapterSlug: string;
  chapterTitle: string;
  blogSlug: string;
  blogTitle: string;
  authorName: string;
  authorSlug: string;
  revisionNumber: number;
  /** Заявка на уже опубликованную главу — ревьюер должен понимать, что правки пойдут поверх. */
  isPublishedRevision: boolean;
  skills: string[];
  note: string | null;
  /** Доля навыков заявки, покрытых компетенциями ЭТОГО ревьюера. */
  matchPct: number;
  matched: string[];
  channel: ReviewRequestChannel;
  createdAt: number;
  dueAt: number | null;
}

/**
 * Очередь заявок для ревьюера: открытые заявки, отсортированные по совпадению с его компетенциями.
 *
 * Из выдачи исключаются: свои блоги (нельзя рецензировать себя), главы, где ревьюер уже назначен,
 * заблокированные авторы и авторы со снятым `can_author` (их контент скрыт отовсюду — ui-feedback
 * hotfix), скрытые блоги, а также заявки на неактуальную ревизию (автор успел сдать новую).
 */
export async function getReviewQueue(handle: string, userId: string): Promise<QueueRequestItem[]> {
  const rows = await db
    .select({
      id: reviewRequests.id,
      chapterId: reviewRequests.chapterId,
      revisionNumber: reviewRequests.revisionNumber,
      skills: reviewRequests.skills,
      note: reviewRequests.note,
      channel: reviewRequests.channel,
      createdAt: reviewRequests.createdAt,
      dueAt: reviewRequests.dueAt,
      chapterSlug: chapters.slug,
      chapterTitle: chapters.title,
      blogSlug: blogs.slug,
      blogTitle: blogs.title,
      authorId: blogs.authorId,
      authorName: users.displayName,
      authorSlug: users.slug,
    })
    .from(reviewRequests)
    .innerJoin(chapters, eq(chapters.id, reviewRequests.chapterId))
    .innerJoin(blogs, eq(blogs.id, chapters.blogId))
    .innerJoin(users, eq(users.id, blogs.authorId))
    .where(
      and(
        eq(reviewRequests.status, "open"),
        eq(users.isBlocked, false),
        eq(users.canAuthor, true),
        eq(blogs.hidden, false),
        ne(blogs.authorId, userId), // свой блог рецензировать нельзя
      ),
    )
    .orderBy(desc(reviewRequests.createdAt));
  if (rows.length === 0) return [];

  const chapterIds = [...new Set(rows.map((r) => r.chapterId))];

  // Последняя ревизия каждой главы + её ось публикации: заявка на устаревшую ревизию не показывается.
  const revRows = await db
    .select({
      chapterId: chapterRevisions.chapterId,
      number: chapterRevisions.number,
      status: chapterRevisions.status,
    })
    .from(chapterRevisions)
    .where(inArray(chapterRevisions.chapterId, chapterIds));
  const latest = new Map<string, { number: number; status: string }>();
  for (const r of revRows) {
    const prev = latest.get(r.chapterId);
    if (!prev || r.number > prev.number) latest.set(r.chapterId, { number: r.number, status: r.status });
  }

  // Главы, где ревьюер уже назначен на эту ревизию (взял заявку раньше либо назначен админом).
  const mineRows = await db
    .select({ chapterId: chapterReviewers.chapterId, revisionNumber: chapterReviewers.revisionNumber })
    .from(chapterReviewers)
    .where(and(eq(chapterReviewers.handle, handle), inArray(chapterReviewers.chapterId, chapterIds)));
  const mine = new Set(mineRows.map((r) => `${r.chapterId}#${r.revisionNumber}`));

  const me = (
    await db.select({ competencies: users.competencies }).from(users).where(eq(users.handle, handle)).limit(1)
  )[0];
  const competencies = parseJson<string[]>(me?.competencies, []);

  const items = rows
    .filter((r) => {
      const lr = latest.get(r.chapterId);
      return !!lr && lr.number === r.revisionNumber && !mine.has(`${r.chapterId}#${r.revisionNumber}`);
    })
    .map((r): QueueRequestItem => {
      const skills = parseJson<string[]>(r.skills, []);
      const m = skillMatch(competencies, skills);
      return {
        id: r.id,
        chapterId: r.chapterId,
        chapterSlug: r.chapterSlug,
        chapterTitle: r.chapterTitle,
        blogSlug: r.blogSlug,
        blogTitle: r.blogTitle,
        authorName: r.authorName,
        authorSlug: r.authorSlug,
        revisionNumber: r.revisionNumber,
        isPublishedRevision: latest.get(r.chapterId)?.status === "published",
        skills,
        note: r.note,
        matchPct: m.pct,
        matched: m.matched,
        channel: r.channel,
        createdAt: r.createdAt,
        dueAt: r.dueAt,
      };
    });

  // Сортировка: сначала по совпадению, затем СТАРЫЕ заявки выше (справедливость очереди —
  // иначе свежая заявка с тем же match% вечно перекрывала бы висящую).
  return items.sort(
    (a, b) => b.matchPct - a.matchPct || a.createdAt - b.createdAt || a.chapterTitle.localeCompare(b.chapterTitle, "ru"),
  );
}

export interface AuthorRequestView {
  id: string;
  chapterId: string;
  chapterSlug: string;
  chapterTitle: string;
  blogSlug: string;
  blogTitle: string;
  revisionNumber: number;
  status: ReviewRequestStatus;
  channel: ReviewRequestChannel;
  dueAt: number | null;
  claimedByName: string | null;
  claimedBySlug: string | null;
  returnCount: number;
  createdAt: number;
}

/** Живые заявки автора (open|claimed) — для кабинета и таймера SLA. */
export async function getAuthorReviewRequests(userId: string): Promise<AuthorRequestView[]> {
  const rows = await db
    .select({
      id: reviewRequests.id,
      chapterId: reviewRequests.chapterId,
      revisionNumber: reviewRequests.revisionNumber,
      status: reviewRequests.status,
      channel: reviewRequests.channel,
      dueAt: reviewRequests.dueAt,
      claimedBy: reviewRequests.claimedBy,
      returnCount: reviewRequests.returnCount,
      createdAt: reviewRequests.createdAt,
      chapterSlug: chapters.slug,
      chapterTitle: chapters.title,
      blogSlug: blogs.slug,
      blogTitle: blogs.title,
    })
    .from(reviewRequests)
    .innerJoin(chapters, eq(chapters.id, reviewRequests.chapterId))
    .innerJoin(blogs, eq(blogs.id, chapters.blogId))
    .where(and(eq(blogs.authorId, userId), inArray(reviewRequests.status, ["open", "claimed"])))
    .orderBy(desc(reviewRequests.createdAt));
  if (rows.length === 0) return [];

  const handles = [...new Set(rows.map((r) => r.claimedBy).filter((h): h is string => !!h))];
  const claimers =
    handles.length === 0
      ? []
      : await db
          .select({ handle: users.handle, displayName: users.displayName, slug: users.slug })
          .from(users)
          .where(inArray(users.handle, handles));
  const byHandle = new Map(claimers.map((c) => [c.handle, c]));

  return rows.map((r) => ({
    id: r.id,
    chapterId: r.chapterId,
    chapterSlug: r.chapterSlug,
    chapterTitle: r.chapterTitle,
    blogSlug: r.blogSlug,
    blogTitle: r.blogTitle,
    revisionNumber: r.revisionNumber,
    status: r.status,
    channel: r.channel,
    dueAt: r.dueAt,
    claimedByName: r.claimedBy ? (byHandle.get(r.claimedBy)?.displayName ?? r.claimedBy) : null,
    claimedBySlug: r.claimedBy ? (byHandle.get(r.claimedBy)?.slug ?? null) : null,
    returnCount: r.returnCount,
    createdAt: r.createdAt,
  }));
}

export interface AdminRequestRow extends AuthorRequestView {
  authorName: string;
  authorHandle: string;
  skills: string[];
  note: string | null;
}

/**
 * Все живые заявки платформы (Ф15) — очередь редакции: что висит без ревьюера и что просрочено.
 * Отличается от авторской выборки ровно снятым `eq(blogs.authorId, userId)` + именем автора,
 * поэтому построена поверх неё, а не отдельным запросом с копией JOIN-цепочки.
 * Сортировка: сначала непросроченные снизу — просроченные и старые всплывают наверх.
 */
export async function getAdminRequestQueue(now: number): Promise<AdminRequestRow[]> {
  const rows = await db
    .select({
      id: reviewRequests.id,
      chapterId: reviewRequests.chapterId,
      revisionNumber: reviewRequests.revisionNumber,
      status: reviewRequests.status,
      channel: reviewRequests.channel,
      dueAt: reviewRequests.dueAt,
      claimedBy: reviewRequests.claimedBy,
      returnCount: reviewRequests.returnCount,
      createdAt: reviewRequests.createdAt,
      skills: reviewRequests.skills,
      note: reviewRequests.note,
      chapterSlug: chapters.slug,
      chapterTitle: chapters.title,
      blogSlug: blogs.slug,
      blogTitle: blogs.title,
      authorName: users.displayName,
      authorHandle: users.handle,
    })
    .from(reviewRequests)
    .innerJoin(chapters, eq(chapters.id, reviewRequests.chapterId))
    .innerJoin(blogs, eq(blogs.id, chapters.blogId))
    .innerJoin(users, eq(users.id, blogs.authorId))
    .where(inArray(reviewRequests.status, ["open", "claimed"]))
    .orderBy(reviewRequests.createdAt);

  const handles = [...new Set(rows.map((r) => r.claimedBy).filter((h): h is string => !!h))];
  const claimers =
    handles.length === 0
      ? []
      : await db
          .select({ handle: users.handle, displayName: users.displayName, slug: users.slug })
          .from(users)
          .where(inArray(users.handle, handles));
  const byHandle = new Map(claimers.map((c) => [c.handle, c]));

  const items = rows.map((r) => ({
    id: r.id,
    chapterId: r.chapterId,
    chapterSlug: r.chapterSlug,
    chapterTitle: r.chapterTitle,
    blogSlug: r.blogSlug,
    blogTitle: r.blogTitle,
    revisionNumber: r.revisionNumber,
    status: r.status,
    channel: r.channel,
    dueAt: r.dueAt,
    claimedByName: r.claimedBy ? (byHandle.get(r.claimedBy)?.displayName ?? r.claimedBy) : null,
    claimedBySlug: r.claimedBy ? (byHandle.get(r.claimedBy)?.slug ?? null) : null,
    returnCount: r.returnCount,
    createdAt: r.createdAt,
    authorName: r.authorName,
    authorHandle: r.authorHandle,
    skills: parseJson<string[]>(r.skills, []),
    note: r.note,
  }));

  // Просроченные — наверх; внутри группы старые выше (та же справедливость, что в очереди ревьюера).
  const overdue = (r: AdminRequestRow) => (r.dueAt != null && r.dueAt <= now ? 0 : 1);
  return items.sort((a, b) => overdue(a) - overdue(b) || a.createdAt - b.createdAt);
}

/** Живая заявка на конкретную ревизию (для редактора: показать статус вместо формы). */
export async function getRequestForRevision(
  chapterId: string,
  revisionNumber: number,
): Promise<AuthorRequestView | null> {
  const row = (
    await db
      .select({
        id: reviewRequests.id,
        status: reviewRequests.status,
        channel: reviewRequests.channel,
        dueAt: reviewRequests.dueAt,
        claimedBy: reviewRequests.claimedBy,
        returnCount: reviewRequests.returnCount,
        createdAt: reviewRequests.createdAt,
        chapterSlug: chapters.slug,
        chapterTitle: chapters.title,
        blogSlug: blogs.slug,
        blogTitle: blogs.title,
      })
      .from(reviewRequests)
      .innerJoin(chapters, eq(chapters.id, reviewRequests.chapterId))
      .innerJoin(blogs, eq(blogs.id, chapters.blogId))
      .where(
        and(
          eq(reviewRequests.chapterId, chapterId),
          eq(reviewRequests.revisionNumber, revisionNumber),
          inArray(reviewRequests.status, ["open", "claimed"]),
        ),
      )
      .limit(1)
  )[0];
  if (!row) return null;

  const claimer = row.claimedBy
    ? (
        await db
          .select({ displayName: users.displayName, slug: users.slug })
          .from(users)
          .where(eq(users.handle, row.claimedBy))
          .limit(1)
      )[0]
    : null;

  return {
    id: row.id,
    chapterId,
    chapterSlug: row.chapterSlug,
    chapterTitle: row.chapterTitle,
    blogSlug: row.blogSlug,
    blogTitle: row.blogTitle,
    revisionNumber,
    status: row.status,
    channel: row.channel,
    dueAt: row.dueAt,
    claimedByName: claimer?.displayName ?? row.claimedBy,
    claimedBySlug: claimer?.slug ?? null,
    returnCount: row.returnCount,
    createdAt: row.createdAt,
  };
}
