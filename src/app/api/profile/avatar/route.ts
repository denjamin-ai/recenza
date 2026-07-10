// Смена аватарки СВОЕГО профиля (ui-feedback-5 П2): любой пользователь с users-строкой.
// Файл сначала загружается через POST /api/uploads (kind=avatar), сюда приходит путь.
// Валидация: строго /uploads/avatars/ (файл из чужого раздела не подвесить) либо null (сброс).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";

export async function PATCH(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`avatar:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  let avatarUrl: string | null;
  try {
    const body = (await req.json()) as { avatarUrl?: unknown };
    if (body.avatarUrl === null) {
      avatarUrl = null;
    } else if (
      typeof body.avatarUrl === "string" &&
      body.avatarUrl.startsWith("/uploads/avatars/") &&
      body.avatarUrl.length <= 200
    ) {
      avatarUrl = body.avatarUrl;
    } else {
      return NextResponse.json(
        { error: "avatarUrl: путь /uploads/avatars/… или null." },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  await db.update(users).set({ avatarUrl }).where(eq(users.id, userId));
  return NextResponse.json({ ok: true, avatarUrl });
}
