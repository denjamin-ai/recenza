// Лента уведомлений колокола: только личные строки пользователя (recipientId = userId).

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getNotifications } from "@/lib/queries/notifications";

export async function GET(): Promise<NextResponse> {
  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const feed = await getNotifications(userId);
  return NextResponse.json(feed);
}
