# CLAUDE.md

Гайд для Claude Code при работе с репозиторием **Recenza** — монолит на Next.js 16:
многоглавный девблог с редакционным review-flow и 4 ролями. Интерфейс на русском.

> Доменная модель — **глава-ориентированная** (Blog → Chapter → Revision → blocks). UX-эталон и
> детальная модель — `docs/prototype/README.md` (корневой `README.md` — bootstrap-гайд для человека,
> не источник модели). План миграции — `docs/migration/PLAN.md`. Стенды/БД — `docs/migration/ENVIRONMENTS.md`.
> Тесты — `docs/migration/TESTING.md`.

## Текущее состояние репозитория (ВСЕ фазы 0–12 `done` — проект в проде)

⚠️ **Прочти первым.** Монолит **работает в проде**: `https://recenza.ru` (VPS Ubuntu 24.04, Хельсинки;
Caddy + Node standalone + systemd; деплой — GH Actions `deploy.yml` на push в `main`). Каркас: Next 16 +
`src/`, `node_modules/`, `tsconfig.json`, `next.config.ts`, `drizzle.config.ts`, миграции
`drizzle/0000_*.sql` … `0005_*.sql` (0004: `chapter_revisions.scheduled_at` + `chapter_reviewers.last_seen_at`;
0005: drop `chapter_reviewers.online`; всего **28 таблиц**), `blog.db`/`blog.test.db`, два стенда, auth/роли,
читательский слой, авторский слой (кабинет/редактор/портфолио), review-flow (ReviewPage), публичные
комментарии, подбор ревьюеров, админка/монетизация, слой качества (Playwright e2e + CI),
**hardening + прод-деплой (Фаза 12)**. npm-скрипты работают.

**Источник правды по прогрессу — `docs/migration/PLAN.md`** («Карта фаз» + живой Журнал каждой фазы;
там же — решения и backlog по каждой фазе). На сегодня закрыто:
- **0** bootstrap (каркас/env/git) · **1** токены+тема · **2** схема БД (Drizzle/turso) ·
  **3** два стенда+seed · **4** auth/роли/гейтинг+UI-оболочки · **5** читательский слой
  (лента/ридер/engagement/уведомления/SEO) · **6** авторский слой
  (кабинет + редактор Variant B + портфолио) · **7** review-flow (ReviewPage:
  треды/вердикты/apply-and-close/чат/публикация/кросс-экранный sync) · **8** комментирование
  (тред ≤2/якоря-фрагменты/спойлер старых ревизий/окно правки 15м/голоса/уведомления;
  `src/lib/queries/comments.ts`, `src/app/api/comments/**`, `src/components/reader/comment*`) ·
  **9** подбор ревьюеров (матчинг+«Топ»/согласие через приглашения/приватная оценка/recruit-запрос автора;
  `src/lib/reviewer-match.ts`, `src/lib/queries/invitations.ts`, `src/app/api/reviewer/invitations/**`,
  `src/app/api/author/{ratings,recruit-requests}/**`) ·
  **10** админка/модерация/монетизация (полноэкранный admin-портал RSC route-сегментами
  `src/app/admin/(protected)/{dashboard,users,reports,review,recruit,banners,donation}` + `_components/**`;
  `src/app/api/admin/**`; `src/lib/queries/{admin,settings,monetization,board}.ts`; миграция `0003` `blogs.hidden`;
  публичная доска `src/app/(reader)/board` + `src/app/api/board/applications`; карусель+DonateModal
  `src/components/reader/{promo-carousel,promo-carousel-slot,donate-modal,reviewer-board}.tsx`; `src/components/icons.tsx`).

- **11** слой качества: `playwright.config.ts` (в **корне**; `testDir: testing/e2e`), `testing/` создан —
  тест-документация (`TEST-PLAN.md`, `test-cases/TC-*.md`, `smoke/`, `regression/`), MCP-артефакт
  (`testing/mcp/MCP-FINDINGS.md`), **127 TS-тестов** (`testing/e2e/**`: POM `pages/*`, `fixtures.ts`,
  `global-setup.ts`, `helpers/*`, ролевые + `flows/*` спеки; с Ф12 — `uploads/cron/blocks-render`;
  с ui-feedback-3 — `flows/blog-manage`), CI (`.github/workflows/e2e-{smoke,nightly}.yml`,
  `scripts/ci/write-env-test.mjs`). Полный `test:e2e` зелёный (127/127, 0 skip).

- **12** hardening + прод-деплой (VPS recenza.ru): mermaid-js (клиентский ленивый) + KaTeX (блок `latex` +
  инлайн `$...$`, серверный) · `/api/uploads` + `UploadField` (image/cover/QR; magic-bytes, 4МБ, 413 по
  Content-Length) · отложенная публикация (`scheduled_at` + PublishModal + `/api/cron/publish` c Bearer) ·
  общий `publishRevision()` (`src/lib/queries/publish.ts`) + P1-фиксы (fan-out `new_chapter` подписчикам,
  void pending PCR, переназначение primary при снятии) · presence-heartbeat
  (`/api/review/[id]/heartbeat`, `online = last_seen_at ≥ now−90с`) · создание пользователей админом
  (`POST /api/admin/users` + форма; self-registration нет — альфа) · security-заголовки (`next.config.ts`;
  HSTS — в Caddy) · Lighthouse CI (nightly) · деплой-обвязка (`deploy/**`, `scripts/migrate.mjs`,
  `.github/workflows/deploy.yml`).

**Все фазы `done` — дальнейшая работа = hotfix-ветки/новые итерации** (git-flow ниже; журналы и backlog —
в `PLAN.md`). Весь код «Архитектуры» ниже — **готовый и работающий**, не спецификация.

## Команды
- `npm run dev` — dev (:3000, `.env.local` → `blog.db`)
- `npm run dev:test` — тестовый стенд (:3001, `dotenv -e .env.test` → `blog.test.db`; сначала `test:reset`)
- `npm run build` — прод-сборка (первичная валидация)
- `npm run lint` — ESLint
- `npm run db:generate` / `db:migrate` / `db:migrate:test` — миграции (какая БД — решает env-файл через dotenv-cli)
- `npm run seed` / `npm run seed:test` — seed dev / детерминированный seed теста
- `npm run test:reset` — полный сброс тест-БД (`db:migrate:test` + `seed:test`); создаёт БД с нуля
- `npm run test:e2e` / `:ui` / `:report` — Playwright; `test:smoke` / `test:critical` — `--grep @smoke|@critical`
  (⚠️ стенд `:3001` должен быть поднят или `reuseExistingServer` поднимет `dev:test` сам; **никогда не :3000**)

⚠️ `next dev` НЕ читает `.env.test` автоматически — все команды тест-стенда только через `dotenv -e .env.test --`.
Выбор БД: `TURSO_CONNECTION_URL` → иначе `file:${DB_FILE_NAME}` (`blog.db` dev / `blog.test.db` test) —
одно правило в `db/index.ts` и `drizzle.config.ts`. Шаблон env-переменных — закоммиченный `.env.example`
(сами `.env.local`/`.env.test`/`.env.prod.local` — gitignored).

С Фазы 12 dev снова изолирован: `.env.local` → `file:blog.db` (Turso-креды заархивированы комментарием;
Turso выведен из эксплуатации). Прод-БД — локальный SQLite на VPS, тесты — только `:3001`/`blog.test.db`.

## Стек
- Next.js 16 App Router, TypeScript, Tailwind CSS v4
- БД: `@libsql/client` + Drizzle ORM (dialect **`turso`**) — один драйвер для dev (`file:blog.db`) и прод (Turso)
- MDX/блоки: `next-mdx-remote/rsc` + `rehype-pretty-code` (Shiki); рендер блоков идентичен в ридере и ревью
- Auth: `iron-session` + `bcryptjs`, cookie 7д, имя `blog_session`
- Темы: `next-themes`. Деплой: **VPS recenza.ru** (Caddy + Node standalone + systemd; GH Actions
  `deploy.yml`; конфиги в `deploy/`, runbook — `ENVIRONMENTS.md` §6). Формулы: KaTeX (блок `latex` +
  инлайн `$...$`, серверный); диаграммы: mermaid-js (клиентский ленивый)

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
- `index.ts` — libsql-клиент (env Turso → fallback file; `PRAGMA foreign_keys = ON` на старте). `schema.ts` —
  вся схема (`sqliteTable`, snake_case). `drizzle.config.ts` (`turso`). Сиды: `seed-core.ts` (детерминированный
  построитель) + тонкие раннеры `seed.ts`/`seed-test.ts`.
- **JSON-поля — `text`, не `{mode:"json"}`** (json-mode роняет весь SELECT на битой строке). Разбор —
  **только** через `parseJson()` из `db/json.ts` (try/catch → безопасный дефолт); запись — `stringifyJson()`.
  Прямой `JSON.parse` вне `json.ts` запрещён.
- **28 таблиц** (полная схема — `ENVIRONMENTS.md` §4): `users`, `app_settings`, `blogs`, `chapters`,
  `chapter_revisions`, `chapter_reviewers`, `reviewer_history`, `threads`, `thread_replies`, `review_chat`,
  `review_checklists`, `public_comments`, `comment_votes`, `chapter_votes`, `bookmarks`, `follows`,
  `notifications`, `portfolios`, `reports`, `primary_change_requests`, `removed_reviewers`,
  `review_invitations`, `reviewer_ratings`, `recruit_requests`, `board_calls`,
  `reviewer_applications`, `promo_banners`, `donation_methods` (`app_settings` — KV-singleton, напр.
  `donations_enabled`). Поля у `users`: `competencies` (JSON), `reviewer_rating`/`reviewer_ratings_n`,
  `review_load`/`review_capacity`; у `chapters` — `skills` (JSON, ключевые навыки статьи). Полное описание
  новых таблиц — `docs/prototype/README.md` §11.9. Ревью-таблицы ссылаются FK на **`users.handle`**
  (UNIQUE, иммутабелен) — пользователя с ревью-историей нельзя hard-delete (только soft/бан).
- Перечисления: `role`, `revision.status` (`draft|under-review|changes-requested|published`),
  `verdict` (`approve|request-changes`), `thread.status` (`open|resolved`), `complexity`, `block.type`,
  `invitation.status` (`pending|accepted|declined|flagged`),
  `recruit.status`/`application.status` (`pending|approved|rejected` / `pending|accepted|declined`),
  `banner.action` (`internal|external|donate`), `donation_method.type` (`link|qr`).
- Engagement-таблицы — `uniqueIndex` + `db.transaction()` для race-safe toggle.

### Auth (`src/lib/auth.ts`)
- `SessionData { isAdmin, userId?, userRole? }` — инвариант: `isAdmin` и `userId` не одновременно.
- **Две семьи гардов — не путать:**
  - **Handler-гарды** (для `app/api/**`): `requireAdmin` / `requireUser(role?)` / `requireAuthor` / `requireReviewer`
    возвращают `SessionData | NextResponse` — в хендлере результат **нужно вернуть**:
    `const s = await requireAuthor(); if (s instanceof NextResponse) return s;`.
  - **Page-гарды** (для `(protected)/layout.tsx`): `requireAdminPage` / `requireAuthorPage` / `requireReviewerPage`
    **редиректят** (`next/navigation`), не возвращают `NextResponse`.
- `getSession` (чтение — безопасно в RSC и API; **запись** `save()/destroy()` — только в route handler).
  `getCurrentUser()` → `PublicUser | null` (self-heal: гасит сессию заблокированного/удалённого).
  `toPublicUser()` срезает `passwordHash` — наружу отдавать `PublicUser`, не `User`. Роль для гейтинга
  берётся **из БД** на каждый запрос (не из cookie).
- Route-группы: `app/admin/(protected)/`, `app/author/(protected)/`, `app/reviewer/(protected)/`,
  `app/(reader)/`, публичный сегмент — layout каждой вызывает свой `require*Page`.
- Эндпоинты: `POST/DELETE /api/auth` (admin), `POST/DELETE /api/auth/user` (пользователи),
  `GET /api/auth/user`. Rate-limit логина (`src/lib/rate-limit.ts`, 5/15мин). CSRF — same-origin
  (`src/lib/csrf.ts`) на мутациях.

### Ролевой гейтинг (binding — нарушать нельзя)
- **Читатель** комментирует везде, голосует, закладывает, подписывается.
- **Автор** видит/читает/комментирует **только свои** блоги; чужие фильтруются из ленты/каталога и
  блокируются в ридере. Не комментирует чужое, не рецензирует. Приглашает ревьюеров и оценивает их.
- **Ревьюер** только рецензирует (треды/вердикты/правки/чат); **никогда не комментирует**, нет блогов;
  публичный профиль — «что отрецензировал». Принимает/отклоняет приглашения; имеет компетенции и рейтинг.
- **Админ** модерирует; **не создаёт блоги/главы**; роль пользователя не меняется обычным API.
  Ведёт доску «Ищем ревьюеров», разбирает запросы/заявки ревьюеров, баннеры и пожертвования.
  Админка — полноэкранная (шапка сайта скрыта), своя навигация: Модерация / Люди / Платформа.

### Review-flow
- Назначение ревьюеров на главу + **ведущий (primary)**; вердикты на handle/ревизию; `reviewer_history`
  хранит кредит по версиям. Чат сессии (`review_chat`) — вне тредов. Чек-лист готовности — гейт отправки.
- Публикация главы доступна автору **только при всех `approve`** (или force-approve админом).
- Опубликованная глава указывает ревьюеров текущей версии + прошлых (за раскрытием).
- ⚠️ Регресс-ловушка: роут `article` обязан рендерить data-driven `BlogReaderScreen`, не легаси
  single-article вид (см. `README.md` §3). Открытие разных блогов → разный контент, обновление `title`/OG.

### Подбор ревьюеров, согласие, оценка, монетизация (этап «подбор ревьюеров»)
Полная спецификация — `docs/prototype/README.md` §11. Ключевое (binding):
- **Компетенции ревьюера** (`users.competencies`) и **навыки статьи** (`chapters.skills`) — РАЗНЫЕ
  сущности. Навыки статьи — как ключевые слова в научной статье: **обязательны для отправки**
  главы и **видны читателю** (отдельно от `blog.tags`).
- **Подбор**: совпадение навыков → `match.pct`; «Топ» = навыки 50% + рейтинг 30% + объём 20%;
  учитывается занятость (`review_load/capacity` → `free|busy|full`).
- **Согласие (смена модели назначения):** ревьюер НЕ активен по факту назначения — автор шлёт
  **приглашение** (`review_invitations`), ревьюер **принимает/отклоняет**, автор узнаёт сразу.
  Ревьюер может пожаловаться **«навыки не совпадают»** (при match < 50%) → глава снимается с ревью,
  автору предлагается исправить навыки (регуляция через админа).
- **Оценка ревьюера автором** после публикации (`reviewer_ratings`): 1–5 звёзд, **приватно**
  (видит ревьюер и админ); в «Топ» идёт только агрегат.
- **Нет совпадений** → автор шлёт запрос админу (`recruit_requests`) с вердиктом
  (на рассмотрении / одобрен / отклонён + причина); одобрение публикует направление на
  публичную доску. Блог нельзя опубликовать без ревью — это запасной путь.
- **Публичная доска** «Ищем ревьюеров» (`board_calls`, ведёт админ) + **заявки**
  (`reviewer_applications`, apply-to-review → админ принимает/отклоняет).

### Монетизация и промо (admin-managed)
- **Промо-баннеры ленты** (`promo_banners`) — карусель на ленте; действие по клику
  `internal|external|donate`. Кнопка «Стать ревьюером» переехала из шапки в баннер.
- **Пожертвования** (`donation_methods`, тип `link|qr` + флаг включения) — модалка «Поддержать»:
  ссылки (DonationAlerts) кнопками, QR (Ozon/СБП) сканом, **без сумм**; QR только загружается
  (без генерации). Баннеры и пожертвования настраиваются **независимо**.

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

### Тест-слой (Фаза 11 — готовый код, не спека)
- `playwright.config.ts` — в **корне** (не в `testing/e2e/`): `testDir: testing/e2e`, `baseURL :3001`,
  `workers:1`, `fullyParallel:false`, `webServer npm run dev:test` (`reuseExistingServer: !CI`);
  читает `.env.test` через `dotenv` (нужен `ADMIN_PASSWORD_PLAIN`).
- `global-setup.ts` — `reseed()` + auth-state 4 ролей в `testing/e2e/.auth/*.json` (gitignored) + прогрев роутов.
- Фикстуры (`fixtures.ts`): `asGuest/asReader/asAuthor/asReviewer/asAdmin` (свой browserContext поверх
  storageState), `loginAs(handle)` (sergey/lena/max/troll), `guestWithXff(xff)` (изоляция login-лимита),
  `api(role?)` (request-контекст с `Origin` — без него same-origin CSRF отбивает мутации 403).
- **Изоляция:** мутирующие спеки (`admin.spec` + `flows/*`) — `serial` + `reseed()` в `beforeAll` **и `afterAll`**
  (иначе `--grep @smoke` теряет соседние reseed'ы и падает); ролевые — read-only/additive/self-restoring.
- **Флак-обходы:** «мёртвые» клики до гидрации Next dev → `expect().toPass`-ретрай; action rate-limit 1/сек →
  `throttleMutation` в POM + `toPass` на негативных API (429→ретрай). console-guard (`fixtures.ts`) падает на
  `console.error`/`pageerror` с allowlist (`Failed to load resource`/`/uploads/`/preload/not-found script-tag).
- Локаторы — по роли/тексту/aria (`data-testid` в приложении нет); реальные локаторы/тайминги — `testing/mcp/MCP-FINDINGS.md`.
- Seed-константы (ID/slug) — единственный источник в `testing/e2e/helpers/seed.ts` (при правке seed — синхронить).

## Claude Code обвязка
- `.claude/rules/`: `security.md`, `next-app-router.md`, `drizzle-queries.md`, `mdx-components.md`,
  `frontend-design.md`.
- `.claude/agents/`: `playwright-tester`, `code-reviewer`, `security-reviewer`, `design-watcher`, `seo-optimizer`.
- `.claude/skills/`: `qa-test-planner`, `playwright-best-practices`, `next-best-practices`,
  `drizzle-schema`, `review-flow-domain`, `security-checklist`.
- MCP: **Playwright MCP** (`mcp__playwright__*`).

## Флоу изменений (обязателен для любого кода)

**Сквозной процесс** любого пост-релизного изменения — `docs/migration/WORKFLOW.md`:
классификация S/M/L → ветка → разработка → тесты (какие обязательны) → Цикл качества
(какие сабагенты по зоне) → PR → автодеплой → проверка прода → запись в журнал
`PLAN.md` § «Пост-релизные итерации». Ниже — только деплой-механика.

## Деплой изменений на прод (как выкатывать)

Прод — VPS `https://recenza.ru` (Ubuntu 24.04; Caddy → Node standalone → systemd `recenza.service`;
БД — локальный SQLite `/srv/recenza/shared/data/blog.prod.db`). Полный runbook/layout — `ENVIRONMENTS.md` §6.

**Штатный путь (ничего руками не делать):**
1. Ветка от `main` (`hotfix-<slug>` / `phase-*`) → правки → локально `npm run lint` + `npx playwright test` (зелёные).
2. `gh pr create` → PR-гейт `e2e-smoke` (CI сам генерит `.env.test`) → зелёный → `gh pr merge --squash --delete-branch`.
3. Push в `main` **автоматически** запускает `.github/workflows/deploy.yml`: standalone-сборка
   (`BUILD_STANDALONE=1`, `NEXT_PUBLIC_BASE_URL` вшивается в билд) → rsync в
   `/srv/recenza/releases/<sha>` → `scripts/migrate.mjs` (миграции `drizzle/`) → симлинк
   `current` → `sudo systemctl restart recenza` → health-check. Секреты: GH Secrets
   `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_SSH_KEY`.
4. Проверить: `gh run list --workflow=deploy` = success; `curl -I https://recenza.ru` = 200.

**Ручной перезапуск деплоя:** `gh workflow run deploy --ref main`.
**Откат:** на сервере `ln -sfn /srv/recenza/releases/<прежний-sha> /srv/recenza/current && sudo systemctl restart recenza`
(миграции only-forward/аддитивные — откат кода безопасен). **Логи:** `journalctl -u recenza -f`.
**Прод-env** живёт только в `/srv/recenza/shared/env` (systemd EnvironmentFile; правка → restart).
**SSH на сервер** — только по ключам; ключ владельца добавлен (root + `recenza`), на его машине —
`~/.ssh/recenza_ed25519`: `ssh -i ~/.ssh/recenza_ed25519 root@91.184.243.106 "<команда>"`.
Как завести новый — `ENVIRONMENTS.md` §6.5.
⚠️ Миграции 0000→N применяются деплоем автоматически; деструктивные миграции запрещены (сначала
бэкап `/srv/recenza/backups`, ночной таймер 03:30). ⚠️ Один Node-инстанс (in-memory rate-limit).
⚠️ На VPS рядом AmneziaWG в Docker — ufw-правила (51820/udp, 51821/tcp) не трогать.

## Git и репозиторий
- Репозиторий: **`https://github.com/denjamin-ai/recenza`** (права на ветки, PR, мерж и пуш в `main` выданы).
- **Git-flow:** одна фаза = одна ветка = один PR. `phase-<N>-<slug>` от `main`; squash-merge в `main`
  после зелёного Цикла качества; ветку удалять. Блокирующий баг — `hotfix-<slug>` с приоритетным PR.
- Стартовый bootstrap (Фаза 0) — допустимо коммитить прямо в `main`. Дальше — только через PR.
- **Никогда не коммить** `.env.local`/`.env.test`/`*.db` и любые секреты. Перед коммитом — `git status`.
- Команды (`git commit*`, `git push*`, `gh pr *`) разрешены; деструктивные (`git reset --hard`, `push --force`) — спрашивать.

## Gotchas
- bcrypt в `.env*` экранирует `$` как `\$` (dotenv-expand), **одинарно и в `.env.local`, и в `.env.test`**.
  ⚠️ Легенда Фазы 4 про «двойное `\\$` на тест-стенде» опровергнута эмпирически в Фазе 12: `.env.test`
  проходит ровно ОДИН expand (dotenv-cli); `next dev` не читает `.env.test`, а `@next/env` не перетирает
  уже заданные env. `\\$` давал битый хэш → CI-смоки падали 401 на логине админа (исправлено в
  `scripts/ci/write-env-test.mjs`). В проде (systemd EnvironmentFile) — без экранирования вовсе.
- `SESSION_SECRET` без fallback — падение при старте, если не задан.
- Seed-скрипты нужен `process.exit()` (libsql держит соединение).
- **drizzle-kit опускает `onDelete` для `ADD COLUMN` в SQLite** — FK-действие правится в миграции
  вручную (`0001_*.sql`: `pinned_blog_id … ON DELETE SET NULL` дописан руками). Snapshot уже фиксирует
  `set null`, так что следующий `generate` не даёт дрейфа.
- `requireUser()` кидает `NextResponse` (не Error) — в хендлере его нужно `return`.
- `cover_url` валидируется на префикс `/uploads/` — внешние URL отклоняются.
- Engagement-toggle через `db.transaction()`; нарушение `uniqueIndex` = баг в toggle-логике.
- **Редактор (Variant B, Фаза 6) — управляемые `textarea` с raw-markdown** (никакого
  `contenteditable`/`execCommand`). Инлайн-разметка живёт строкой в `block.text`
  (`**b**`/`*i*`/`` `code` ``/`[l](url)`; курсив только `*..*`, чтобы `snake_case` не курсивился),
  рендер — `src/components/blocks/inline.tsx`. С Фазы 12 есть block-тип `latex` (KaTeX, RSC) и инлайн
  `$...$` (анти-ценовая эвристика: нужен LaTeX-подобный символ, кириллица внутри → литерал);
  math-токены выбрасываются из `stripInlineMarks` (SEO/ToC).
- **`normalizeBlock` (`src/lib/blocks/normalize.ts`) лечит дрейф имён** прототип→рендерер
  (`subtype→variant`, `tone→variant`, `caption→alt`); валидатор + чек-лист готовности
  (`src/lib/blocks/validate.ts`) изоморфны клиент⇄сервер. Константы блоков — в клиент-безопасном
  `src/lib/blocks/constants.ts` (без drizzle, чтобы редактор не тащил схему БД в бандл).
- **Submit главы (Фаза 9 — согласие) создаёт `review_invitations` (pending), НЕ `chapter_reviewers`.**
  Ревью стартует только после accept — accept (`src/app/api/reviewer/invitations/[id]`) наполняет
  `chapter_reviewers` (`reviewLoad +1`). Все downstream-гейты (verdict/threads/chat/publish/инбокс/queue)
  опираются на `chapter_reviewers`, поэтому согласие соблюдается без их правок. publish делает `reviewLoad −1`.
  `submit-revision` (Ф7) переносит уже принявших напрямую — намеренный carry-forward (re-consent не нужен,
  backlog P2 Ф10). Главу `under-review`/`published` редактор править не даёт (`409`). match%/«Топ» (навыки
  50%+рейтинг 30%+объём 20%) — чистый `src/lib/reviewer-match.ts`; flag «навыки не совпадают» доступен лишь
  при match<50% (перепроверка на сервере) → ревизия `changes-requested`. Оценки приватны: наружу только
  агрегат `users.reviewerRating`.
- **Изображения — только путь `/uploads/`**; загрузка — `POST /api/uploads` (Фаза 12: kind
  `article|cover|donation|banner` → гейт author/admin; magic-bytes + 4МБ + ранний 413 по Content-Length;
  dev/test пишет в `public/uploads`, прод — `UPLOADS_DIR`, отдаёт Caddy). UI — `src/components/upload-field.tsx`.
- **`src/lib/slug.ts` — транслитерирующий slug** (НЕ кириллический `slugify` из
  `src/components/blocks/anchors.ts`); не перепутать.
- **Review-flow (Фаза 7) — POV серверный.** Доступ к `app/api/review/**` — через `resolveReviewAccess()`
  (`src/lib/queries/review.ts`): автор-владелец ИЛИ назначенный ревьюер. Вердикт — только ревьюер;
  apply/publish/submit-revision/primary-change — только автор. Демо-дропдаута POV из прототипа нет.
  Review-`threads` ≠ публичные `public_comments` (Фаза 8) — разные таблицы/роуты; ревьюер участвует в
  ревью-тредах, но **никогда** не в публичных комментариях.
- **Apply-and-close правит блоки текущей under-review ревизии in-place** (не плодит ревизии). Новая
  ревизия — только «Отправить v{N+1}» (`submit-revision`: snapshot блоков, `prev_blocks`=последняя
  published, вердикты обнулены). Публикация — гейт «все approve» (перепроверяется в БД) + `reviewer_history`.
- **`router.refresh()` в клиентских ревью-действиях оборачивать в `startTransition`** — иначе он ловит
  Suspense-границу `loading.tsx`, ReviewScreen перемонтируется и теряет тост/локальный UI-стейт, а статус
  не обновляется без hard reload (`src/components/review/review-screen.tsx`). Кросс-экранный sync = поллинг
  (30с) + refresh; вебсокетов нет. Presence (Фаза 12) — heartbeat: ревьюер шлёт
  `POST /api/review/[id]/heartbeat` при открытии и в каждом поллинге; `online = last_seen_at ≥ now−90с`
  (деривация в `queries/review.ts`); typing-индикатора нет (backlog).
- **Публикация (Фаза 12) — единый `publishRevision()`** (`src/lib/queries/publish.ts`): его используют
  author-publish, admin force-approve и cron. Внутри транзакции: гейт all-approve (для gate="all-approve"),
  снапшот кредита, `reviewLoad −1`, fan-out `new_chapter` подписчикам автора, void pending
  `primary_change_requests`. Отложенная публикация: `publish`-роут принимает `{scheduledAt}` (или `null`
  для отмены), `/api/cron/publish` (Bearer `CRON_SECRET`, constant-time) публикует наступившие, перепроверяя
  гейт; провал гейта снимает план + уведомление `scheduled_publish_failed`. Снятие ведущего админом
  переназначает primary детерминированно (первый по handle из оставшихся).
- **Прод-деплой (Фаза 12)**: standalone-сборка ТОЛЬКО с `BUILD_STANDALONE=1` (иначе ломается `next start`);
  `outputFileTracingExcludes` в `next.config.ts` ОБЯЗАТЕЛЕН — без него трейсер утаскивает `.env*`/`.git`/
  `blog.db` в артефакт (утечка секретов). Миграции на проде — `scripts/migrate.mjs` (drizzle-orm migrator;
  drizzle-orm докладывается в артефакт — Next бандлит его в чанки). Прод-env — systemd EnvironmentFile
  (БЕЗ `\$`-экранирования). Строго один Node-инстанс (in-memory rate-limit). На VPS рядом AmneziaWG
  в Docker (51820/udp, 51821/tcp) — ufw-правила не трогать.
- **Создание пользователей — только админом** (`POST /api/admin/users` + форма в «Люди»);
  self-registration нет по построению (альфа). Роль задаётся один раз при создании; admin-роль через
  API не создаётся. Смена пароля пользователю — `password` в `PATCH /api/admin/users/[handle]`
  (ui-feedback-3); активные сессии при этом НЕ гасятся (backlog; немедленный разлогин — бан).
- **Удаление блога автором** (`DELETE /api/author/blogs/[blogId]`, ui-feedback-3) — только полностью
  черновиковый блог: все ревизии всех глав `draft` и `publishedAt IS NULL`, иначе 409; гейт
  перечитывается ВНУТРИ транзакции (анти-TOCTOU). `public_comments`/`removed_reviewers` ссылаются по
  `blogSlug` без FK — чистятся явно; остальное сносят каскады схемы. Published-блоги не удаляются
  никогда (кредит `reviewer_history`); их скрывает админ через `hidden`.
- **Автосейв редактора (ui-feedback-3)**: только СТРУКТУРНЫЕ правки блоков
  (вставка/удаление/перестановка/смена типа, включая markdown-шорткат) — `BlockListEditor.onChange`
  отдаёт `meta.structural`, `chapter-editor` планирует дебаунс-сейв 1.6с (> окна рейт-лимита
  `author-save` 1/с). `save()` читает title/blocks из refs (не из замыкания), сейвы сериализованы
  цепочкой промисов, 429 ретраится один раз по Retry-After; «Просмотр» — кнопка с сохранением перед
  переходом. Текстовые правки автосейв не триггерят (Ctrl+S/кнопка остаются).
- **Общие модули ui-feedback-3**: группы меню блоков — `editor/block-menu.ts` (плюс-меню якорится к
  кнопке, click-outside/Escape; слэш-меню — клавиатура ↑↓/Enter/Escape); лимиты баннеров —
  `src/lib/banners.ts` (форма и API-400 из одного источника); кнопка «назад» —
  `src/components/back-link.tsx`; «Руководство» — `src/components/nav/guide-modal.tsx` (роль-зависимый
  гид; тексты под РЕАЛЬНУЮ модель, не легаси прототипа). Пикер ревьюеров SubmitSheet: дефолтная
  вкладка «Все» (`DEFAULT_TAB`).
- **Служебный контент на прод** — `scripts/seed-recenza.mjs` (паттерн: идемпотентный additive-скрипт
  а-ля `migrate.mjs`, inline-определения таблиц, published-ревизии напрямую как seed-core §5;
  deploy.yml докладывает скрипт + `ulid`/`bcryptjs` в артефакт). С ui-feedback-4 скрипт — НЕЗАВИСИМЫЕ
  идемпотентные секции (блог «О Recenza» + тексты recruit-баннера; UPDATE только пока значение равно
  старому сидовому — правки админа не затираются). Перед прогоном на сервере — бэкап БД.
- **ui-feedback-4 (сверка с прототипами)**: **главная без табов и поиска, карточки БЛОГОВ** —
  ролевой сплит в `app/(reader)/page.tsx`: reader → «Ваша лента» (секции «Подписки»/«Свежее»,
  `getFollowedAuthorIds`), гость/автор/ревьюер → «Все блоги»; каталог для reader — `/?view=all`;
  компоненты `home-tabs/filter-chips/feed-list/chapter-feed-card/subscription-feed/catalog-grid`
  УДАЛЕНЫ (`getFeed` жив — им питается `feed.xml`); карточка — `blog-index-card.tsx`, плейсхолдер
  обложки — детерминированный градиент от slug (`.cover-ph-*` в globals.css). **«Лента» в шапке —
  справа** (первая в правом кластере). **Кабинет автора «Мои блоги»** — `lg:grid-cols-[1fr_300px]`:
  сетка карточек max 2 колонки (футер «＋ Глава» + pin-тоггл 38px; «ваш ход» = есть `changes-requested`)
  + aside (карточка «Об авторе» с тогглом видимости портфолио, «События» из `getNotifications`;
  тексты уведомлений — общий `src/lib/notification-text.ts`, его же использует колокол). **Карусель**:
  CTA ПОД текстом слева, текст ВСЕГДА белый (`--promo-cta-bg`/`--promo-cta-foreground`; в dark ink
  под кнопкой затемняется) — ⚠️ реверс «всегда справа» из ui-feedback-3 П4 (новое указание владельца).
  **Whole-режим ридера**: кредит и комментарии НЕ рендерятся per-chapter — после глав ОДНА карточка
  «Блог ревьюили» (`blog-reviewer-credit.tsx`, чистая агрегация `section.credit`) и ОДИН merged-блок
  (`blog-comments-slot.tsx` → `getBlogComments`; композер таргетит главу селектом «К главе»/якорем —
  блоговых комментариев нет по построению, `chapter_slug NOT NULL`). **Админ-кнопки** — общий
  `src/app/admin/_components/buttons.tsx` (btnPrimary/Secondary/Text/DangerSoft/DangerStrong/Warning/
  WarningStrong + ActionBtn-карточки жалоб + inputCls); тексты кнопок НЕ менялись (e2e-локаторы).
  **Donate-модалка** — по прототипу (золото — токены `--gold*`, прототипный #b8860b затемнён до AA).
  **Плюрализация** — общий `src/lib/plural.ts`.
- **Комментарии (Фаза 8): глубина считается от 0** (`cmt_reply_reader` в seed — валидная глубина 2 = максимум).
  Ответ разрешён только если глубина родителя ≤1 (ответ на узел глубины 2 → `409`); проверка серверная
  (`src/app/api/comments/route.ts`), UI-флаг `canReply`/`depth<2` — вторичен. Листинг — **RSC**
  (`getChapterComments` в `src/lib/queries/comments.ts`), мутации — роуты `src/app/api/comments/**`; гейтинг —
  единый `commentGate` (reader везде / author только свой блог / reviewer никогда / `commentingBlocked` → 403),
  перепроверяется в каждом роуте. Ревизия штампуется сервером (`resolveCommentTarget`), не из клиента.
  Якоря-фрагменты скроллят к `[data-block-id]` (есть на каждом блоке, mode-независим) — НЕ к `id="block-…"`
  (он только у заголовков). Голос за коммент ресинкается через `key`-remount (не `useEffect`). Soft-delete:
  tombstone остаётся только при живых потомках; physical-delete нет (иначе `parentId` CASCADE снёс бы ответы).
