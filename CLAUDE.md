# CLAUDE.md

Гайд для Claude Code при работе с репозиторием **Recenza** — монолит на Next.js 16:
многоглавный девблог с редакционным review-flow и 4 ролями. Интерфейс на русском.

> Доменная модель — **глава-ориентированная** (Blog → Chapter → Revision → blocks). UX-эталон и
> детальная модель — `docs/prototype/README.md` (корневой `README.md` — bootstrap-гайд для человека,
> не источник модели). План миграции — `docs/migration/PLAN.md`. Стенды/БД — `docs/migration/ENVIRONMENTS.md`.
> Тесты — `docs/migration/TESTING.md`.

## Текущее состояние репозитория (ВСЕ фазы 0–15 `done` — проект в проде)

⚠️ **Прочти первым.** Монолит **работает в проде**: `https://recenza.ru` (VPS Ubuntu 24.04, Хельсинки;
Caddy + Node standalone + systemd; деплой — GH Actions `deploy.yml` на push в `main`). Каркас: Next 16 +
`src/`, `node_modules/`, `tsconfig.json`, `next.config.ts`, `drizzle.config.ts`, миграции
`drizzle/0000_*.sql` … `0007_*.sql` (0004: `chapter_revisions.scheduled_at` + `chapter_reviewers.last_seen_at`;
0005: drop `chapter_reviewers.online`; 0006: `blog_votes` + data-миграция голосов с глав на блоги,
`chapter_votes` deprecated; 0007: `users.is_reviewer/can_author/introduced_by` +
`chapter_revisions.review_status` + бэкфилл ролей и разведение осей — Фаза 13;
**0009**: `blogs.featured_at` + `reports.{note,about_handle,resolved_at}` — Фаза 15;
**0008**: `review_requests` + `expert_invites` + `chapter_revisions.{title,skills,review_closed_at,
verified_at,verified_tier}` + `blogs.verified_{at,tier}` + `reviewer_applications.{invited_by,invite_token}`
— Фаза 14; всего **31 таблица**), `blog.db`/`blog.test.db`, два стенда, auth/возможности,
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
  `src/app/admin/(protected)/{dashboard,users,reports,review,recruit,board,banners,donation}` + `_components/**`;
  `src/app/api/admin/**`; `src/lib/queries/{admin,settings,monetization,board}.ts`; миграция `0003` `blogs.hidden`;
  публичная доска `src/app/(reader)/board` + `src/app/api/board/applications`; карусель+DonateModal
  `src/components/reader/{promo-carousel,promo-carousel-slot,donate-modal,reviewer-board}.tsx`; `src/components/icons.tsx`).

- **11** слой качества: `playwright.config.ts` (в **корне**; `testDir: testing/e2e`), `testing/` создан —
  тест-документация (`TEST-PLAN.md`, `test-cases/TC-*.md`, `smoke/`, `regression/`), MCP-артефакт
  (`testing/mcp/MCP-FINDINGS.md`), **тест-слой** (актуальное число — `TEST-PLAN.md` §9.7) (`testing/e2e/**`: POM `pages/*`, `fixtures.ts`,
  `global-setup.ts`, `helpers/*`, ролевые + `flows/*` спеки; с Ф12 — `uploads/cron/blocks-render`;
  с ui-feedback-3 — `flows/blog-manage`), CI (`.github/workflows/e2e-{smoke,nightly}.yml`,
  `scripts/ci/write-env-test.mjs`). Полный `test:e2e` — зелёный, 0 skip.
  ⚠️ `CRON_SECRET` для cron-спеков генерирует САМ `playwright.config.ts` и отдаёт его только тому
  стенду, который поднял сам. Если :3001 уже поднят вручную, cron-спеки получат 401 — перед полным
  прогоном стенд надо гасить (в `.env.test` переменная пустая).

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
- БД: `@libsql/client` + Drizzle ORM (dialect **`turso`**) — один драйвер для dev (`file:blog.db`)
  и прода (локальный SQLite на VPS; Turso выведен из эксплуатации в Ф12)
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
- **31 таблица** (полная схема — `ENVIRONMENTS.md` §4): `users`, `app_settings`, `blogs`, `chapters`,
  `chapter_revisions`, `chapter_reviewers`, `reviewer_history`, `threads`, `thread_replies`, `review_chat`,
  `review_checklists`, `public_comments`, `comment_votes`, `chapter_votes` (deprecated с ui-feedback-5),
  `blog_votes` (голос за блог — модель прототипа), `bookmarks`, `follows`,
  `notifications`, `portfolios`, `reports`, `removed_reviewers`, `recruit_requests`, `board_calls`,
  `reviewer_applications`, `promo_banners`, `donation_methods`,
  **`review_requests`** и **`expert_invites`** (Ф14) + legacy, которые НЕ читаются:
  `primary_change_requests`, `review_invitations`, `reviewer_ratings` (`app_settings` — KV-singleton,
  напр. `donations_enabled`). Поля у `users`: `competencies` (JSON), `introduced_by` (уровень бейджа),
  `review_load`/`review_capacity`; у `chapter_revisions` — `title`/`skills` (снапшот метаданных),
  `review_closed_at`, `verified_at`/`verified_tier`; у `blogs` — `verified_at`/`verified_tier`.
  Ревью-таблицы ссылаются FK на **`users.handle`**
  (UNIQUE, иммутабелен) — пользователя с ревью-историей нельзя hard-delete (только soft/бан).
- Перечисления: `role`, `revision.status` (`draft|published`), `revision.review_status`
  (`none|requested|in-review|changes-requested|reviewed`),
  `review_request.channel` (`queue|invite|editorial`) и `.status` (`open|claimed|done|cancelled|expired`),
  `expert_invite.status` (`pending|used|revoked|expired`), `verified_tier` (`invited|independent`),
  `verdict` (`approve|request-changes`), `thread.status` (`open|resolved`), `complexity`, `block.type`,
  `invitation.status` (`pending|accepted|declined|flagged`),
  `recruit.status`/`application.status` (`pending|approved|rejected` / `pending|accepted|declined`),
  `banner.action` (`internal|external|donate`), `donation_method.type` (`link|qr`).
- Engagement-таблицы — `uniqueIndex` + `db.transaction()` для race-safe toggle.

### Auth (`src/lib/auth.ts`)
- `SessionData { isAdmin, userId? }` — инвариант: `isAdmin` и `userId` не одновременно.
  ⚠️ Поле `userRole` удалено в Ф13: возможности НИКОГДА не берутся из cookie.
- **Две семьи гардов — не путать:**
  - **Handler-гарды** (для `app/api/**`): `requireAdmin` / `requireUser()` / `requireCapability(cap)` /
    `requireAuthor` / `requireReviewer` возвращают `SessionData | NextResponse` — в хендлере результат
    **нужно вернуть**: `const s = await requireAuthor(); if (s instanceof NextResponse) return s;`.
    ⚠️ У `requireUser()` **намеренно нет параметра роли** — всё, что требует возможности, идёт через
    `requireCapability` (`requireAuthor`/`requireReviewer` — его алиасы, имена сохранены).
  - **Page-гарды** (для `(protected)/layout.tsx`): `requireAdminPage` / `requireUserPage` /
    `requireCapabilityPage(cap)` / `requireAuthorPage` / `requireReviewerPage`
    **редиректят** (`next/navigation`), не возвращают `NextResponse`.
- `getSession` (чтение — безопасно в RSC и API; **запись** `save()/destroy()` — только в route handler).
  `getCurrentUser()` → `PublicUser | null` (self-heal: гасит сессию заблокированного/удалённого).
  `toPublicUser()` срезает `passwordHash` — наружу отдавать `PublicUser`, не `User`. Роль для гейтинга
  берётся **из БД** на каждый запрос (не из cookie).
- Route-группы: `app/admin/(protected)/`, `app/author/(protected)/`, `app/reviewer/(protected)/`,
  `app/(account)/` (приватные `/workspace` и `/settings`, гард `requireUserPage` + `noindex`),
  `app/(reader)/`, публичный сегмент — layout каждой вызывает свой `require*Page`.
- Эндпоинты: `POST/DELETE /api/auth` (admin), `POST/DELETE /api/auth/user` (пользователи),
  `GET /api/auth/user`. Rate-limit логина (`src/lib/rate-limit.ts`, 5/15мин). CSRF — same-origin
  (`src/lib/csrf.ts`) на мутациях.

### Гейтинг по возможностям (binding — нарушать нельзя; Фаза 13 заменила ролевую модель)
- **Базовый уровень есть у всех.** Любой аккаунт читает, комментирует, голосует, закладывает,
  подписывается. Отдельной роли «читатель» больше нет — это отсутствие возможностей.
- **Возможности** (`users.can_author`, `users.is_reviewer`) **выдаёт и отзывает только админ**
  (`PATCH /api/admin/users/[handle]` + чекбоксы в карточке пользователя). Возможности читаются
  **из БД на каждый запрос** (в cookie их нет) — отзыв действует без перелогина.
  Хелперы — `src/lib/roles.ts`.
- **`can_author` у нового аккаунта ВКЛЮЧЁН по умолчанию** (решение владельца): вести блог — базовая
  возможность, админ снимает её точечно. `is_reviewer` выдаётся явно. ⚠️ Дефолт живёт в
  `POST /api/admin/users` (`body.canAuthor !== false`), а НЕ в схеме: сменить `DEFAULT` колонки
  в SQLite = пересоздать `users`, на которую ссылаются FK ревью-таблиц.
- **`can_author`** — вести блоги/главы, отправлять на ревью, публиковать. Ownership обязателен
  всегда: `requireAuthor()` + `blog.authorId === session.userId`.
  ⚠️ **Снятие `can_author` ПРЯЧЕТ все блоги автора** из ленты/каталога/подписок/sitemap/feed,
  по прямой ссылке (404) и из закладок; новые комментарии к ним не принимаются. Скрытие
  **деривационное** — фильтр `eq(users.canAuthor, true)` в ридер-запросах (`feed.ts`,
  `chapters.ts`, `comments.ts`, `bookmarks.ts`), данные не мутируются: вернули флаг — вернулись
  блоги. Кредит `reviewer_history` не затрагивается. Отзыв — не бан: аккаунт остаётся читателем.
- **`is_reviewer`** — рецензировать (треды/вердикты/правки/чат), принимать приглашения, компетенции.
  Ревьюер **комментирует чужие блоги как обычный читатель**; закрыта только та глава, которую он
  ревьюит или ревьюил — **конфликт интересов** (`getConflictedChapterIds`, проверка серверная).
- **Колонка `users.role` — legacy**: не дропнута, пишется shim'ом при создании, **гейты её не читают**.
- **Админ** модерирует; **не создаёт блоги/главы**; сам возможностей не имеет (env-based, без строки
  в `users`) — бар «Реакции» ему не рендерится. Ведёт доску «Ищем ревьюеров», разбирает запросы/заявки,
  баннеры и пожертвования. Админка — полноэкранная, навигация: Модерация / Люди / Платформа.

### Две оси состояния главы (binding; Фаза 13)
`chapter_revisions.status` = `draft|published` (публикация) и `chapter_revisions.review_status` =
`none|requested|in-review|changes-requested|reviewed` (ревью) — **независимы**. Единый источник
предикатов и подписей — `src/lib/review-status.ts` (`isReviewOpen`, `isRevisionEditable`,
`PUBLICATION_META`, `REVIEW_META`, `statusDotClass`); локальных копий множества активных статусов
заводить нельзя (до Ф13 их было девять).
⚠️ **Ф14: `isReviewOpen(reviewStatus, reviewClosedAt)` — ось публикации из предиката УШЛА.** До неё
предикат возвращал `false` для любой `published`-ревизии, из-за чего ревью опубликованной главы было
невозможно физически (вердикт отвечал 409), а фаза требует заявку в любом статусе. Закрытие сессии —
явный токен `chapter_revisions.review_closed_at`, который ставит только `closeReviewSession()`.
- **Публикация свободна**: ревьюеры не нужны никогда, гейт «все approve» удалён.
  Роут — `POST /api/author/chapters/[chapterId]/publish` (он же принимает `scheduledAt`).
- **Публикация не трогает ось ревью**; `reviewed` переживает публикацию — это основание кредита.
- **Кредит `reviewer_history` — только за `approve`** (публиковать можно посреди ревью);
  `reviewLoad −1` — всем назначенным.
- **Правка опубликованной главы** заводит ревизию-черновик поверх; читатель видит опубликованную,
  пока автор не опубликует новую (ридер-селекторы фильтруют `status='published'` ДО `max(number)`).
- Удаление блога требует `status='draft' AND review_status='none'` по всем ревизиям —
  одной проверки `draft` НЕДОСТАТОЧНО (глава на ревью тоже `draft`).

### Review-flow
- Назначение ревьюера создаёт **claim заявки** (`review_requests` → `chapter_reviewers`); вердикты на
  handle/ревизию; `reviewer_history` хранит кредит по версиям. Чат сессии (`review_chat`) — вне тредов.
- ⚠️ **Ф14: роли «ведущего» (primary) НЕТ** — состав ревью не иерархичен, один ревьюер достаточен.
  Колонки `chapters.primary_handle`/`chapter_reviewers.is_primary` и таблица `primary_change_requests`
  остались в БД как legacy и не читаются.
- Публикация свободна (Ф13) и ревью не гейтит её никогда.
- Опубликованная глава указывает ревьюеров текущей версии + прошлых (за раскрытием) и **бейдж**.
- ⚠️ Регресс-ловушка: роут `article` обязан рендерить data-driven `BlogReaderScreen`, не легаси
  single-article вид (см. `README.md` §3). Открытие разных блогов → разный контент, обновление `title`/OG.

### Ревью 2.0: заявки, каналы, бейджи (binding; Фаза 14 заменила «подбор + согласие + рейтинг»)
⚠️ `docs/prototype/README.md` §11.2–§11.5 помечен **SUPERSEDED** — подбор, приглашения и рейтинг
описаны там как история; реализовывать их заново нельзя.
- **Компетенции ревьюера** (`users.competencies`) и **навыки статьи** (`chapter_revisions.skills`,
  рабочее значение — `chapters.skills`) — РАЗНЫЕ сущности. Навыки статьи обязательны для ЗАЯВКИ
  и видны читателю (отдельно от `blog.tags`).
- **Автор нигде не выбирает ревьюеров.** Он оставляет ЗАЯВКУ (`review_requests`,
  `POST /api/author/chapters/[id]/review-request`), ревьюер берёт её сам из очереди своего кабинета
  (`POST /api/reviewer/requests/[id]/claim`). Claim пишет `chapter_reviewers` — поэтому downstream
  (треды/вердикты/чат/`resolveReviewAccess`) правок не потребовал.
- **Заявку можно оставить в ЛЮБОМ состоянии главы, включая `published`** (З-03). Нельзя только на
  ревизию, у которой уже есть бейдж. Одна живая заявка на ревизию — частичный `uniqueIndex`
  `(chapter_id, revision_number) WHERE status IN ('open','claimed')` + перепроверка в транзакции.
- **Гейты claim'а — все на сервере и внутри транзакции:** заявка ещё `open`, `review_load < capacity`
  (З-06 — раньше `full` проверялся только в UI), не свой блог, ревизия актуальна.
- **Очередь сортируется по совпадению с компетенциями РЕВЬЮЕРА** — `skillMatch()` из чистого
  `src/lib/reviewer-match.ts` переиспользуется как есть, меняются лишь аргументы местами;
  тай-брейк — старые заявки выше (справедливость очереди).
- **Три канала:** (1) очередь; (2) **инвайт-ссылка эксперта** (`expert_invites`, токен из CSPRNG,
  публичная `/invite/[token]` → анкета в `reviewer_applications` с `invited_by`; аккаунт создаёт
  админ, проставляя `users.introduced_by`); (3) запрос в редакцию (`recruit_requests`) → доска.
- **SLA** (`src/lib/review-sla.ts`, решение владельца): **14 дней** без claim → эскалация
  (`channel` → `editorial`, уведомление админу); **21 день** молчания после claim → автовозврат
  заявки в очередь, `reviewLoad −1`, уведомления. Признак работы = вердикт/тред/сообщение чата
  после claim; heartbeat признаком НЕ считается. Роут — `/api/cron/review-sla` (Bearer, constant-time).
- **Рейтинг ревьюеров удалён целиком** (решение владельца). Взамен: SLA, приватная жалоба админу,
  счётчик объёма в профиле, отзыв возможности. `reviewer_ratings` и `users.reviewer_rating*` —
  legacy, не читаются.
- **Публичная доска** «Ищем ревьюеров» (`board_calls`, ведёт админ) + **заявки**
  (`reviewer_applications`, apply-to-review → админ принимает/отклоняет) — без изменений.

### Бейдж ревью — «награда на выходе» (binding; Фаза 14)
- **Выдаётся только в `closeReviewSession()`** (`src/lib/queries/review-session.ts`) — единственное
  место, где пишется кредит `reviewer_history`, освобождается `review_load` и замораживается уровень.
  Ни один роут не принимает уровень/дату бейджа из тела запроса.
- **Две точки вызова:** `publishRevision()` и verdict-роут при all-approve на УЖЕ опубликованной
  ревизии. Без второй точки ревью после публикации не давало бы ни кредита, ни бейджа, а
  `review_load` тёк бы навсегда.
- **Идемпотентность — на `chapter_revisions.review_closed_at`**, перечитываемом ВНУТРИ транзакции.
- **Уровень:** `invited`, если ВСЕ кредитованные ревьюеры приведены автором (`users.introduced_by`
  = его handle); иначе `independent`. Один независимый поднимает уровень всей ревизии. Значение
  замораживается — правка `introduced_by` задним числом прошлые бейджи не переписывает.
- **Бейдж главы привязан к НОМЕРУ ревизии** и иммутабелен; если проверенная ревизия старее текущей,
  читателю показывается «Проверена версия N от ‹дата› · текущая версия изменилась» со ссылкой
  `?v=N` на архивное чтение (только published-ревизии, `noindex` + canonical, комментарии и
  реакции подавлены).
- **`blogs.verified_at`/`verified_tier` — денормализация, ИСТОРИЧЕСКАЯ** (решение владельца):
  агрегат по всем проверенным ревизиям, правка главы его НЕ гасит (иначе исправленная опечатка
  выкидывала бы блог с главной). Пересчёт — `recomputeBlogVerified()`, БЕЗУСЛОВНО из обеих точек.
  Фильтрация главной по этим полям — Фаза 15, здесь только данные и поверхности.

### Витрина главной и «Выбор редакции» (binding; Фаза 15)
- **Главная — ВИТРИНА, а не каталог.** На неё попадает только блог с бейджем
  `verified_tier = 'independent'`. Уровень `invited` («проверено приглашённым экспертом») — это
  прозрачность, а не пропуск: такой блог открывается по прямой ссылке, индексируется и виден в
  профиле автора, но витрину не получает (З-19/З-24).
- **Каталог никуда не делся** — `/?view=all` показывает ВСЁ опубликованное, с сортировкой
  (`?sort=new|verified|top`) и пагинацией (`?page=N`), заменившими жёсткий срез `others.slice(0,4)`.
- **Страховка пустой витрины (R-2):** пока проверенных меньше `SHOWCASE_MIN_VERIFIED` (=3), витрину
  ведёт редакция — `blogs.featured_at`, экран `/admin/featured`, дата ставится СЕРВЕРОМ.
  Нет ни проверенных, ни закреплённых → **пустое состояние со ссылкой на каталог**; отката на
  «показать всё подряд» НЕТ (решение владельца).
- **«Подписки» витринной политикой не фильтруются**: подписка — явный выбор читателя.
- ⚠️ Фильтр витрины живёт в `src/lib/queries/showcase.ts` (+ чистые правила `src/lib/showcase.ts`),
  а НЕ в `getReadableChapters`: тот — общий предок пяти поверхностей, и фильтр в нём схлопнул бы
  `sitemap.xml`, профиль автора и закладки.
- **SEO расходится намеренно:** `feed.xml` — только проверенное (по бейджу РЕВИЗИИ,
  `FeedFilter.verifiedOnly`), `sitemap.xml` — всё опубликованное.

### Жалобы и модерация (binding; Фаза 15)
- До Ф15 жалобу было **невозможно создать**: роута не было, кнопки не было, единственный
  `insert(reports)` жил в сиде (З-51). Теперь цикл замкнут: `POST /api/reports` → уведомление
  админу (`report_filed`) → разбор в `/admin/reports`.
- **Три цели** (`REPORT_TARGET_TYPES`): `comment`, `blog`, `review`. Тип типизирован — раньше
  свободная строка печаталась в админке «как есть» (З-61).
- **`review` — приватная жалоба на ревьюера**, замена снесённому в Ф14 рейтингу: доступна только
  УЧАСТНИКУ сессии главы и только на другого участника; «о ком» — `reports.about_handle`.
- **Гейт — `requireUser()`, не возможность**: жалуется любой аккаунт. `commentingBlocked` жалобу
  НЕ блокирует (она приватна и полезна редакции) — не «унифицировать» с `commentGate`.
- ⚠️ **Единый 404** и для «цели нет», и для «жаловаться нельзя»: иначе роут становится оракулом
  существования скрытых блогов и удалённых комментариев. Дедуп — одна ОТКРЫТАЯ жалоба на цель
  от одного автора (проверка внутри транзакции), rate-limit 1/10с.
- Разбор: `resolve` · `delete_comment` · `hide_blog` (скрытие блога и закрытие жалобы ОДНОЙ
  транзакцией). Действие обязано соответствовать типу цели, иначе 400.

### Админ-портал после Фазы 15
- **Разделы:** Модерация (Жалобы · Ревью глав · Заявки ревьюеров) · Люди (Пользователи) ·
  Платформа (**Выбор редакции** · Доска ревьюеров · Баннеры · Пожертвования).
- **Свой колокол** (`getAdminNotifications`, `/api/admin/notifications{,/read}`): у админ-сессии нет
  `userId`, а admin-строки лежат с `recipient_id IS NULL` — общий роут отвечал бы ей 401.
  Компонент `NotificationBell` ОДИН, параметризован `feedUrl`/`readUrl` (двойник разошёлся бы
  по a11y и e2e-локаторам).
- **Очередь заявок** на `/admin/review` + **ручное назначение** (подстраховка холодного старта):
  идёт через ОБЩИЙ `claimReviewRequest()` (`src/lib/queries/review-claim.ts`) — тот же, что у
  claim'а ревьюера. Копия гейтов запрещена: именно так в Ф14 всплыли непроверяемая ёмкость (З-06)
  и гонка двух claim'ов.
- **Read-only просмотр ревью** — `/admin/review/[chapterId]`. ⚠️ `resolveReviewAccess` НЕ трогать:
  он намеренно 401-ит админа, и на нём стоят 8 мутирующих роутов. «Только чтение» обеспечено
  отсутствием мутирующих поверхностей, а не послаблением гарда; `ReviewScreen` переиспользовать
  нельзя (heartbeat + ActionBar).
- **Журнал снятий** — `getRemovedReviewers()` (был написан в Ф10 и не вызывался ни разу, З-55).
- **Фильтры пользователей** (`?q=`/`?cap=`/`?status=`/`?sort=`) считаются в SQL, а не в JS.

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

### Профиль, «Рабочее место», настройки (Фаза 13.5–13.7)
- **Публичный профиль `/u/[slug]` — ЕДИНЫЙ и есть у любого аккаунта.** 404 только у
  заблокированного/несуществующего. «Пустой» профиль (ни публикаций, ни ревью) отдаётся, но с
  `robots: noindex` и вне `sitemap.xml`. Табы: «О себе» (био + компетенции + портфолио) ·
  «Блоги (N)» (при N>0) · **«Ревью (N)»** (только при `is_reviewer` — ревью-активность публична,
  решение владельца, реверс прототипа). Чипы возможностей — множественные. Рейтинг ★ из профиля
  убран (снос рейтинга целиком — Ф14). Секции — RSC (`profile-sections.tsx`), табы — клиент.
- **`/workspace`** — приватный хаб: карточки кабинетов по возможностям + «Требует внимания» +
  подвал «Аккаунт». Карточки администратора НЕТ (админ env-based). Иконка-замок из прототипа
  НЕ портирована — только текстовые подписи. Токен `--private` (+`-bg`/`-border`).
- **`/settings`** — канонический адрес редактирования профиля; та же форма (`profile-form.tsx`)
  открывается модалкой «Изменить профиль» на своём `/u/` (⚠️ реверс uif-6 П3). Мутация —
  `PATCH /api/profile`: строгий allowlist `displayName|bio|links|competencies`, правит ТОЛЬКО себя,
  ссылки только `^https?://` (и с непустым хостом), компетенции — лишь при `is_reviewer`
  (флаг перечитывается из БД). Аватар доступен любому аккаунту отсюда.

### Дизайн-система
- Шрифты: **Lora** (заголовки), **Literata** (текст), **Fira Code** (код) — `next/font`, subsets
  `latin`+`cyrillic`. Акцент — **teal**; **`--private`** (индиго) — только приватные поверхности
  «Рабочего места». Тонкие границы, **без теней**. Тёмная/светлая темы.
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

Прод — VPS `https://recenza.ru` (Ubuntu 24.04; Cloudflare-прокси → Caddy → Node standalone →
systemd `recenza.service`; БД — локальный SQLite `/srv/recenza/shared/data/blog.prod.db`).
Полный runbook/layout — `ENVIRONMENTS.md` §6; Cloudflare (DNS, оранжевое облачко, SSL Full strict,
DPI-инцидент 2026-07-11, продление LE-сертификата) — §6.6.

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
- **Ф14: заявка вместо приглашений.** `POST /api/author/chapters/[id]/review-request` создаёт
  `review_requests(open)` и ставит `review_status='requested'`; `chapter_reviewers` наполняет ТОЛЬКО
  claim (`POST /api/reviewer/requests/[id]/claim`, `reviewLoad +1`, `review_status → 'in-review'`).
  Все downstream-гейты (verdict/threads/chat/инбокс/очередь) опираются на `chapter_reviewers` —
  это и есть главная экономия фазы: смена способа НАЗНАЧЕНИЯ их не задела.
  Закрытие сессии (`closeReviewSession`) делает `reviewLoad −1` и переводит заявку в `done`.
  ⚠️ Удалены (роуты отвечают 404): `POST /api/author/chapters/[id]/submit`, `POST /api/author/ratings`,
  `POST /api/review/[id]/primary-change`, `POST /api/admin/review/[id]/primary`,
  `POST /api/reviewer/invitations/[id]`. Модуль `src/lib/queries/invitations.ts` снесён.
  `submit-revision` переносит назначения на новую ревизию с обнулёнными вердиктами И **тащит за собой
  заявку** (`revisionNumber` → новый, срок молчания заново) — иначе она висела бы на устаревшем номере
  и SLA вернул бы в очередь работающего ревьюера.
  ⚠️ Ф13 (в силе): заявка обнуляет вердикты своей ревизии (фикс З-05); редактор не даёт править,
  пока ревью открыто (published — даёт, заводя черновик поверх).
- **Изображения — только путь `/uploads/`**; загрузка — `POST /api/uploads` (Фаза 12: kind
  `article|cover|donation|banner` → гейт author/admin; magic-bytes + 4МБ + ранний 413 по Content-Length;
  dev/test пишет в `public/uploads`, прод — `UPLOADS_DIR`, отдаёт Caddy). UI — `src/components/upload-field.tsx`.
- **`src/lib/slug.ts` — транслитерирующий slug** (НЕ кириллический `slugify` из
  `src/components/blocks/anchors.ts`); не перепутать.
- **Review-flow (Фаза 7) — POV серверный.** Доступ к `app/api/review/**` — через `resolveReviewAccess()`
  (`src/lib/queries/review.ts`): автор-владелец ИЛИ назначенный ревьюер. Вердикт — только ревьюер;
  apply/submit-revision/primary-change — только автор. Демо-дропдаута POV из прототипа нет.
  ⚠️ Ф13: **публикация вышла из review-flow** — это `POST /api/author/chapters/[id]/publish`
  (ownership, а не позиция в ревью-сессии). Review-`threads` ≠ публичные `public_comments` (Фаза 8) —
  разные таблицы/роуты; ревьюер участвует в ревью-тредах и **в публичных комментариях тоже**,
  кроме глав, которые ревьюит/ревьюил (конфликт интересов).
- **Apply-and-close правит блоки текущей ревизии на ревью in-place** (не плодит ревизии). Новые
  ревизии — «Отправить v{N+1}» (`submit-revision`: snapshot блоков, `prev_blocks`=последняя published,
  вердикты обнулены) **и правка опубликованной главы** (`PATCH` заводит черновик поверх, Ф13).
- **`router.refresh()` в клиентских ревью-действиях оборачивать в `startTransition`** — иначе он ловит
  Suspense-границу `loading.tsx`, ReviewScreen перемонтируется и теряет тост/локальный UI-стейт, а статус
  не обновляется без hard reload (`src/components/review/review-screen.tsx`). Кросс-экранный sync = поллинг
  (30с) + refresh; вебсокетов нет. Presence (Фаза 12) — heartbeat: ревьюер шлёт
  `POST /api/review/[id]/heartbeat` при открытии и в каждом поллинге; `online = last_seen_at ≥ now−90с`
  (деривация в `queries/review.ts`); typing-индикатора нет (backlog).
- **Публикация — единый `publishRevision()`** (`src/lib/queries/publish.ts`): его используют
  author-publish, admin force-approve и cron. ⚠️ Ф13: параметра `gate` НЕТ — ревью-гейт удалён,
  осталась одна race-safe перепроверка «ревизия ещё не published». ⚠️ Ф14: кредит, `reviewLoad −1`,
  бейдж и закрытие заявок уехали в `closeReviewSession()` — `publishRevision` зовёт его ПОСЛЕ
  проставления `status='published'` (бейдж выдаётся только опубликованной ревизии) и затем
  **безусловно** `recomputeBlogVerified()`: публикация непроверенной ревизии тоже меняет картину.
  Осталось здесь: fan-out `new_chapter` подписчикам **только при первой публикации главы**.
  Отложенная публикация: author-`publish`-роут принимает `{scheduledAt}` (или `null` для отмены),
  `/api/cron/publish` (Bearer `CRON_SECRET`, constant-time) публикует наступившие **только у последней
  ревизии**; при появлении новой ревизии план гасится в `submit-revision`/fork.
- **Частичный UNIQUE в SQLite — единственный в схеме** (`review_requests_chapter_rev_active_uq`,
  `WHERE status IN ('open','claimed')`). drizzle-kit его генерирует корректно (проверено: SQLite
  принимает и квалифицированное имя колонки в WHERE), но полагаться только на него нельзя — гейт
  «живая заявка уже есть» перепроверяется ВНУТРИ транзакции роута.
- **Метаданные главы версионируются (Ф14)**: читателю отдаются `chapter_revisions.title/skills`
  выбранной ревизии (COALESCE с `chapters.*`), автор правит `chapters.*` как рабочее значение,
  а `PATCH /api/author/chapters/[id]` пишет снапшот в ревизию во ВСЕХ ветках (форк из published,
  ветка гонки «черновик уже появился», in-place). Иначе бейдж «проверена версия N» врал бы:
  навыки и заголовок можно было бы поменять задним числом.
- **Прод-деплой (Фаза 12)**: standalone-сборка ТОЛЬКО с `BUILD_STANDALONE=1` (иначе ломается `next start`);
  `outputFileTracingExcludes` в `next.config.ts` ОБЯЗАТЕЛЕН — без него трейсер утаскивает `.env*`/`.git`/
  `blog.db` в артефакт (утечка секретов). Миграции на проде — `scripts/migrate.mjs` (drizzle-orm migrator;
  drizzle-orm докладывается в артефакт — Next бандлит его в чанки). Прод-env — systemd EnvironmentFile
  (БЕЗ `\$`-экранирования). Строго один Node-инстанс (in-memory rate-limit). На VPS рядом AmneziaWG
  в Docker (51820/udp, 51821/tcp) — ufw-правила не трогать.
- **Создание пользователей — только админом** (`POST /api/admin/users` + форма в «Люди»);
  self-registration нет по построению (альфа). ⚠️ Ф14: сюда добавлен `introducedBy` — от него зависит
  УРОВЕНЬ БЕЙДЖА, поэтому он валидируется как часть доверия: только админ, только существующий handle,
  никогда не сам на себя (иначе `independent` подделывается). ⚠️ Ф14: отзыв `isReviewer` через PATCH
  теперь ещё и ОСВОБОЖДАЕТ — возвращает взятые заявки в очередь, снимает назначения с открытых сессий
  и обнуляет `reviewLoad` (раньше назначение «висело», а счётчик тёк — backlog Ф13 P2).
  ⚠️ Ф13: вместо роли задаются **возможности**
  (чекбоксы `canAuthor`/`isReviewer`, обе выключены = читатель) и их можно менять позже —
  `PATCH /api/admin/users/[handle]`. Смена пароля пользователю — `password` там же
  (ui-feedback-3); активные сессии при этом НЕ гасятся (backlog; немедленный разлогин — бан).
- **Удаление блога автором** (`DELETE /api/author/blogs/[blogId]`, ui-feedback-3) — только полностью
  черновиковый блог: все ревизии всех глав `status='draft' AND review_status='none'` и
  `publishedAt IS NULL`, иначе 409 (⚠️ Ф13: одной проверки `draft` мало — глава на ревью тоже `draft`);
  гейт перечитывается ВНУТРИ транзакции (анти-TOCTOU). `public_comments`/`removed_reviewers` ссылаются по
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
- **ui-feedback-5**: **голоса — БЛОГОВЫЕ** (`blog_votes`; миграция 0006 сконвертировала chapter_votes
  по знаку суммы; роут `POST /api/blogs/[id]/vote`, старый chapters-роут удалён; intent-replay в
  `login-form.tsx` шлёт blogId — при смене vote-роута править ОБА места). **Engagement (голос/закладка/
  подписка) — у ЛЮБОГО аккаунта** (`requireUser()` без параметра в vote/bookmarks/follows;
  `/bookmarks` редиректит на `/login` только гостя). ⚠️ Формулировка «только роль reader» из
  ui-feedback-5 отменена Фазой 13 вместе с ролями — базовый уровень есть у всех; бар «Реакции» рендерится ОДИН раз
  НАВЕРХУ (с ui-feedback-6: whole — в шапке блога, глава — после h1/навыков ДО контента;
  `canEngage` = гость|reader; engagement считается страницей, НЕ в `buildReaderSections`).
  **Аватарки**: kind=avatar в `/api/uploads` (любой пользователь) + `PATCH /api/profile/avatar`
  (self, строго `/uploads/avatars/`); UI — `avatar-changer.tsx` (с ui-feedback-6 — ТОЛЬКО кнопка
  на своём `/u/…`; пункт меню убран, читателю сменить аватар негде — backlog);
  `Avatar` (review-primitives) принимает `src`. **Карусель крутится всегда** (reduced-motion гард
  снят — смена слайда мгновенная; пауза hover + точки/стрелки остаются). **Доска /board** — hero
  по прототипу (центр, метрики, «Список ведёт редакция»).
- **ui-feedback-6**: **админ-страница «Доска ревьюеров»** (`/admin/board`, раздел «Платформа») —
  форма создания направления ВСЕГДА раскрыта (`board-actions.tsx`; из recruit-actions Board*-
  компоненты убраны, «Заявки ревьюеров» = только запросы+отклики). **Автор без «Ленты»**: ссылки
  в шапке нет, в меню аватара — «Все мои блоги» → `/`, h1 каталога и крошка ридера для автора —
  «Все мои блоги». **«Изменить профиль» на `/u/` убран** — редактирование живёт в табе «Об авторе»
  (AuthorProfile). **Футер с тэглайном удалён** (AppFrame без `<footer>`).
- **Ф15: `/blog/[slug]` — ОГЛАВЛЕНИЕ, а не редирект** на первую главу (З-26). Тела глав там нет,
  дубликата контента не возникает, canonical остаётся `/blog/{slug}`; режим «Весь блог»
  (`?mode=whole`) сохранён как был. Пейджер «предыдущая/следующая глава» (`chapter-pager.tsx`)
  считается из уже загруженного `blog.chapters` — новых запросов ноль, ссылки ВСЕГДА канонические
  (из архивного `?v=N` уводить в архив соседней главы нельзя: у неё его нет).
- **Ф15: подвал вернулся** (`site-footer.tsx` в `AppFrame`) — но не тэглайновый из ui-feedback-6,
  а служебный: «О платформе» (`/about`) · «Как стать ревьюером» (`/board`) · RSS. Страница
  `/about` заведена вместе с ним: иначе пункт вёл бы на прод-блог `o-recenza`, которого нет
  на тест-стенде.
- **Ф15: гид (`guide-modal.tsx`) строится по ВОЗМОЖНОСТЯМ**, а не по «главной роли» — аккаунт с
  обеими видит оба кабинетных раздела; заголовок диалога «Ваши возможности» (у аккаунта без
  возможностей — «Гид читателя»). Тексты про «пригласите ревьюеров» переписаны под заявку/очередь
  Ф14, у читателя добавлен раздел про бейджи (З-27).
- **Комментарии (Фаза 8): глубина считается от 0** (`cmt_reply_reader` в seed — валидная глубина 2 = максимум).
  Ответ разрешён только если глубина родителя ≤1 (ответ на узел глубины 2 → `409`); проверка серверная
  (`src/app/api/comments/route.ts`), UI-флаг `canReply`/`depth<2` — вторичен. Листинг — **RSC**
  (`getChapterComments` в `src/lib/queries/comments.ts`), мутации — роуты `src/app/api/comments/**`; гейтинг —
  единый `commentGate` — ⚠️ он НЕ смотрит на роли (Ф13 сняла оба запрета): комментирует любой
  вошедший аккаунт, отказ даёт только `commentingBlocked` и конфликт интересов (глава, которую
  зритель ревьюит/ревьюил); гость и админ получают login-prompt,
  перепроверяется в каждом роуте. Ревизия штампуется сервером (`resolveCommentTarget`), не из клиента.
  Якоря-фрагменты скроллят к `[data-block-id]` (есть на каждом блоке, mode-независим) — НЕ к `id="block-…"`
  (он только у заголовков). Голос за коммент ресинкается через `key`-remount (не `useEffect`). Soft-delete:
  tombstone остаётся только при живых потомках; physical-delete нет (иначе `parentId` CASCADE снёс бы ответы).
