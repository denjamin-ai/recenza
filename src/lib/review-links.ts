// Клиент-безопасные ссылки и константы ревью-флоу (Фаза 7). БЕЗ импортов db/auth/next-server —
// чтобы клиентские компоненты могли импортировать их, не таща серверный модуль queries/review.ts
// (и через него auth.ts/next/headers) в браузерный бандл. Сервер ре-экспортит их из queries/review.

/** Типы уведомлений ревью (payload.href ведёт получателя на нужный экран). */
export const REVIEW_NOTIFY = {
  recruitRequested: "recruit_requested", // админу: автор просит подобрать ревьюеров (Фаза 9; обработка — Фаза 10)
  changesRequested: "review_changes_requested",
  ready: "review_ready",
  published: "review_published",
  newChapter: "new_chapter", // подписчикам автора: опубликована новая глава (Фаза 12, P1-фикс)
  scheduledPublishFailed: "scheduled_publish_failed", // автору: отложенная публикация не прошла гейт (Фаза 12)
  comment: "review_comment",
  revisionSubmitted: "review_revision_submitted", // ревьюеру: автор сдал новую версию
  // ── заявки на ревью (Фаза 14) ──
  requestClaimed: "review_request_claimed", // автору: ревьюер взял заявку
  requestReturned: "review_request_returned", // автору+ревьюеру: заявка вернулась в очередь по SLA
  requestEscalated: "review_request_escalated", // админу: заявку никто не взял в срок
  requestExpired: "review_request_expired", // автору: заявка не нашла ревьюера и закрыта
  badgeGranted: "review_badge_granted", // автору: глава получила бейдж
  expertApplication: "expert_application_filed", // админу: анкета по инвайт-ссылке автора
} as const;
// ⚠️ Фаза 14 — сняты вместе со своими механизмами (типы больше не эмитятся; старые строки в БД
// остаются и рендерятся дефолтной подписью): `review_invited`, `review_invite_accepted`,
// `review_invite_declined`, `review_skills_mismatch` (приглашений нет — ревьюер берёт заявку сам),
// `review_primary_change`/`primary_changed` (роль «ведущего» упразднена; первый вообще никогда
// не отправлялся — З-29).

/** Типы уведомлений админ-действий (Фаза 10). payload.href ведёт получателя на нужный экран. */
export const ADMIN_NOTIFY = {
  forceApproved: "force_approved", // автору: админ опубликовал главу за него
  reviewerRemoved: "reviewer_removed", // ревьюеру: админ снял его с ревью (+ payload.reason)
  recruitApproved: "recruit_approved", // автору: запрос на подбор одобрен, направление на доске
  recruitRejected: "recruit_rejected", // автору: запрос на подбор отклонён (+ payload.reason)
  applicationAccepted: "application_accepted", // заявителю: принят в ревьюеры (роль выдана)
  applicationDeclined: "application_declined", // заявителю: заявка отклонена
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
