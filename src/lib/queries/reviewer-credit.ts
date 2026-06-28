// Кредит ревьюеров опубликованной главы: текущая версия (чипами) + прошлые версии (за раскрытием).
// Источник — reviewer_history (кредит по версиям). Ведущий помечается по chapters.primaryHandle.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviewerHistory, users } from "@/lib/db/schema";

export interface ReviewerChip {
  handle: string;
  displayName: string;
  slug: string;
  isPrimary: boolean;
}

export interface PastVersionCredit {
  revision: number;
  reviewers: ReviewerChip[];
}

export interface ChapterReviewerCredit {
  current: ReviewerChip[];
  past: PastVersionCredit[];
}

export async function getChapterReviewerCredit(args: {
  chapterId: string;
  latestRevisionNumber: number;
  primaryHandle: string | null;
}): Promise<ChapterReviewerCredit> {
  const { chapterId, latestRevisionNumber, primaryHandle } = args;

  const rows = await db
    .select({
      revision: reviewerHistory.revisionNumber,
      handle: reviewerHistory.handle,
      displayName: users.displayName,
      slug: users.slug,
    })
    .from(reviewerHistory)
    .innerJoin(users, eq(reviewerHistory.handle, users.handle))
    .where(eq(reviewerHistory.chapterId, chapterId));

  const byRevision = new Map<number, ReviewerChip[]>();
  for (const r of rows) {
    const chip: ReviewerChip = {
      handle: r.handle,
      displayName: r.displayName,
      slug: r.slug,
      isPrimary: primaryHandle != null && r.handle === primaryHandle,
    };
    const list = byRevision.get(r.revision) ?? [];
    list.push(chip);
    byRevision.set(r.revision, list);
  }

  const current = byRevision.get(latestRevisionNumber) ?? [];
  const past: PastVersionCredit[] = [...byRevision.entries()]
    .filter(([rev]) => rev < latestRevisionNumber)
    .sort((a, b) => b[0] - a[0])
    .map(([revision, reviewers]) => ({ revision, reviewers }));

  return { current, past };
}
