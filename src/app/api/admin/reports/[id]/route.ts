// Разбор жалобы (Фаза 10) — только админ. action:
//   "resolve"        — пометить жалобу resolved (контент оставить).
//   "delete_comment" — мягко удалить целевой комментарий (deletedAt, как Фаза 8) + resolved.
//   "hide_blog"      — Ф15: скрыть блог + resolved В ОДНОЙ транзакции. Отдельный вызов
//                      PATCH /api/admin/blogs/[id] оставлял бы окно «блог скрыт, жалоба открыта».
// Только soft-delete (tombstone сохраняет ветку ответов); hard-delete — backlog (требует замены
// public_comments.parentId cascade→set null). Гасим admin-уведомление report_filed для этой жалобы.
// Ф15: любая ветка проставляет `resolved_at` — по нему строится журнал разбора.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, publicComments, reports } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { clearAdminNotifications } from "@/lib/queries/notifications";
import { MODERATION_NOTIFY } from "@/lib/review-links";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;

  const ACTIONS = ["resolve", "delete_comment", "hide_blog"] as const;
  let action: (typeof ACTIONS)[number];
  try {
    const body = (await req.json()) as { action?: unknown };
    if (!ACTIONS.includes(body.action as (typeof ACTIONS)[number])) {
      return NextResponse.json({ error: "Некорректное действие." }, { status: 400 });
    }
    action = body.action as (typeof ACTIONS)[number];
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

  // Действие обязано соответствовать типу цели: «удалить комментарий» у жалобы на блог — 400,
  // а не тихое вырождение в resolve (до Ф15 несоответствие проглатывалось).
  if (action === "delete_comment" && report.targetType !== "comment") {
    return NextResponse.json({ error: "Жалоба не на комментарий." }, { status: 400 });
  }
  if (action === "hide_blog" && report.targetType !== "blog") {
    return NextResponse.json({ error: "Жалоба не на блог." }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    await db.transaction(async (tx) => {
      if (action === "delete_comment") {
        // Soft-delete: гасим текст только если ещё не удалён (idempotent), tombstone сохраняем.
        await tx
          .update(publicComments)
          .set({ deletedAt: now })
          .where(eq(publicComments.id, report.targetId));
      }
      if (action === "hide_blog") {
        await tx.update(blogs).set({ hidden: true }).where(eq(blogs.id, report.targetId));
      }
      await tx.update(reports).set({ status: "resolved", resolvedAt: now }).where(eq(reports.id, id));
      await clearAdminNotifications(tx, MODERATION_NOTIFY.reportFiled, "reportId", id);
    });
  } catch {
    return NextResponse.json({ error: "Не удалось разобрать жалобу." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
