---
description: Паттерны Drizzle ORM + libsql/Turso.
globs:
  - "src/lib/db/**"
  - "src/app/api/**"
---

# Правило: Drizzle ORM

- Только Drizzle, **никакого raw SQL**. dialect в `drizzle.config.ts` — `"turso"` (не `"sqlite"`).
- Клиент `db/index.ts`: env Turso → fallback `file:blog.db` (dev) / `file:blog.test.db` (test).
- **Timestamps — Unix seconds**: `Math.floor(Date.now() / 1000)`. Никаких миллисекунд.
- **ID — `ulid()`** из пакета `ulid`. Никаких uuid/автоинкремента.
- JSON-поля (`tags`, `links`, `blocks`, `prev_blocks`, `anchor`, `suggestion`) — хранить строкой/`JSONB`,
  читать **только в `try/catch`**, при ошибке — безопасный дефолт (`[]`/`null`).
- Версионирование: при обновлении главы — снапшот предыдущей ревизии **до** записи новой.
- Engagement-toggle (`*_votes`, `bookmarks`, `follows`): `db.transaction()` (select-then-insert-or-delete)
  + `uniqueIndex` как страховка. Нарушение уникальности = баг в toggle-логике, не норма.
- Каскады/`set null` — объявлять в схеме; помнить, что в SQLite `PRAGMA foreign_keys` может быть выключен.
- После правки `schema.ts`: `drizzle-kit generate` → ревью миграции → `drizzle-kit migrate`.
- Seed-скрипты завершать `process.exit()` (libsql держит соединение).
