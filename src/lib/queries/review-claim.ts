// Захват заявки на ревью — ОБЩЕЕ транзакционное ядро (Фаза 15).
//
// Вынесено из `POST /api/reviewer/requests/[requestId]/claim`, потому что Ф15 добавила второй
// вход в ту же операцию: ручное назначение админом (подстраховка холодного старта).
// ⚠️ Копировать эти гейты во второй роут нельзя: именно так в Ф14 обнаружился З-06 (`capacity`
// проверялся только в UI) и гонка двух параллельных claim'ов. Один вход в логику — один набор
// инвариантов.
//
// ВСЕ проверки — ВНУТРИ транзакции (анти-TOCTOU): заявку берут параллельно, и «взял первым»
// должно решаться атомарно.

import { and, eq, sql } from "drizzle-orm";
import {
  blogs,
  chapterReviewers,
  chapterRevisions,
  chapters,
  reviewRequests,
  users,
} from "@/lib/db/schema";
import { createNotifications } from "@/lib/queries/notifications";
import { REVIEW_NOTIFY, authorReviewHref, reviewerReviewHref } from "@/lib/queries/review";
import { SLA_SILENT_DAYS, dueAtFrom } from "@/lib/review-sla";
import type { db as dbType } from "@/lib/db";

/** Транзакция или сам клиент — как в `review-session.ts`. */
type Executor = Parameters<Parameters<typeof dbType.transaction>[0]>[0] | typeof dbType;

/** Гейт claim'а не прошёл внутри транзакции. `status` — какой код отдать вызывающему. */
export class ClaimError extends Error {
  constructor(
    readonly reason: string,
    readonly status: number,
  ) {
    super(reason);
  }
}

export interface ClaimArgs {
  requestId: string;
  /** Кто становится ревьюером (он же — владелец слота нагрузки). */
  reviewer: { id: string; handle: string; displayName: string };
  /**
   * Назначает админ, а не сам ревьюер. Гейты одинаковы (админ не может «продавить» перегруженного
   * ревьюера), но два различия есть:
   *   • формулировка ошибки о ёмкости — во втором лице для self-claim, нейтральная для админа;
   *   • при назначении админом ревьюер ПОЛУЧАЕТ уведомление: он эту работу не выбирал и иначе
   *     узнал бы о ней, только зайдя в кабинет.
   */
  byAdmin?: boolean;
  now: number;
}

/** Успешный захват: id главы, куда ведёт ревью-сессия. */
export async function claimReviewRequest(tx: Executor, args: ClaimArgs): Promise<{ chapterId: string }> {
  const { requestId, reviewer, now, byAdmin = false } = args;
  // Ревьюер, берущий заявку сам, читает сообщение про СЕБЯ; админ — про назначаемого.
  const capacityError = byAdmin
    ? "Ревьюер загружен до предела — сначала нужно закрыть текущие ревью."
    : "Вы уже загружены до предела — завершите текущие ревью.";

  const row = (
    await tx
      .select({
        id: reviewRequests.id,
        chapterId: reviewRequests.chapterId,
        revisionNumber: reviewRequests.revisionNumber,
        status: reviewRequests.status,
        chapterTitle: chapters.title,
        chapterSlug: chapters.slug,
        blogSlug: blogs.slug,
        blogHidden: blogs.hidden,
        authorId: blogs.authorId,
        authorBlocked: users.isBlocked,
        authorCanAuthor: users.canAuthor,
      })
      .from(reviewRequests)
      .innerJoin(chapters, eq(chapters.id, reviewRequests.chapterId))
      .innerJoin(blogs, eq(blogs.id, chapters.blogId))
      .innerJoin(users, eq(users.id, blogs.authorId))
      .where(eq(reviewRequests.id, requestId))
      .limit(1)
  )[0];
  if (!row) throw new ClaimError("Заявка не найдена.", 404);
  if (row.status !== "open") throw new ClaimError("Заявку уже взяли.", 409);
  // Видимость автора перепроверяется ЗДЕСЬ, а не только в листинге очереди: `requestId` мог
  // остаться в открытой вкладке, а автора успели забанить или снять ему `can_author` — тогда
  // весь его контент скрыт, и назначать на него ревьюера нельзя. Ответ 404 — не раскрываем причину.
  if (row.authorBlocked || !row.authorCanAuthor || row.blogHidden) {
    throw new ClaimError("Заявка не найдена.", 404);
  }
  // Свой блог рецензировать нельзя — иначе автор с возможностью ревьюера выдал бы бейдж сам себе.
  // (При назначении админом сравниваем с НАЗНАЧАЕМЫМ — админ у себя блогов не имеет по построению.)
  if (row.authorId === reviewer.id) {
    throw new ClaimError("Нельзя рецензировать собственный блог.", 403);
  }

  // З-06: серверная проверка занятости. До Ф14 `full` дизейблил чекбокс в пикере и только.
  const me = (
    await tx
      .select({ load: users.reviewLoad, capacity: users.reviewCapacity })
      .from(users)
      .where(eq(users.handle, reviewer.handle))
      .limit(1)
  )[0];
  if (me && me.load >= me.capacity) {
    throw new ClaimError(capacityError, 409);
  }

  // Заявка должна относиться к АКТУАЛЬНОЙ ревизии: автор мог сдать новую, пока заявка ждала.
  const revs = await tx
    .select({ id: chapterRevisions.id, number: chapterRevisions.number })
    .from(chapterRevisions)
    .where(eq(chapterRevisions.chapterId, row.chapterId));
  const latest = revs.reduce((a, b) => (b.number > a.number ? b : a));
  if (latest.number !== row.revisionNumber) {
    throw new ClaimError("Заявка устарела — у главы есть новая версия.", 409);
  }

  // ⚠️ Захват — УСЛОВНЫЙ UPDATE с проверкой затронутых строк (паттерн из invite/apply).
  // Раньше здесь стоял безусловный UPDATE, и «взял первым» решалось прочитанным ранее статусом:
  // два параллельных claim'а оба проходили проверку, оба писали свою строку в `chapter_reviewers`
  // (PK различает по handle) и оба инкрементили `review_load`, а `claimed_by` оставался у
  // последнего — «потерянный» ревьюер навсегда выпадал из SLA-свипа с зависшим слотом.
  const claimed = await tx
    .update(reviewRequests)
    .set({
      status: "claimed",
      claimedBy: reviewer.handle,
      claimedAt: now,
      dueAt: dueAtFrom(now, SLA_SILENT_DAYS),
    })
    .where(and(eq(reviewRequests.id, row.id), eq(reviewRequests.status, "open")))
    .returning({ id: reviewRequests.id });
  if (claimed.length === 0) throw new ClaimError("Заявку уже взяли.", 409);

  // Ревью стартует ровно здесь (idempotent по PK — гонка двух claim'ов уже отсечена статусом).
  await tx
    .insert(chapterReviewers)
    .values({
      chapterId: row.chapterId,
      revisionNumber: row.revisionNumber,
      handle: reviewer.handle,
    })
    .onConflictDoNothing();
  // Инкремент тоже условный: между чтением `load/capacity` и записью параллельный claim
  // другой заявки мог исчерпать лимит. `WHERE review_load < review_capacity` закрывает окно.
  const loaded = await tx
    .update(users)
    .set({ reviewLoad: sql`${users.reviewLoad} + 1` })
    .where(and(eq(users.handle, reviewer.handle), sql`${users.reviewLoad} < ${users.reviewCapacity}`))
    .returning({ handle: users.handle });
  if (loaded.length === 0) {
    throw new ClaimError(capacityError, 409);
  }

  await tx
    .update(chapterRevisions)
    .set({ reviewStatus: "in-review" })
    .where(and(eq(chapterRevisions.id, latest.id), eq(chapterRevisions.reviewStatus, "requested")));

  await createNotifications(tx, [
    {
      recipientId: row.authorId,
      type: REVIEW_NOTIFY.requestClaimed,
      payload: {
        href: authorReviewHref(row.blogSlug, row.chapterSlug),
        chapterTitle: row.chapterTitle,
        revision: row.revisionNumber,
        reviewer: reviewer.displayName,
      },
    },
    // Ф15: при ручном назначении ревьюер работу не выбирал — без этого уведомления он узнал бы
    // о ней, только заглянув в кабинет. При self-claim оно избыточно (он сам только что нажал).
    ...(byAdmin
      ? [
          {
            recipientId: reviewer.id,
            type: REVIEW_NOTIFY.requestAssigned,
            payload: {
              href: reviewerReviewHref(row.chapterId),
              chapterTitle: row.chapterTitle,
              revision: row.revisionNumber,
            },
          },
        ]
      : []),
  ]);

  return { chapterId: row.chapterId };
}
