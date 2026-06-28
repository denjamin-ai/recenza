// Аутентификация ПОЛЬЗОВАТЕЛЕЙ (reader/author/reviewer): POST (вход) / GET (текущий) / DELETE (выход).
// Контракт (harness): POST /api/auth/user body {handle,password} → 200 + cookie blog_session.
//   GET /api/auth/user → { user: PublicUser | null }. 429 при rate-limit. Заблокированный — generic 401.

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUser, getSession, toPublicUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import {
  checkLoginRate,
  clearLoginRate,
  clientKey,
  recordLoginFailure,
} from "@/lib/rate-limit";

function rateLimited(retryAfter?: number): NextResponse {
  return NextResponse.json(
    { error: "Слишком много попыток входа. Попробуйте позже." },
    { status: 429, headers: { "Retry-After": String(retryAfter ?? 900) } },
  );
}

// Единый ответ на любую неудачу входа: не раскрываем, что именно не так (handle? пароль? блок?).
function loginFailed(): NextResponse {
  return NextResponse.json({ error: "Неверный никнейм или пароль." }, { status: 401 });
}

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const key = `user:${clientKey(req)}`;
  const rl = checkLoginRate(key);
  if (!rl.ok) return rateLimited(rl.retryAfter);

  let handle = "";
  let password = "";
  try {
    const body = (await req.json()) as { handle?: unknown; password?: unknown };
    if (typeof body.handle === "string") handle = body.handle.trim();
    if (typeof body.password === "string") password = body.password;
  } catch {
    recordLoginFailure(key);
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  if (!handle || !password) {
    recordLoginFailure(key);
    return loginFailed();
  }

  const row = await db.query.users.findFirst({ where: eq(users.handle, handle) });
  // Заблокированный пользователь не входит (binding); причину не раскрываем.
  if (!row || row.isBlocked) {
    recordLoginFailure(key);
    return loginFailed();
  }

  const ok = await bcrypt.compare(password, row.passwordHash);
  if (!ok) {
    recordLoginFailure(key);
    return loginFailed();
  }

  const session = await getSession();
  session.isAdmin = false; // инвариант: пользователь без isAdmin=true
  session.userId = row.id;
  session.userRole = row.role;
  await session.save();

  clearLoginRate(key);
  return NextResponse.json({ user: toPublicUser(row) });
}

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser(); // null для гостя/админа/заблокированного
  return NextResponse.json({ user });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
