# ENVIRONMENTS.md — Стенды и базы данных

Полное устройство **тестового** и **продового** стендов, всех БД и детерминированного флоу
тестового стенда. Реализуется в **Фазе 2** `PLAN.md`. Монолит — один Next.js-репозиторий,
разные стенды отличаются только env + БД + портом.

---

## 1. Три окружения (стенда обязательно два: test и prod)

| Параметр | **Dev** (рабочее) | **Test** (тестовый стенд) | **Prod** (продовый стенд) |
|----------|-------------------|---------------------------|---------------------------|
| URL | `http://localhost:3000` | `http://localhost:3001` | `https://<домен>` |
| БД | `file:blog.db` | `file:blog.test.db` | Turso (libsql, реплика) |
| Env-файл | `.env.local` | `.env.test` | Vercel env |
| Запуск | `npm run dev` | `npm run dev:test` | Vercel build/deploy |
| Seed | `npm run seed` | `npm run seed:test` (детерминированный) | только bootstrap-админ |
| Назначение | разработка | **только тесты** (Playwright) | боевой |

> ⚠️ **Инвариант изоляции.** Тесты НИКОГДА не ходят на `:3000`/`blog.db` и тем более на прод.
> Тестовый стенд всегда сбрасывается к фиксированному seed перед прогоном — это гарантирует
> воспроизводимость. Dev-БД и прод-БД тесты не трогают.

---

## 2. Переменные окружения

`.env.example` (коммитится; реальные значения — нет):

```bash
# --- общие ---
SESSION_SECRET=            # 32+ символа, обязателен при старте
ADMIN_PASSWORD_HASH=       # bcrypt, '$' экранируется как '\$' (dotenv-expand)
NEXT_PUBLIC_BASE_URL=      # канонический URL (sitemap, RSS, JSON-LD); в .env.test → :3001

# --- выбор стенда/БД ---
APP_ENV=                   # в .env.test: APP_ENV=test (выбор file:blog.test.db); в .env.local не задавать

# --- БД ---
# dev/test: TURSO_* не задаются → fallback на file: по APP_ENV
TURSO_CONNECTION_URL=      # прод: обязателен
TURSO_AUTH_TOKEN=          # прод: обязателен

# --- только .env.test ---
ADMIN_PASSWORD_PLAIN=      # открытый пароль админа для авто-логина в тестах (= admin-pass, см. SETUP)
```

**Правила.**
- `SESSION_SECRET` без fallback — приложение падает при старте, если не задан (безопасность).
- Значения с `$` в `.env.local`/`.env.test` (bcrypt-хэши **и** `ADMIN_PASSWORD_PLAIN`) экранировать как
  `\$` — иначе dotenv-expand считает `$xxx` переменной. `ADMIN_PASSWORD_HASH` и `ADMIN_PASSWORD_PLAIN` —
  **одна пара** (хэш от того же пароля; по умолчанию `admin-pass`, см. `SETUP.md` Шаг 4).
- `ADMIN_PASSWORD_PLAIN` живёт **только** в `.env.test`, никогда в проде; настоящие креды туда не писать.
- **Изоляция стендов — через `APP_ENV` + `dotenv-cli`.** Тест-скрипты (`dev:test`, `seed:test`,
  `test:reset`) обёрнуты в `dotenv -e .env.test --`, который грузит `.env.test` (там `APP_ENV=test`).
  `db/index.ts` и `drizzle.config.ts` выбирают БД так: `TURSO_CONNECTION_URL` задан → Turso; иначе
  `APP_ENV==='test'` → `file:blog.test.db`; иначе → `file:blog.db`. **`next dev` сам `.env.test` не
  грузит** (он всегда `NODE_ENV=development`) — поэтому обёртка `dotenv` обязательна.

---

## 3. Команды (package.json)

```jsonc
{
  "dev":            "next dev",                                          // :3000, blog.db
  "dev:test":       "npm run seed:test && dotenv -e .env.test -- next dev -p 3001", // :3001, blog.test.db
  "build":          "next build",                                       // первичная валидация
  "lint":           "next lint",
  "seed":           "tsx src/lib/db/seed.ts",                           // dev-данные
  "seed:test":      "dotenv -e .env.test -- tsx src/lib/db/seed-test.ts", // ДЕТЕРМИНИРОВАННЫЙ seed (blog.test.db)
  "test:reset":     "dotenv -e .env.test -- drizzle-kit migrate && npm run seed:test", // сброс ТОЛЬКО blog.test.db
  "test:e2e":       "playwright test",                                  // авто-стартует dev:test
  "test:e2e:ui":    "playwright test --ui",
  "test:e2e:report":"playwright show-report testing/reports/playwright-html"
}
```

Нужна dev-зависимость `dotenv-cli` (обёртка `dotenv -e .env.test --` грузит `.env.test`/`APP_ENV=test`).
DB-миграции dev/прод: `npx drizzle-kit generate` (после правки схемы) → `npx drizzle-kit migrate`
(БД берётся из `drizzle.config.ts`: `TURSO_*` → иначе `file:blog.db`). Тест-БД мигрируется **только**
через `npm run test:reset` (обёрнут в `dotenv -e .env.test`, поэтому бьёт по `blog.test.db`).

---

## 4. Схема БД (глава-ориентированная модель)

Все таблицы создаются миграциями Drizzle (dialect `turso`). `snake_case`, `id = ulid()`,
timestamps — **Unix seconds**, JSON-поля — строки/`JSONB`, читаются в `try/catch`.

**Идентичность и FK.** Все ссылки на пользователя — на суррогатный `users.id` (ulid). `handle` и `slug` —
мутабельные **отображаемые** поля (не ключи): где UI прототипа оперирует handle/slug, в проде это
join по `users.id`/`chapters.id` или денормализованная копия. Колонки `*_handle`/`*_slug` из прототипа
маппятся в `*_user_id`/`chapter_id` (+ денормализованный slug для ссылок).

```
users
  id, handle (uniq), role(reader|author|reviewer|admin), password_hash,
  display_name, bio, avatar_url, links(JSON), slug(uniq),
  pinned_blog_id→blogs.id (SET NULL)   -- один закреплённый блог автора («Закрепить как портфолио»)
  is_blocked, commenting_blocked, created_at

blogs
  id, slug(uniq), title, author_id→users.id, cover_url, tags(JSON[]),
  complexity(simple|medium|complex), summary,
  published_at, last_activity_at, view_count, rating, bookmark_count

chapters
  id, blog_id→blogs.id(CASCADE), slug, title, "order", primary_reviewer_id→users.id  -- ведущий
  UNIQUE(blog_id, slug)

chapter_revisions
  id, chapter_id→chapters.id(CASCADE), number, status(draft|under-review|changes-requested|published),
  summary, blocks(JSONB), prev_blocks(JSONB),  -- снапшот последней публикации (для инлайн-диффа)
  submitted_at, published_at
  UNIQUE(chapter_id, number)
  -- ⚠ ПОЛЯ deadline НЕТ намеренно (см. README §5, PLAN Фаза 5). Статус блока (added/edited) НЕ хранится —
  --   вычисляется из prev_blocks через diffWords при рендере. `summary` = «что нового в vN» + заметка ревьюерам.

chapter_reviewers            -- назначения + вердикты на ревизию
  chapter_id→chapters.id, revision_number, reviewer_id→users.id,
  is_primary, verdict(approve|request-changes), verdict_at, online, typing
  PRIMARY KEY(chapter_id, revision_number, reviewer_id)
  -- per-block BlockVerdictStamp (approve/fix/discuss) — эфемерный UI-маркер, НЕ персистится;
  --   хранится только этот вердикт ревьюера на ревизию.

reviewer_history             -- кредит ревьюеров по версиям (для опубликованной главы)
  chapter_id→chapters.id, revision_number, reviewer_id→users.id
  PRIMARY KEY(chapter_id, revision_number, reviewer_id)

threads                      -- обсуждения, привязанные к блоку
  id, chapter_id→chapters.id(CASCADE), revision_number, block_id, anchor,
  status(open|resolved), from_user_id→users.id, text,
  suggestion(JSON {from,to} | null), created_at

thread_replies
  id, thread_id→threads.id(CASCADE), from_user_id→users.id, text, created_at

review_chat                  -- чат сессии ревью (вне тредов; UX-спека — PLAN Фаза 6)
  id, chapter_id→chapters.id(CASCADE), revision_number, from_user_id→users.id, text, created_at

review_checklists            -- чек-лист готовности к отправке/ревью
  id, chapter_id→chapters.id, items(JSON [{text,checked}]), created_at

public_comments              -- читательские комментарии
  id, chapter_id→chapters.id(CASCADE), revision_number, author_id→users.id(SET NULL),
  parent_id→public_comments(≤2 уровня), text,
  anchor(JSON {block_id,quote} | null), edited_at, deleted_at, created_at,
  blog_slug, chapter_slug   -- ДЕНОРМАЛИЗАЦИЯ для ссылок/фильтра; КЛЮЧ — chapter_id + revision_number

comment_votes                -- ±1, uniqueIndex(user_id, comment_id), CASCADE  (user_id→users.id)
chapter_votes                -- ±1, uniqueIndex(user_id, chapter_id), CASCADE  (user_id→users.id)
bookmarks                    -- uniqueIndex(user_id, blog_id), CASCADE         (user_id→users.id)
follows                      -- подписки reader→blog, PK(user_id, blog_id)     (user_id→users.id)

notifications                -- polling; is_admin_recipient + recipient_id=NULL → админу
  id, recipient_id→users.id|NULL, is_admin_recipient, type, payload(JSON), is_read, created_at

portfolios                   -- «Об авторе», один на автора, публикуется БЕЗ ревью
  id, author_id→users.id(uniq), blocks(JSONB), is_visible, updated_at

reports                      -- жалобы
  id, reporter_id→users.id, target_type, target_id, reason, status(open|resolved), created_at

primary_change_requests      -- заявки на смену ведущего ревьюера
  id, chapter_id→chapters.id, revision_number, from_reviewer_id→users.id, to_reviewer_id→users.id, status, created_at

removed_reviewers            -- лог снятия ревьюера админом
  id, chapter_id→chapters.id(CASCADE), reviewer_id→users.id, by_admin, reason, created_at,
  blog_slug, chapter_slug   -- ДЕНОРМАЛИЗАЦИЯ для отображения; КЛЮЧ — chapter_id
```

**Ключевые ограничения.**
- **FK — только на суррогатные ключи** (`users.id`, `chapters.id`, `blogs.id`). `handle`/`slug` мутабельны
  (Editor разрешает override slug) → ключами быть не могут; для ссылок денормализуются.
- **`PRAGMA foreign_keys=ON` на каждом соединении** (`db/index.ts`). В libsql/SQLite FK по умолчанию
  **выключены** и включаются per-connection — иначе объявленные `CASCADE`/`SET NULL` молча не сработают
  (orphan-строки). Проверять, что в `file:` режиме каскады реально срабатывают.
- Engagement-таблицы (`*_votes`, `bookmarks`, `follows`) — `uniqueIndex` + `db.transaction()` для
  race-safe toggle (select-then-insert-or-delete). Нарушение уникальности = баг в toggle-логике.
- `public_comments` к **старой** ревизии помечаются stale и уезжают в спойлер «прошлые версии».
- **Engagement (голос/закладка/подписка) — только роль `reader`.** Автор/ревьюер их не имеют (binding).
  Автор не голосует за свои главы; пользователь — за свои комментарии (проверки на уровне API).
- `is_blocked=1` скрывает все блоги автора во всех поверхностях; `commenting_blocked=1` блокирует комментарии/голоса.

---

## 5. Полный флоу тестового стенда

Этот флоу выполняется автоматически перед каждым прогоном (см. сабагент `playwright-tester`).

```bash
# 0. Сброс тест-БД к фиксированному seed (затрагивает ТОЛЬКО blog.test.db)
bash .claude/playwright-tester/reset-test-db.sh      # migrate + seed:test

# 1. Поднять/дождаться тест-сервер на 3001
bash .claude/playwright-tester/healthcheck.sh 60 http://localhost:3001
#   exit 1 → подсказать: npm run dev:test

# 2. Залогинить роли (cookies в /tmp/*_cookies.txt). Пароль админа login.sh читает из .env.test
#    сам (source .env.test): оболочка Claude Code не хранит env между вызовами, а tool Read(.env.test)
#    запрещён в settings.json (чтение файла программой запрет не нарушает).
BASE_URL=http://localhost:3001 bash .claude/playwright-tester/login.sh admin      # пароль из .env.test (ADMIN_PASSWORD_PLAIN)
BASE_URL=http://localhost:3001 bash .claude/playwright-tester/login.sh reader   password
BASE_URL=http://localhost:3001 bash .claude/playwright-tester/login.sh author   password
BASE_URL=http://localhost:3001 bash .claude/playwright-tester/login.sh reviewer password
#   admin → POST /api/auth ; пользователи → POST /api/auth/user (РАЗНЫЕ эндпоинты!)

# 3. Прогон тестов (Playwright MCP для исследования / @playwright/test для спеков)

# 4. (опц.) Проверка состояния БД без знания SQL
DB_PATH=blog.test.db bash .claude/playwright-tester/db-query.sh chapters
DB_PATH=blog.test.db bash .claude/playwright-tester/db-query.sh user reviewer

# 5. Чистка: проще всего повторный reset
bash .claude/playwright-tester/reset-test-db.sh
```

**Тестовые аккаунты после seed:**

| Роль | Никнейм | Пароль |
|------|---------|--------|
| Читатель | `reader` | `password` |
| Автор | `author` | `password` |
| Ревьюер | `reviewer` | `password` |
| Админ | — | `ADMIN_PASSWORD_PLAIN` из `.env.test` |

**Что обязан содержать детерминированный seed (`seed-test.ts`):**
- по одному пользователю на каждую из 4 ролей (+ 2–3 доп. ревьюера для команды/смены ведущего);
- блог автора с **несколькими главами во всех статусах**: `draft`, `under-review`,
  `changes-requested`, `published`;
- у опубликованной главы — **две ревизии** с `prev_blocks` (чтобы работал инлайн-дифф и кредит по версиям);
- треды: `open` и `resolved`, минимум один с `suggestion` (для apply-and-close);
- сообщения `review_chat` (несколько участников);
- `chapter_reviewers` с назначенным **ведущим** и разными вердиктами; `reviewer_history` на 2 версии;
- публичные комментарии: к текущей и к **старой** ревизии, нить читатель→автор→читатель,
  один в пределах окна правки (≤15 мин) и один за его пределами;
- портфолио «Об авторе» (видимое и скрытое состояния покрыть кейсами);
- у автора **закреплён один блог** (`users.pinned_blog_id`) — для проверки сортировки/кольца/профиля;
- одна жалоба (`reports`) и одна заявка на смену ведущего (`primary_change_requests`).

> Детерминизм: фиксированные `id`/`slug`/`createdAt` (или сид-генератор), чтобы повтор `seed:test`
> давал идентичный снимок и тесты не флакали.

---

## 6. Флоу продового стенда

```bash
# 1. Применить миграции к Turso (не seed!)
TURSO_CONNECTION_URL=... TURSO_AUTH_TOKEN=... npx drizzle-kit migrate

# 2. Bootstrap-админ — через env (ADMIN_PASSWORD_HASH), self-registration отсутствует

# 3. Деплой на Vercel; env заданы в проекте Vercel

# 4. Smoke на prod-preview (НЕ на тестовом стенде)
```

> **Отложенной публикации по cron в глава-модели нет** (легаси статейной версии удалено). Публикация
> главы — действие автора при всех `approve` (или force-approve админом). Если позже понадобится
> отложенная публикация — завести `chapter_revisions.scheduled_at` + cron-роут; учесть, что на Vercel
> **Hobby** cron только «раз в сутки» (`* * * * *` падает на деплое — per-minute требует Pro).

**Изоляция стендов (критический инвариант релиза):** разные БД, разные env-файлы, разные URL,
разные секреты. Ни один тест не должен иметь доступа к проду; ни один прод-секрет не лежит в `.env.test`.
