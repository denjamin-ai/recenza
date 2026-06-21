---
name: drizzle-schema
description: >
  Конвенции схемы и запросов Drizzle (dialect turso) для Recenza: snake_case,
  ulid() PK, Unix seconds, JSON-поля, uniqueIndex для race-safe toggle, FK+каскады,
  снапшот ревизии. Применяй в фазах со схемой/данными (2, 3, 9, 10).
---

# Drizzle (turso) — конвенции схемы и запросов Recenza

## Базовые правила
- Dialect в `drizzle.config.ts` — **`turso`** (не `sqlite`). Один драйвер для dev (`file:blog.db`) и прод (Turso).
- Имена — **snake_case** в БД (`author_id`, `is_blocked`, `chapter_id`). PK — `text("id").primaryKey()` со значением `ulid()`.
- Timestamps — `integer` Unix seconds (`Math.floor(Date.now()/1000)`), не ms, не ISO-строки.
- Все запросы — через Drizzle query builder. **Никакого raw SQL** в коде приложения.

## JSON-поля
- `tags`, `links`, `blocks`, `prev_blocks`, `anchor`, `suggestion`, `skills`, `competencies` — хранить как
  `text`/JSONB; **читать только в `try/catch`** (битый JSON не должен ронять рендер).

## Гонки и идемпотентность
- Engagement-таблицы (`bookmarks`, `follows`, `chapter_votes`, `comment_votes`) — `uniqueIndex` на
  `(user_id, target_id)`. Toggle — внутри `db.transaction()`. Нарушение `uniqueIndex` = баг в toggle-логике, не «поймать и проглотить».

## Внешние ключи и каскады
- FK + `onDelete` явно. ⚠️ В SQLite каскады работают только при включённом `PRAGMA foreign_keys=ON` —
  проверь, что libsql-клиент его включает; иначе `onDelete: "set null"`/каскады молча не сработают.
- Удаление ревизии с комментариями — запрещать (`restrict`), не терять данные.

## Версионирование ревизий (инвариант)
- При обновлении главы — **снапшот предыдущей ревизии ДО записи** новой (`prev_blocks`). Кредит ревьюеров
  хранится по версиям (`reviewer_history`), не перетирается.

## Миграции
- Только `drizzle-kit generate` (миграции коммитятся) → `drizzle-kit migrate`. БД-файл создаётся первой миграцией.
- Выбор БД — одно правило: `TURSO_CONNECTION_URL ?? file:${DB_FILE_NAME}` — синхронно в `db/index.ts` и `drizzle.config.ts`.

## Чеклист
- [ ] snake_case, `ulid()` PK, Unix seconds
- [ ] JSON только через `try/catch`
- [ ] `uniqueIndex` + транзакция на каждом toggle
- [ ] FK/каскады заданы; `foreign_keys=ON`
- [ ] снапшот ревизии до записи
- [ ] нет raw SQL; dialect `turso`
