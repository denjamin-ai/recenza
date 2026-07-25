// SLA заявки на ревью (Фаза 14) — ЕДИНЫЙ источник сроков для cron'а, кабинета автора и очереди
// ревьюера. Файл клиент-безопасен (чистые функции, никаких импортов db/auth) — его тянут и RSC,
// и клиентские карточки заявок.
//
// Сроки — решение владельца (журнал Ф14):
//   14 дней заявка висит в очереди без claim → эскалация: канал 'editorial', уведомление админу,
//                                              направление уходит на публичную доску;
//   21 день молчания после claim           → автовозврат в очередь, reviewLoad −1, уведомления.
// Менять только его решением: числа завязаны на ожидания авторов в UI («Ревьюер найдётся до …»).

import { plural } from "@/lib/plural";

/** Дней, пока заявка ждёт исполнителя в очереди до эскалации в редакцию. */
export const SLA_UNCLAIMED_DAYS = 14;
/** Дней, пока взявший заявку ревьюер может не подавать признаков работы до автовозврата. */
export const SLA_SILENT_DAYS = 21;

const DAY = 86_400; // Unix seconds

/** Дедлайн через N дней от момента `now` (Unix seconds — конвенция проекта). */
export function dueAtFrom(now: number, days: number): number {
  return now + days * DAY;
}

export type SlaState = "ok" | "soon" | "overdue";

/** Состояние дедлайна: `soon` — осталось ≤3 дней. `null` дедлайн → всегда `ok`. */
export function slaState(dueAt: number | null, now: number): SlaState {
  if (dueAt == null) return "ok";
  if (dueAt <= now) return "overdue";
  return dueAt - now <= 3 * DAY ? "soon" : "ok";
}

/** Целых дней до дедлайна (отрицательные — просрочено). */
export function daysLeft(dueAt: number, now: number): number {
  return Math.ceil((dueAt - now) / DAY);
}

/**
 * Подпись срока для UI: «осталось 5 дней» / «остался 1 день» / «просрочено на 2 дня».
 * Плюрализация — общий `plural()` (ui-feedback-4), чтобы формы склонялись одинаково везде.
 */
export function formatDueLabel(dueAt: number, now: number): string {
  const left = daysLeft(dueAt, now);
  if (left > 0) return `${plural(left, "остался", "осталось", "осталось")} ${left} ${plural(left, "день", "дня", "дней")}`;
  const over = Math.abs(left);
  if (over === 0) return "срок истекает сегодня";
  return `просрочено на ${over} ${plural(over, "день", "дня", "дней")}`;
}
