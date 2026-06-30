// Уведомления для колокола: читаем СОХРАНённые строки (генерация при публикации/назначении — позже).
// Только личные строки пользователя (recipientId = userId, не admin-broadcast).

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { parseJson, stringifyJson } from "@/lib/db/json";
import type { NotificationPayload } from "@/types";

// Исполнитель запроса: db или транзакция (tx). Обе имеют одинаковую сигнатуру .insert — берём её
// структурно, чтобы createNotifications работал и внутри db.transaction(), и без неё.
type Executor = Pick<typeof db, "insert">;

export interface NotificationSpec {
  /** Личное уведомление: id получателя. null + isAdminRecipient → админу. */
  recipientId?: string | null;
  isAdminRecipient?: boolean;
  type: string;
  payload?: NotificationPayload;
}

/**
 * Создаёт уведомления (батч). Вызывать внутри той же транзакции, что и событие (передать tx),
 * чтобы уведомление и изменение состояния были атомарны. Пустой список — no-op.
 * Соглашение: для прямой навигации из колокола кладём `payload.href` (ссылку считает создатель,
 * зная роль получателя). См. NotificationBell.
 */
export async function createNotifications(executor: Executor, specs: NotificationSpec[]): Promise<void> {
  if (specs.length === 0) return;
  const now = Math.floor(Date.now() / 1000);
  await executor.insert(notifications).values(
    specs.map((s) => ({
      recipientId: s.recipientId ?? null,
      isAdminRecipient: s.isAdminRecipient ?? false,
      type: s.type,
      payload: s.payload ? stringifyJson(s.payload) : null,
      createdAt: now,
    })),
  );
}

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
