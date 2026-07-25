// Единая транзакция публикации ревизии (Фаза 12). Используется тремя путями:
// author-publish (api/author/chapters/[chapterId]/publish), admin force-approve
// (api/admin/review/[chapterId]/force-approve) и cron отложенной публикации (api/cron/publish).
//
// ⚠️ Фаза 13 — ПУБЛИКАЦИЯ СВОБОДНА. Гейт «все approve» удалён целиком (не заменён на gate:"none"):
// раз публиковать можно всегда, ветка all-approve была бы мёртвым кодом, а "force" отличался бы от
// "none" ровно одним уведомлением. Осталась единственная race-safe перепроверка — «ревизия ещё
// не опубликована» (иначе двойной decrement reviewLoad). Ревью — независимая ось (`review_status`),
// публикация её НЕ трогает: опубликованная глава может остаться `none`, а `reviewed` переживает
// публикацию и служит основанием кредита.
//
// Сверх Фазы 7/10 здесь закрыт P1-баг Фазы 11: публикация уведомляет подписчиков автора
// (follows → new_chapter) при ПЕРВОЙ публикации главы.
//
// ⚠️ Фаза 14: кредит `reviewer_history`, освобождение `review_load`, выдача бейджа и закрытие
// заявок уехали в общий `closeReviewSession()` (`queries/review-session.ts`) — та же операция
// нужна во второй точке, где публикации не происходит (одобрение уже опубликованной ревизии).
// Гашение запросов смены ведущего снято вместе с самой ролью «ведущего».

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterRevisions, follows, users } from "@/lib/db/schema";
import { ADMIN_NOTIFY, REVIEW_NOTIFY } from "@/lib/review-links";
import { createNotifications, type NotificationSpec } from "@/lib/queries/notifications";
import { closeReviewSession, recomputeBlogVerified } from "@/lib/queries/review-session";

/** Публикация невозможна из текущего состояния (уже опубликована) → у вызывающего 409. */
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
  /** Handle автора блога — по нему `closeReviewSession` считает уровень бейджа (Ф14). */
  authorHandle: string;
}

export async function publishRevision(
  target: PublishTarget,
  opts: { notifyAuthorForceApproved?: boolean } = {},
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const href = `/blog/${target.blogSlug}/${target.chapterSlug}`;

  await db.transaction(async (tx) => {
    // Race-safe: ревизия ещё не опубликована (параллельным запросом/cron'ом) — иначе
    // двойной decrement reviewLoad и дубль fan-out'а подписчикам.
    const rev = (
      await tx
        .select({ status: chapterRevisions.status })
        .from(chapterRevisions)
        .where(eq(chapterRevisions.id, target.revisionId))
        .limit(1)
    )[0];
    if (!rev) throw new PublishGateError("Ревизия не найдена.");
    if (rev.status === "published") {
      throw new PublishGateError("Эта версия главы уже опубликована.");
    }

    await tx
      .update(chapterRevisions)
      .set({ status: "published", publishedAt: now, scheduledAt: null })
      .where(eq(chapterRevisions.id, target.revisionId));

    // ⚠️ Ф14: кредит/бейдж/освобождение слотов вынесены в общий `closeReviewSession()` — он же
    // работает во второй точке (одобрение УЖЕ опубликованной ревизии, где публикации не будет).
    // Зовём его ПОСЛЕ проставления status='published': бейдж выдаётся только опубликованной ревизии.
    // Идемпотентность — на `review_closed_at`, перечитываемом внутри tx.
    const { assigned, tier } = await closeReviewSession(tx, {
      revisionId: target.revisionId,
      chapterId: target.chapterId,
      revisionNumber: target.revisionNumber,
      authorHandle: target.authorHandle,
    });
    // Пересчёт агрегата блога — БЕЗУСЛОВНО, а не только при выдаче бейджа: публикация новой
    // непроверенной ревизии тоже меняет картину (у главы бейдж пропадает).
    await recomputeBlogVerified(tx, target.blogId);

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

    // ── Уведомления (внутри tx: атомарны с публикацией) ──
    const specs: NotificationSpec[] = [];

    if (opts.notifyAuthorForceApproved) {
      specs.push({
        recipientId: target.authorId,
        type: ADMIN_NOTIFY.forceApproved,
        payload: { href, chapterTitle: target.chapterTitle },
      });
    }

    // Ф14: бейдж выдан — автор узнаёт об этом отдельным событием (это «награда на выходе»,
    // ради которой ревью вообще существует; в общем потоке публикации она бы потерялась).
    if (tier !== null) {
      specs.push({
        recipientId: target.authorId,
        type: REVIEW_NOTIFY.badgeGranted,
        payload: { href, chapterTitle: target.chapterTitle, tier },
      });
    }

    // Ревьюерам — «глава опубликована» (уведомляем всех назначенных, не только кредитованных:
    // тот, кто запросил правки, тоже должен узнать, что главу опубликовали).
    if (assigned.length > 0) {
      const idRows = await tx
        .select({ handle: users.handle, id: users.id })
        .from(users)
        .where(inArray(users.handle, assigned));
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
    // ⚠️ Ф13: только при ПЕРВОЙ публикации главы. Раньше переиздание было редким (требовало
    // полного круга ревью), теперь правка опубликованной главы — штатный сценарий, и без этого
    // условия подписчики получали бы «новая глава» на каждую исправленную опечатку.
    const publishedCount = (
      await tx
        .select({ number: chapterRevisions.number })
        .from(chapterRevisions)
        .where(
          and(
            eq(chapterRevisions.chapterId, target.chapterId),
            eq(chapterRevisions.status, "published"),
          ),
        )
    ).length;
    if (publishedCount <= 1) {
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
    }

    await createNotifications(tx, specs);
  });
}
