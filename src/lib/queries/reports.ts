// Жалобы: серверный резолв цели и право пожаловаться (Фаза 15, З-51).
//
// ⚠️ Клиент присылает ТОЛЬКО тип и id цели. Всё остальное — существование, видимость, «своё/чужое»
// и участие в ревью — проверяется здесь, на сервере. Роут не различает «цели нет» и «жаловаться
// нельзя»: обе ветки дают 404, иначе жалоба становится оракулом существования скрытых объектов.

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blogs,
  chapterReviewers,
  chapterRevisions,
  chapters,
  publicComments,
  reports,
  reviewerHistory,
  users,
} from "@/lib/db/schema";
import type { ReportTargetType } from "@/types";

/** Разрешённая цель жалобы: нормализованный id + участник, о котором жалоба (только для ревью). */
export interface ReportSubject {
  targetType: ReportTargetType;
  targetId: string;
  aboutHandle: string | null;
}

interface Reporter {
  id: string;
  handle: string;
}

/**
 * Проверяет цель и право жалобщика. `null` — цели нет ЛИБО жаловаться на неё нельзя
 * (единый ответ, см. шапку файла).
 */
export async function resolveReportSubject(
  targetType: ReportTargetType,
  targetId: string,
  aboutHandle: string | null,
  reporter: Reporter,
): Promise<ReportSubject | null> {
  if (targetType === "comment") return resolveComment(targetId, reporter);
  if (targetType === "blog") return resolveBlog(targetId, reporter);
  return resolveReview(targetId, aboutHandle, reporter);
}

async function resolveComment(commentId: string, reporter: Reporter): Promise<ReportSubject | null> {
  const row = (
    await db
      .select({ id: publicComments.id, authorId: publicComments.authorId })
      .from(publicComments)
      .where(and(eq(publicComments.id, commentId), isNull(publicComments.deletedAt)))
      .limit(1)
  )[0];
  if (!row) return null;
  // На свой комментарий жаловаться нечего — его можно удалить.
  if (row.authorId === reporter.id) return null;
  return { targetType: "comment", targetId: row.id, aboutHandle: null };
}

async function resolveBlog(blogId: string, reporter: Reporter): Promise<ReportSubject | null> {
  // Видимость — те же гейты, что у публичных поверхностей: не скрыт, автор не заблокирован
  // и не лишён авторства, есть хотя бы одна опубликованная глава.
  const row = (
    await db
      .select({ id: blogs.id, authorId: blogs.authorId })
      .from(chapterRevisions)
      .innerJoin(chapters, eq(chapterRevisions.chapterId, chapters.id))
      .innerJoin(blogs, eq(chapters.blogId, blogs.id))
      .innerJoin(users, eq(blogs.authorId, users.id))
      .where(
        and(
          eq(blogs.id, blogId),
          eq(chapterRevisions.status, "published"),
          eq(blogs.hidden, false),
          eq(users.isBlocked, false),
          eq(users.canAuthor, true),
        ),
      )
      .limit(1)
  )[0];
  if (!row) return null;
  if (row.authorId === reporter.id) return null;
  return { targetType: "blog", targetId: row.id, aboutHandle: null };
}

/**
 * Приватная жалоба на ревью (замена снесённому в Ф14 рейтингу, решение владельца).
 * Жаловаться может только УЧАСТНИК сессии главы (автор блога либо ревьюер этой главы), и только
 * на другого участника: иначе это канал доноса на кого угодно.
 */
async function resolveReview(
  chapterId: string,
  aboutHandle: string | null,
  reporter: Reporter,
): Promise<ReportSubject | null> {
  if (!aboutHandle) return null;
  if (aboutHandle === reporter.handle) return null;

  const chapter = (
    await db
      .select({ id: chapters.id, authorId: blogs.authorId })
      .from(chapters)
      .innerJoin(blogs, eq(chapters.blogId, blogs.id))
      .where(eq(chapters.id, chapterId))
      .limit(1)
  )[0];
  if (!chapter) return null;

  const participants = await chapterParticipants(chapterId);
  const reporterIsAuthor = chapter.authorId === reporter.id;
  if (!reporterIsAuthor && !participants.has(reporter.handle)) return null;

  // «О ком»: либо ревьюер этой главы, либо её автор (ревьюер тоже может пожаловаться на автора).
  const aboutIsAuthor = await isAuthorHandle(chapter.authorId, aboutHandle);
  if (!participants.has(aboutHandle) && !aboutIsAuthor) return null;

  return { targetType: "review", targetId: chapter.id, aboutHandle };
}

/** Ревьюеры главы: назначенные сейчас + кредитованные за прошлые версии. */
async function chapterParticipants(chapterId: string): Promise<Set<string>> {
  const [assigned, credited] = await Promise.all([
    db
      .select({ handle: chapterReviewers.handle })
      .from(chapterReviewers)
      .where(eq(chapterReviewers.chapterId, chapterId)),
    db
      .select({ handle: reviewerHistory.handle })
      .from(reviewerHistory)
      .where(eq(reviewerHistory.chapterId, chapterId)),
  ]);
  return new Set([...assigned, ...credited].map((r) => r.handle));
}

async function isAuthorHandle(authorId: string, handle: string): Promise<boolean> {
  const row = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, authorId), eq(users.handle, handle)))
      .limit(1)
  )[0];
  return !!row;
}

/**
 * Уже есть открытая жалоба этого пользователя на эту цель? Дедуп вместо частичного UNIQUE:
 * жалоб мало, гонок нет, а повторная жалоба ПОСЛЕ разбора должна быть разрешена.
 */
export async function hasOpenReport(
  reporterId: string,
  targetType: ReportTargetType,
  targetId: string,
): Promise<boolean> {
  const row = (
    await db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, reporterId),
          eq(reports.targetType, targetType),
          eq(reports.targetId, targetId),
          eq(reports.status, "open"),
        ),
      )
      .limit(1)
  )[0];
  return !!row;
}
