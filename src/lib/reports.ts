// Жалобы модератору — ЧИСТЫЙ модуль (без db/auth), общий для формы и для валидации API.
// По образцу `src/lib/banners.ts`: каталог причин и лимиты живут в ОДНОМ месте, иначе форма и
// ответ 400 расходятся. Каталог причин — из прототипа (`data/fake-data.js:574-579`).

import type { ReportTargetType } from "@/types";

export const REPORT_REASONS = [
  { id: "spam", label: "Спам / реклама" },
  { id: "abuse", label: "Оскорбления / токсичность" },
  { id: "offtopic", label: "Не по теме" },
  { id: "other", label: "Другое" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

/** Комментарий модератору — необязателен; лимит общий для textarea (maxLength) и для API. */
export const MAX_REPORT_NOTE = 1000;

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && REPORT_REASONS.some((r) => r.id === value);
}

/**
 * Подпись причины. ⚠️ Fallback на сырую строку обязателен: до Ф15 `reports.reason` был свободным
 * текстом, и в БД (в т.ч. в сиде) лежат строки вроде «Спам в комментариях» — их нужно показывать
 * как есть, а не терять при выводе.
 */
export function reasonLabel(raw: string): string {
  return REPORT_REASONS.find((r) => r.id === raw)?.label ?? raw;
}

/** Подпись цели для админ-экрана (З-61: раньше печатался сырой `target_type`). */
export const REPORT_TARGET_LABEL: Record<ReportTargetType, string> = {
  comment: "комментарий",
  blog: "блог",
  review: "ревью",
};

/** Заголовок модалки по цели. */
export const REPORT_DIALOG_TITLE: Record<ReportTargetType, string> = {
  comment: "Пожаловаться на комментарий",
  blog: "Пожаловаться на блог",
  review: "Пожаловаться на ревью",
};
