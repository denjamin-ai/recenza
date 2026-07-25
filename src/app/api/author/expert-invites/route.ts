// Инвайт-ссылки эксперта: выпуск автором (Фаза 14, канал 2).
//
// Токен — CSPRNG (`crypto.randomBytes`), а НЕ `ulid()`: ulid монотонен по времени, соседние
// значения предсказуемы, а тут токен и есть единственный секрет публичной страницы `/invite/[token]`.

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapters, expertInvites } from "@/lib/db/schema";
import { getCurrentUser, requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { INVITE_TTL_DAYS, MAX_ACTIVE_INVITES, countActiveInvites } from "@/lib/queries/expert-invites";

const DAY = 86_400;

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAuthor();
  if (gate instanceof NextResponse) return gate;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`expert-invite:${user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  let chapterId: string | null = null;
  try {
    const body = (await req.json().catch(() => ({}))) as { chapterId?: unknown };
    if (typeof body.chapterId === "string" && body.chapterId.trim()) chapterId = body.chapterId.trim();
    else if (body.chapterId != null && typeof body.chapterId !== "string") {
      return NextResponse.json({ error: "chapterId: ожидается строка или null." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  // Ownership главы (если ссылка привязана к главе): чужую главу подставить нельзя.
  if (chapterId) {
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
  }

  const now = Math.floor(Date.now() / 1000);
  if ((await countActiveInvites(user.handle, now)) >= MAX_ACTIVE_INVITES) {
    return NextResponse.json(
      { error: `Одновременно активных ссылок не больше ${MAX_ACTIVE_INVITES}. Отзовите ненужные.` },
      { status: 409 },
    );
  }

  const token = randomBytes(24).toString("base64url");
  await db.insert(expertInvites).values({
    token,
    byHandle: user.handle,
    chapterId,
    status: "pending",
    expiresAt: now + INVITE_TTL_DAYS * DAY,
    createdAt: now,
  });

  return NextResponse.json(
    { ok: true, token, url: `/invite/${token}`, expiresAt: now + INVITE_TTL_DAYS * DAY },
    { status: 201 },
  );
}
