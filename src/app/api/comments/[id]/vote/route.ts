// Голос за комментарий (±1), race-safe toggle (клон chapter-vote). Порядок: CSRF → auth → rate-limit →
// валидация → запрет self-vote → транзакция. Счёт — SUM в той же транзакции (идемпотентный ответ).

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { commentVotes, publicComments } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

async function readState(userId: string, commentId: string) {
  const [voteRow, scoreRow] = await Promise.all([
    db
      .select({ value: commentVotes.value })
      .from(commentVotes)
      .where(and(eq(commentVotes.userId, userId), eq(commentVotes.commentId, commentId)))
      .limit(1),
    db
      .select({ score: sql<number>`coalesce(sum(${commentVotes.value}), 0)` })
      .from(commentVotes)
      .where(eq(commentVotes.commentId, commentId)),
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

  const rl = hitActionRate(`comment-vote:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { id: commentId } = await ctx.params;

  let value: 1 | -1;
  try {
    const body = (await req.json()) as { value?: unknown };
    if (body.value === 1) value = 1;
    else if (body.value === -1) value = -1;
    else return NextResponse.json({ error: "Некорректное значение голоса." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const commentRow = (
    await db
      .select({ id: publicComments.id, authorId: publicComments.authorId, deletedAt: publicComments.deletedAt })
      .from(publicComments)
      .where(eq(publicComments.id, commentId))
      .limit(1)
  )[0];
  if (!commentRow) return NextResponse.json({ error: "Комментарий не найден." }, { status: 404 });
  if (commentRow.deletedAt != null) {
    return NextResponse.json({ error: "Комментарий удалён." }, { status: 409 });
  }
  if (commentRow.authorId === userId) {
    return NextResponse.json({ error: "Нельзя голосовать за свой комментарий." }, { status: 403 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const existing = (
        await tx
          .select({ id: commentVotes.id, value: commentVotes.value })
          .from(commentVotes)
          .where(and(eq(commentVotes.userId, userId), eq(commentVotes.commentId, commentId)))
          .limit(1)
      )[0];

      let myVote: 1 | -1 | 0;
      if (!existing) {
        await tx.insert(commentVotes).values({
          userId,
          commentId,
          value,
          createdAt: Math.floor(Date.now() / 1000),
        });
        myVote = value;
      } else if (existing.value === value) {
        await tx.delete(commentVotes).where(eq(commentVotes.id, existing.id));
        myVote = 0;
      } else {
        await tx.update(commentVotes).set({ value }).where(eq(commentVotes.id, existing.id));
        myVote = value;
      }

      const scoreRow = (
        await tx
          .select({ score: sql<number>`coalesce(sum(${commentVotes.value}), 0)` })
          .from(commentVotes)
          .where(eq(commentVotes.commentId, commentId))
      )[0];
      return { myVote, score: Number(scoreRow?.score ?? 0) };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    // Гонка (uniqueIndex user+comment) — отдаём актуальное состояние идемпотентно.
    return NextResponse.json({ ok: true, ...(await readState(userId, commentId)) });
  }
}
