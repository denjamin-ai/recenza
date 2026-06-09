---
description: Паттерны Drizzle ORM + libsql/Turso.
globs:
  - "src/lib/db/**"
  - "src/app/api/**"
---

# Правило: Drizzle ORM

- Только Drizzle, **никакого raw SQL**. dialect в `drizzle.config.ts` — `"turso"` (не `"sqlite"`).
- Клиент `db/index.ts`: `TURSO_*` → иначе `file:` по `APP_ENV` (`test` → `blog.test.db`, иначе `blog.db`).
  На каждом соединении выполнять `PRAGMA foreign_keys=ON`.
- **Timestamps — Unix seconds**: `Math.floor(Date.now() / 1000)`. Никаких миллисекунд.
- **ID — `ulid()`** из пакета `ulid`. Никаких uuid/автоинкремента.
- JSON-поля (`tags`, `links`, `blocks`, `prev_blocks`, `anchor`, `suggestion`) — хранить строкой/`JSONB`,
  читать **только в `try/catch`**, при ошибке — безопасный дефолт (`[]`/`null`).
- Версионирование: при обновлении главы — снапшот предыдущей ревизии **до** записи новой.
- Engagement-toggle (`*_votes`, `bookmarks`, `follows`): `db.transaction()` (select-then-insert-or-delete)
  + `uniqueIndex` как страховка. Нарушение уникальности = баг в toggle-логике, не норма.
- FK — только на суррогатные `*.id` (`handle`/`slug` мутабельны → денормализуются, не ключи).
  Каскады/`set null` объявлять в схеме; **обязательно `PRAGMA foreign_keys=ON` на каждом соединении** —
  в libsql/SQLite FK по умолчанию выключены, иначе каскады молча не сработают (orphan-строки).
- После правки `schema.ts`: `drizzle-kit generate` → ревью миграции → `drizzle-kit migrate`.
- Seed-скрипты завершать `process.exit()` (libsql держит соединение).
