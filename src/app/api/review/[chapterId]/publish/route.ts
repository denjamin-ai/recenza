// Публикация главы (Фаза 7) — author-only. Гейт (перепроверяется в БД, race-safe): ВСЕ назначенные
// ревьюеры последней ревизии вынесли approve (и их ≥1). Иначе 409. Force-approve админом — Фаза 10.
// При публикации: ревизия → published + publishedAt; кредит ревьюеров в reviewer_history (для ридера);
// блог помечается опубликованным (publishedAt при первой публикации). Уведомляем ревьюеров.

import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterReviewers, chapterRevisions, reviewerHistory, users } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { createNotifications } from "@/lib/queries/notifications";
import { REVIEW_NOTIFY, resolveReviewAccess } from "@/lib/queries/review";

const ACTIVE = new Set(["under-review", "changes-requested"]);

/** Гейт публикации не прошёл при перепроверке внутри транзакции (гонка) → 409. */
class PublishGateFailed extends Error {
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

  const { chapterId } = await params;
  const access = await resolveReviewAccess(chapterId);
  if (access instanceof NextResponse) return access;
  if (access.role !== "author") {
    return NextResponse.json({ error: "Публиковать может только автор." }, { status: 403 });
  }

  const rl = hitActionRate(`review-publish:${access.user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { session } = access;
  if (!ACTIVE.has(session.revision.status)) {
    return NextResponse.json({ error: "Главу нельзя опубликовать из текущего статуса." }, { status: 409 });
  }

  const revNumber = session.revision.number;

  // Быстрый путь (UX): предварительная проверка гейта вне транзакции — чтобы не открывать tx зря.
  const preRows = await db
    .select({ verdict: chapterReviewers.verdict })
    .from(chapterReviewers)
    .where(and(eq(chapterReviewers.chapterId, chapterId), eq(chapterReviewers.revisionNumber, revNumber)));
  if (preRows.length === 0) {
    return NextResponse.json({ error: "Нет назначенных ревьюеров." }, { status: 409 });
  }
  if (!preRows.every((r) => r.verdict === "approve")) {
    return NextResponse.json({ error: "Опубликовать можно только когда все ревьюеры одобрили." }, { status: 409 });
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    await db.transaction(async (tx) => {
      // Race-safe: ревизия ещё активна (не опубликована параллельно) — иначе двойной decrement reviewLoad.
      const rev = (
        await tx.select({ status: chapterRevisions.status }).from(chapterRevisions).where(eq(chapterRevisions.id, session.revision.id)).limit(1)
      )[0];
      if (!rev || !ACTIVE.has(rev.status)) throw new PublishGateFailed("Главу нельзя опубликовать из текущего статуса.");

      // Гейт «все approve» — перечитываем вердикты ВНУТРИ транзакции (не доверяем кэшу/предпроверке).
      const verdictRows = await tx
        .select({ handle: chapterReviewers.handle, verdict: chapterReviewers.verdict })
        .from(chapterReviewers)
        .where(and(eq(chapterReviewers.chapterId, chapterId), eq(chapterReviewers.revisionNumber, revNumber)));
      if (verdictRows.length === 0) throw new PublishGateFailed("Нет назначенных ревьюеров.");
      if (!verdictRows.every((r) => r.verdict === "approve")) {
        throw new PublishGateFailed("Опубликовать можно только когда все ревьюеры одобрили.");
      }
      const handles = verdictRows.map((r) => r.handle);

      await tx
        .update(chapterRevisions)
        .set({ status: "published", publishedAt: now })
        .where(eq(chapterRevisions.id, session.revision.id));

      // Кредит ревьюеров этой версии (идемпотентно: чистим и пишем заново).
      await tx
        .delete(reviewerHistory)
        .where(and(eq(reviewerHistory.chapterId, chapterId), eq(reviewerHistory.revisionNumber, revNumber)));
      for (const h of handles) {
        await tx.insert(reviewerHistory).values({ chapterId, revisionNumber: revNumber, handle: h });
      }

      // Ревью завершено → освобождаем ревьюеров: reviewLoad -= 1 (не ниже 0). Закрывает цикл занятости
      // (accept делает +1; Фаза 9). Снятие ревьюера/force-approve админом — Фаза 10.
      await tx
        .update(users)
        .set({ reviewLoad: sql`max(${users.reviewLoad} - 1, 0)` })
        .where(inArray(users.handle, handles));

      // publishedAt блога ставим только при первой публикации — читаем внутри транзакции (race-safe).
      const blogRow = (
        await tx.select({ publishedAt: blogs.publishedAt }).from(blogs).where(eq(blogs.id, session.blog.id)).limit(1)
      )[0];
      await tx
        .update(blogs)
        .set({ lastActivityAt: now, ...(blogRow?.publishedAt == null ? { publishedAt: now } : {}) })
        .where(eq(blogs.id, session.blog.id));

      // Адресаты уведомлений — внутри транзакции по свежим handle.
      const idRows = await tx.select({ handle: users.handle, id: users.id }).from(users).where(inArray(users.handle, handles));
      const ids = new Map(idRows.map((r) => [r.handle, r.id]));
      await createNotifications(
        tx,
        handles
          .map((h) => ids.get(h))
          .filter((id): id is string => !!id)
          .map((recipientId) => ({
            recipientId,
            type: REVIEW_NOTIFY.published,
            payload: {
              href: `/blog/${session.blog.slug}/${session.chapter.slug}`,
              chapterTitle: session.chapter.title,
            },
          })),
      );
    });
  } catch (e) {
    if (e instanceof PublishGateFailed) return NextResponse.json({ error: e.reason }, { status: 409 });
    return NextResponse.json({ error: "Не удалось опубликовать." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    blogSlug: session.blog.slug,
    chapterSlug: session.chapter.slug,
  });
}
