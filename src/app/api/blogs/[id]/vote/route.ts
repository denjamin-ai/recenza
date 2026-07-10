// Голос за БЛОГ (±1), race-safe toggle (ui-feedback-5: голоса блоговые, как в прототипе).
// Порядок: CSRF → auth (ТОЛЬКО reader — модель ролей) → rate-limit → валидация → цель → транзакция.
// Счёт — SUM в той же транзакции (идемпотентный ответ).

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogVotes, blogs } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

async function readState(userId: string, blogId: string) {
  const [voteRow, scoreRow] = await Promise.all([
    db
      .select({ value: blogVotes.value })
      .from(blogVotes)
      .where(and(eq(blogVotes.userId, userId), eq(blogVotes.blogId, blogId)))
      .limit(1),
    db
      .select({ score: sql<number>`coalesce(sum(${blogVotes.value}), 0)` })
      .from(blogVotes)
      .where(eq(blogVotes.blogId, blogId)),
  ]);
  const myVote = voteRow[0]?.value === 1 ? 1 : voteRow[0]?.value === -1 ? -1 : 0;
  return { myVote, score: Number(scoreRow[0]?.score ?? 0) };
}

export async function POST(req: Request, ctx: Ctx): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // Голосует только читатель (ui-feedback-5, решение владельца: engagement — прерогатива reader).
  const session = await requireUser("reader");
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

  const { id: blogId } = await ctx.params;

  let value: 1 | -1;
  try {
    const body = (await req.json()) as { value?: unknown };
    if (body.value === 1) value = 1;
    else if (body.value === -1) value = -1;
    else return NextResponse.json({ error: "Некорректное значение голоса." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const blogRow = (
    await db.select({ id: blogs.id }).from(blogs).where(eq(blogs.id, blogId)).limit(1)
  )[0];
  if (!blogRow) return NextResponse.json({ error: "Блог не найден." }, { status: 404 });

  try {
    const result = await db.transaction(async (tx) => {
      const existing = (
        await tx
          .select({ id: blogVotes.id, value: blogVotes.value })
          .from(blogVotes)
          .where(and(eq(blogVotes.userId, userId), eq(blogVotes.blogId, blogId)))
          .limit(1)
      )[0];

      let myVote: 1 | -1 | 0;
      if (!existing) {
        await tx.insert(blogVotes).values({
          userId,
          blogId,
          value,
          createdAt: Math.floor(Date.now() / 1000),
        });
        myVote = value;
      } else if (existing.value === value) {
        await tx.delete(blogVotes).where(eq(blogVotes.id, existing.id));
        myVote = 0;
      } else {
        await tx.update(blogVotes).set({ value }).where(eq(blogVotes.id, existing.id));
        myVote = value;
      }

      const scoreRow = (
        await tx
          .select({ score: sql<number>`coalesce(sum(${blogVotes.value}), 0)` })
          .from(blogVotes)
          .where(eq(blogVotes.blogId, blogId))
      )[0];
      return { myVote, score: Number(scoreRow?.score ?? 0) };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    // Гонка (uniqueIndex user+blog) — отдаём актуальное состояние идемпотентно.
    return NextResponse.json({ ok: true, ...(await readState(userId, blogId)) });
  }
}
