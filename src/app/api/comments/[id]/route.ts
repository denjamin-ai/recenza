// Правка (PATCH) и мягкое удаление (DELETE) публичного комментария (Фаза 8).
// Окно правки 15 мин — серверная истина. Soft-delete (deletedAt), НЕ физическое удаление: иначе CASCADE
// снёс бы живые ответы. Оба метода: CSRF → auth → rate-limit → ownership.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { publicComments } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { EDIT_WINDOW_S } from "@/lib/queries/comments";

const MAX_TEXT = 4000;

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`comment-edit:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { id } = await ctx.params;

  const row = (
    await db
      .select({
        id: publicComments.id,
        authorId: publicComments.authorId,
        createdAt: publicComments.createdAt,
        deletedAt: publicComments.deletedAt,
      })
      .from(publicComments)
      .where(eq(publicComments.id, id))
      .limit(1)
  )[0];
  if (!row) return NextResponse.json({ error: "Комментарий не найден." }, { status: 404 });
  if (row.authorId !== userId) return NextResponse.json({ error: "Нельзя редактировать чужой комментарий." }, { status: 403 });
  if (row.deletedAt != null) return NextResponse.json({ error: "Комментарий удалён." }, { status: 409 });

  const now = Math.floor(Date.now() / 1000);
  if (now - row.createdAt >= EDIT_WINDOW_S) {
    return NextResponse.json({ error: "Окно редактирования истекло." }, { status: 403 });
  }

  let text: string;
  try {
    const body = (await req.json()) as { text?: unknown };
    const rawText = typeof body.text === "string" ? body.text.trim() : "";
    if (!rawText) return NextResponse.json({ error: "Пустой комментарий." }, { status: 400 });
    text = rawText.slice(0, MAX_TEXT);
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  await db.update(publicComments).set({ text, editedAt: now }).where(eq(publicComments.id, id));
  return NextResponse.json({ ok: true, editedAt: now });
}

export async function DELETE(req: Request, ctx: Ctx): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`comment-delete:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { id } = await ctx.params;

  const row = (
    await db
      .select({
        id: publicComments.id,
        authorId: publicComments.authorId,
        deletedAt: publicComments.deletedAt,
      })
      .from(publicComments)
      .where(eq(publicComments.id, id))
      .limit(1)
  )[0];
  if (!row) return NextResponse.json({ error: "Комментарий не найден." }, { status: 404 });
  if (row.authorId !== userId) return NextResponse.json({ error: "Нельзя удалить чужой комментарий." }, { status: 403 });
  if (row.deletedAt != null) return NextResponse.json({ ok: true }); // идемпотентно

  const now = Math.floor(Date.now() / 1000);
  await db.update(publicComments).set({ deletedAt: now }).where(eq(publicComments.id, id));
  return NextResponse.json({ ok: true });
}
