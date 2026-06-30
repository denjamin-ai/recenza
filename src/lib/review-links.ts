// Клиент-безопасные ссылки и константы ревью-флоу (Фаза 7). БЕЗ импортов db/auth/next-server —
// чтобы клиентские компоненты могли импортировать их, не таща серверный модуль queries/review.ts
// (и через него auth.ts/next/headers) в браузерный бандл. Сервер ре-экспортит их из queries/review.

/** Типы уведомлений ревью (payload.href ведёт получателя на нужный экран). */
export const REVIEW_NOTIFY = {
  invited: "review_invited",
  changesRequested: "review_changes_requested",
  ready: "review_ready",
  published: "review_published",
  comment: "review_comment",
  primaryChange: "review_primary_change",
} as const;

export function reviewerReviewHref(chapterId: string): string {
  return `/reviewer/review/${chapterId}`;
}

export function authorReviewHref(blogSlug: string, chapterSlug: string): string {
  return `/author/blog/${blogSlug}/${chapterSlug}/review`;
}
