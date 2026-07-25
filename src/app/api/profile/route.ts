// Настройки профиля пользователя (Фаза 13.7) — закрывает З-38/З-39: до этой фазы
// `display_name`/`bio`/`links` не обновлялись НИГДЕ (значения попадали в БД только при создании
// аккаунта админом), а `competencies` менялись единственным путём — accept заявки с доски.
//
// Гейт: любой вошедший аккаунт правит ТОЛЬКО себя (userId из сессии, не из тела).
// СТРОГИЙ allowlist: спред тела в Drizzle update() запрещён — иначе поле `can_author`/`is_reviewer`/
// `role`/`handle`/`slug` уехало бы в эскалацию привилегий. `competencies` принимаются только у
// аккаунта с возможностью «ревьюер» (проверка по БД, не по телу запроса).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { stringifyJson } from "@/lib/db/json";
import { MAX_SKILLS } from "@/lib/blocks/validate";
import type { LinkItem } from "@/types";

const MAX_NAME = 80;
const MAX_BIO = 1000;
const MAX_LINKS = 5;
const MAX_LABEL = 40;
const MAX_URL = 200;
const MAX_COMPETENCY = 40;

/** Ссылки принимаем только http(s) — `javascript:`/`data:` отсекаются до записи в БД. */
function parseLinks(raw: unknown): LinkItem[] | { error: string } {
  if (!Array.isArray(raw)) return { error: "links: ожидается массив." };
  if (raw.length > MAX_LINKS) return { error: `Ссылок не больше ${MAX_LINKS}.` };
  const out: LinkItem[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return { error: "links: элемент — объект." };
    const { label, url } = item as { label?: unknown; url?: unknown };
    const u = typeof url === "string" ? url.trim() : "";
    if (!u) continue; // пустая строка формы — просто пропускаем
    if (!/^https?:\/\//i.test(u) || u.length > MAX_URL) {
      return { error: "Ссылка должна начинаться с http:// или https://" };
    }
    const l = typeof label === "string" ? label.trim().slice(0, MAX_LABEL) : "";
    out.push({ label: l || new URL(u).hostname, url: u });
  }
  return out;
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`profile:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  let body: { displayName?: unknown; bio?: unknown; links?: unknown; competencies?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const set: Partial<{
    displayName: string;
    bio: string | null;
    links: string;
    competencies: string;
  }> = {};

  if (body.displayName !== undefined) {
    if (typeof body.displayName !== "string") {
      return NextResponse.json({ error: "Некорректное имя." }, { status: 400 });
    }
    const name = body.displayName.trim();
    if (name.length < 1 || name.length > MAX_NAME) {
      return NextResponse.json({ error: `Имя: от 1 до ${MAX_NAME} символов.` }, { status: 400 });
    }
    set.displayName = name;
  }

  if (body.bio !== undefined) {
    if (body.bio === null) set.bio = null;
    else if (typeof body.bio === "string") {
      const bio = body.bio.trim();
      if (bio.length > MAX_BIO) {
        return NextResponse.json({ error: `О себе: не больше ${MAX_BIO} символов.` }, { status: 400 });
      }
      set.bio = bio || null;
    } else return NextResponse.json({ error: "Некорректное «О себе»." }, { status: 400 });
  }

  if (body.links !== undefined) {
    const links = parseLinks(body.links);
    if ("error" in links) return NextResponse.json({ error: links.error }, { status: 400 });
    set.links = stringifyJson(links);
  }

  if (body.competencies !== undefined) {
    // Возможность перечитываем из БД — телу запроса не доверяем.
    const me = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { isReviewer: true },
    });
    if (!me?.isReviewer) {
      return NextResponse.json({ error: "Компетенции есть только у ревьюеров." }, { status: 403 });
    }
    if (!Array.isArray(body.competencies) || body.competencies.some((s) => typeof s !== "string")) {
      return NextResponse.json({ error: "Некорректные компетенции." }, { status: 400 });
    }
    const list = [
      ...new Set(
        (body.competencies as string[])
          .map((s) => s.trim().slice(0, MAX_COMPETENCY))
          .filter(Boolean),
      ),
    ].slice(0, MAX_SKILLS);
    set.competencies = stringifyJson(list);
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "Нет полей для изменения." }, { status: 400 });
  }

  await db.update(users).set(set).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}
