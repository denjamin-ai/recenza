// Ревьюер берёт заявку из очереди (Фаза 14) — точка, где ревью реально стартует.
// Пришла на смену accept'у приглашения (`/api/reviewer/invitations/[id]`, удалён): инициатива
// перешла к ревьюеру, но downstream не тронут — треды/вердикты/чат по-прежнему опираются на
// `chapter_reviewers`, строку в которой создаёт именно claim.
//
// ⚠️ ВСЕ гейты проверяются ВНУТРИ транзакции (анти-TOCTOU): заявку берут параллельно, и «взял
// первым» должно решаться атомарно. Отдельно закрыт З-06 — `capacity` раньше проверялся ТОЛЬКО
// в UI, то есть не проверялся вовсе.

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blogs,
  chapterReviewers,
  chapterRevisions,
  chapters,
  reviewRequests,
  users,
} from "@/lib/db/schema";
import { getCurrentUser, requireReviewer } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { createNotifications } from "@/lib/queries/notifications";
import { REVIEW_NOTIFY, authorReviewHref } from "@/lib/queries/review";
import { SLA_SILENT_DAYS, dueAtFrom } from "@/lib/review-sla";

/** Гейт claim'а не прошёл внутри транзакции. `status` — какой код отдать вызывающему. */
class ClaimError extends Error {
  constructor(
    readonly reason: string,
    readonly status: number,
  ) {
    super(reason);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireReviewer();
  if (gate instanceof NextResponse) return gate;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`request-claim:${user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { requestId } = await params;
  const now = Math.floor(Date.now() / 1000);
  let chapterId = "";

  try {
    await db.transaction(async (tx) => {
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
            authorId: blogs.authorId,
          })
          .from(reviewRequests)
          .innerJoin(chapters, eq(chapters.id, reviewRequests.chapterId))
          .innerJoin(blogs, eq(blogs.id, chapters.blogId))
          .where(eq(reviewRequests.id, requestId))
          .limit(1)
      )[0];
      if (!row) throw new ClaimError("Заявка не найдена.", 404);
      if (row.status !== "open") throw new ClaimError("Заявку уже взяли.", 409);
      // Свой блог рецензировать нельзя — иначе автор с возможностью ревьюера выдал бы бейдж сам себе.
      if (row.authorId === user.id) {
        throw new ClaimError("Нельзя рецензировать собственный блог.", 403);
      }

      // З-06: серверная проверка занятости. До Ф14 `full` дизейблил чекбокс в пикере и только.
      const me = (
        await tx
          .select({ load: users.reviewLoad, capacity: users.reviewCapacity })
          .from(users)
          .where(eq(users.handle, user.handle))
          .limit(1)
      )[0];
      if (me && me.load >= me.capacity) {
        throw new ClaimError("Вы уже загружены до предела — завершите текущие ревью.", 409);
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

      await tx
        .update(reviewRequests)
        .set({
          status: "claimed",
          claimedBy: user.handle,
          claimedAt: now,
          dueAt: dueAtFrom(now, SLA_SILENT_DAYS),
        })
        .where(eq(reviewRequests.id, row.id));

      // Ревью стартует ровно здесь (idempotent по PK — гонка двух claim'ов уже отсечена статусом).
      await tx
        .insert(chapterReviewers)
        .values({
          chapterId: row.chapterId,
          revisionNumber: row.revisionNumber,
          handle: user.handle,
        })
        .onConflictDoNothing();
      await tx
        .update(users)
        .set({ reviewLoad: sql`${users.reviewLoad} + 1` })
        .where(eq(users.handle, user.handle));

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
            reviewer: user.displayName,
          },
        },
      ]);

      chapterId = row.chapterId;
    });
  } catch (e) {
    if (e instanceof ClaimError) return NextResponse.json({ error: e.reason }, { status: e.status });
    return NextResponse.json({ error: "Не удалось взять заявку." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, chapterId });
}
