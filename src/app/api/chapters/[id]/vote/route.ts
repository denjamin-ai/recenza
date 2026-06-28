// Голос за главу (±1), race-safe toggle. Порядок: CSRF → auth → rate-limit → валидация → ownership → транзакция.
// Автор не голосует за свою главу. Счёт — SUM в той же транзакции (идемпотентный ответ).

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterVotes, chapters } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

async function readState(userId: string, chapterId: string) {
  const [voteRow, scoreRow] = await Promise.all([
    db
      .select({ value: chapterVotes.value })
      .from(chapterVotes)
      .where(and(eq(chapterVotes.userId, userId), eq(chapterVotes.chapterId, chapterId)))
      .limit(1),
    db
      .select({ score: sql<number>`coalesce(sum(${chapterVotes.value}), 0)` })
      .from(chapterVotes)
      .where(eq(chapterVotes.chapterId, chapterId)),
  ]);
  const myVote = voteRow[0]?.value === 1 ? 1 : voteRow[0]?.value === -1 ? -1 : 0;
  return { myVote, score: Number(scoreRow[0]?.score ?? 0) };
}

export async function POST(req: Request, ctx: Ctx): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`vote:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { id: chapterId } = await ctx.params;

  let value: 1 | -1;
  try {
    const body = (await req.json()) as { value?: unknown };
    if (body.value === 1) value = 1;
    else if (body.value === -1) value = -1;
    else return NextResponse.json({ error: "Некорректное значение голоса." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const chapterRow = (
    await db
      .select({ id: chapters.id, authorId: blogs.authorId })
      .from(chapters)
      .innerJoin(blogs, eq(chapters.blogId, blogs.id))
      .where(eq(chapters.id, chapterId))
      .limit(1)
  )[0];
  if (!chapterRow) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });
  if (chapterRow.authorId === userId) {
    return NextResponse.json({ error: "Нельзя голосовать за свою главу." }, { status: 403 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const existing = (
        await tx
          .select({ id: chapterVotes.id, value: chapterVotes.value })
          .from(chapterVotes)
          .where(and(eq(chapterVotes.userId, userId), eq(chapterVotes.chapterId, chapterId)))
          .limit(1)
      )[0];

      let myVote: 1 | -1 | 0;
      if (!existing) {
        await tx.insert(chapterVotes).values({
          userId,
          chapterId,
          value,
          createdAt: Math.floor(Date.now() / 1000),
        });
        myVote = value;
      } else if (existing.value === value) {
        await tx.delete(chapterVotes).where(eq(chapterVotes.id, existing.id));
        myVote = 0;
      } else {
        await tx.update(chapterVotes).set({ value }).where(eq(chapterVotes.id, existing.id));
        myVote = value;
      }

      const scoreRow = (
        await tx
          .select({ score: sql<number>`coalesce(sum(${chapterVotes.value}), 0)` })
          .from(chapterVotes)
          .where(eq(chapterVotes.chapterId, chapterId))
      )[0];
      return { myVote, score: Number(scoreRow?.score ?? 0) };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    // Гонка (uniqueIndex user+chapter) — отдаём актуальное состояние идемпотентно.
    return NextResponse.json({ ok: true, ...(await readState(userId, chapterId)) });
  }
}
