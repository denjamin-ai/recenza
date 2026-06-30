// Запрос автора админу «подберите ревьюеров» (Фаза 9, запасной путь при «нет совпадений»).
// Только автор-владелец главы. Дедуп: один pending-запрос на (главу, автора). Обработка админом
// (approve → доска / reject → причина) — Фаза 10; здесь лишь создаём запрос + уведомляем админа.
// Блог нельзя опубликовать без ревью (гейт публикации) — recruit это запасной маршрут, не обход.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapters, recruitRequests } from "@/lib/db/schema";
import { getCurrentUser, requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { stringifyJson } from "@/lib/db/json";
import { createNotifications } from "@/lib/queries/notifications";
import { REVIEW_NOTIFY } from "@/lib/queries/review";
import { MAX_SKILLS } from "@/lib/blocks/validate";

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAuthor();
  if (gate instanceof NextResponse) return gate;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`recruit-request:${user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  let chapterId: string;
  let skills: string[];
  try {
    const body = (await req.json()) as { chapterId?: unknown; skills?: unknown };
    if (typeof body.chapterId !== "string" || !body.chapterId) {
      return NextResponse.json({ error: "Не указана глава." }, { status: 400 });
    }
    if (!Array.isArray(body.skills) || body.skills.some((s) => typeof s !== "string")) {
      return NextResponse.json({ error: "Некорректные навыки." }, { status: 400 });
    }
    chapterId = body.chapterId;
    skills = [...new Set((body.skills as string[]).map((s) => s.trim()).filter(Boolean))].slice(0, MAX_SKILLS);
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }
  if (skills.length === 0) {
    return NextResponse.json({ error: "Укажите навыки статьи." }, { status: 400 });
  }

  // Ownership: глава → блог → автор.
  const row = (
    await db
      .select({ authorId: blogs.authorId })
      .from(chapters)
      .innerJoin(blogs, eq(blogs.id, chapters.blogId))
      .where(eq(chapters.id, chapterId))
      .limit(1)
  )[0];
  if (!row || row.authorId !== user.id) {
    return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });
  }

  // Дедуп: один pending-запрос на (главу, автора).
  const existing = (
    await db
      .select({ id: recruitRequests.id })
      .from(recruitRequests)
      .where(
        and(
          eq(recruitRequests.chapterId, chapterId),
          eq(recruitRequests.byHandle, user.handle),
          eq(recruitRequests.status, "pending"),
        ),
      )
      .limit(1)
  )[0];
  if (existing) {
    return NextResponse.json({ ok: true, alreadyPending: true });
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(recruitRequests).values({
        chapterId,
        byHandle: user.handle,
        skills: stringifyJson(skills),
        status: "pending",
        createdAt: now,
      });
      // Уведомляем админа (обработка — Фаза 10; строка уведомления forward-compatible).
      await createNotifications(tx, [
        { isAdminRecipient: true, type: REVIEW_NOTIFY.recruitRequested, payload: { skills } },
      ]);
    });
  } catch {
    return NextResponse.json({ error: "Не удалось отправить запрос." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
