// Модерация пользователя (Фаза 10) — только админ. Тумблеры isBlocked / commentingBlocked +
// reviewCapacity. СТРОГИЙ allowlist полей: роль НИКОГДА не редактируется обычным API (binding,
// CLAUDE.md §гейтинг) — единственный путь смены роли в Фазе 10 — accept заявки с доски.
// Бан = soft (FK на users.handle запрещает hard-delete). Бан автора скрывает его блоги
// (фильтр users.isBlocked в getReadableChapters/getReadableBlog) — отдельного действия не нужно.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ handle: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { handle } = await params;

  let body: { isBlocked?: unknown; commentingBlocked?: unknown; reviewCapacity?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const set: Partial<{ isBlocked: boolean; commentingBlocked: boolean; reviewCapacity: number }> = {};
  if (body.isBlocked !== undefined) {
    if (typeof body.isBlocked !== "boolean") return NextResponse.json({ error: "isBlocked: ожидается boolean." }, { status: 400 });
    set.isBlocked = body.isBlocked;
  }
  if (body.commentingBlocked !== undefined) {
    if (typeof body.commentingBlocked !== "boolean") return NextResponse.json({ error: "commentingBlocked: ожидается boolean." }, { status: 400 });
    set.commentingBlocked = body.commentingBlocked;
  }
  if (body.reviewCapacity !== undefined) {
    if (typeof body.reviewCapacity !== "number" || !Number.isInteger(body.reviewCapacity) || body.reviewCapacity < 0 || body.reviewCapacity > 50) {
      return NextResponse.json({ error: "reviewCapacity: целое 0..50." }, { status: 400 });
    }
    set.reviewCapacity = body.reviewCapacity;
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "Нет полей для изменения." }, { status: 400 });
  }

  const target = (await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.handle, handle)).limit(1))[0];
  if (!target) return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
  // Админа из БД не существует (env-based) — но на всякий случай не даём блокировать admin-роль.
  if (target.role === "admin") return NextResponse.json({ error: "Нельзя модерировать администратора." }, { status: 403 });

  await db.update(users).set(set).where(eq(users.handle, handle));
  return NextResponse.json({ ok: true });
}
