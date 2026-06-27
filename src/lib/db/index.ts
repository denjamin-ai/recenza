// libsql-клиент + Drizzle. Один драйвер для dev (file:blog.db), test (file:blog.test.db) и прод (Turso).
// Правило выбора БД ДОЛЖНО совпадать с drizzle.config.ts: env Turso → иначе file:${DB_FILE_NAME}.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// «пуст → file:» (ENVIRONMENTS §2): пустая строка в .env.local трактуется как отсутствие, не только undefined.
const url =
  process.env.TURSO_CONNECTION_URL?.trim() ||
  `file:${process.env.DB_FILE_NAME ?? "blog.db"}`;

export const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
});

// Настройка соединения (не запрос данных) — без неё onDelete-каскады/set null в SQLite молча не срабатывают.
// Не глотаем ошибку: иначе сбой PRAGMA выключил бы FK-каскады незаметно.
client.execute("PRAGMA foreign_keys = ON").catch((e) => {
  console.error("[db] PRAGMA foreign_keys = ON failed:", e);
});

export const db = drizzle(client, { schema });

export type Db = typeof db;
