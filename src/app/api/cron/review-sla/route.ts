// Cron SLA заявок на ревью (Фаза 14). Защита — как у `/api/cron/publish`: Authorization: Bearer
// <CRON_SECRET> ПЕРВОЙ проверкой, constant-time сравнение (обычный `!==` течёт тайминг).
// Запускается systemd-timer'ом рядом с cron публикации.
//
// Три свипа (сроки — `src/lib/review-sla.ts`, решение владельца: 14 / 21 день):
//   1. ЭСКАЛАЦИЯ  open + channel='queue' + due_at<=now → channel='editorial', уведомление админу.
//      Заявка ОСТАЁТСЯ открытой и в очереди — редакция подключается, а не отбирает.
//      Смена канала сама по себе идемпотентна: второй тик эту строку уже не выберет.
//   2. ИСТЕЧЕНИЕ  open + channel='editorial' + due_at<=now → expired, ось ревью → none.
//   3. ВОЗВРАТ    claimed + due_at<=now И НЕТ признаков работы → обратно в очередь,
//      ревьюер снимается с главы, review_load −1, уведомления автору, ревьюеру и админу.
//
// Признак работы = вердикт ИЛИ тред/сообщение в чате от этого ревьюера после claim. Heartbeat
// (`last_seen_at`) сигналом НЕ считается: открыть страницу — не значит рецензировать.

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, gt, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blogs,
  chapterReviewers,
  chapterRevisions,
  chapters,
  reviewChat,
  reviewRequests,
  threads,
  users,
} from "@/lib/db/schema";
import { REVIEW_NOTIFY, authorReviewHref, reviewerInboxHref } from "@/lib/review-links";
import { createNotifications } from "@/lib/queries/notifications";
import { SLA_UNCLAIMED_DAYS, dueAtFrom } from "@/lib/review-sla";

export const dynamic = "force-dynamic";

/** Constant-time сравнение Bearer-токена (security-ревью Ф12: != течёт тайминг). */
function bearerOk(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || !bearerOk(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  let escalated = 0;
  let expired = 0;
  let returned = 0;

  const due = await db
    .select({
      id: reviewRequests.id,
      chapterId: reviewRequests.chapterId,
      revisionNumber: reviewRequests.revisionNumber,
      status: reviewRequests.status,
      channel: reviewRequests.channel,
      claimedBy: reviewRequests.claimedBy,
      claimedAt: reviewRequests.claimedAt,
      returnCount: reviewRequests.returnCount,
      chapterTitle: chapters.title,
      chapterSlug: chapters.slug,
      blogSlug: blogs.slug,
      authorId: blogs.authorId,
    })
    .from(reviewRequests)
    .innerJoin(chapters, eq(chapters.id, reviewRequests.chapterId))
    .innerJoin(blogs, eq(blogs.id, chapters.blogId))
    .where(
      and(
        inArray(reviewRequests.status, ["open", "claimed"]),
        isNotNull(reviewRequests.dueAt),
        lte(reviewRequests.dueAt, now),
      ),
    );

  for (const row of due) {
    const authorPayload = {
      href: authorReviewHref(row.blogSlug, row.chapterSlug),
      chapterTitle: row.chapterTitle,
      revision: row.revisionNumber,
    };

    // ── Свип 1: эскалация в редакцию ──
    if (row.status === "open" && row.channel === "queue") {
      await db.transaction(async (tx) => {
        await tx
          .update(reviewRequests)
          .set({ channel: "editorial", dueAt: dueAtFrom(now, SLA_UNCLAIMED_DAYS) })
          .where(and(eq(reviewRequests.id, row.id), eq(reviewRequests.status, "open")));
        await createNotifications(tx, [
          {
            isAdminRecipient: true,
            type: REVIEW_NOTIFY.requestEscalated,
            payload: { ...authorPayload, blogSlug: row.blogSlug, chapterSlug: row.chapterSlug },
          },
        ]);
      });
      escalated += 1;
      continue;
    }

    // ── Свип 2: заявка так и не нашла ревьюера ──
    if (row.status === "open" && row.channel === "editorial") {
      await db.transaction(async (tx) => {
        const fresh = (
          await tx
            .select({ status: reviewRequests.status })
            .from(reviewRequests)
            .where(eq(reviewRequests.id, row.id))
            .limit(1)
        )[0];
        if (!fresh || fresh.status !== "open") return; // заявку успели взять — не трогаем
        await tx
          .update(reviewRequests)
          .set({ status: "expired", resolvedAt: now })
          .where(eq(reviewRequests.id, row.id));
        await tx
          .update(chapterRevisions)
          .set({ reviewStatus: "none" })
          .where(
            and(
              eq(chapterRevisions.chapterId, row.chapterId),
              eq(chapterRevisions.number, row.revisionNumber),
            ),
          );
        await createNotifications(tx, [
          { recipientId: row.authorId, type: REVIEW_NOTIFY.requestExpired, payload: authorPayload },
          { isAdminRecipient: true, type: REVIEW_NOTIFY.requestExpired, payload: authorPayload },
        ]);
      });
      expired += 1;
      continue;
    }

    // ── Свип 3: взял и молчит ──
    if (row.status === "claimed" && row.claimedBy) {
      const since = row.claimedAt ?? 0;
      const verdictRows = await db
        .select({ verdict: chapterReviewers.verdict })
        .from(chapterReviewers)
        .where(
          and(
            eq(chapterReviewers.chapterId, row.chapterId),
            eq(chapterReviewers.revisionNumber, row.revisionNumber),
            eq(chapterReviewers.handle, row.claimedBy),
          ),
        );
      const hasVerdict = verdictRows.some((v) => v.verdict !== null);
      const threadRows = await db
        .select({ id: threads.id })
        .from(threads)
        .where(
          and(
            eq(threads.chapterId, row.chapterId),
            eq(threads.revisionNumber, row.revisionNumber),
            eq(threads.fromHandle, row.claimedBy),
            gt(threads.createdAt, since),
          ),
        )
        .limit(1);
      const chatRows = await db
        .select({ id: reviewChat.id })
        .from(reviewChat)
        .where(
          and(
            eq(reviewChat.chapterId, row.chapterId),
            eq(reviewChat.revisionNumber, row.revisionNumber),
            eq(reviewChat.fromHandle, row.claimedBy),
            gt(reviewChat.createdAt, since),
          ),
        )
        .limit(1);

      if (hasVerdict || threadRows.length > 0 || chatRows.length > 0) {
        // Работа идёт — продлеваем срок ещё на один период, не наказывая за медленное ревью.
        await db
          .update(reviewRequests)
          .set({ dueAt: dueAtFrom(now, SLA_UNCLAIMED_DAYS) })
          .where(eq(reviewRequests.id, row.id));
        continue;
      }

      const reviewerHandle = row.claimedBy;
      const reviewerRow = (
        await db.select({ id: users.id }).from(users).where(eq(users.handle, reviewerHandle)).limit(1)
      )[0];

      await db.transaction(async (tx) => {
        const fresh = (
          await tx
            .select({ status: reviewRequests.status })
            .from(reviewRequests)
            .where(eq(reviewRequests.id, row.id))
            .limit(1)
        )[0];
        if (!fresh || fresh.status !== "claimed") return;

        await tx
          .update(reviewRequests)
          .set({
            status: "open",
            claimedBy: null,
            claimedAt: null,
            dueAt: dueAtFrom(now, SLA_UNCLAIMED_DAYS),
            returnCount: row.returnCount + 1,
          })
          .where(eq(reviewRequests.id, row.id));
        // Снимаем назначение и освобождаем слот — иначе `review_load` протекал бы навсегда.
        await tx
          .delete(chapterReviewers)
          .where(
            and(
              eq(chapterReviewers.chapterId, row.chapterId),
              eq(chapterReviewers.revisionNumber, row.revisionNumber),
              eq(chapterReviewers.handle, reviewerHandle),
            ),
          );
        await tx
          .update(users)
          .set({ reviewLoad: sql`max(${users.reviewLoad} - 1, 0)` })
          .where(eq(users.handle, reviewerHandle));

        // Не осталось назначенных — глава снова просто ждёт ревьюера.
        const rest = await tx
          .select({ handle: chapterReviewers.handle })
          .from(chapterReviewers)
          .where(
            and(
              eq(chapterReviewers.chapterId, row.chapterId),
              eq(chapterReviewers.revisionNumber, row.revisionNumber),
            ),
          );
        if (rest.length === 0) {
          await tx
            .update(chapterRevisions)
            .set({ reviewStatus: "requested" })
            .where(
              and(
                eq(chapterRevisions.chapterId, row.chapterId),
                eq(chapterRevisions.number, row.revisionNumber),
              ),
            );
        }

        await createNotifications(tx, [
          { recipientId: row.authorId, type: REVIEW_NOTIFY.requestReturned, payload: authorPayload },
          ...(reviewerRow
            ? [
                {
                  recipientId: reviewerRow.id,
                  type: REVIEW_NOTIFY.requestReturned,
                  payload: { href: reviewerInboxHref(), chapterTitle: row.chapterTitle },
                },
              ]
            : []),
          { isAdminRecipient: true, type: REVIEW_NOTIFY.requestReturned, payload: authorPayload },
        ]);
      });
      returned += 1;
    }
  }

  return NextResponse.json({ ok: true, due: due.length, escalated, expired, returned });
}
