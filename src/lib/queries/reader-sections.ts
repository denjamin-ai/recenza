// Сборка секций ридера: для каждой главы — engagement-состояние + кредит ревьюеров + флаг canVote.
// canVote: голосовать может залогиненный, КРОМЕ автора этой главы (binding; дублируется на API).

import { getReaderEngagement } from "./engagement";
import { getChapterReviewerCredit } from "./reviewer-credit";
import type { ReadableBlog, ReadableChapter, ReaderSection } from "./types";

export async function buildReaderSections(
  blog: ReadableBlog,
  chapters: ReadableChapter[],
  viewerId?: string,
): Promise<ReaderSection[]> {
  return Promise.all(
    chapters.map(async (chapter) => {
      const [engagement, credit] = await Promise.all([
        getReaderEngagement({
          chapterId: chapter.id,
          blogId: blog.id,
          authorId: blog.author.id,
          userId: viewerId,
        }),
        getChapterReviewerCredit({
          chapterId: chapter.id,
          latestRevisionNumber: chapter.revisionNumber,
          primaryHandle: chapter.primaryHandle,
        }),
      ]);
      return {
        chapter,
        engagement,
        credit,
        // Голосовать может кто угодно, КРОМЕ автора этой главы. Гость видит кнопку и по клику
        // уходит на логин (intent-replay) — поэтому НЕ требуем залогиненности здесь.
        canVote: viewerId !== blog.author.id,
      };
    }),
  );
}
