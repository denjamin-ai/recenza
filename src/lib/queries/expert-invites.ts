// Инвайт-ссылки эксперта (Фаза 14, канал 2 из трёх) — автор зовёт рецензента ИЗВНЕ платформы.
//
// Зачем канал вообще нужен: очередь работает, только если на платформе есть ревьюер с нужными
// компетенциями. Для узкой темы его может не быть вовсе — тогда автор приводит своего эксперта.
// Плата за это — прозрачность: ревью от приведённого автором эксперта даёт бейдж УРОВНЯ `invited`
// (`users.introduced_by` = автор), который не пускает блог на главную. Это не запрет, а маркировка.
//
// Регистрация остаётся закрытой (альфа): по ссылке заполняется АНКЕТА (`reviewer_applications`),
// аккаунт создаёт админ и лично выдаёт данные.

import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapters, expertInvites, reviewerApplications } from "@/lib/db/schema";
import type { ExpertInviteStatus } from "@/types";

/** Сколько дней живёт ссылка. Короткий срок ограничивает окно, в которое утёкший токен полезен. */
export const INVITE_TTL_DAYS = 14;
/** Больше активных ссылок на автора не выдаём — иначе канал превращается в рассылку. */
export const MAX_ACTIVE_INVITES = 5;

export interface AuthorInviteView {
  id: string;
  token: string;
  chapterTitle: string | null;
  status: ExpertInviteStatus;
  expiresAt: number;
  createdAt: number;
  usedAt: number | null;
}

/** Ссылки автора (активные и отработавшие) — для панели «Пригласить эксперта» в кабинете. */
export async function getAuthorExpertInvites(handle: string): Promise<AuthorInviteView[]> {
  const rows = await db
    .select({
      id: expertInvites.id,
      token: expertInvites.token,
      status: expertInvites.status,
      expiresAt: expertInvites.expiresAt,
      createdAt: expertInvites.createdAt,
      usedAt: expertInvites.usedAt,
      chapterTitle: chapters.title,
    })
    .from(expertInvites)
    .leftJoin(chapters, eq(chapters.id, expertInvites.chapterId))
    .where(eq(expertInvites.byHandle, handle))
    .orderBy(desc(expertInvites.createdAt));
  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    chapterTitle: r.chapterTitle ?? null,
    status: r.status,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    usedAt: r.usedAt,
  }));
}

/** Сколько ссылок автора ещё живы (для лимита). */
export async function countActiveInvites(handle: string, now: number): Promise<number> {
  const rows = await db
    .select({ id: expertInvites.id })
    .from(expertInvites)
    .where(
      and(
        eq(expertInvites.byHandle, handle),
        eq(expertInvites.status, "pending"),
        gt(expertInvites.expiresAt, now),
      ),
    );
  return rows.length;
}

export interface PublicInviteView {
  token: string;
  /** Имя автора-пригласившего — единственное, что раскрывается по валидному токену. */
  byName: string;
  chapterTitle: string | null;
  blogTitle: string | null;
}

/**
 * Публичная карточка приглашения по токену. null — токен не существует, отработал или истёк.
 * ⚠️ Вызывающий ОБЯЗАН отвечать одинаково на все три случая: разные ответы превращают страницу
 * в оракул существования токенов.
 */
export async function getPublicInvite(token: string, now: number): Promise<PublicInviteView | null> {
  const { blogs, users } = await import("@/lib/db/schema");
  const row = (
    await db
      .select({
        token: expertInvites.token,
        status: expertInvites.status,
        expiresAt: expertInvites.expiresAt,
        byName: users.displayName,
        authorBlocked: users.isBlocked,
        chapterTitle: chapters.title,
        blogTitle: blogs.title,
      })
      .from(expertInvites)
      .innerJoin(users, eq(users.handle, expertInvites.byHandle))
      .leftJoin(chapters, eq(chapters.id, expertInvites.chapterId))
      .leftJoin(blogs, eq(blogs.id, chapters.blogId))
      .where(eq(expertInvites.token, token))
      .limit(1)
  )[0];
  if (!row) return null;
  if (row.status !== "pending" || row.expiresAt <= now || row.authorBlocked) return null;
  return {
    token: row.token,
    byName: row.byName,
    chapterTitle: row.chapterTitle ?? null,
    blogTitle: row.blogTitle ?? null,
  };
}

/** Анкеты, пришедшие по инвайт-ссылкам — для админской страницы разбора. */
export async function getInviteApplications() {
  return db
    .select({
      id: reviewerApplications.id,
      name: reviewerApplications.name,
      area: reviewerApplications.area,
      skills: reviewerApplications.skills,
      message: reviewerApplications.message,
      status: reviewerApplications.status,
      createdAt: reviewerApplications.createdAt,
      invitedBy: reviewerApplications.invitedBy,
      byHandle: reviewerApplications.byHandle,
    })
    .from(reviewerApplications)
    .orderBy(desc(reviewerApplications.createdAt));
}
