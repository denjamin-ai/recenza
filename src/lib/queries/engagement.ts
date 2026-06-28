// Чтение engagement-состояния для ридера: счёт голосов главы (агрегат), мой голос, закладка, подписка.
// Счёт голосов выводится на чтении через SUM (без денормализованного счётчика/миграции).

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookmarks, chapterVotes, follows } from "@/lib/db/schema";

export interface ReaderEngagement {
  score: number;
  myVote: 1 | -1 | 0;
  isBookmarked: boolean;
  isFollowing: boolean;
}

export async function getReaderEngagement(args: {
  chapterId: string;
  blogId: string;
  authorId: string;
  userId?: string;
}): Promise<ReaderEngagement> {
  const { chapterId, blogId, authorId, userId } = args;

  const scoreRow = (
    await db
      .select({ score: sql<number>`coalesce(sum(${chapterVotes.value}), 0)` })
      .from(chapterVotes)
      .where(eq(chapterVotes.chapterId, chapterId))
  )[0];
  const score = Number(scoreRow?.score ?? 0);

  if (!userId) {
    return { score, myVote: 0, isBookmarked: false, isFollowing: false };
  }

  const [voteRow, bookmarkRow, followRow] = await Promise.all([
    db
      .select({ value: chapterVotes.value })
      .from(chapterVotes)
      .where(and(eq(chapterVotes.userId, userId), eq(chapterVotes.chapterId, chapterId)))
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
