// Публичная заявка «стать ревьюером» с доски (Фаза 10). ПУБЛИЧНАЯ мутация — без requireUser:
// откликнуться может и гость (byHandle=null + имя). Защита: same-origin + rate-limit (по IP/пользователю)
// + строгая валидация. Зарегистрированный заявитель → byHandle из сессии (имя берём из аккаунта).
// Создаёт reviewer_applications(pending) + admin-уведомление. Разбор (accept→роль / decline) — админ.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reviewerApplications } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { clientKey, hitActionRate } from "@/lib/rate-limit";
import { stringifyJson } from "@/lib/db/json";
import { MAX_SKILLS } from "@/lib/blocks/validate";
import { createNotifications } from "@/lib/queries/notifications";

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const user = await getCurrentUser(); // null → гость/админ

  const rl = hitActionRate(`board-apply:${user?.id ?? clientKey(req)}`, 5000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите немного." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 5) } },
    );
  }

  let area: string;
  let skills: string[];
  let message: string | null;
  let guestName: string | null;
  try {
    const body = (await req.json()) as { area?: unknown; skills?: unknown; message?: unknown; name?: unknown };
    if (typeof body.area !== "string" || !body.area.trim()) {
      return NextResponse.json({ error: "Укажите направление." }, { status: 400 });
    }
    area = body.area.trim().slice(0, 120);
    if (!Array.isArray(body.skills) || body.skills.some((s) => typeof s !== "string")) {
      return NextResponse.json({ error: "Некорректные навыки." }, { status: 400 });
    }
    skills = [...new Set((body.skills as string[]).map((s) => s.trim().slice(0, 100)).filter(Boolean))].slice(0, MAX_SKILLS);
    if (skills.length === 0) return NextResponse.json({ error: "Укажите хотя бы один навык." }, { status: 400 });
    message = typeof body.message === "string" && body.message.trim() ? body.message.trim().slice(0, 1000) : null;
    guestName = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : null;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  // Гость обязан представиться; зарегистрированный — имя из аккаунта (name не используем).
  if (!user && !guestName) {
    return NextResponse.json({ error: "Представьтесь, пожалуйста." }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(reviewerApplications).values({
        byHandle: user?.handle ?? null,
        name: user ? user.displayName : guestName,
        area,
        skills: stringifyJson(skills),
        message,
        status: "pending",
        createdAt: now,
      });
      await createNotifications(tx, [{ isAdminRecipient: true, type: "reviewer_application_filed", payload: { area } }]);
    });
  } catch {
    return NextResponse.json({ error: "Не удалось отправить заявку." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
