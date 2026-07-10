// Сборка секций ридера: для каждой главы — кредит ревьюеров. Engagement (голос за блог /
// закладка / подписка) с ui-feedback-5 считается ОДИН раз на страницу (getReaderEngagement),
// не per-chapter — см. страницы blog/[slug].

import { getChapterReviewerCredit } from "./reviewer-credit";
import type { ReadableBlog, ReadableChapter, ReaderSection } from "./types";

export async function buildReaderSections(
  blog: ReadableBlog,
  chapters: ReadableChapter[],
): Promise<ReaderSection[]> {
  return Promise.all(
    chapters.map(async (chapter) => {
      const credit = await getChapterReviewerCredit({
        chapterId: chapter.id,
        latestRevisionNumber: chapter.revisionNumber,
        primaryHandle: chapter.primaryHandle,
      });
      return { chapter, credit };
    }),
  );
}
