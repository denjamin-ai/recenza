// Ядро аутентификации Recenza — iron-session + гарды возможностей (CLAUDE.md §Auth, §Гейтинг).
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
//
// ⚠️ Фаза 13: гейтинг идёт по ВОЗМОЖНОСТЯМ (`users.can_author` / `users.is_reviewer`), не по `users.role`.
// У `requireUser()` НАМЕРЕННО нет параметра роли — так случайный ролевой гейт невозможен в принципе;
// всё, что требует конкретной возможности, обязано идти через requireCapability/requireCapabilityPage.
// Возможность всегда перечитывается из БД на каждый запрос (не из cookie).

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hasCapability, type Capability } from "@/lib/roles";
import type { PublicUser, SessionData, User } from "@/types";

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

/** Снимок SessionData (без методов iron-session); ГАРАНТИРУЕТ инвариант: админ — без userId. */
function snapshot(s: IronSession<SessionData>): SessionData {
  if (s.isAdmin) return { isAdmin: true };
  return { isAdmin: false, userId: s.userId };
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
 * Любой аккаунт (без требований к возможностям). Гость/админ → 401.
 * Сверяет блокировку по БД (живая сессия заблокированного → 401 + self-heal).
 *
 * ⚠️ Параметра роли здесь НЕТ намеренно (Фаза 13): если действию нужна возможность —
 * это `requireCapability("author" | "reviewer")`, а не сравнение строк.
 */
export async function requireUser(): Promise<SessionData | NextResponse> {
  const session = await getSession();
  if (session.isAdmin || !session.userId) return unauthorized();

  const row = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { id: true, isBlocked: true },
  });
  if (!row || row.isBlocked) {
    try {
      session.destroy();
    } catch {
      /* RSC read-only */
    }
    return unauthorized("Сессия недействительна.");
  }
  return { isAdmin: false, userId: row.id };
}

/**
 * Аккаунт с конкретной возможностью (выдаёт админ). Гость/админ → 401, нет возможности → 403.
 * Возможности читаются из БД на каждый запрос — отзыв возможности действует без перелогина.
 */
export async function requireCapability(
  capability: Capability,
): Promise<SessionData | NextResponse> {
  const session = await getSession();
  if (session.isAdmin || !session.userId) return unauthorized();

  const row = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { id: true, isBlocked: true, canAuthor: true, isReviewer: true },
  });
  if (!row || row.isBlocked) {
    try {
      session.destroy();
    } catch {
      /* RSC read-only */
    }
    return unauthorized("Сессия недействительна.");
  }
  if (!hasCapability(row, capability)) return forbidden();
  return { isAdmin: false, userId: row.id };
}

export function requireAuthor(): Promise<SessionData | NextResponse> {
  return requireCapability("author");
}
export function requireReviewer(): Promise<SessionData | NextResponse> {
  return requireCapability("reviewer");
}

// ───────────────────────────── Page-гарды ((protected)/layout.tsx) ─────────────────────────────

/** Гард админ-портала (fullscreen). Гость → /admin/login, иной пользователь → /. */
export async function requireAdminPage(): Promise<SessionData> {
  const session = await getSession();
  if (!session.isAdmin) redirect(session.userId ? "/" : "/admin/login");
  return snapshot(session);
}

/** Гард приватных страниц аккаунта (/workspace, /settings): любой вошедший пользователь. */
export async function requireUserPage(): Promise<PublicUser> {
  const session = await getSession();
  if (session.isAdmin) redirect("/admin");

  const user = await getCurrentUser();
  if (!user) redirect("/login"); // гость / заблокированный / удалённый
  return user;
}

/** Гард кабинета возможности. Гость → /login, админ → /admin, нет возможности → /. */
export async function requireCapabilityPage(capability: Capability): Promise<PublicUser> {
  const user = await requireUserPage();
  if (!hasCapability(user, capability)) redirect("/");
  return user;
}

export function requireAuthorPage(): Promise<PublicUser> {
  return requireCapabilityPage("author");
}
export function requireReviewerPage(): Promise<PublicUser> {
  return requireCapabilityPage("reviewer");
}
