// Чтение engagement-состояния для ридера: счёт голосов БЛОГА (агрегат), мой голос, закладка, подписка.
// ui-feedback-5: голоса переехали с глав на блоги (blog_votes; модель прототипа). Состояние считается
// ОДИН раз на страницу (бар один: в whole-режиме наверху, в главе — после контента).
// Счёт голосов выводится на чтении через SUM (без денормализованного счётчика/миграции).

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogVotes, bookmarks, follows } from "@/lib/db/schema";

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
