# Отчёт аудита окружения — Recenza — 2026-06-09

> Аудит проведён в роли «двойки» **Архитектор** (целостность модели, согласованность документов,
> полнота против прототипа) + **Фуллстек** (исполнимость на чистой машине, корректность стека).
> Прочитаны полностью: `CLAUDE.md`, `docs/migration/{PROMPT,PLAN,SETUP,ENVIRONMENTS,TESTING}.md`,
> `.claude/{settings.json,settings.local.json,rules/*,agents/*,skills/**/SKILL.md}`, `.mcp.json`,
> `.env.example`, `package.json`, `.gitignore`, `docs/prototype/README.md`,
> `docs/prototype/legacy-article-model-CLAUDE.md` + грепы по `docs/prototype/ui_kits/blog/*`.
> Топ-находки и внешние факты адверсариально верифицированы (read-only многоагентным проходом).

## 0. Статус устранения (применено 2026-06-09)

Все находки ниже **устранены в документации/обвязке** (код `src/` не создавался — работа в режиме
планирования; правки готовят пакет к запуску в Claude Code). Продуктовые решения, согласованные с владельцем:
- **Engagement (голос/закладка/подписка) — только роль `reader`** (P2-4); author/reviewer → 403.
- **Дедлайн ревизии удалён** намеренно (P2-8); зафиксировано в PLAN Фаза 5 + ENVIRONMENTS §4 (схема без `deadline`).
- **Отложенная публикация по cron удалена как легаси** (P2-2): убраны `/api/cron/publish`, `CRON_SECRET`,
  расписание `vercel.json` из PLAN Ф13, ENVIRONMENTS §2/§6, CLAUDE.md, `.env.example`, `next-app-router.md`.

Механические правки по файлам:
- **Env-изоляция (P0-1/P0-2):** `dotenv-cli` + `APP_ENV=test`; выбор БД `TURSO_*`→`APP_ENV` в `db/index.ts`/
  `drizzle.config.ts`; тест-скрипты обёрнуты в `dotenv -e .env.test` — `package.json`, ENVIRONMENTS §2/§3,
  SETUP Шаги 3–4, `.env.example`, `settings.json`.
- **FK/PRAGMA/slug (P1-2):** все FK → `*.id`; `public_comments`/`removed_reviewers` ключ `chapter_id`(+`revision_number`),
  slug денормализован; `PRAGMA foreign_keys=ON` — ENVIRONMENTS §4, PLAN Ф1, CLAUDE.md, `drizzle-queries.md`, `code-reviewer.md`.
- **Пароль админа (P1-3):** единый `admin-pass`; экранирование `$` и для PLAIN; `login.sh` читает из `.env.test`;
  env-ключи `BASE_URL`/`DB_PATH` (было `TEST_*`) — ENVIRONMENTS §2/§5, SETUP, `playwright-tester.md`, `settings.json`.
- **Легаси `playwright-tester.md` (P1-1):** полностью переписан под глава-модель и пути `.claude/`.
- **`latex`-блок (P2-1):** добавлен в enum (12 типов; «14» = пункты меню) — CLAUDE.md, PLAN Ф1, `mdx-components.md`.
- **Пин блога (P2-3):** `users.pinned_blog_id` — ENVIRONMENTS §4, PLAN Ф1/Ф5, seed §5.
- **Чат сессии без эталона (P2-10):** под-спека в PLAN Фаза 6 + пометка в TESTING REV-SESSION-CHAT.
- **Per-block вердикт (P2-9) / статус блока (P2-11):** зафиксированы как эфемерные/вычисляемые (не хранятся).
- **Скиллы (P2-6):** примечания о неполном бандле + Figma N/A. **Прочие агенты (P2-7):** легаси-термины,
  битые ссылки, security-чеклист (ownership/assignment/binding), легаси-шрифты в design-watcher.
- **Пути PROMPT/SETUP (P2-12):** `docs/prototype/...`, `SKILL.md`, `legacy-article-model-CLAUDE.md`.
- **P3:** `.gitignore` WAL/SHM; `test:smoke`/`test:critical` в allow; POSIX-note в SETUP Шаг 0; redirect-307-нюанс;
  intent-replay `comment`/`follow`; `.auth`-путь.

Ниже сохранён исходный аудит (находки + цитаты + матрицы) как обоснование правок.

## 1. Резюме
**Вердикт: ТРЕБУЕТ ПРАВОК.** Фазу 0 начать можно, но на Фазе 2 изоляция стендов и вся тест-обвязка
сломаются как написано. Безопасность гейтинга — со спорной точкой (матрица ролей) и слабым чеклистом
security-агента.

**21 находка:** 2 блокера (P0), 4 серьёзных (P1), 12 значимых (P2), косметика (P3) — отдельным списком.

Два корня большинства проблем:
1. **Env-механика стендов не разведена** — ни один скрипт не подключает `.env.test`, нет выбора
   `blog.test.db`; `next dev` всегда `NODE_ENV=development`.
2. **Легаси-зараза из статейной версии** — `playwright-tester.md` и (мягче) остальные агенты/скиллы
   ссылаются на article-модель (`articles`, `articleVersions`, `/api/articles`, `coverImageUrl`,
   пути `.agents/...`), которой в глава-модели нет.

Все цитаты проверены прямым чтением; внешние факты — со ссылками (см. находки).

## 2. Находки

### [P0-1] Тестовый стенд не получает `.env.test` / `blog.test.db` — изоляция недостижима
- **Где:** `package.json:5,13,15`; `ENVIRONMENTS.md` §1 (стр. 20-22), §2 (стр. 52), §3 (стр. 64-65); `SETUP.md` Шаг 3 (стр. 48-53); `.env.example:12-16`
- **Нашёл:** Фуллстек · **verdict: confirmed**
- **Проблема:** `"dev:test": "npm run seed:test && next dev -p 3001"`, `"seed:test": "tsx src/lib/db/seed-test.ts"`. `next dev` жёстко ставит `NODE_ENV=development` → Next грузит `.env.local`/`.env.development`, но **не** `.env.test` (его Next грузит только при `NODE_ENV=test`). `tsx` env-файлы не грузит. `dotenv-cli` не установлен (SETUP Шаг 3) и не вызывается. ENVIRONMENTS §2:52 — выбор БД «по `NODE_ENV`/флагу», но под `next dev` оба стенда = development, флага нет. → стенд на :3001 молча работает на `blog.db`/dev-секретах, ломая инвариант ENVIRONMENTS §1:20-22 («тесты НИКОГДА не ходят на blog.db»).
- **Доказательство:** `package.json:5` `"dev:test": "npm run seed:test && next dev -p 3001"`; `ENVIRONMENTS.md:52` «…→ `file:blog.db` (dev) или `file:blog.test.db` (test, по `NODE_ENV`/флагу)»; `SETUP.md:48-53` (в списке зависимостей нет dotenv/dotenv-cli).
- **Патч:** установить `dotenv-cli` (добавить в SETUP Шаг 3 `npm i -D dotenv-cli`) и в `package.json`:
  ```jsonc
  "dev:test":  "dotenv -e .env.test -- npm run _seedtest && dotenv -e .env.test -- next dev -p 3001",
  "_seedtest": "tsx src/lib/db/seed-test.ts",
  "seed:test": "dotenv -e .env.test -- tsx src/lib/db/seed-test.ts",
  ```
  ИЛИ ввести явный `APP_ENV=test`, читаемый в `db/index.ts` для выбора `blog.test.db`, и грузить
  `.env.test` через `import 'dotenv/config'` в самих tsx-скриптах. В `ENVIRONMENTS.md §2` заменить
  «по NODE_ENV/флагу» на конкретный механизм.

### [P0-2] `test:reset` мигрирует не ту БД / падает до Фазы 1; обходит ask-гейт
- **Где:** `package.json:15`; `ENVIRONMENTS.md` §3 (стр. 67), §6 (стр. 221); `PLAN.md` Фаза 1 (стр. 91,94); `.claude/settings.json:11,20`
- **Нашёл:** Фуллстек · **verdict: confirmed**
- **Проблема:** `"test:reset": "drizzle-kit migrate && npm run seed:test"`. `drizzle-kit migrate` берёт `dbCredentials` из единственного `drizzle.config.ts` — ничто не нацеливает его на `blog.test.db` (fallback в `db/index.ts` работает только в рантайме приложения, не в CLI drizzle-kit). До Фазы 1 нет `schema.ts`/папки миграций → команда падает. Доп.: `settings.json` `allow: "Bash(npm run test:reset)"` при `ask: "Bash(npx drizzle-kit migrate)"` — `test:reset` авто-пропускает ask-гейт на migrate (лазейка после Фазы 1).
- **Доказательство:** `package.json:15`; `.claude/settings.json:11` (allow `npm run test:reset`) vs `:20` (ask `npx drizzle-kit migrate`); миграций в репозитории нет (Фаза 1 их только создаёт, `PLAN.md:91`).
- **Патч:** отдельный таргет для теста — `"test:reset": "dotenv -e .env.test -- drizzle-kit migrate --config=drizzle.config.ts && dotenv -e .env.test -- npm run seed:test"` с env-driven `dbCredentials.url` в `drizzle.config.ts` (читает `TURSO_*` → иначе `file:${APP_ENV==='test'?'blog.test.db':'blog.db'}`). Согласовать ask-политику: либо убрать `test:reset` из allow, либо явно задокументировать намеренный пропуск.

### [P1-1] `playwright-tester.md` — легаси article-модель и неверные пути `.agents/`
- **Где:** `.claude/agents/playwright-tester.md:51-52,80,84,86-90,94-189,162-165,264-273,318`; ср. `.claude/settings.json:14`; `ENVIRONMENTS.md` §4-5; `SETUP.md` Шаг 4 (стр. 61-62)
- **Нашёл:** оба · **verdict: confirmed**
- **Проблема (кластер):**
  - **Пути `.agents/...`** (стр. 51-52,94,102,124…) — проект использует `.claude/...`; `settings.json:14` разрешает только `Bash(bash .claude/playwright-tester/*)`. Скрипты по `.agents/...` не найдутся и не разрешены.
  - **Легаси-таблицы** (стр. 162-165): `articles, article_versions, review_assignments, review_comments, article_votes, subscriptions, article_changelog` — в глава-модели их нет.
  - **Легаси-эндпоинты** `/api/articles` (стр. 142-147,159,264-273).
  - **Легаси-инварианты** (стр. 86-90): `coverImageUrl`, `publicComments.articleVersionId onDelete restrict`, «Admin не создаёт статьи».
  - **Пароль `dhome$32`** (стр. 80,124,206) ≠ SETUP `admin-pass` (Шаг 4) → admin-логин не сойдётся.
  - **«после фазы 24+»** (стр. 318) — в плане 14 фаз (0–13).
  - **Скилл `.agents/skills/playwright-cli`** (стр. 52) не существует.
- **Доказательство:** `playwright-tester.md:162-165` «Имена таблиц в SQLite: `articles`, `article_versions`, …»; `:84` «`coverImageUrl` начинается с `/uploads/`»; `:318` «после фазы 24+»; `settings.json:14` `Bash(bash .claude/playwright-tester/*)`.
- **Патч:** переписать под глава-модель (см. **карту замен** в §4): пути `.claude/playwright-tester/`, таблицы/эндпоинты/инварианты заменить, убрать «фаза 24» и `playwright-cli`, пароль синхронизировать с SETUP. (Ссылки на `testing/*` и `*.sh` — это форвард-артефакты Фаз 2/10/11, оставить.)

### [P1-2] Несогласованные FK (handle vs id) + ключи по slug → осиротевшие строки; FK-pragma off
- **Где:** `ENVIRONMENTS.md` §4 (стр. 94-149,152-157); `PLAN.md` Фаза 1 (стр. 88), Фаза 5 (стр. 187); `.claude/rules/drizzle-queries.md:19`; `CLAUDE.md` (gotcha PRAGMA)
- **Нашёл:** Фуллстек · **verdict: confirmed** (+ внешняя проверка libsql)
- **Проблема:** review-таблицы FK на `users.handle` (`chapters.primary_handle`, `chapter_reviewers.handle`, `reviewer_history.handle`, `threads.from_handle`, `thread_replies.from_handle`, `review_chat.from_handle`, `follows.user_handle`), а engagement/comments/blogs — на `users.id` (`blogs.author_id`, `*_votes.user_id`, `bookmarks.user_id`, `public_comments.author_id`, `portfolios.author_id`, `reports.reporter_id`). `public_comments` ключуется `blog_slug+chapter_slug+revision`, `removed_reviewers` — `blog_slug+chapter_slug+handle` (строки, не FK). Editor разрешает override slug (Фаза 5:187) → переименование slug/handle осиротит комментарии и логи. **Внешне подтверждено:** в SQLite/libsql `PRAGMA foreign_keys` по умолчанию **off** и устанавливается на каждое соединение; libsql ведёт себя неодинаково в file/remote/replica-режимах — объявленные `CASCADE`/`SET NULL` **не сработают** без явного `PRAGMA foreign_keys=ON` (sqlite.org/foreignkeys.html; libsql issue #764).
- **Доказательство:** `ENVIRONMENTS.md:94` `primary_handle→users.handle` vs `:127` `author_id→users(SET NULL)`; `:127,149` ключи по `blog_slug/chapter_slug`; `PLAN.md:187` «slug авто+override»; `drizzle-queries.md:19` «в SQLite PRAGMA foreign_keys может быть выключен».
- **Патч:** унифицировать все FK на `users.id` (`handle` — мутабельное отображаемое поле, не ключ); `public_comments`/`removed_reviewers` ключевать `chapter_id`(+`revision_number`) как FK, slug хранить денормализованно; в `db/index.ts` выполнять `PRAGMA foreign_keys=ON` на каждое соединение и проверить, что в `file:` режиме каскады реально срабатывают.

### [P1-3] `ADMIN_PASSWORD_HASH` ↔ `ADMIN_PASSWORD_PLAIN` рассинхрон + `$`-ловушка + deny Read(.env.test)
- **Где:** `SETUP.md` Шаг 4 (стр. 61-62); `ENVIRONMENTS.md` §2 (стр. 45), §5 (стр. 174,197); `playwright-tester.md:80`; `.claude/settings.json:27,31-34`
- **Нашёл:** оба · **verdict: confirmed**
- **Проблема:** SETUP хеширует `admin-pass` и пишет `ADMIN_PASSWORD_PLAIN=admin-pass`; ENVIRONMENTS §2 и агент используют `dhome$32`. (1) хеш для `admin-pass` ≠ паролю `dhome$32` → 401 в тестах. (2) `dhome$32` содержит `$` → dotenv-expand интерпретирует `$32` как переменную (экранирование задокументировано только для хеша). (3) `settings.json deny Read(.env.test)` (стр. 27), но флоу логина `login.sh admin "$ADMIN_PASSWORD_PLAIN"` (ENVIRONMENTS §5:174) требует значения; `env`-блок (стр. 31-34) даёт `TEST_BASE_URL`/`TEST_DB_PATH`, но не `ADMIN_PASSWORD_PLAIN` → в Bash-сессии пусто.
- **Доказательство:** `SETUP.md:61-62` (`admin-pass`); `ENVIRONMENTS.md:45` «(напр. dhome$32)»; `playwright-tester.md:80` «`dhome$32`»; `settings.json:27` `Read(.env.test)` в deny.
- **Патч:** один источник пароля во всех доках (рекомендую `admin-pass` без `$`); добавить правило экранирования `$` и для `ADMIN_PASSWORD_PLAIN`; `login.sh` пусть сам `source .env.test` (чтение файла программой не нарушает deny на tool `Read`), либо прокидывать plain через переменную окружения тест-прогона.

### [P2-1] Тип блока `latex` отсутствует в каноническом enum (11 типов vs заявленные «14»)
- **Где:** `Editor2.jsx:41,66,82,306`; `README.md` §1 (стр. 38), §9 (стр. 444), §5 (стр. 288 «14 types»); `CLAUDE.md` (block.type), `PLAN.md` Фаза 1 (стр. 86), `ENVIRONMENTS.md` §4, `.claude/rules/mdx-components.md`
- **Нашёл:** Архитектор · **verdict: confirmed**
- **Проблема:** прототип имеет 12-й тип `latex` (`Editor2.jsx:66 {type:"latex",hint:"$$"}`, `:82 case "latex"`, `:306 /^\$\$/→latex`), README §9 называет его «LaTeX block», но enum в CLAUDE/PLAN/ENVIRONMENTS — 11 типов без `latex`; при этом все три заявляют «14 типов» слэш-меню (фактически 12 items). → latex-блок негде персистить.
- **Доказательство:** `Editor2.jsx:66` `{ type: "latex", title: "LaTeX-формула", hint: "$$" }`; `PLAN.md:86` «…`mermaid/image/table/embed`» (без latex).
- **Патч:** добавить `latex` в `block.type` во всех трёх документах и `mdx-components.md`; привести «14» к фактическому числу типов; либо явно решить, что LaTeX рендерится инлайн через remark-math (тогда убрать тип из редактора).

### [P2-2] Cron-публикация «отложенных глав»: нет поля-расписания **и** `* * * * *` падает на Vercel Hobby
- **Где:** `PLAN.md` Фаза 13 (стр. 386,393); `ENVIRONMENTS.md` §6 (стр. 227-229); `CLAUDE.md` (Cron); `chapter_revisions` (ENVIRONMENTS §4:97-100); ср. `legacy-article-model-CLAUDE.md:99,205-209` (`scheduledAt`)
- **Нашёл:** оба · **verdict: confirmed** (+ внешняя проверка Vercel)
- **Проблема:** (а) `/api/cron/publish` для «отложенных глав», но в `chapter_revisions` нет `scheduled_at`/`publish_at` — cron'у нечего выбирать (в глава-прототипе отложенной публикации нет; она была в статейной модели). (б) **Внешне подтверждено:** на Vercel **Hobby** допустимы только cron «раз в сутки»; выражение `* * * * *` (каждую минуту) **провалит деплой** (per-minute — только Pro/Enterprise; точность Hobby — почасовая ±59мин). Источник: vercel.com/docs/cron-jobs/usage-and-pricing.
- **Доказательство:** `ENVIRONMENTS.md:229` `{"path":"/api/cron/publish","schedule":"* * * * *"}`; `chapter_revisions` (§4:97-100) — только `submitted_at, published_at`; Vercel docs: «Hobby accounts are limited to cron jobs that run once per day. Cron expressions that would run more frequently will fail during deployment.»
- **Патч:** решить судьбу фичи. Если нужна — добавить `chapter_revisions.scheduled_at` (unix, nullable, валидация «в будущем», гейт «все approve») и поставить **дневное** расписание (или перейти на Pro для per-minute). Если не нужна в глава-модели — удалить cron-публикацию из Фазы 13/ENVIRONMENTS (cron-инфру можно оставить под будущее).

### [P2-3] Пин блога — механика без колонки в схеме
- **Где:** `Author-v2.jsx:62,97,100,302,419`; `data.js:616-631` (`window.__pins`); `Index-v2.jsx:607-618`; `PLAN.md` Фаза 5 (стр. 181)
- **Нашёл:** Архитектор · **verdict: confirmed**
- **Проблема:** автор закрепляет **один** блог («Закрепить как портфолио», сортировка вперёд + кольцо, всплытие на публичном профиле). `__pins` = `map[handle]=slug`. PLAN Фаза 5 описывает поведение, но в `blogs`/`users` нет колонки пина.
- **Доказательство:** `data.js:631` `isPinned: function (handle, slug) { return map[handle] === slug; }`; `Author-v2.jsx:100` `onTogglePin={() => window.__pins?.set(me, b.slug)}`; `PLAN.md:181` «пин блога сортирует вперёд + кольцо».
- **Патч:** `users.pinned_blog_id → blogs.id (SET NULL)` (один пин/автор); упомянуть в Фазе 5 и ENVIRONMENTS §4.

### [P2-4] Матрица ролей: engagement автора/ревьюера противоречит binding-гейтингу (затрагивает безопасность)
- **Где:** `TESTING.md` §2 (стр. 41-42); `PROMPT.md:34-36`; `CLAUDE.md` (Ролевой гейтинг, стр. 57); `ENVIRONMENTS.md` §4 (стр. 157)
- **Нашёл:** Архитектор · **verdict: confirmed**
- **Проблема:** TESTING §2 даёт автору и ревьюеру «Голос/закладка/подписка ✅», но: автор не видит чужие блоги (изоляция) → не может их голосовать/закладывать и «не голосует за свои главы» (ENVIRONMENTS §4:157); ревьюер связан «только рецензирует» (CLAUDE.md). Право engagement для author/reviewer нигде явно не специфицировано — матрица (источник истины для тестов и гейтинга) противоречит binding. Риск: реализация/тесты разойдутся по тому, кто может голосовать.
- **Доказательство:** `TESTING.md:41` «| Голос/закладка/подписка | →login | ✅ | ✅ | ✅ | — |»; `CLAUDE.md:57` «**Читатель** … голосует, закладывает, подписывается»; `ENVIRONMENTS.md:157` «Автор не голосует за свои главы».
- **Патч:** зафиксировать единое правило до Фазы 3 (рекомендация: engagement — только роль reader; author/reviewer его не имеют). Привести TESTING §2 в соответствие; добавить в CLAUDE-матрицу столбцы явно.

### [P2-5] `settings.json` env-ключи не совпадают с тем, что читают скрипты
- **Где:** `.claude/settings.json:32-33`; `ENVIRONMENTS.md` §5 (стр. 174,183); `playwright-tester.md:97-98`
- **Нашёл:** Фуллстек · **verdict: confirmed**
- **Проблема:** настройки экспортируют `TEST_BASE_URL`/`TEST_DB_PATH`, а скрипты ждут `BASE_URL`/`DB_PATH` → переменные не долетают.
- **Доказательство:** `settings.json:32-33` `"TEST_BASE_URL"`, `"TEST_DB_PATH"`; `ENVIRONMENTS.md:174` `BASE_URL=… bash …login.sh`, `:183` `DB_PATH=blog.test.db bash …db-query.sh`.
- **Патч:** переименовать в `settings.json` в `BASE_URL`/`DB_PATH` (или научить скрипты читать `TEST_*` с fallback).

### [P2-6] Скиллы ссылаются на отсутствующий собственный бандл
- **Где:** `qa-test-planner/SKILL.md:3,91-92,179-182,385-450`; `playwright-best-practices/SKILL.md:24-189`; факт (`git ls-files`): в каждой папке только `SKILL.md`
- **Нашёл:** Фуллстек · **verdict: confirmed**
- **Проблема:** обе скилл-карты — индексы без контента: `./scripts/*.sh`, `references/*.md`, десятки `core/*.md`/`advanced/*.md`/`testing-patterns/*.md` не существуют. `qa-test-planner` к тому же Figma-центричен, а Figma MCP не подключён (`.mcp.json` — только playwright).
- **Доказательство:** `playwright-best-practices/SKILL.md:24` ссылка на `core/test-suite-structure.md` и т.д.; `qa-test-planner/SKILL.md:3` «Includes Figma MCP integration»; `.mcp.json` — единственный сервер `playwright`.
- **Патч:** донести бандл-файлы скиллов ИЛИ переписать `SKILL.md` самодостаточно (контент инлайном). В `qa-test-planner` пометить Figma-секции как неприменимые/удалить.

### [P2-7] Прочие агенты — остаточные article-термины, битые ссылки, слабый security-чеклист
- **Где:** `code-reviewer.md:38,66,79,84,91`; `seo-optimizer.md:29,35,45`; `security-reviewer.md:30,40`; `design-watcher.md:31,89`
- **Нашёл:** оба · **verdict: confirmed**
- **Проблема:** code-reviewer: «при обновлении **статьи** → снимок в **articleVersions**» (стр. 38,66), примеры `articles/[id]`, `article-card`. seo-optimizer: «articles table» (стр. 29), title-template «Название блога» (стр. 35) vs правило `%s | Recenza`. security-reviewer: «один admin-пользователь» (стр. 30); чеклист (стр. 40) проверяет только `requireAdmin()` — **не** покрывает author-ownership (`blog.authorId===session.userId`), reviewer-assignment и role-binding (reviewer-не-комментирует, автор-не-в-чужих) — ключевые инварианты продукта. design-watcher: читает `docs/design/impeccable.md` (стр. 31, не существует — легаси-скилл), пример `article-card.tsx` (стр. 89).
- **Доказательство:** `code-reviewer.md:38` «при обновлении статьи — сначала снимок в articleVersions»; `seo-optimizer.md:29` «Статьи хранятся в БД (articles table)»; `security-reviewer.md:30` «один admin-пользователь»; `design-watcher.md:31` «docs/design/impeccable.md … (если существует)».
- **Патч:** заменить термины на главу/`chapter_revisions`; расширить чеклист security-reviewer пунктами ownership/assignment/binding; design-watcher → ссылаться на `.claude/rules/frontend-design.md`; seo title-template → `%s | Recenza`.

### [P2-8] `deadline`: код прототипа и SQL-эскиз имеют, README §5/PLAN/схема — нет (против правила «извлекай из кода»)
- **Где:** `Editor3.jsx:143,190-191,259,281-282,342,588,751,766,786`; `Review-v2-main.jsx:453`; `README.md` §5 (стр. 286 «No deadline field»), §8 (стр. 398 `deadline TIMESTAMPTZ`); `PLAN.md` Фаза 5 (стр. 189); `ENVIRONMENTS.md` §4 (стр. 97-100, без deadline); `PROMPT.md:54`
- **Нашёл:** Архитектор · **verdict: confirmed**
- **Проблема:** живой `Editor3` (EditorScreen) полноценно использует deadline (инпут, draft, submit→`revision.deadline`) и README §8 SQL-эскиз содержит `deadline TIMESTAMPTZ`. Но README §5 прозой и PLAN Фаза 5 говорят «без дедлайна», а схема ENVIRONMENTS §4 колонку не содержит. Решение принято молча и **нарушает директиву PROMPT:54 «Извлекай поведение из кода, а не из памяти»**.
- **Доказательство:** `Editor3.jsx:281` `value={deadline}`, `:766` `revision:{… deadline: deadlineTs}`; `README.md:286` «No deadline field»; `PLAN.md:189` «Без поля дедлайна».
- **Патч:** явно зафиксировать решение в PLAN Фаза 5 + ENVIRONMENTS §4 («дедлайн намеренно удалён в проде, см. README §5») ЛИБО вернуть `chapter_revisions.deadline`.

### [P2-9] Per-block `BlockVerdictStamp` (approve/fix/discuss) — нет места в схеме
- **Где:** `Review-v2.jsx:136,149-159,254,308-339,475-476`; ср. `PLAN.md` Фаза 6 (стр. 208,213); `ENVIRONMENTS.md` §4 (`chapter_reviewers.verdict` — на ревизию, не на блок)
- **Нашёл:** Архитектор (discovery) · **verdict: confirmed**
- **Проблема:** в ConvoCanvas ревьюер циклит вердикт **на каждом блоке** (approve/fix/discuss) — `blockVerdicts` (локальный стейт `Review-v2.jsx:136`). Схема хранит вердикт только на уровне ревизии (`chapter_reviewers.verdict`). Per-block вердиктам негде персистить — если они должны переживать перезагрузку, нужна колонка/таблица.
- **Доказательство:** `Review-v2.jsx:136` `blockVerdicts` (local); `PLAN.md:213` «BlockVerdictStamp циклом approve/fix/discuss» (без указания хранилища); ENVIRONMENTS §4 — нет per-block колонки.
- **Патч:** решить: либо per-block stamp эфемерен (тогда явно отметить в PLAN Фаза 6), либо добавить хранение (поле `verdict` внутри элемента `blocks[]` JSON, или таблица `block_verdicts(chapter_id, revision_number, block_id, handle, verdict)`).

### [P2-10] `review_chat` (акцентный кластер «чат сессии») — есть в схеме/плане/тестах, но **нет UX-эталона** в прототипе
- **Где:** `README.md` §1 (стр. 27 `chat: ChatMsg[]`), §4 (стр. 200-240 — в ConvoCanvas только треды+композер, чата нет); `ENVIRONMENTS.md` §4 (`review_chat`); `PLAN.md` Фаза 6 (стр. 219); `TESTING.md` §3.1 REV-SESSION-CHAT (стр. 65)
- **Нашёл:** Архитектор (discovery) · **verdict: confirmed**
- **Проблема:** «чат сессии» — один из трёх обязательных акцентных кластеров (ТЗ, PROMPT:75-76). Схема (`review_chat`), план (Фаза 6) и тест-кейс (REV-SESSION-CHAT) есть, но **в прототипе нет UI чата** (Review-v2.jsx не рендерит chat; в §4 диаграмме его нет). Разработчик строит акцентную фичу без эталона — риск расхождения с замыслом.
- **Доказательство:** `README.md:27` «chat: ChatMsg[] ← session chat»; `README.md:222-233` ThreadsRail+Composer (без отдельного чата); `Review-v2.jsx` — UI чата отсутствует.
- **Патч:** добавить в PLAN Фаза 6 явную под-спеку UX чата сессии (расположение, отделение от тредов, presence/typing) ИЛИ задание спроектировать его, раз прототип-эталона нет; либо понизить REV-SESSION-CHAT до «спроектировать+проверить».

### [P2-11] Статус блока (`added`/`edited`) для инлайн-диффа — не в плане и без места в схеме
- **Где:** `Review-v2.jsx:173-177,202,212,231`; `blogs-data.js:64,67-70` (`status:"edited"/"added"`); ср. `PLAN.md` Фаза 6 (стр. 213 `diffWords(prev,curr)`); `ENVIRONMENTS.md` §4 (`blocks` JSONB без поля status)
- **Нашёл:** Фуллстек (discovery) · **verdict: confirmed**
- **Проблема:** прототип хранит `status` на блоках (`blogs-data.js:64 status:"edited"`) и рисует по нему diff-полосы. План же предполагает дифф **вычислять** из `prev_blocks` (`diffWords`). Не определено: статус блока — вычисляемый (из `prev_blocks`) или персистится? Если нужно персистить — нет колонки.
- **Доказательство:** `blogs-data.js:67` `{ id:"b2-diag", type:"mermaid", status:"added", … }`; `Review-v2.jsx:173` проверки `block.status === 'added'`; `PLAN.md:213` `инлайн-дифф diffWords(prev,curr)`.
- **Патч:** явно выбрать модель: «статус вычисляется из `prev_blocks` через diffWords» (тогда задокументировать в Фазе 6 и не хранить) ИЛИ добавить `status` в элемент `blocks[]`.

### [P2-12] Пути в PROMPT/SETUP не совпадают с реальной раскладкой
- **Где:** `PROMPT.md:49,53,59-60,97`; `SETUP.md:39`; факт: `docs/prototype/README.md`, `docs/prototype/legacy-article-model-CLAUDE.md`, `docs/prototype/ui_kits/blog/*`, `.claude/skills/*/SKILL.md`
- **Нашёл:** Архитектор · **verdict: confirmed**
- **Проблема:** промт указывает источники по несуществующим путям: `/recenza-prototype/README.md`, `/recenza-prototype/ui_kits/blog/*.jsx`, `/recenza-prototype/uploads/CLAUDE.md`, скилл `SKILL-d54f14eb.md`. Исполнитель промта файлы не найдёт.
- **Доказательство:** `PROMPT.md:49` «`README.md` прототипа (`/recenza-prototype/README.md`)»; `PROMPT.md:97` «`playwright-best-practices` (из `SKILL-d54f14eb.md`)»; `SETUP.md:39` `SKILL-d54f14eb.md`.
- **Патч:** заменить на `docs/prototype/README.md`, `docs/prototype/legacy-article-model-CLAUDE.md`, `docs/prototype/ui_kits/blog/*`, `.claude/skills/playwright-best-practices/SKILL.md`.

### P3 — косметика/мелочи (кратко)
- `.gitignore` не игнорит `*.db-wal`/`*.db-shm` (libsql WAL) — могут попасть в гит. **Патч:** добавить обе маски.
- `next-best-practices` числится готовым в `CLAUDE.md` (`.claude/skills/`), но не создан (`PROMPT.md:98` «создай»). Согласовать формулировку.
- `test:smoke`/`test:critical`/`start` есть в `package.json:19-20,7`, но не в ENVIRONMENTS §3/PLAN Фаза 2/permissions — задокументировать или убрать.
- POSIX-зависимости тест-скриптов (`/tmp`, `/dev/null`, `python3`, `bash`, `sqlite3` CLI) — на win32-машине разработчика нужны git-bash + установка `sqlite3`/`python3` (CI на Linux — ок). Отметить в SETUP Шаг 0.
- intent-replay для `comment`/`follow` (`App.jsx:392`, `BlogReader.jsx:212`) не перечислен явно (Фаза 4 DoD — только vote/bookmark). Добавить в Фазу 4/7.
- `SETUP.md:64` `.gitignore: /.auth` vs реальный `/testing/e2e/.auth/` — выровнять текст.
- «note ревьюерам» (Editor3 `note`) сабмитится как `revision.summary` (`Editor3.jsx:766`) — «заметка ревьюерам» и «changelog summary» схлопнуты в одно поле; уточнить терминологию (одно поле осознанно или нужны два).
- Тест «редирект → 307» (TESTING §4:97, playwright-tester:312) — **корректен** (Next 16 `redirect()` = 307; 308 только у `permanentRedirect()`), но e2e должен дёргать `/admin` прямым GET без JS и без follow-redirects, иначе RSC-стриминг отдаст meta-refresh, а Server Action — 303. Добавить нюанс в спек.

## 3. Матрица покрытия акцентных сценариев
| Сценарий | Фаза(PLAN) | Тест-кейс(TESTING) | Спек(§6) | Seed(ENV §5) | Дыра? |
|---|---|---|---|---|---|
| Ревью одной главы (тред→suggestion→apply→approve→publish) | 6 | REV-CHAPTER | review-chapter.spec | главы во всех статусах + тред c suggestion | нет |
| Ревью всего блога (мульти-главы) | 6 | REV-WHOLE-BLOG | review-whole-blog.spec | блог с разными статусами | нет |
| **Чат сессии (multi-user)** | 6 | REV-SESSION-CHAT | session-chat.spec | review_chat | **ДА: нет UX-эталона в прототипе — P2-10** |
| Смена ведущего | 6,9 | REV-PRIMARY | (admin/flows) | primary_change_requests | частично: нет отдельного spec в §6 |
| Кредит по версиям (v2) | 4,6 | REV-VERSIONS / PUB-CHAPTER-V2 | publish.spec | reviewer_history (2 версии) | нет |
| Публикация черновика | 5,6 | PUB-DRAFT | publish.spec | draft-глава | нет |
| Публикация в каталог/ленту | 4 | PUB-ARTICLE | publish.spec | published + подписки | нет |
| Публикация профиля/портфолио без ревью | 8 | PUB-PROFILE/PORTFOLIO | publish.spec | портфолио visible/hidden | нет |
| Коммент читатель↔автор↔читатель | 7 | COM-THREAD | comment-thread.spec | нить чит→автор→чит | нет |
| Коммент к старой ревизии (спойлер) | 7 | COM-STALE | comment-thread.spec | коммент к старой ревизии | нет |
| Окно правки 15 мин | 7 | COM-EDIT-WINDOW | (comment-thread) | в окне и вне | нет |
| Гейтинг ролей (403/редиректы) | 3,7 | COM-GATING + §2 | guest/…/admin.spec | все 4 роли | **спорно — engagement (P2-4)** |
| Пин блога (профиль) | 5 | — | — | — | **ДА: нет TC/seed/колонки — P2-3** |
| LaTeX-блок | 5 | — | — | — | **ДА: нет типа — P2-1** |
| Per-block вердикт | 6 | — | — | — | **ДА: нет хранилища — P2-9** |
| Отложенная публикация (cron) | 13 | — | — | — | **ДА: нет поля + падает на Hobby — P2-2** |
| intent-replay (vote/bookmark) | 4 | TC-GUEST | guest.spec | — | частично (comment/follow — P3) |

## 4. Сводная таблица согласованности + карта замен легаси
| Артефакт | Истина (где определён) | Где упомянут | Расходится в |
|---|---|---|---|
| Имена таблиц | ENVIRONMENTS §4 (глава-модель) | CLAUDE.md, PLAN Ф1 | `playwright-tester.md:162-165` (легаси `articles/…`) |
| Пути обвязки | `.claude/…` (settings, факт) | SETUP, ENVIRONMENTS §5 | `playwright-tester.md` (`.agents/…`) |
| Пароль админа | SETUP `admin-pass` | — | ENVIRONMENTS §2 / agent `dhome$32` |
| env-ключи стенда | скрипты `BASE_URL/DB_PATH` | ENVIRONMENTS §5, agent | `settings.json` `TEST_BASE_URL/TEST_DB_PATH` |
| block.type | enum 11 типов (CLAUDE/PLAN/ENV) | mdx-rule «14» | прототип `latex` (Editor2) — 12-й |
| deadline | PLAN/ENV §4 (нет) | README §5 (нет) | Editor3 код + README §8 SQL (есть) |
| Скрипты npm | `package.json` | ENVIRONMENTS §3, PLAN Ф2, CLAUDE | `db:generate/db:migrate/test:smoke/test:critical/start` лишние/недок. |
| Источники-пути | факт `docs/prototype/…` | — | PROMPT/SETUP `/recenza-prototype/…`, `SKILL-d54f14eb.md` |
| Engagement-права | binding (reader-only) | PROMPT/CLAUDE | TESTING §2 (author/reviewer ✅) |
| env-механика стенда | — (не определена) | ENVIRONMENTS §2 «по NODE_ENV/флагу» | package.json (нет dotenv/флага) |

**Карта замен легаси → глава-модель** (для патчей агентов/скиллов):
`articles`→`blogs`+`chapters`; `articleVersions`→`chapter_revisions`(`prev_blocks`); `review_assignments`/`reviewSessions`→`chapter_reviewers`; `review_comments`→`threads`+`thread_replies`+`review_chat`; `article_votes`→`chapter_votes`; `subscriptions`→`follows`; `article_changelog`→(нет; кредит — `reviewer_history`); `coverImageUrl`→`cover_url`; `articleVersionId`→`blog_slug+chapter_slug+revision`; `difficulty(…,hard)`→`complexity(…,complex)`; verdict `approved|needs_work|rejected`→`approve|request-changes`; пути `.agents/`→`.claude/`; «статья»→«глава/ревизия».

## 5. Что НЕ проверял (честно)
- Команды не запускал (plan mode) — патчи предложены, не исполнены. Предлагаю прогнать после Фазы 0:
  `npm run build`, `npm run lint`, и сухой `npx drizzle-kit generate` после Фазы 1.
- `index.html` (11.5k строк, инлайн прототипа) не читал построчно — это сгенерированная сборка из
  канонических `*.jsx`/`*.js` (README §7); проверял источники.
- Разрешено: **frontmatter сабагентов** (`disallowedTools/maxTurns/memory/effort/background/color/model/tools`)
  — по докам Claude Code **все валидны** (не находка).
- Разрешено внешне: **Vercel cron** (`* * * * *` падает на Hobby — см. P2-2), **libsql FK pragma**
  (каскады не сработают без `PRAGMA foreign_keys=ON` — см. P1-2), **Next redirect** (307 верно — см. P3).
- Не проверял реальные данные seed (скриптов ещё нет) — оценивал по требованиям ENVIRONMENTS §5.

## 6. Топ-5 правок (риск/усилие)
1. **[P0-1]** Развести env стендов (`dotenv-cli` + флаг `APP_ENV`/выбор БД в `db/index.ts`) — без этого изоляция фиктивна.
2. **[P0-2]** Нацелить `test:reset`/`drizzle-kit migrate` на `blog.test.db` (env-driven config) и закрыть ask-лазейку.
3. **[P1-1]** Переписать `playwright-tester.md` под глава-модель и пути `.claude/` (карта замен §4) — иначе вся тест-обвязка нерабочая.
4. **[P1-2]** Унифицировать FK на `users.id`, slug-ключи → FK, включить `PRAGMA foreign_keys=ON` (иначе тихая потеря строк).
5. **[P1-3]** Синхронизировать пароль админа + экранирование `$` + доступ к `ADMIN_PASSWORD_PLAIN` (иначе admin-логин в тестах не работает).
