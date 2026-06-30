// Вердикт ревьюера на последнюю ревизию (Фаза 7). Только назначенный ревьюер (resolveReviewAccess →
// role reviewer). Автор вердикт НЕ ставит (гейт серверный). Допустимо в статусах under-review|changes-requested.
// Пересчитываем статус ревизии: любой request-changes → changes-requested; все approve → under-review
// (готово к публикации — производный флаг allApproved). Уведомляем автора.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapterReviewers, chapterRevisions } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { createNotifications } from "@/lib/queries/notifications";
import { REVIEW_NOTIFY, authorReviewHref, resolveReviewAccess } from "@/lib/queries/review";
import { VERDICTS, type RevisionStatus, type Verdict } from "@/types";

const ACTIVE = new Set(["under-review", "changes-requested"]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { chapterId } = await params;
  const access = await resolveReviewAccess(chapterId);
  if (access instanceof NextResponse) return access;
  if (access.role !== "reviewer") {
    return NextResponse.json({ error: "Вердикт ставит только назначенный ревьюер." }, { status: 403 });
  }

  const rl = hitActionRate(`review-verdict:${access.user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  let verdict: Verdict;
  try {
    const body = (await req.json()) as { verdict?: unknown };
    if (typeof body.verdict !== "string" || !(VERDICTS as readonly string[]).includes(body.verdict)) {
      return NextResponse.json({ error: "Некорректный вердикт." }, { status: 400 });
    }
    verdict = body.verdict as Verdict;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const { session } = access;
  if (!ACTIVE.has(session.revision.status)) {
    return NextResponse.json({ error: "Глава не на активном ревью." }, { status: 409 });
  }

  const now = Math.floor(Date.now() / 1000);
  const revNumber = session.revision.number;
  // Пересчёт статуса/консенсуса делаем по СВЕЖИМ вердиктам из БД ВНУТРИ транзакции (после записи
  // своего голоса) — иначе при одновременных голосах двух ревьюеров расчёт по кэшу сессии даёт гонку.
  let allApprove = false;
  let newStatus: RevisionStatus = session.revision.status;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(chapterReviewers)
        .set({ verdict, verdictAt: now })
        .where(
          and(
            eq(chapterReviewers.chapterId, chapterId),
            eq(chapterReviewers.revisionNumber, revNumber),
            eq(chapterReviewers.handle, access.user.handle),
          ),
        );
      const fresh = await tx
        .select({ verdict: chapterReviewers.verdict })
        .from(chapterReviewers)
        .where(
          and(eq(chapterReviewers.chapterId, chapterId), eq(chapterReviewers.revisionNumber, revNumber)),
        );
      const anyChanges = fresh.some((r) => r.verdict === "request-changes");
      allApprove = fresh.length > 0 && fresh.every((r) => r.verdict === "approve");
      // Статус ревизии: правки → changes-requested; иначе остаётся under-review (publish — отдельный
      // шаг; «все одобрили» — производный флаг allApprove, не статус).
      newStatus = anyChanges ? "changes-requested" : "under-review";
      if (newStatus !== session.revision.status) {
        await tx
          .update(chapterRevisions)
          .set({ status: newStatus })
          .where(eq(chapterRevisions.id, session.revision.id));
      }
      // Уведомление автору: запрошены правки / всё одобрено.
      const href = authorReviewHref(session.blog.slug, session.chapter.slug);
      const payload = { href, chapterTitle: session.chapter.title, revision: revNumber };
      if (verdict === "request-changes") {
        await createNotifications(tx, [
          { recipientId: session.blog.authorId, type: REVIEW_NOTIFY.changesRequested, payload },
        ]);
      } else if (allApprove) {
        await createNotifications(tx, [
          { recipientId: session.blog.authorId, type: REVIEW_NOTIFY.ready, payload },
        ]);
      }
    });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить вердикт." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, verdict, status: newStatus, allApproved: allApprove });
}
