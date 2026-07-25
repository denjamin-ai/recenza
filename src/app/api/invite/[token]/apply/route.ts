// Анкета эксперта по инвайт-ссылке (Фаза 14, канал 2). ПУБЛИЧНАЯ мутация — как
// `POST /api/board/applications`: аккаунта у эксперта ещё нет (регистрация закрыта, альфа),
// поэтому без `requireUser`. Защита: same-origin + rate-limit по IP + одноразовость токена.
//
// ⚠️ Анти-оракул: «нет такого токена», «уже использован» и «истёк» отдают ОДИН ответ 409 с одним
// текстом. Иначе страница превращается в проверялку существования токенов.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { expertInvites, reviewerApplications } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { clientKey, hitActionRate } from "@/lib/rate-limit";
import { stringifyJson } from "@/lib/db/json";
import { MAX_SKILLS } from "@/lib/blocks/validate";
import { REVIEW_NOTIFY } from "@/lib/review-links";
import { createNotifications } from "@/lib/queries/notifications";

/** Токен не годится (нет / отработал / истёк) — наружу всегда одинаково. */
class InviteUnusable extends Error {}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const user = await getCurrentUser(); // может быть null — эксперт ещё не на платформе

  const rl = hitActionRate(`invite-apply:${user?.id ?? clientKey(req)}`, 5000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите немного." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 5) } },
    );
  }

  const { token } = await params;

  let name: string | null;
  let area: string;
  let skills: string[];
  let message: string | null;
  try {
    const body = (await req.json()) as { name?: unknown; area?: unknown; skills?: unknown; message?: unknown };
    if (typeof body.area !== "string" || !body.area.trim()) {
      return NextResponse.json({ error: "Укажите направление." }, { status: 400 });
    }
    area = body.area.trim().slice(0, 120);
    if (!Array.isArray(body.skills) || body.skills.some((s) => typeof s !== "string")) {
      return NextResponse.json({ error: "Некорректные навыки." }, { status: 400 });
    }
    skills = [
      ...new Set((body.skills as string[]).map((s) => s.trim().slice(0, 100)).filter(Boolean)),
    ].slice(0, MAX_SKILLS);
    if (skills.length === 0) {
      return NextResponse.json({ error: "Укажите хотя бы один навык." }, { status: 400 });
    }
    message = typeof body.message === "string" && body.message.trim() ? body.message.trim().slice(0, 1000) : null;
    name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : null;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  if (!user && !name) {
    return NextResponse.json({ error: "Представьтесь, пожалуйста." }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    await db.transaction(async (tx) => {
      // Гейт перечитывается ВНУТРИ транзакции и гасится тем же UPDATE — две параллельные отправки
      // по одной ссылке не создадут две анкеты.
      const inv = (
        await tx
          .select({
            id: expertInvites.id,
            byHandle: expertInvites.byHandle,
            status: expertInvites.status,
            expiresAt: expertInvites.expiresAt,
          })
          .from(expertInvites)
          .where(eq(expertInvites.token, token))
          .limit(1)
      )[0];
      if (!inv || inv.status !== "pending" || inv.expiresAt <= now) throw new InviteUnusable();

      const claimed = await tx
        .update(expertInvites)
        .set({ status: "used", usedAt: now })
        .where(and(eq(expertInvites.id, inv.id), eq(expertInvites.status, "pending")))
        .returning({ id: expertInvites.id });
      if (claimed.length === 0) throw new InviteUnusable();

      await tx.insert(reviewerApplications).values({
        byHandle: user?.handle ?? null,
        name: user ? user.displayName : name,
        area,
        skills: stringifyJson(skills),
        message,
        status: "pending",
        createdAt: now,
        invitedBy: inv.byHandle,
        inviteToken: token,
      });
      await createNotifications(tx, [
        {
          isAdminRecipient: true,
          type: REVIEW_NOTIFY.expertApplication,
          payload: { area, invitedBy: inv.byHandle },
        },
      ]);
    });
  } catch (e) {
    if (e instanceof InviteUnusable) {
      return NextResponse.json({ error: "Ссылка недействительна." }, { status: 409 });
    }
    return NextResponse.json({ error: "Не удалось отправить анкету." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
