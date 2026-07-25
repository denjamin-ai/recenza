// Отметить админ-событие прочитанным: {id} — одно, пустое тело — все (Фаза 15).
// Зеркало `/api/notifications/read`, но по признаку `is_admin_recipient`, а не по `recipientId`:
// у админ-сессии нет `userId`, а broadcast-строки лежат с `recipient_id IS NULL`.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  let id: string | undefined;
  try {
    const body = (await req.json()) as { id?: unknown };
    if (typeof body.id === "string" && body.id) id = body.id;
  } catch {
    id = undefined; // пустое/битое тело → отметить все
  }

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      id
        ? and(eq(notifications.isAdminRecipient, true), eq(notifications.id, id))
        : eq(notifications.isAdminRecipient, true),
    );

  return NextResponse.json({ ok: true });
}
