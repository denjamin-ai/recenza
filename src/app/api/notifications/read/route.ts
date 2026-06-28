// Отметить уведомление прочитанным: {id} — одно, пустое тело — все. Только свои строки (изоляция).

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  let id: string | undefined;
  try {
    const body = (await req.json()) as { id?: unknown };
    if (typeof body.id === "string" && body.id) id = body.id;
  } catch {
    id = undefined; // пустое/битое тело → отметить все
  }

  if (id) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.recipientId, userId), eq(notifications.id, id)));
  } else {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.recipientId, userId), eq(notifications.isAdminRecipient, false)));
  }

  return NextResponse.json({ ok: true });
}
