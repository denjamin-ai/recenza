// Снятие ревьюера с главы админом (Фаза 10). Логирует в removed_reviewers (byAdmin + причина),
// удаляет назначение на последней ревизии (chapter_reviewers), корректирует reviewLoad −1
// (консистентно с claim=+1 / закрытие сессии=−1), уведомляет ревьюера и автора. Только админ.
//
// ⚠️ Ф14: снята вся обвязка «ведущего» и приглашений (переназначение primary, гашение pending-PCR
// и их строк в админ-очереди) — этих сущностей больше нет. Взамен заявка, по которой ревьюер попал
// на главу, ВОЗВРАЩАЕТСЯ в очередь: снятие ревьюера не должно оставлять главу без пути к ревью.

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapterReviewers, removedReviewers, reviewRequests, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { ADMIN_NOTIFY } from "@/lib/review-links";
import { createNotifications, type NotificationSpec } from "@/lib/queries/notifications";
import { getReviewSession, userIdsByHandle } from "@/lib/queries/review";
import { SLA_UNCLAIMED_DAYS, dueAtFrom } from "@/lib/review-sla";

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
      // ⚠️ Ф14: снятая обвязка. Приглашений больше нет (ревьюер берёт заявку сам), роли «ведущего»
      // нет — переназначать преемника и гасить запросы смены некому. Взамен: заявка, по которой
      // ревьюер попал на главу, возвращается в очередь, чтобы главу мог взять кто-то другой.
      await tx
        .update(reviewRequests)
        .set({ status: "open", claimedBy: null, claimedAt: null, dueAt: dueAtFrom(now, SLA_UNCLAIMED_DAYS) })
        .where(
          and(
            eq(reviewRequests.chapterId, chapterId),
            eq(reviewRequests.revisionNumber, revNumber),
            eq(reviewRequests.claimedBy, handle),
            eq(reviewRequests.status, "claimed"),
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
  } catch (e) {
    if (e instanceof Error && e.message === "stale") {
      return NextResponse.json({ error: "Ревьюер уже снят." }, { status: 409 });
    }
    return NextResponse.json({ error: "Не удалось снять ревьюера." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
