// Создание пользователя админом (Фаза 12) — альфа-модель доступа: self-registration в приложении
// нет, аккаунты выдаёт только админ и сообщает пароль лично.
//
// Фаза 13: вместо одной роли задаются ВОЗМОЖНОСТИ. `canAuthor` по умолчанию ВКЛЮЧЕН (снимается
// явным `false`), `isReviewer` — выключен. Менять их можно и позже — PATCH /api/admin/users/[handle];
// снятие `can_author` прячет все блоги автора из публичных поверхностей.
// Колонка `role` notNull, поэтому пишется legacy-shim, отражающий «главную» возможность;
// админ через этот эндпоинт не создаётся (админ — env-based, строки в users не имеет).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";

const HANDLE_RE = /^[a-z0-9_-]{3,30}$/;

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

  let body: {
    handle?: unknown;
    displayName?: unknown;
    password?: unknown;
    canAuthor?: unknown;
    isReviewer?: unknown;
    introducedBy?: unknown;
  };
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

  if (body.canAuthor !== undefined && typeof body.canAuthor !== "boolean") {
    return NextResponse.json({ error: "canAuthor: ожидается boolean." }, { status: 400 });
  }
  if (body.isReviewer !== undefined && typeof body.isReviewer !== "boolean") {
    return NextResponse.json({ error: "isReviewer: ожидается boolean." }, { status: 400 });
  }
  // ⚠️ Авторство по умолчанию ВКЛЮЧЕНО (решение владельца): вести блог — базовая возможность
  // нового аккаунта, админ снимает её точечно. Ревьюерство остаётся выдаваемым явно.
  // Дефолт живёт здесь, а не в схеме: сменить DEFAULT колонки в SQLite = пересоздать таблицу
  // `users`, на которую ссылаются FK ревью-таблиц (деструктивные миграции запрещены).
  const canAuthor = body.canAuthor !== false;
  const isReviewer = body.isReviewer === true;
  // legacy-shim для notNull-колонки `role`: гейты её не читают (см. schema.ts).
  const role = isReviewer ? "reviewer" : canAuthor ? "author" : "reader";

  // Ф14: кто привёл этого человека (канал «инвайт-ссылка эксперта»). От этого поля зависит
  // УРОВЕНЬ БЕЙДЖА: ревью от приведённого автором эксперта помечается `invited` и не пускает блог
  // на главную. Значит поле — часть доверия, и подделать его нельзя: только админ, только
  // существующий handle, и никогда не сам на себя (иначе автор-ревьюер выдавал бы себе independent).
  let introducedBy: string | null = null;
  if (body.introducedBy != null) {
    if (typeof body.introducedBy !== "string" || !body.introducedBy.trim()) {
      return NextResponse.json({ error: "introducedBy: ожидается handle или null." }, { status: 400 });
    }
    introducedBy = body.introducedBy.trim().toLowerCase();
    if (introducedBy === handle) {
      return NextResponse.json({ error: "Пользователь не может пригласить сам себя." }, { status: 400 });
    }
    const inviter = (
      await db.select({ handle: users.handle }).from(users).where(eq(users.handle, introducedBy)).limit(1)
    )[0];
    if (!inviter) {
      return NextResponse.json({ error: "Пригласивший не найден." }, { status: 400 });
    }
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
      canAuthor,
      isReviewer,
      introducedBy,
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
