// Две оси состояния главы (Фаза 13) — единый источник для сервера и UI.
//
// Ось ПУБЛИКАЦИИ  (`chapter_revisions.status`)        — draft | published
// Ось РЕВЬЮ       (`chapter_revisions.review_status`) — none | requested | in-review | changes-requested | reviewed
//
// Оси независимы: главу можно опубликовать с `review_status = 'none'`, а ревью запросить на уже
// опубликованную ревизию. Раньше активность ревью проверялась ДЕВЯТЬЮ копиями множества
// {under-review, changes-requested} (7 локальных `const ACTIVE`, `ACTIVE_REVISION_STATUSES`,
// инлайн-`inArray` в cron) и пятью копиями словаря статусов в компонентах — теперь всё здесь.
//
// Файл клиент-безопасен: импорты только type-only (стираются компилятором), схема БД в бандл не тянется.

import type { ReviewStatus, RevisionStatus } from "@/types";

/** Ревью по ревизии заведено (любое состояние, кроме «не запрашивали»). */
export const OPEN_REVIEW_STATUSES = [
  "requested",
  "in-review",
  "changes-requested",
  "reviewed",
] as const satisfies readonly ReviewStatus[];

/**
 * Ревью-сессия открыта — можно ставить вердикты, вести треды, чат и применять правки.
 * ⚠️ Считается по ОБЕИМ осям: публикация закрывает сессию, даже если `review_status = 'reviewed'`
 * (он переживает публикацию намеренно — это основание кредита и бейджа Ф14).
 * `reviewed` входит в «открытые» сознательно: ревьюер должен мочь передумать и сменить вердикт
 * на `request-changes` после того, как все одобрили (паритет с поведением до Фазы 13).
 */
export function isReviewOpen(status: RevisionStatus, reviewStatus: ReviewStatus): boolean {
  return status !== "published" && reviewStatus !== "none";
}

/**
 * Автор может править ревизию.
 *   published                      → да, но PATCH заведёт ревизию-черновик ПОВЕРХ (Ф13);
 *   draft + none|changes-requested → да, in place;
 *   draft + requested|in-review|reviewed → нет: ревизия у ревьюеров (409).
 */
export function isRevisionEditable(status: RevisionStatus, reviewStatus: ReviewStatus): boolean {
  if (status === "published") return true;
  return reviewStatus === "none" || reviewStatus === "changes-requested";
}

// ───────────────────────────── подписи для UI ─────────────────────────────

export interface StatusMeta {
  label: string;
  cls: string;
}

/** Первичный бейдж — где глава находится по оси публикации. */
export const PUBLICATION_META: Record<RevisionStatus, StatusMeta> = {
  draft: { label: "Черновик", cls: "bg-[var(--muted)] text-[var(--muted-foreground)]" },
  published: { label: "Опубликовано", cls: "bg-[var(--success-bg)] text-[var(--success)]" },
};

/** Вторичный бейдж — состояние ревью. `none` бейджа не имеет (ревью не запрашивали). */
export const REVIEW_META: Record<Exclude<ReviewStatus, "none">, StatusMeta> = {
  requested: { label: "Ждёт ревьюера", cls: "bg-[var(--info-bg)] text-[var(--info)]" },
  "in-review": { label: "На ревью", cls: "bg-[var(--info-bg)] text-[var(--info)]" },
  "changes-requested": { label: "Нужны правки", cls: "bg-[var(--warning-bg)] text-[var(--warning)]" },
  reviewed: { label: "Ревью пройдено", cls: "bg-[var(--success-bg)] text-[var(--success)]" },
};

export function reviewMeta(reviewStatus: ReviewStatus): StatusMeta | null {
  return reviewStatus === "none" ? null : REVIEW_META[reviewStatus];
}

/** Точка-индикатор главы в компактных списках (кабинет автора). Ревью важнее публикации. */
export function statusDotClass(status: RevisionStatus, reviewStatus: ReviewStatus): string {
  if (reviewStatus === "changes-requested") return "bg-[var(--warning)]";
  if (reviewStatus === "requested" || reviewStatus === "in-review") return "bg-[var(--info)]";
  if (status === "published") return "bg-[var(--success)]";
  return "bg-[var(--muted-foreground)]";
}
