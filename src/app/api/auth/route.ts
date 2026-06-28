// Аутентификация АДМИНА: POST (вход по env-паролю) / DELETE (выход).
// Контракт (harness login.sh): POST /api/auth body {password} → 200 + cookie blog_session; 429 при rate-limit.
// Админ НЕ имеет строки users — сессия { isAdmin: true } без userId (инвариант SessionData).

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
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

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const key = `admin:${clientKey(req)}`;
  const rl = checkLoginRate(key);
  if (!rl.ok) return rateLimited(rl.retryAfter);

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password;
  } catch {
    recordLoginFailure(key);
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  if (!password) {
    recordLoginFailure(key);
    return NextResponse.json({ error: "Введите пароль." }, { status: 401 });
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    console.error("[auth] ADMIN_PASSWORD_HASH не задан — вход админа невозможен.");
    return NextResponse.json({ error: "Сервер не настроен." }, { status: 500 });
  }

  const ok = await bcrypt.compare(password, hash);
  if (!ok) {
    recordLoginFailure(key);
    return NextResponse.json({ error: "Неверный пароль." }, { status: 401 });
  }

  const session = await getSession();
  session.isAdmin = true;
  delete session.userId; // инвариант: admin без userId/userRole
  delete session.userRole;
  await session.save();

  clearLoginRate(key);
  return NextResponse.json({ isAdmin: true });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
