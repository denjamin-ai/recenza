// Разбор запроса смены ведущего ревьюера админом (Фаза 10). Phase 7 пишет primary_change_requests
// (status='pending') + уведомляет админа (type primary_change_request). Здесь админ approve/reject:
//   approve — chapters.primaryHandle = toHandle; isPrimary в chapter_reviewers последней ревизии
//             переносится на toHandle (если он назначен); pcr → approved; уведомляем автора+ревьюеров.
//   reject  — pcr → rejected; уведомляем автора.
// Кросс-экранно: смена primaryHandle видна на ReviewPage (поллинг 30с). Только админ.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapterReviewers, chapters, primaryChangeRequests } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { ADMIN_NOTIFY } from "@/lib/review-links";
import { clearAdminNotifications, createNotifications, type NotificationSpec } from "@/lib/queries/notifications";
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

  let action: "approve" | "reject";
  let requestId: string;
  try {
    const body = (await req.json()) as { action?: unknown; requestId?: unknown };
    if (body.action !== "approve" && body.action !== "reject") {
      return NextResponse.json({ error: "Некорректное действие." }, { status: 400 });
    }
    if (typeof body.requestId !== "string" || !body.requestId) {
      return NextResponse.json({ error: "Не указан запрос." }, { status: 400 });
    }
    action = body.action;
    requestId = body.requestId;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const pcr = (
    await db
      .select({
        id: primaryChangeRequests.id,
        chapterId: primaryChangeRequests.chapterId,
        fromHandle: primaryChangeRequests.fromHandle,
        toHandle: primaryChangeRequests.toHandle,
        status: primaryChangeRequests.status,
      })
      .from(primaryChangeRequests)
      .where(eq(primaryChangeRequests.id, requestId))
      .limit(1)
  )[0];
  if (!pcr || pcr.chapterId !== chapterId) return NextResponse.json({ error: "Запрос не найден." }, { status: 404 });
  if (pcr.status !== "pending") return NextResponse.json({ error: "Запрос уже обработан." }, { status: 409 });

  const session = await getReviewSession(chapterId);
  if (!session) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });
  const revNumber = session.revision.number;

  try {
    await db.transaction(async (tx) => {
      // TOCTOU: перечитываем статус запроса внутри tx.
      const fresh = (
        await tx.select({ status: primaryChangeRequests.status }).from(primaryChangeRequests).where(eq(primaryChangeRequests.id, requestId)).limit(1)
      )[0];
      if (!fresh || fresh.status !== "pending") throw new Error("stale");

      await tx
        .update(primaryChangeRequests)
        .set({ status: action === "approve" ? "approved" : "rejected" })
        .where(eq(primaryChangeRequests.id, requestId));

      if (action === "approve") {
        await tx.update(chapters).set({ primaryHandle: pcr.toHandle }).where(eq(chapters.id, chapterId));
        // Переносим флаг ведущего среди назначенных ревьюеров последней ревизии.
        await tx
          .update(chapterReviewers)
          .set({ isPrimary: false })
          .where(and(eq(chapterReviewers.chapterId, chapterId), eq(chapterReviewers.revisionNumber, revNumber)));
        await tx
          .update(chapterReviewers)
          .set({ isPrimary: true })
          .where(
            and(
              eq(chapterReviewers.chapterId, chapterId),
              eq(chapterReviewers.revisionNumber, revNumber),
              eq(chapterReviewers.handle, pcr.toHandle),
            ),
          );
      }

      await clearAdminNotifications(tx, "primary_change_request", "chapterSlug", session.chapter.slug);

      const href = `/author/blog/${session.blog.slug}/${session.chapter.slug}/review`;
      const idByHandle = await userIdsByHandle([pcr.fromHandle, pcr.toHandle]);
      const specs: NotificationSpec[] = [
        {
          recipientId: session.blog.authorId,
          type: ADMIN_NOTIFY.primaryChanged,
          payload: { href, chapterTitle: session.chapter.title, action },
        },
      ];
      if (action === "approve") {
        for (const h of [pcr.fromHandle, pcr.toHandle]) {
          const rid = idByHandle.get(h);
          if (rid) specs.push({ recipientId: rid, type: ADMIN_NOTIFY.primaryChanged, payload: { chapterTitle: session.chapter.title, action } });
        }
      }
      await createNotifications(tx, specs);
    });
  } catch (e) {
    if (e instanceof Error && e.message === "stale") return NextResponse.json({ error: "Запрос уже обработан." }, { status: 409 });
    return NextResponse.json({ error: "Не удалось обработать запрос." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
