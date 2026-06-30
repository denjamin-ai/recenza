// Разбор жалобы (Фаза 10) — только админ. action:
//   "resolve"        — пометить жалобу resolved (контент оставить).
//   "delete_comment" — мягко удалить целевой комментарий (deletedAt, как Фаза 8) + resolved.
// Только soft-delete (tombstone сохраняет ветку ответов); hard-delete — backlog (требует замены
// public_comments.parentId cascade→set null). Гасим admin-уведомление report_filed для этой жалобы.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { publicComments, reports } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { clearAdminNotifications } from "@/lib/queries/notifications";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;

  let action: "resolve" | "delete_comment";
  try {
    const body = (await req.json()) as { action?: unknown };
    if (body.action !== "resolve" && body.action !== "delete_comment") {
      return NextResponse.json({ error: "Некорректное действие." }, { status: 400 });
    }
    action = body.action;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const report = (
    await db
      .select({ id: reports.id, targetType: reports.targetType, targetId: reports.targetId })
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1)
  )[0];
  if (!report) return NextResponse.json({ error: "Жалоба не найдена." }, { status: 404 });

  const now = Math.floor(Date.now() / 1000);
  try {
    await db.transaction(async (tx) => {
      if (action === "delete_comment" && report.targetType === "comment") {
        // Soft-delete: гасим текст только если ещё не удалён (idempotent), tombstone сохраняем.
        await tx
          .update(publicComments)
          .set({ deletedAt: now })
          .where(eq(publicComments.id, report.targetId));
      }
      await tx.update(reports).set({ status: "resolved" }).where(eq(reports.id, id));
      await clearAdminNotifications(tx, "report_filed", "reportId", id);
    });
  } catch {
    return NextResponse.json({ error: "Не удалось разобрать жалобу." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
