# CLAUDE.md

Гайд для Claude Code при работе с репозиторием **Recenza** — монолит на Next.js 16:
многоглавный девблог с редакционным review-flow и 4 ролями. Интерфейс на русском.

> Доменная модель — **глава-ориентированная** (Blog → Chapter → Revision → blocks). UX-эталон и
> детальная модель — в `README.md` прототипа. План миграции — `PLAN.md`. Стенды/БД — `ENVIRONMENTS.md`.
> Тесты — `TESTING.md`.

## Команды
- `npm run dev` — dev (:3000, `blog.db`)
- `npm run dev:test` — тестовый стенд (:3001, `blog.test.db`, seed)
- `npm run build` — прод-сборка (первичная валидация)
- `npm run lint` — ESLint
- `npm run seed` / `npm run seed:test` — seed dev / детерминированный seed теста
- `npm run test:reset` — сброс тест-БД к seed
- `npm run test:e2e` / `:ui` / `:report` — Playwright
- `npx drizzle-kit generate` / `migrate` — миграции БД

## Стек
- Next.js 16 App Router, TypeScript, Tailwind CSS v4
- БД: `@libsql/client` + Drizzle ORM (dialect **`turso`**) — один драйвер для dev (`file:blog.db`) и прод (Turso)
- MDX/блоки: `next-mdx-remote/rsc` + `rehype-pretty-code` (Shiki); рендер блоков идентичен в ридере и ревью
- Auth: `iron-session` + `bcryptjs`, cookie 7д, имя `blog_session`
- Темы: `next-themes`. Деплой: Vercel + Turso

## Конвенции (жёсткие)
- Path alias `@/* → src/*`. Все запросы — через Drizzle, **никакого raw SQL**.
- Timestamps — **Unix seconds** (`Math.floor(Date.now()/1000)`). ID — **`ulid()`**.
- JSON-поля (tags, links, blocks, anchor, suggestion) — строки/`JSONB`, читать **только в `try/catch`**.
- Динамические params в Next.js 16 — `Promise`: `const { id } = await params`.
- Страницы с запросом к БД: `export const dynamic = "force-dynamic"`.
- UI-текст — на русском. Общие типы — в `src/types/index.ts`, импортировать оттуда.
- Версионирование: при обновлении главы — снапшот предыдущей ревизии **до** записи.

## Архитектура

### БД (`src/lib/db/`)
- `index.ts` — libsql-клиент (env Turso → fallback file). `schema.ts` — вся схема. `drizzle.config.ts` (`turso`).
- Таблицы (полная схема — `ENVIRONMENTS.md` §4): `users`, `blogs`, `chapters`, `chapter_revisions`,
  `chapter_reviewers`, `reviewer_history`, `threads`, `thread_replies`, `review_chat`,
  `review_checklists`, `public_comments`, `comment_votes`, `chapter_votes`, `bookmarks`, `follows`,
  `notifications`, `portfolios`, `reports`, `primary_change_requests`, `removed_reviewers`.
- Перечисления: `role`, `revision.status` (`draft|under-review|changes-requested|published`),
  `verdict` (`approve|request-changes`), `thread.status` (`open|resolved`), `complexity`, `block.type`.
- Engagement-таблицы — `uniqueIndex` + `db.transaction()` для race-safe toggle.

### Auth (`src/lib/auth.ts`)
- `SessionData { isAdmin, userId?, userRole? }` — инвариант: `isAdmin` и `userId` не одновременно.
- `getSession`, `requireUser(role?)`, `requireAuthor`, `requireReviewer`, `requireAdmin`.
- Route-группы: `app/admin/(protected)/`, `app/author/(protected)/`, `app/reviewer/(protected)/`,
  `app/(reader)/`, публичный сегмент — layout каждой вызывает свой `require*`.
- Эндпоинты: `POST/DELETE /api/auth` (admin), `POST/DELETE /api/auth/user` (пользователи),
  `GET /api/auth/user`. Rate-limit логина (5/15мин). CSRF — same-origin на мутациях.

### Ролевой гейтинг (binding — нарушать нельзя)
- **Читатель** комментирует везде, голосует, закладывает, подписывается.
- **Автор** видит/читает/комментирует **только свои** блоги; чужие фильтруются из ленты/каталога и
  блокируются в ридере. Не комментирует чужое, не рецензирует.
- **Ревьюер** только рецензирует (треды/вердикты/правки/чат); **никогда не комментирует**, нет блогов;
  публичный профиль — «что отрецензировал».
- **Админ** модерирует; **не создаёт блоги/главы**; роль пользователя не меняется обычным API.

### Review-flow
- Назначение ревьюеров на главу + **ведущий (primary)**; вердикты на handle/ревизию; `reviewer_history`
  хранит кредит по версиям. Чат сессии (`review_chat`) — вне тредов. Чек-лист готовности — гейт отправки.
- Публикация главы доступна автору **только при всех `approve`** (или force-approve админом).
- Опубликованная глава указывает ревьюеров текущей версии + прошлых (за раскрытием).
- ⚠️ Регресс-ловушка: роут `article` обязан рендерить data-driven `BlogReaderScreen`, не легаси
  single-article вид (см. `README.md` §3). Открытие разных блогов → разный контент, обновление `title`/OG.

### Редактор (Variant B) и блоки
- Writing-first: чистый документ, обвязка ревью — в правой шторке `SubmitSheet`, метаданные — в
  `ChapterSettingsPopover`. Слэш-меню (14 типов), markdown-шорткаты, инлайн-тулбар выделения.
- Типы блоков: `p/h2/h3/quote/list/code/callout/mermaid/image/table/embed` — рендерятся идентично в
  ридере и ревью. Mermaid → mermaid-js; LaTeX → KaTeX; изображения → загрузка в сторедж.

### Комментарии
- Только читатели (и автор как участник своего блога). Привязка к блоку (`anchor`), ключ ревизии,
  вложенность ≤2, окно правки 15 мин, soft delete. Комментарии к старой ревизии — спойлер «прошлые версии».

### Дизайн-система
- Шрифты: **Lora** (заголовки), **Literata** (текст), **Fira Code** (код) — `next/font`, subsets
  `latin`+`cyrillic`. Акцент — **teal**. Тонкие границы, **без теней**. Тёмная/светлая темы.
- Только CSS-переменные — никаких raw-цветов (`text-red-500` и т.п.). Анимации — только
  `transform`/`opacity` + `prefers-reduced-motion`. Хит-таргеты ≥36/44px.

### API-паттерн (`src/app/api/`)
- Admin-роуты: `await requireAdmin()` первой строкой. Author-роуты: `requireAuthor()` + проверка
  ownership (`blog.authorId === session.userId`). Reviewer-роуты: `requireReviewer()` + проверка назначения.
- Смешанный доступ — паттерн `resolveAccess()` (auth → fetch → ownership). Cron — `Bearer CRON_SECRET`.
- Мутация главы — снапшот ревизии до записи. Все мутации требуют same-origin.

## Тестирование
- Тест-стенд: **:3001**, `blog.test.db`, `.env.test`, `workers:1`, sequential. Никогда не трогать `:3000`/прод.
- Двухуровнево: Playwright **MCP** (исследование) + **TS-автотесты** `@playwright/test` (CI). См. `TESTING.md`.
- `npm run build` — необходимое, прохождение smoke — достаточное условие готовности.

## Claude Code обвязка
- `.claude/rules/`: `security.md`, `next-app-router.md`, `drizzle-queries.md`, `mdx-components.md`,
  `frontend-design.md`.
- `.claude/agents/`: `playwright-tester`, `code-reviewer`, `security-reviewer`, `design-watcher`, `seo-optimizer`.
- `.claude/skills/`: `qa-test-planner`, `playwright-best-practices`, `next-best-practices`.
- MCP: **Playwright MCP** (`mcp__playwright__*`).

## Gotchas
- bcrypt в `.env*` экранирует `$` как `\$` (dotenv-expand).
- `SESSION_SECRET` без fallback — падение при старте, если не задан.
- Seed-скрипты нужен `process.exit()` (libsql держит соединение).
- `requireUser()` кидает `NextResponse` (не Error) — в хендлере его нужно `return`.
- `cover_url` валидируется на префикс `/uploads/` — внешние URL отклоняются.
- Engagement-toggle через `db.transaction()`; нарушение `uniqueIndex` = баг в toggle-логике.
