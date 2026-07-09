// Создание пользователя админом (Фаза 12) — альфа-модель доступа: self-registration в приложении
// нет, аккаунты выдаёт только админ и сообщает пароль лично. Роль задаётся ОДИН раз при создании
// (менять её обычным API по-прежнему нельзя — binding, CLAUDE.md §гейтинг); роль admin через этот
// эндпоинт не создаётся (админ — env-based, строки в users не имеет).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";

const HANDLE_RE = /^[a-z0-9_-]{3,30}$/;
const CREATABLE_ROLES = ["reader", "author", "reviewer"] as const;
type CreatableRole = (typeof CREATABLE_ROLES)[number];

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const rate = hitActionRate("admin:create-user");
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter ?? 1) } },
    );
  }

  let body: { handle?: unknown; displayName?: unknown; password?: unknown; role?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const handle = typeof body.handle === "string" ? body.handle.trim().toLowerCase() : "";
  if (!HANDLE_RE.test(handle)) {
    return NextResponse.json(
      { error: "Хэндл: 3–30 символов, только a-z, 0-9, «_» и «-»." },
      { status: 400 },
    );
  }

  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  if (displayName.length < 1 || displayName.length > 80) {
    return NextResponse.json({ error: "Имя: от 1 до 80 символов." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "Пароль: минимум 8 символов." }, { status: 400 });
  }

  const role = body.role as CreatableRole;
  if (!CREATABLE_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Роль: reader, author или reviewer." },
      { status: 400 },
    );
  }

  // slug = handle (оба UNIQUE); проверяем оба поля, т.к. slug другого пользователя мог занять имя.
  const clash = (
    await db
      .select({ handle: users.handle, slug: users.slug })
      .from(users)
      .where(eq(users.handle, handle))
      .limit(1)
  )[0] ?? (
    await db
      .select({ handle: users.handle, slug: users.slug })
      .from(users)
      .where(eq(users.slug, handle))
      .limit(1)
  )[0];
  if (clash) {
    return NextResponse.json({ error: "Хэндл уже занят." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    await db.insert(users).values({
      handle,
      role,
      passwordHash,
      displayName,
      slug: handle,
      createdAt: Math.floor(Date.now() / 1000),
    });
  } catch {
    // TOCTOU-гонка check→insert: UNIQUE(handle|slug) сработал между проверкой и вставкой.
    return NextResponse.json({ error: "Хэндл уже занят." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, handle }, { status: 201 });
}
