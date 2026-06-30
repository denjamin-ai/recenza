// Клиент-безопасные ссылки и константы ревью-флоу (Фаза 7). БЕЗ импортов db/auth/next-server —
// чтобы клиентские компоненты могли импортировать их, не таща серверный модуль queries/review.ts
// (и через него auth.ts/next/headers) в браузерный бандл. Сервер ре-экспортит их из queries/review.

/** Типы уведомлений ревью (payload.href ведёт получателя на нужный экран). */
export const REVIEW_NOTIFY = {
  invited: "review_invited", // ревьюеру: приглашение в ревью (Фаза 9)
  inviteAccepted: "review_invite_accepted", // автору: ревьюер принял приглашение (Фаза 9)
  inviteDeclined: "review_invite_declined", // автору: ревьюер отклонил приглашение (Фаза 9)
  skillsMismatch: "review_skills_mismatch", // автору: жалоба «навыки не совпадают» → исправьте навыки (Фаза 9)
  recruitRequested: "recruit_requested", // админу: автор просит подобрать ревьюеров (Фаза 9; обработка — Фаза 10)
  changesRequested: "review_changes_requested",
  ready: "review_ready",
  published: "review_published",
  comment: "review_comment",
  primaryChange: "review_primary_change",
} as const;

/** Кабинет ревьюера (входящие приглашения, активные ревью). */
export function reviewerInboxHref(): string {
  return "/reviewer";
}

export function reviewerReviewHref(chapterId: string): string {
  return `/reviewer/review/${chapterId}`;
}

export function authorReviewHref(blogSlug: string, chapterSlug: string): string {
  return `/author/blog/${blogSlug}/${chapterSlug}/review`;
}
