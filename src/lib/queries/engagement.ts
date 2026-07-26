// Чтение engagement-состояния для ридера: счёт голосов БЛОГА (агрегат), мой голос, закладка, подписка.
// ui-feedback-5: голоса переехали с глав на блоги (blog_votes; модель прототипа). Состояние считается
// ОДИН раз на страницу (бар один: в whole-режиме наверху, в главе — после контента).
// Счёт голосов выводится на чтении через SUM (без денормализованного счётчика/миграции).

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blogVotes,
  blogs,
  bookmarks,
  chapterRevisions,
  chapters,
  follows,
  users,
} from "@/lib/db/schema";

export interface ReaderEngagement {
  score: number;
  myVote: 1 | -1 | 0;
  isBookmarked: boolean;
  isFollowing: boolean;
}

export async function getReaderEngagement(args: {
  blogId: string;
  authorId: string;
  userId?: string;
}): Promise<ReaderEngagement> {
  const { blogId, authorId, userId } = args;

  const scoreRow = (
    await db
      .select({ score: sql<number>`coalesce(sum(${blogVotes.value}), 0)` })
      .from(blogVotes)
      .where(eq(blogVotes.blogId, blogId))
  )[0];
  const score = Number(scoreRow?.score ?? 0);

  if (!userId) {
    return { score, myVote: 0, isBookmarked: false, isFollowing: false };
  }

  const [voteRow, bookmarkRow, followRow] = await Promise.all([
    db
      .select({ value: blogVotes.value })
      .from(blogVotes)
      .where(and(eq(blogVotes.userId, userId), eq(blogVotes.blogId, blogId)))
      .limit(1),
    db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.blogId, blogId)))
      .limit(1),
    db
      .select({ userId: follows.userId })
      .from(follows)
      .where(and(eq(follows.userId, userId), eq(follows.authorId, authorId)))
      .limit(1),
  ]);

  const myVote = voteRow[0]?.value === 1 ? 1 : voteRow[0]?.value === -1 ? -1 : 0;
  return {
    score,
    myVote,
    isBookmarked: bookmarkRow.length > 0,
    isFollowing: followRow.length > 0,
  };
}

/**
 * Гейт мутаций реакций (голос/закладка): блог должен быть ПУБЛИЧНО ВИДЕН.
 *
 * ⚠️ Аудит ИБ 2026-07-26. Раньше vote/bookmarks проверяли только «строка блога существует», из-за
 * чего реагировать можно было на черновик, на блог скрытого админом автора и на блог, скрытый по
 * жалобе (`hidden`). Последствия: накрутка `blogs.bookmarkCount` и `?sort=top` на невидимом
 * контенте + разница 200/404 как оракул существования. Условия совпадают с читательскими
 * поверхностями (`feed.ts`, `chapters.ts`): не скрыт, автор не заблокирован и сохранил `canAuthor`,
 * есть хотя бы одна published-ревизия.
 *
 * @returns `{ id, authorId }` либо `null` — вызывающий обязан отдать ЕДИНЫЙ 404 и на «нет такого»,
 *          и на «не виден», иначе роут снова станет оракулом.
 */
export async function resolveEngageableBlog(
  blogId: string,
): Promise<{ id: string; authorId: string } | null> {
  const row = (
    await db
      .select({ id: blogs.id, authorId: blogs.authorId })
      .from(blogs)
      .innerJoin(users, eq(blogs.authorId, users.id))
      .innerJoin(chapters, eq(chapters.blogId, blogs.id))
      .innerJoin(chapterRevisions, eq(chapterRevisions.chapterId, chapters.id))
      .where(
        and(
          eq(blogs.id, blogId),
          eq(blogs.hidden, false),
          eq(users.isBlocked, false),
          eq(users.canAuthor, true),
          eq(chapterRevisions.status, "published"),
        ),
      )
      .limit(1)
  )[0];
  return row ?? null;
}
