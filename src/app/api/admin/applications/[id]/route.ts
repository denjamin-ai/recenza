// Разбор заявки «стать ревьюером» с публичной доски (Фаза 10) — только админ.
//   accept  — для ЗАРЕГИСТРИРОВАННОГО заявителя (byHandle) выдаём роль reviewer + переносим навыки
//             заявки в competencies (merge, unique) + уведомляем (application_accepted). Это
//             ЕДИНСТВЕННЫЙ admin-путь смены роли (решение фазы; иначе роль не меняется обычным API).
//             Для гостя (byHandle=null) аккаунта нет — просто помечаем accepted (онбординг — вручную/Ф12).
//   decline — статус declined; уведомляем зарегистрированного заявителя.
// Примечание: заявки не привязаны FK к board_calls (несут свободный `area`); board_calls.waiting —
// admin-curated счётчик, автоматически не пересчитывается.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviewerApplications, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { parseJson, stringifyJson } from "@/lib/db/json";
import { MAX_SKILLS } from "@/lib/blocks/validate";
import { ADMIN_NOTIFY } from "@/lib/review-links";
import { createNotifications } from "@/lib/queries/notifications";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;

  let action: "accept" | "decline";
  try {
    const body = (await req.json()) as { action?: unknown };
    if (body.action !== "accept" && body.action !== "decline") {
      return NextResponse.json({ error: "Некорректное действие." }, { status: 400 });
    }
    action = body.action;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const app = (
    await db
      .select({
        id: reviewerApplications.id,
        byHandle: reviewerApplications.byHandle,
        skills: reviewerApplications.skills,
        status: reviewerApplications.status,
      })
      .from(reviewerApplications)
      .where(eq(reviewerApplications.id, id))
      .limit(1)
  )[0];
  if (!app) return NextResponse.json({ error: "Заявка не найдена." }, { status: 404 });
  if (app.status !== "pending") return NextResponse.json({ error: "Заявка уже обработана." }, { status: 409 });

  const appSkills = parseJson<string[]>(app.skills, []);

  try {
    await db.transaction(async (tx) => {
      const fresh = (await tx.select({ status: reviewerApplications.status }).from(reviewerApplications).where(eq(reviewerApplications.id, id)).limit(1))[0];
      if (!fresh || fresh.status !== "pending") throw new Error("stale");

      await tx
        .update(reviewerApplications)
        .set({ status: action === "accept" ? "accepted" : "declined" })
        .where(eq(reviewerApplications.id, id));

      if (!app.byHandle) return; // гость — нет аккаунта для роли/уведомления

      const u = (
        await tx
          .select({ id: users.id, role: users.role, competencies: users.competencies })
          .from(users)
          .where(eq(users.handle, app.byHandle))
          .limit(1)
      )[0];
      if (!u) return; // заявитель удалён — заявка просто закрыта

      if (action === "accept") {
        if (u.role !== "admin") {
          const merged = [...new Set([...parseJson<string[]>(u.competencies, []), ...appSkills])].slice(0, MAX_SKILLS);
          await tx.update(users).set({ role: "reviewer", competencies: stringifyJson(merged) }).where(eq(users.id, u.id));
        }
        await createNotifications(tx, [
          { recipientId: u.id, type: ADMIN_NOTIFY.applicationAccepted, payload: { href: "/reviewer" } },
        ]);
      } else {
        await createNotifications(tx, [
          { recipientId: u.id, type: ADMIN_NOTIFY.applicationDeclined, payload: {} },
        ]);
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "stale") return NextResponse.json({ error: "Заявка уже обработана." }, { status: 409 });
    return NextResponse.json({ error: "Не удалось обработать заявку." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
