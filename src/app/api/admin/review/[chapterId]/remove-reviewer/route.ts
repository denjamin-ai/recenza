// Снятие ревьюера с главы админом (Фаза 10). Логирует в removed_reviewers (byAdmin + причина),
// удаляет назначение на последней ревизии (chapter_reviewers), корректирует reviewLoad −1
// (консистентно с accept=+1 / publish=−1), гасит pending-приглашение этой ревизии (→ declined),
// уведомляет ревьюера (reviewer_removed) и автора. Только админ.

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapterReviewers, removedReviewers, reviewInvitations, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
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

      const idByHandle = await userIdsByHandle([handle]);
      const reviewerId = idByHandle.get(handle);
      const specs: NotificationSpec[] = [];
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
  } catch {
    return NextResponse.json({ error: "Не удалось снять ревьюера." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
