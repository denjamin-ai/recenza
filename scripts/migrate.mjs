// Раннер миграций для прод-сервера (Фаза 12): plain JS, только prod-зависимости
// (drizzle-orm + @libsql/client) — drizzle-kit (devDep) на сервер не едет.
// Запускается деплой-скриптом ПЕРЕД рестартом сервиса: node scripts/migrate.mjs
// БД выбирается тем же правилом, что и приложение: TURSO_CONNECTION_URL ?? file:${DB_FILE_NAME}.
// Каталог миграций — ./drizzle рядом с релизом (кладётся в артефакт deploy.yml).

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.TURSO_CONNECTION_URL?.trim() || `file:${process.env.DB_FILE_NAME || "blog.db"}`;
const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

const client = createClient({ url, authToken });
await client.execute("PRAGMA foreign_keys = ON;");
const db = drizzle(client);

console.log(`[migrate] БД: ${url.startsWith("file:") ? url : "Turso"} · миграции: ${migrationsFolder}`);
await migrate(db, { migrationsFolder });
console.log("[migrate] миграции применены.");
process.exit(0); // libsql держит соединение (гоча seed-скриптов)
