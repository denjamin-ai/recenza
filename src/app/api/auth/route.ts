// Аутентификация АДМИНА: POST (вход по env-паролю) / DELETE (выход).
// Контракт (harness login.sh): POST /api/auth body {password} → 200 + cookie blog_session; 429 при rate-limit.
// Админ НЕ имеет строки users — сессия { isAdmin: true } без userId (инвариант SessionData).

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import {
  accountKey,
  checkAccountRate,
  checkLoginRate,
  clearRate,
  clientKey,
  recordFailure,
} from "@/lib/rate-limit";

// Ведро на сам админ-аккаунт (аудит ИБ 2026-07-26): IP-ключ приходит из внешнего заголовка,
// поэтому распределённый перебор ADMIN_PASSWORD_HASH обходит IP-лимит по построению.
// ⚠️ Обратная сторона (принята владельцем): вход в админку можно запереть снаружи на 15 минут.
//    Аварийный выход — `sudo systemctl restart recenza` (вёдра in-memory).
const ADMIN_ACCOUNT = accountKey("admin");

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

  const acctRl = checkAccountRate("admin");
  if (!acctRl.ok) return rateLimited(acctRl.retryAfter);

  const failed = () => {
    recordFailure(key);
    recordFailure(ADMIN_ACCOUNT);
  };

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password;
  } catch {
    // Ошибка разбора JSON — не попытка подбора пароля, в rate-limit не засчитываем.
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  if (!password) {
    failed();
    return NextResponse.json({ error: "Введите пароль." }, { status: 401 });
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    console.error("[auth] ADMIN_PASSWORD_HASH не задан — вход админа невозможен.");
    return NextResponse.json({ error: "Сервер не настроен." }, { status: 500 });
  }

  const ok = await bcrypt.compare(password, hash);
  if (!ok) {
    failed();
    return NextResponse.json({ error: "Неверный пароль." }, { status: 401 });
  }

  const session = await getSession();
  session.isAdmin = true;
  delete session.userId; // инвариант: admin без userId
  await session.save();

  clearRate(key);
  clearRate(ADMIN_ACCOUNT);
  return NextResponse.json({ isAdmin: true });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
