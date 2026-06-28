// Подписка на автора (toggle), автор-центрично. Нельзя подписаться на себя; цель — существующий
// незаблокированный автор. PK(userId, authorId) — страховка от гонки.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { follows, users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";

async function isFollowing(userId: string, authorId: string): Promise<boolean> {
  const row = await db
    .select({ userId: follows.userId })
    .from(follows)
    .where(and(eq(follows.userId, userId), eq(follows.authorId, authorId)))
    .limit(1);
  return row.length > 0;
}

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`follow:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  let authorId: string;
  try {
    const body = (await req.json()) as { authorId?: unknown };
    if (typeof body.authorId !== "string" || !body.authorId) {
      return NextResponse.json({ error: "Некорректный authorId." }, { status: 400 });
    }
    authorId = body.authorId;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  if (authorId === userId) {
    return NextResponse.json({ error: "Нельзя подписаться на себя." }, { status: 400 });
  }

  const target = (
    await db
      .select({ id: users.id, role: users.role, isBlocked: users.isBlocked })
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1)
  )[0];
  if (!target || target.isBlocked || target.role !== "author") {
    return NextResponse.json({ error: "Автор не найден." }, { status: 404 });
  }

  try {
    const following = await db.transaction(async (tx) => {
      const existing = (
        await tx
          .select({ userId: follows.userId })
          .from(follows)
          .where(and(eq(follows.userId, userId), eq(follows.authorId, authorId)))
          .limit(1)
      )[0];
      if (!existing) {
        await tx.insert(follows).values({ userId, authorId, createdAt: Math.floor(Date.now() / 1000) });
        return true;
      }
      await tx.delete(follows).where(and(eq(follows.userId, userId), eq(follows.authorId, authorId)));
      return false;
    });
    return NextResponse.json({ ok: true, following });
  } catch {
    return NextResponse.json({ ok: true, following: await isFollowing(userId, authorId) });
  }
}
