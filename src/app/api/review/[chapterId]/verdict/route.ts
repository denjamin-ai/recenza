// Вердикт ревьюера на последнюю ревизию (Фаза 7). Только назначенный ревьюер (resolveReviewAccess →
// role reviewer). Автор вердикт НЕ ставит (гейт серверный). Допустимо, пока ревью-сессия открыта.
// Пересчитываем ось ревью: любой request-changes → changes-requested; все approve → reviewed.
//
// ⚠️ Ф14: если одобрена УЖЕ опубликованная ревизия — здесь же закрывается сессия и выдаётся бейдж
// (публикации после одобрения не будет, а значит `publishRevision()` этого не сделает никогда).

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapterReviewers, chapterRevisions } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { createNotifications } from "@/lib/queries/notifications";
import { REVIEW_NOTIFY, authorReviewHref, resolveReviewAccess } from "@/lib/queries/review";
import { isReviewOpen } from "@/lib/review-status";
import { closeReviewSession, recomputeBlogVerified } from "@/lib/queries/review-session";
import { VERDICTS, type ReviewStatus, type Verdict, type VerifiedTier } from "@/types";

/** Сессия закрылась между гейтом и записью вердикта → 409 (голос не должен теряться молча). */
class SessionClosed extends Error {}

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
  if (!isReviewOpen(session.revision.reviewStatus, session.revision.reviewClosedAt)) {
    return NextResponse.json({ error: "Глава не на активном ревью." }, { status: 409 });
  }

  const now = Math.floor(Date.now() / 1000);
  const revNumber = session.revision.number;
  // Пересчёт статуса/консенсуса делаем по СВЕЖИМ вердиктам из БД ВНУТРИ транзакции (после записи
  // своего голоса) — иначе при одновременных голосах двух ревьюеров расчёт по кэшу сессии даёт гонку.
  let allApprove = false;
  let newStatus: ReviewStatus = session.revision.reviewStatus;
  let badge: VerifiedTier | null = null;

  try {
    await db.transaction(async (tx) => {
      // TOCTOU: гейт выше проверен по кэшу сессии (`resolveReviewAccess` читает её в начале запроса).
      // Автор мог опубликовать ревизию и закрыть сессию, пока ревьюер держал форму открытой — тогда
      // вердикт записался бы в `chapter_reviewers` с ответом 200, но кредит по этой сессии уже
      // посчитан без него и повторно `closeReviewSession` не сработает (идемпотентность). То есть
      // голос молча терялся бы. Перечитываем токен в транзакции и честно отвечаем 409.
      const stillOpen = (
        await tx
          .select({ reviewClosedAt: chapterRevisions.reviewClosedAt })
          .from(chapterRevisions)
          .where(eq(chapterRevisions.id, session.revision.id))
          .limit(1)
      )[0];
      if (!stillOpen || stillOpen.reviewClosedAt !== null) throw new SessionClosed();

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
      // Ось РЕВЬЮ (Фаза 13): правки → changes-requested; все одобрили → reviewed; иначе ещё in-review.
      // «reviewed» — теперь настоящий статус, а не производный флаг: он переживает публикацию и
      // служит основанием кредита/бейджа (Ф14). Ось публикации здесь НЕ трогается.
      newStatus = anyChanges ? "changes-requested" : allApprove ? "reviewed" : "in-review";
      if (newStatus !== session.revision.reviewStatus) {
        await tx
          .update(chapterRevisions)
          .set({ reviewStatus: newStatus })
          .where(eq(chapterRevisions.id, session.revision.id));
      }
      // ⚠️ Ф14, вторая точка выдачи кредита и бейджа. Если ревизия УЖЕ опубликована, публикации
      // после одобрения не будет — а значит `publishRevision()` сессию не закроет никогда:
      // ни кредита, ни бейджа, а `review_load` ревьюера протёк бы навсегда. Закрываем здесь.
      // Черновик так не закрываем: он ещё будет опубликован, и закрытие произойдёт там.
      if (allApprove && session.revision.status === "published") {
        const res = await closeReviewSession(tx, {
          revisionId: session.revision.id,
          chapterId,
          revisionNumber: revNumber,
          authorHandle: session.blog.authorHandle,
        });
        badge = res.tier;
        await recomputeBlogVerified(tx, session.blog.id);
      }

      // Уведомление автору: запрошены правки / всё одобрено / выдан бейдж.
      const href = authorReviewHref(session.blog.slug, session.chapter.slug);
      const payload = { href, chapterTitle: session.chapter.title, revision: revNumber };
      if (verdict === "request-changes") {
        await createNotifications(tx, [
          { recipientId: session.blog.authorId, type: REVIEW_NOTIFY.changesRequested, payload },
        ]);
      } else if (allApprove) {
        await createNotifications(tx, [
          {
            recipientId: session.blog.authorId,
            type: badge !== null ? REVIEW_NOTIFY.badgeGranted : REVIEW_NOTIFY.ready,
            payload: badge !== null ? { ...payload, tier: badge } : payload,
          },
        ]);
      }
    });
  } catch (e) {
    if (e instanceof SessionClosed) {
      return NextResponse.json({ error: "Ревью по этой версии уже завершено." }, { status: 409 });
    }
    return NextResponse.json({ error: "Не удалось сохранить вердикт." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, verdict, status: newStatus, allApproved: allApprove, badge });
}
