// Лента админ-событий для колокола админ-портала (Фаза 15, З-52).
//
// Отдельный роут, а не ветка в `/api/notifications`: тот стоит на `requireUser()` и по построению
// отдаёт ЛИЧНЫЕ строки пользователя, а у админ-сессии `userId` вообще нет. Разделение оставляет
// оба канала простыми и не даёт случайно смешать личные и broadcast-уведомления.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminNotifications } from "@/lib/queries/notifications";

export async function GET(): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  return NextResponse.json(await getAdminNotifications());
}
