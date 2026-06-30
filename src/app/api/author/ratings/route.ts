// Оценка ревьюера автором (Фаза 9) — ПРИВАТНО (видят только ревьюер и админ; в «Топ» идёт агрегат).
// Только автор-владелец главы, только опубликованной, только зачтённого ревьюера (reviewer_history).
// Upsert на (chapter, reviewer, by); агрегат users.reviewerRating/reviewerRatingsN пересчитывается
// с нуля из reviewer_ratings (без дельт — drift-free).

import { NextResponse } from "next/server";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapters, reviewerHistory, reviewerRatings, users } from "@/lib/db/schema";
import { getCurrentUser, requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAuthor();
  if (gate instanceof NextResponse) return gate;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`rate-reviewer:${user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  let chapterId: string;
  let reviewerHandle: string;
  let stars: number;
  try {
    const body = (await req.json()) as { chapterId?: unknown; reviewerHandle?: unknown; stars?: unknown };
    if (typeof body.chapterId !== "string" || !body.chapterId) {
      return NextResponse.json({ error: "Не указана глава." }, { status: 400 });
    }
    if (typeof body.reviewerHandle !== "string" || !body.reviewerHandle) {
      return NextResponse.json({ error: "Не указан ревьюер." }, { status: 400 });
    }
    if (typeof body.stars !== "number" || !Number.isInteger(body.stars) || body.stars < 1 || body.stars > 5) {
      return NextResponse.json({ error: "Оценка — целое от 1 до 5." }, { status: 400 });
    }
    chapterId = body.chapterId;
    reviewerHandle = body.reviewerHandle;
    stars = body.stars;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  // Ownership: глава → блог → автор.
  const row = (
    await db
      .select({ authorId: blogs.authorId })
      .from(chapters)
      .innerJoin(blogs, eq(blogs.id, chapters.blogId))
      .where(eq(chapters.id, chapterId))
      .limit(1)
  )[0];
  if (!row || row.authorId !== user.id) {
    return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });
  }

  // Оценивать можно только зачтённого ревьюера (есть в reviewer_history опубликованной версии).
  const credited = (
    await db
      .select({ handle: reviewerHistory.handle })
      .from(reviewerHistory)
      .where(and(eq(reviewerHistory.chapterId, chapterId), eq(reviewerHistory.handle, reviewerHandle)))
      .limit(1)
  )[0];
  if (!credited) {
    return NextResponse.json({ error: "Этого ревьюера нельзя оценить для этой главы." }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(reviewerRatings)
        .values({ chapterId, reviewerHandle, byHandle: user.handle, stars, createdAt: now })
        .onConflictDoUpdate({
          target: [reviewerRatings.chapterId, reviewerRatings.reviewerHandle, reviewerRatings.byHandle],
          set: { stars, createdAt: now },
        });

      // Пересчёт агрегата ревьюера из БД (в «Топ» идёт только он).
      const agg = (
        await tx
          .select({ avg: sql<number>`avg(${reviewerRatings.stars})`, n: count() })
          .from(reviewerRatings)
          .where(eq(reviewerRatings.reviewerHandle, reviewerHandle))
      )[0];
      await tx
        .update(users)
        .set({ reviewerRating: agg?.avg ?? null, reviewerRatingsN: agg?.n ?? 0 })
        .where(eq(users.handle, reviewerHandle));
    });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить оценку." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
