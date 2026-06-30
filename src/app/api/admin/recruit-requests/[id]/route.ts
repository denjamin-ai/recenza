// Разбор запроса автора «найдите ревьюеров» (Фаза 10) — только админ. Phase 9 создаёт recruit_requests
// (pending) + уведомляет админа. Здесь:
//   approve — публикуем направление на публичную доску (board_calls) + статус approved + уведомляем автора.
//   reject  — статус rejected + причина (reason) + уведомляем автора (recruit_rejected с reason).
// Блог нельзя опубликовать без ревью — recruit это запасной путь, одобрение лишь открывает набор на доске.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { boardCalls, recruitRequests } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { parseJson, stringifyJson } from "@/lib/db/json";
import { ADMIN_NOTIFY } from "@/lib/review-links";
import { createNotifications } from "@/lib/queries/notifications";
import { userIdsByHandle } from "@/lib/queries/review";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;

  let action: "approve" | "reject";
  let area: string | null = null;
  let note: string | null = null;
  let reason: string | null = null;
  try {
    const body = (await req.json()) as { action?: unknown; area?: unknown; note?: unknown; reason?: unknown };
    if (body.action !== "approve" && body.action !== "reject") {
      return NextResponse.json({ error: "Некорректное действие." }, { status: 400 });
    }
    action = body.action;
    if (action === "approve") {
      area = typeof body.area === "string" && body.area.trim() ? body.area.trim().slice(0, 120) : null;
      note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
    } else {
      if (typeof body.reason !== "string" || !body.reason.trim()) {
        return NextResponse.json({ error: "Укажите причину отклонения." }, { status: 400 });
      }
      reason = body.reason.trim().slice(0, 500);
    }
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const rec = (
    await db
      .select({
        id: recruitRequests.id,
        byHandle: recruitRequests.byHandle,
        skills: recruitRequests.skills,
        status: recruitRequests.status,
      })
      .from(recruitRequests)
      .where(eq(recruitRequests.id, id))
      .limit(1)
  )[0];
  if (!rec) return NextResponse.json({ error: "Запрос не найден." }, { status: 404 });
  if (rec.status !== "pending") return NextResponse.json({ error: "Запрос уже обработан." }, { status: 409 });

  const skills = parseJson<string[]>(rec.skills, []);
  const now = Math.floor(Date.now() / 1000);
  const idByHandle = await userIdsByHandle([rec.byHandle]);
  const authorId = idByHandle.get(rec.byHandle) ?? null;

  try {
    await db.transaction(async (tx) => {
      // TOCTOU: перечитываем статус в tx.
      const fresh = (await tx.select({ status: recruitRequests.status }).from(recruitRequests).where(eq(recruitRequests.id, id)).limit(1))[0];
      if (!fresh || fresh.status !== "pending") throw new Error("stale");

      if (action === "approve") {
        await tx.insert(boardCalls).values({
          area: area ?? skills[0] ?? "Общее",
          skills: stringifyJson(skills),
          waiting: 0,
          note,
          hot: false,
        });
        await tx.update(recruitRequests).set({ status: "approved", resolvedAt: now }).where(eq(recruitRequests.id, id));
        await createNotifications(tx, [
          {
            recipientId: authorId,
            type: ADMIN_NOTIFY.recruitApproved,
            payload: { href: "/board", skills },
          },
        ]);
      } else {
        await tx.update(recruitRequests).set({ status: "rejected", reason, resolvedAt: now }).where(eq(recruitRequests.id, id));
        await createNotifications(tx, [
          {
            recipientId: authorId,
            type: ADMIN_NOTIFY.recruitRejected,
            payload: { href: "/author", reason },
          },
        ]);
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "stale") return NextResponse.json({ error: "Запрос уже обработан." }, { status: 409 });
    return NextResponse.json({ error: "Не удалось обработать запрос." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
