// Публикация главы (Фаза 7) — author-only. Гейт (перепроверяется в БД, race-safe): ВСЕ назначенные
// ревьюеры последней ревизии вынесли approve (и их ≥1). Иначе 409. Force-approve админом — Фаза 10.
// При публикации: ревизия → published + publishedAt; кредит ревьюеров в reviewer_history (для ридера);
// блог помечается опубликованным (publishedAt при первой публикации). Уведомляем ревьюеров.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterReviewers, chapterRevisions, reviewerHistory } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { createNotifications } from "@/lib/queries/notifications";
import { REVIEW_NOTIFY, resolveReviewAccess, userIdsByHandle } from "@/lib/queries/review";

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

  // Гейт «все approve» — перечитываем вердикты из БД (не доверяем кэшу сессии).
  const verdictRows = await db
    .select({ handle: chapterReviewers.handle, verdict: chapterReviewers.verdict })
    .from(chapterReviewers)
    .where(and(eq(chapterReviewers.chapterId, chapterId), eq(chapterReviewers.revisionNumber, revNumber)));
  if (verdictRows.length === 0) {
    return NextResponse.json({ error: "Нет назначенных ревьюеров." }, { status: 409 });
  }
  if (!verdictRows.every((r) => r.verdict === "approve")) {
    return NextResponse.json(
      { error: "Опубликовать можно только когда все ревьюеры одобрили." },
      { status: 409 },
    );
  }

  // Адресаты уведомлений готовим до транзакции (чистое чтение).
  const reviewerIds = await userIdsByHandle(verdictRows.map((r) => r.handle));

  const now = Math.floor(Date.now() / 1000);
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(chapterRevisions)
        .set({ status: "published", publishedAt: now })
        .where(eq(chapterRevisions.id, session.revision.id));

      // Кредит ревьюеров этой версии (идемпотентно: чистим и пишем заново).
      await tx
        .delete(reviewerHistory)
        .where(and(eq(reviewerHistory.chapterId, chapterId), eq(reviewerHistory.revisionNumber, revNumber)));
      for (const r of verdictRows) {
        await tx.insert(reviewerHistory).values({ chapterId, revisionNumber: revNumber, handle: r.handle });
      }

      // publishedAt блога ставим только при первой публикации — читаем внутри транзакции (race-safe).
      const blogRow = (
        await tx.select({ publishedAt: blogs.publishedAt }).from(blogs).where(eq(blogs.id, session.blog.id)).limit(1)
      )[0];
      await tx
        .update(blogs)
        .set({ lastActivityAt: now, ...(blogRow?.publishedAt == null ? { publishedAt: now } : {}) })
        .where(eq(blogs.id, session.blog.id));

      const ids = reviewerIds;
      await createNotifications(
        tx,
        verdictRows
          .map((r) => ids.get(r.handle))
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
  } catch {
    return NextResponse.json({ error: "Не удалось опубликовать." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    blogSlug: session.blog.slug,
    chapterSlug: session.chapter.slug,
  });
}
