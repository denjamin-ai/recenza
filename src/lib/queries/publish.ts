// Единая транзакция публикации ревизии (Фаза 12). Используется тремя путями:
// author-publish (api/review/[chapterId]/publish), admin force-approve
// (api/admin/review/[chapterId]/force-approve) и cron отложенной публикации (api/cron/publish).
// Гейт «все approve» перечитывается ВНУТРИ транзакции (race-safe); gate="force" его обходит.
// Сверх Фазы 7/10 здесь закрыты P1-баги Фазы 11:
//   (a) публикация уведомляет подписчиков автора (follows → new_chapter);
//   (b) pending-запросы смены ведущего гасятся (→ void) + очищается админ-очередь.

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blogs,
  chapterReviewers,
  chapterRevisions,
  follows,
  primaryChangeRequests,
  reviewerHistory,
  users,
} from "@/lib/db/schema";
import { ADMIN_NOTIFY, REVIEW_NOTIFY } from "@/lib/review-links";
import {
  clearAdminNotifications,
  createNotifications,
  type NotificationSpec,
} from "@/lib/queries/notifications";

export const ACTIVE_REVISION_STATUSES = new Set(["under-review", "changes-requested"]);

/** Гейт публикации не прошёл при перепроверке внутри транзакции → у вызывающего 409. */
export class PublishGateError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

/** Срез ревью-сессии, достаточный для публикации (строится из ReviewSession или запроса cron). */
export interface PublishTarget {
  chapterId: string;
  revisionId: string;
  revisionNumber: number;
  blogId: string;
  blogSlug: string;
  chapterSlug: string;
  chapterTitle: string;
  authorId: string;
}

export async function publishRevision(
  target: PublishTarget,
  opts: { gate: "all-approve" | "force"; notifyAuthorForceApproved?: boolean },
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const href = `/blog/${target.blogSlug}/${target.chapterSlug}`;

  await db.transaction(async (tx) => {
    // Race-safe: ревизия ещё активна (не опубликована параллельно) — иначе двойной decrement reviewLoad.
    const rev = (
      await tx
        .select({ status: chapterRevisions.status })
        .from(chapterRevisions)
        .where(eq(chapterRevisions.id, target.revisionId))
        .limit(1)
    )[0];
    if (!rev || !ACTIVE_REVISION_STATUSES.has(rev.status)) {
      throw new PublishGateError("Главу нельзя опубликовать из текущего статуса.");
    }

    // Состав/вердикты ревьюеров — внутри tx (не доверяем кэшу сессии).
    const verdictRows = await tx
      .select({ handle: chapterReviewers.handle, verdict: chapterReviewers.verdict })
      .from(chapterReviewers)
      .where(
        and(
          eq(chapterReviewers.chapterId, target.chapterId),
          eq(chapterReviewers.revisionNumber, target.revisionNumber),
        ),
      );
    if (opts.gate === "all-approve") {
      if (verdictRows.length === 0) throw new PublishGateError("Нет назначенных ревьюеров.");
      if (!verdictRows.every((r) => r.verdict === "approve")) {
        throw new PublishGateError("Опубликовать можно только когда все ревьюеры одобрили.");
      }
    }
    const handles = verdictRows.map((r) => r.handle);

    await tx
      .update(chapterRevisions)
      .set({ status: "published", publishedAt: now, scheduledAt: null })
      .where(eq(chapterRevisions.id, target.revisionId));

    // Кредит ревьюеров этой версии (идемпотентно: чистим и пишем заново).
    await tx
      .delete(reviewerHistory)
      .where(
        and(
          eq(reviewerHistory.chapterId, target.chapterId),
          eq(reviewerHistory.revisionNumber, target.revisionNumber),
        ),
      );
    for (const h of handles) {
      await tx.insert(reviewerHistory).values({
        chapterId: target.chapterId,
        revisionNumber: target.revisionNumber,
        handle: h,
      });
    }

    // Ревью завершено → освобождаем ревьюеров: reviewLoad −1 (accept делает +1; Фаза 9).
    if (handles.length > 0) {
      await tx
        .update(users)
        .set({ reviewLoad: sql`max(${users.reviewLoad} - 1, 0)` })
        .where(inArray(users.handle, handles));
    }

    // publishedAt блога — только при первой публикации (читаем внутри tx, race-safe).
    const blogRow = (
      await tx
        .select({ publishedAt: blogs.publishedAt })
        .from(blogs)
        .where(eq(blogs.id, target.blogId))
        .limit(1)
    )[0];
    await tx
      .update(blogs)
      .set({ lastActivityAt: now, ...(blogRow?.publishedAt == null ? { publishedAt: now } : {}) })
      .where(eq(blogs.id, target.blogId));

    // P1(b): публикация закрывает сессию ревью — pending-запросы смены ведущего теряют смысл.
    // Гасим их (→ void) и чистим очередь «Требует внимания» в админ-дашборде.
    await tx
      .update(primaryChangeRequests)
      .set({ status: "void" })
      .where(
        and(
          eq(primaryChangeRequests.chapterId, target.chapterId),
          eq(primaryChangeRequests.status, "pending"),
        ),
      );
    await clearAdminNotifications(tx, "primary_change_request", "chapterSlug", target.chapterSlug);

    // ── Уведомления (внутри tx: атомарны с публикацией) ──
    const specs: NotificationSpec[] = [];

    if (opts.notifyAuthorForceApproved) {
      specs.push({
        recipientId: target.authorId,
        type: ADMIN_NOTIFY.forceApproved,
        payload: { href, chapterTitle: target.chapterTitle },
      });
    }

    // Ревьюерам — «глава опубликована» (кредит виден в ридере).
    if (handles.length > 0) {
      const idRows = await tx
        .select({ handle: users.handle, id: users.id })
        .from(users)
        .where(inArray(users.handle, handles));
      for (const r of idRows) {
        specs.push({
          recipientId: r.id,
          type: REVIEW_NOTIFY.published,
          payload: { href, chapterTitle: target.chapterTitle },
        });
      }
    }

    // P1(a): подписчикам автора — new_chapter (bell уже умеет этот тип: label по payload.title,
    // href по blogSlug/chapterSlug). Автор сам себе не уведомляется.
    const followerRows = await tx
      .select({ userId: follows.userId })
      .from(follows)
      .where(eq(follows.authorId, target.authorId));
    for (const f of followerRows) {
      if (f.userId === target.authorId) continue;
      specs.push({
        recipientId: f.userId,
        type: REVIEW_NOTIFY.newChapter,
        payload: {
          href,
          title: target.chapterTitle,
          blogSlug: target.blogSlug,
          chapterSlug: target.chapterSlug,
        },
      });
    }

    await createNotifications(tx, specs);
  });
}
