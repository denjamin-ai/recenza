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
  accountKey,
  checkAccountRate,
  checkLoginRate,
  clearRate,
  clientKey,
  recordFailure,
} from "@/lib/rate-limit";

// Фиктивный хэш для выравнивания времени ответа (аудит ИБ 2026-07-26). Раньше ветки «нет такого
// handle» и «заблокирован» возвращались ДО bcrypt.compare, а валидный handle платил полную цену
// хэширования — единый текст ошибки обесценивался измеримой разницей во времени (перечисление
// аккаунтов). Считается один раз при импорте; сравнивается с заведомо неподходящим паролем.
const DUMMY_HASH = bcrypt.hashSync("recenza-timing-equalizer", 10);

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
    // Ошибка разбора JSON — не попытка подбора пароля, в rate-limit не засчитываем.
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  if (!handle || !password) {
    recordFailure(key);
    return loginFailed();
  }

  // Второе ведро — на сам аккаунт: IP-ключ приходит из внешнего заголовка, поэтому распределённый
  // перебор одного handle обходит IP-лимит по построению (аудит ИБ 2026-07-26).
  const acct = accountKey(handle);
  const acctRl = checkAccountRate(handle);
  if (!acctRl.ok) return rateLimited(acctRl.retryAfter);

  const failed = () => {
    recordFailure(key);
    recordFailure(acct);
    return loginFailed();
  };

  const row = await db.query.users.findFirst({ where: eq(users.handle, handle) });
  // Заблокированный пользователь не входит (binding); причину не раскрываем.
  // Фиктивный compare — чтобы время ответа не выдавало существование/статус аккаунта.
  if (!row || row.isBlocked) {
    await bcrypt.compare(password, DUMMY_HASH);
    return failed();
  }

  const ok = await bcrypt.compare(password, row.passwordHash);
  if (!ok) return failed();

  const session = await getSession();
  session.isAdmin = false; // инвариант: пользователь без isAdmin=true
  session.userId = row.id;
  // Возможности в cookie НЕ кладём (Фаза 13): гарды перечитывают их из БД, иначе отзыв
  // возможности админом не действовал бы до перелогина.
  await session.save();

  clearRate(key);
  clearRate(acct);
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
