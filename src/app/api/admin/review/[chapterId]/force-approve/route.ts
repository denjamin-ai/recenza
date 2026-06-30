// Force-approve главы админом (Фаза 10). В отличие от author-публикации (api/review/.../publish),
// ОБХОДИТ гейт «все ревьюеры approve» — но сохраняет всё остальное: ревизия → published + publishedAt,
// кредит ревьюеров (reviewer_history), reviewLoad −1 (закрытие цикла занятости, как обычная публикация),
// publishedAt блога при первой публикации, уведомления. Автор получает force_approved, ревьюеры — published.
// Только админ. Требуется активная ревизия (under-review|changes-requested).

import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterReviewers, chapterRevisions, reviewerHistory, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { ADMIN_NOTIFY } from "@/lib/review-links";
import { createNotifications } from "@/lib/queries/notifications";
import { REVIEW_NOTIFY, getReviewSession, userIdsByHandle } from "@/lib/queries/review";

const ACTIVE = new Set(["under-review", "changes-requested"]);

class GateFailed extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { chapterId } = await params;
  const session = await getReviewSession(chapterId);
  if (!session) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });
  if (!ACTIVE.has(session.revision.status)) {
    return NextResponse.json({ error: "Главу нельзя опубликовать из текущего статуса." }, { status: 409 });
  }

  const revNumber = session.revision.number;
  const now = Math.floor(Date.now() / 1000);
  const authorId = session.blog.authorId;

  try {
    await db.transaction(async (tx) => {
      // Race-safe: ревизия ещё активна (не опубликована параллельно) — иначе двойной decrement reviewLoad.
      const rev = (
        await tx.select({ status: chapterRevisions.status }).from(chapterRevisions).where(eq(chapterRevisions.id, session.revision.id)).limit(1)
      )[0];
      if (!rev || !ACTIVE.has(rev.status)) throw new GateFailed("Главу нельзя опубликовать из текущего статуса.");

      // Реальный состав ревьюеров этой ревизии (внутри tx, не из кэша сессии).
      const verdictRows = await tx
        .select({ handle: chapterReviewers.handle })
        .from(chapterReviewers)
        .where(and(eq(chapterReviewers.chapterId, chapterId), eq(chapterReviewers.revisionNumber, revNumber)));
      const handles = verdictRows.map((r) => r.handle);

      await tx
        .update(chapterRevisions)
        .set({ status: "published", publishedAt: now })
        .where(eq(chapterRevisions.id, session.revision.id));

      // Кредит ревьюеров (идемпотентно). Force-approve кредитует фактически назначенных ревьюеров.
      await tx
        .delete(reviewerHistory)
        .where(and(eq(reviewerHistory.chapterId, chapterId), eq(reviewerHistory.revisionNumber, revNumber)));
      for (const h of handles) {
        await tx.insert(reviewerHistory).values({ chapterId, revisionNumber: revNumber, handle: h });
      }

      if (handles.length > 0) {
        await tx
          .update(users)
          .set({ reviewLoad: sql`max(${users.reviewLoad} - 1, 0)` })
          .where(inArray(users.handle, handles));
      }

      const blogRow = (
        await tx.select({ publishedAt: blogs.publishedAt }).from(blogs).where(eq(blogs.id, session.blog.id)).limit(1)
      )[0];
      await tx
        .update(blogs)
        .set({ lastActivityAt: now, ...(blogRow?.publishedAt == null ? { publishedAt: now } : {}) })
        .where(eq(blogs.id, session.blog.id));

      // Уведомления: автору — force_approved; ревьюерам — published.
      const href = `/blog/${session.blog.slug}/${session.chapter.slug}`;
      const idByHandle = await userIdsByHandle(handles);
      await createNotifications(tx, [
        { recipientId: authorId, type: ADMIN_NOTIFY.forceApproved, payload: { href, chapterTitle: session.chapter.title } },
        ...handles
          .map((h) => idByHandle.get(h))
          .filter((reviewerId): reviewerId is string => !!reviewerId)
          .map((recipientId) => ({
            recipientId,
            type: REVIEW_NOTIFY.published,
            payload: { href, chapterTitle: session.chapter.title },
          })),
      ]);
    });
  } catch (e) {
    if (e instanceof GateFailed) return NextResponse.json({ error: e.reason }, { status: 409 });
    return NextResponse.json({ error: "Не удалось опубликовать." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, blogSlug: session.blog.slug, chapterSlug: session.chapter.slug });
}
