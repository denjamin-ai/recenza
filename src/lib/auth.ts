// Ядро аутентификации Recenza — iron-session + ролевые гарды (CLAUDE.md §Auth, §Ролевой гейтинг).
//
// Развязка RSC ↔ route handler (важно):
//   • ЧТЕНИЕ сессии безопасно везде (getSession / getCurrentUser) — и в Server Components/layout, и в API.
//   • ЗАПИСЬ (session.save() / session.destroy()) допустима ТОЛЬКО в route handlers: в RSC cookies()
//     доступен на чтение. Поэтому save()/destroy() вызываются лишь в /api/auth*; единственная
//     запись вне API — self-heal destroy() в getCurrentUser, обёрнутый в try/catch.
//
// Две семьи гардов:
//   • Handler-гарды (для src/app/api/**): возвращают SessionData | NextResponse — в хендлере НУЖНО
//     вернуть результат: `const s = await requireAuthor(); if (s instanceof NextResponse) return s;`.
//   • Page-гарды (для (protected)/layout.tsx): редиректят (next/navigation), не возвращают NextResponse.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { PublicUser, Role, SessionData, User } from "@/types";

// SESSION_SECRET — без fallback: падаем при импорте, если не задан (CLAUDE.md gotcha, ENVIRONMENTS §2).
const SESSION_PASSWORD = process.env.SESSION_SECRET;
if (!SESSION_PASSWORD) {
  throw new Error("[auth] SESSION_SECRET не задан — обязательная переменная окружения (32+ символа).");
}

export const sessionOptions: SessionOptions = {
  cookieName: "blog_session",
  password: SESSION_PASSWORD,
  cookieOptions: {
    httpOnly: true,
    // secure только в проде: иначе cookie не ставится по http://localhost (стенд «молча» не логинит).
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 дней
    path: "/",
  },
};

/** Чтение сессии. Безопасно в RSC и в route handler. Запись (save/destroy) — только в route handler. */
export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/** Снимок SessionData (без методов iron-session) с гарантией инварианта isAdmin↔userId. */
function snapshot(s: IronSession<SessionData>): SessionData {
  return { isAdmin: Boolean(s.isAdmin), userId: s.userId, userRole: s.userRole };
}

/** Проекция строки users без passwordHash (наружу полный User не отдаём — Phase 2 backlog P2). */
export function toPublicUser(u: User): PublicUser {
  const rest: Partial<User> = { ...u };
  delete rest.passwordHash;
  return rest as PublicUser;
}

/**
 * Текущий пользователь (reader/author/reviewer) как PublicUser, либо null для гостя/админа.
 * Self-heal: если строка исчезла или пользователь заблокирован после входа — гасим сессию.
 */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const session = await getSession();
  if (session.isAdmin || !session.userId) return null;

  const row = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!row || row.isBlocked) {
    try {
      session.destroy(); // в route handler сбросит cookie; в RSC бросит — глотаем (cookie протухнет сам).
    } catch {
      /* RSC: cookies() read-only — игнорируем */
    }
    return null;
  }
  return toPublicUser(row);
}

// ───────────────────────────── Handler-гарды (src/app/api/**) ─────────────────────────────

function unauthorized(message = "Требуется вход."): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}
function forbidden(message = "Недостаточно прав."): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/** Админ-сессия (isAdmin). Гость → 401, пользователь → 403. */
export async function requireAdmin(): Promise<SessionData | NextResponse> {
  const session = await getSession();
  if (!session.isAdmin) return session.userId ? forbidden() : unauthorized();
  return snapshot(session);
}

/**
 * Пользователь (reader/author/reviewer). С `role` — точная роль (иначе 403).
 * Сверяет блокировку по БД (живая сессия заблокированного → 401 + self-heal).
 */
export async function requireUser(role?: Role): Promise<SessionData | NextResponse> {
  const session = await getSession();
  if (session.isAdmin || !session.userId) return unauthorized();

  const row = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { id: true, role: true, isBlocked: true },
  });
  if (!row || row.isBlocked) {
    try {
      session.destroy();
    } catch {
      /* RSC read-only */
    }
    return unauthorized("Сессия недействительна.");
  }
  if (role && row.role !== role) return forbidden();
  return snapshot(session);
}

export function requireAuthor(): Promise<SessionData | NextResponse> {
  return requireUser("author");
}
export function requireReviewer(): Promise<SessionData | NextResponse> {
  return requireUser("reviewer");
}

// ───────────────────────────── Page-гарды ((protected)/layout.tsx) ─────────────────────────────

/** Гард админ-портала (fullscreen). Гость → /admin/login, иной пользователь → /. */
export async function requireAdminPage(): Promise<SessionData> {
  const session = await getSession();
  if (!session.isAdmin) redirect(session.userId ? "/" : "/admin/login");
  return snapshot(session);
}

async function requireRolePage(role: Role): Promise<PublicUser> {
  const session = await getSession();
  if (session.isAdmin) redirect("/admin");

  const user = await getCurrentUser();
  if (!user) redirect("/login"); // гость / заблокированный / удалённый
  if (user.role !== role) redirect("/"); // не та роль
  return user;
}

export function requireAuthorPage(): Promise<PublicUser> {
  return requireRolePage("author");
}
export function requireReviewerPage(): Promise<PublicUser> {
  return requireRolePage("reviewer");
}
