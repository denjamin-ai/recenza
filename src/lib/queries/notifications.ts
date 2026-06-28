// Уведомления для колокола: читаем СОХРАНённые строки (генерация при публикации/назначении — позже).
// Только личные строки пользователя (recipientId = userId, не admin-broadcast).

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import type { NotificationPayload } from "@/types";

export interface NotificationView {
  id: string;
  type: string;
  payload: NotificationPayload;
  isRead: boolean;
  createdAt: number;
}

export interface NotificationFeed {
  unread: number;
  items: NotificationView[];
}

const LIMIT = 20;

export async function getNotifications(userId: string): Promise<NotificationFeed> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      payload: notifications.payload,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(and(eq(notifications.recipientId, userId), eq(notifications.isAdminRecipient, false)))
    .orderBy(desc(notifications.createdAt))
    .limit(LIMIT);

  const items: NotificationView[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    payload: parseJson<NotificationPayload>(r.payload, {}),
    isRead: r.isRead,
    createdAt: r.createdAt,
  }));

  return { unread: items.filter((i) => !i.isRead).length, items };
}
