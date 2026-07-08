// Снятие ревьюера с главы админом (Фаза 10). Логирует в removed_reviewers (byAdmin + причина),
// удаляет назначение на последней ревизии (chapter_reviewers), корректирует reviewLoad −1
// (консистентно с accept=+1 / publish=−1), гасит pending-приглашение этой ревизии (→ declined),
// уведомляет ревьюера (reviewer_removed) и автора. Только админ.
// Фаза 12 (P1-фикс): если снят ВЕДУЩИЙ — primary детерминированно переназначается на первого
// (по handle) из оставшихся ревьюеров (нет dangling primary); pending-запросы смены ведущего
// с участием снятого гасятся (→ void) вместе с их строками в админ-очереди.

import { NextResponse } from "next/server";
import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  chapterReviewers,
  chapters,
  notifications,
  primaryChangeRequests,
  removedReviewers,
  reviewInvitations,
  users,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { parseJson } from "@/lib/db/json";
import { ADMIN_NOTIFY } from "@/lib/review-links";
import { createNotifications, type NotificationSpec } from "@/lib/queries/notifications";
import { getReviewSession, userIdsByHandle } from "@/lib/queries/review";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { chapterId } = await params;

  let handle: string;
  let reason: string | null;
  try {
    const body = (await req.json()) as { handle?: unknown; reason?: unknown };
    if (typeof body.handle !== "string" || !body.handle) {
      return NextResponse.json({ error: "Не указан ревьюер." }, { status: 400 });
    }
    handle = body.handle;
    reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 500) : null;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const session = await getReviewSession(chapterId);
  if (!session) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });
  if (!session.reviewers.some((r) => r.handle === handle)) {
    return NextResponse.json({ error: "Этот ревьюер не назначен на главу." }, { status: 409 });
  }

  const revNumber = session.revision.number;
  const now = Math.floor(Date.now() / 1000);

  try {
    await db.transaction(async (tx) => {
      // TOCTOU: ревьюер ещё назначен на эту ревизию? Иначе (двойной вызов) — не декрементим reviewLoad повторно.
      const still = await tx
        .select({ handle: chapterReviewers.handle })
        .from(chapterReviewers)
        .where(
          and(
            eq(chapterReviewers.chapterId, chapterId),
            eq(chapterReviewers.revisionNumber, revNumber),
            eq(chapterReviewers.handle, handle),
          ),
        )
        .limit(1);
      if (still.length === 0) throw new Error("stale");

      await tx.insert(removedReviewers).values({
        blogSlug: session.blog.slug,
        chapterSlug: session.chapter.slug,
        handle,
        byAdmin: "admin",
        reason,
        createdAt: now,
      });
      await tx
        .delete(chapterReviewers)
        .where(
          and(
            eq(chapterReviewers.chapterId, chapterId),
            eq(chapterReviewers.revisionNumber, revNumber),
            eq(chapterReviewers.handle, handle),
          ),
        );
      // Освобождаем занятость снятого ревьюера (его accept делал +1).
      await tx
        .update(users)
        .set({ reviewLoad: sql`max(${users.reviewLoad} - 1, 0)` })
        .where(eq(users.handle, handle));
      // Если было активное приглашение этой ревизии — помечаем declined (consent-инвариант).
      await tx
        .update(reviewInvitations)
        .set({ status: "declined", respondedAt: now })
        .where(
          and(
            eq(reviewInvitations.chapterId, chapterId),
            eq(reviewInvitations.revision, revNumber),
            eq(reviewInvitations.toHandle, handle),
            eq(reviewInvitations.status, "accepted"),
          ),
        );

      // P1-фикс: снят ведущий → детерминированный преемник (первый по handle из оставшихся),
      // иначе primary «висит» на неназначенном ревьюере и action-bar/запросы смены ломаются.
      let successorHandle: string | null = null;
      const removedWasPrimary = session.chapter.primaryHandle === handle;
      if (removedWasPrimary) {
        const remaining = await tx
          .select({ handle: chapterReviewers.handle })
          .from(chapterReviewers)
          .where(
            and(
              eq(chapterReviewers.chapterId, chapterId),
              eq(chapterReviewers.revisionNumber, revNumber),
            ),
          );
        successorHandle = remaining.map((r) => r.handle).sort()[0] ?? null;
        await tx
          .update(chapters)
          .set({ primaryHandle: successorHandle })
          .where(eq(chapters.id, chapterId));
        // Флаг isPrimary в назначениях — консистентно с chapters.primaryHandle.
        await tx
          .update(chapterReviewers)
          .set({ isPrimary: false })
          .where(
            and(eq(chapterReviewers.chapterId, chapterId), eq(chapterReviewers.revisionNumber, revNumber)),
          );
        if (successorHandle) {
          await tx
            .update(chapterReviewers)
            .set({ isPrimary: true })
            .where(
              and(
                eq(chapterReviewers.chapterId, chapterId),
                eq(chapterReviewers.revisionNumber, revNumber),
                eq(chapterReviewers.handle, successorHandle),
              ),
            );
        }
      }

      // P1-фикс: pending-запросы смены ведущего с участием снятого гасим (→ void) + чистим
      // их строки в админ-очереди (matching по chapterSlug и участнику — точечно, не всю главу).
      const stalePcr = await tx
        .select({ id: primaryChangeRequests.id })
        .from(primaryChangeRequests)
        .where(
          and(
            eq(primaryChangeRequests.chapterId, chapterId),
            eq(primaryChangeRequests.status, "pending"),
            or(eq(primaryChangeRequests.fromHandle, handle), eq(primaryChangeRequests.toHandle, handle)),
          ),
        );
      if (stalePcr.length > 0) {
        for (const p of stalePcr) {
          await tx.update(primaryChangeRequests).set({ status: "void" }).where(eq(primaryChangeRequests.id, p.id));
        }
        const adminRows = await tx
          .select({ id: notifications.id, payload: notifications.payload })
          .from(notifications)
          .where(
            and(
              eq(notifications.isAdminRecipient, true),
              eq(notifications.type, "primary_change_request"),
              eq(notifications.isRead, false),
            ),
          );
        const staleIds = adminRows
          .filter((r) => {
            const p = parseJson<Record<string, unknown>>(r.payload, {});
            return (
              p.chapterSlug === session.chapter.slug &&
              (p.fromHandle === handle || p.toHandle === handle)
            );
          })
          .map((r) => r.id);
        for (const nid of staleIds) {
          await tx.update(notifications).set({ isRead: true }).where(eq(notifications.id, nid));
        }
      }

      const idByHandle = await userIdsByHandle(
        successorHandle ? [handle, successorHandle] : [handle],
      );
      const reviewerId = idByHandle.get(handle);
      const specs: NotificationSpec[] = [];
      if (successorHandle) {
        const successorId = idByHandle.get(successorHandle);
        if (successorId) {
          specs.push({
            recipientId: successorId,
            type: ADMIN_NOTIFY.primaryChanged,
            payload: { chapterTitle: session.chapter.title, handle: successorHandle },
          });
        }
      }
      if (reviewerId) {
        specs.push({
          recipientId: reviewerId,
          type: ADMIN_NOTIFY.reviewerRemoved,
          payload: { chapterTitle: session.chapter.title, reason },
        });
      }
      specs.push({
        recipientId: session.blog.authorId,
        type: ADMIN_NOTIFY.reviewerRemoved,
        payload: {
          href: `/author/blog/${session.blog.slug}/${session.chapter.slug}/review`,
          chapterTitle: session.chapter.title,
          handle,
        },
      });
      await createNotifications(tx, specs);
    });
  } catch (e) {
    if (e instanceof Error && e.message === "stale") {
      return NextResponse.json({ error: "Ревьюер уже снят." }, { status: 409 });
    }
    return NextResponse.json({ error: "Не удалось снять ревьюера." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
