# PLAN.md — Миграция Recenza в Claude Code

Фазовый план миграции дизайн-прототипа **Recenza** (многоглавный девблог с редакционным
ревью) в поддерживаемый **production-монолит на Next.js 16**.

> **Этот файл — живой журнал проекта.** Фазы запускаются в **отдельных сессиях**. Весь прогресс
> фиксируется **здесь**: у каждой фазы есть поле **Статус** и блок **Журнал фазы**. Сессия начинается
> с чтения этого файла, чтобы увидеть готовое (предыдущие фазы) и предстоящее (следующие).

**Сопутствующие документы:** `PROMPT.md` (промт запуска проекта + промт запуска одной фазы),
`CLAUDE.md` (целевая архитектура), `ENVIRONMENTS.md` (стенды + флоу БД), `DESIGN-TOKENS.md` (токены — источник правды),
`TESTING.md` (тест-кейсы + Playwright), `docs/prototype/README.md` (UX-эталон прототипа).

---

## Как читать и вести этот план

Каждая фаза имеет фиксированную структуру (см. **Шаблон фазы** ниже): `Статус · Контекст входа ·
Разблокирует · Старт сессии · Цель · Подфазы/Todo · Скиллы и агенты · Цикл качества · DoD ·
Журнал фазы · Что дальше`.

**Статусы фаз** (обновляй поле «Статус» прямо в этом файле):
- `todo` — не начата.
- `in progress` — в работе (укажи, какие подфазы закрыты).
- `blocked` — заблокирована (обязательно опиши причину в Журнале: что/где сломано).
- `done` — весь DoD выполнен, цикл качества зелёный, Журнал заполнен.

**🔴 Правило блокировки (критично).** Если хотя бы одна фаза в статусе `blocked` — **запрещено
начинать новые фазы**. Сначала устранить блокировку. **Блокирующие баги (которые ломают сборку,
тест-стенд или сквозной флоу) имеют наивысший приоритет — чинить немедленно**, до любой другой
работы. Только после возврата фазы в `in progress`/`done` можно двигаться дальше.

**Закрытие фазы.** Фаза закрывается ТОЛЬКО когда: (1) весь её DoD выполнен; (2) **Цикл качества**
(блокирующий гейт) — зелёный; (3) поле «Статус» = `done` и **Журнал фазы** заполнен (решения,
отклонения, backlog, риски). `npm run build` — необходимое, прохождение профильных тестов на
тестовом стенде — достаточное условие.

**Принципы на весь проект:**
- Монолит. Один Next.js-репозиторий, без выделенных сервисов.
- Доменная модель — **глава-ориентированная** (Blog → Chapter → Revision → blocks), по `README.md` §1–2, §8, §11.
- Два стенда обязательны: **тестовый** (3001, `blog.test.db`) и **продовый** (Turso/Vercel).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       
- Все БД — миграциями Drizzle. Timestamps — Unix seconds. ID — `ulid()`. JSON — только в `try/catch`.
- Интерфейс на русском. Эстетика: Lora/Literata/Fira Code, teal-акцент, тонкие границы, без теней.

---

## Карта фаз

| # | Фаза | Слой | Статус |
|---|------|------|--------|
| 0 | Окружение и репозиторий (bootstrap, запускается первой) | Инфраструктура | `done` |
| 1 | Архитектура Claude Code + токены | Инфраструктура | `done` |
| 2 | Доменная модель и схема БД | Данные | `done` |
| 3 | Два стенда + seed + флоу БД | Инфраструктура | `done` |
| 4 | Auth, роли, гейтинг + UI-обвязка ролей | Платформа | `done` |
| 5 | Читательский слой (публичный) | Продукт | `done` |
| 6 | Авторский слой: кабинет, редактор, портфолио | Продукт | `done` |
| 7 | Редакционный review-flow (ReviewPage) | Продукт | `done` |
| 8 | Комментирование (читатель↔автор↔читатель) | Продукт | `done` |
| 9 | Подбор ревьюеров, согласие, оценка | Продукт | `done` |
| 10 | Админка, модерация и монетизация | Продукт | `done` |
| 11 | Слой качества: тест-кейсы + Playwright | Качество | `done` |
| 12 | Hardening + прод-деплой | Релиз | `done` |
| 13 | Единый аккаунт, профиль и свободная публикация | Платформа | `done` |
| 14 | Ревью 2.0: заявки, каналы, бейджи | Продукт | `done` |
| 15 | UX читателя/автора и кабинет администратора | Продукт | `done` |

> При смене статуса фазы обнови и ячейку в этой таблице, и поле «Статус» в самой фазе — они должны совпадать.

---

## Сабагенты и скиллы (вызывать по именам)

В фазах ниже указано явно: **«вызови сабагента X»** / **«примени скилл Y»**. Реестр:

**Сабагенты (`.claude/agents/`):**
- **`code-reviewer`** — ревью diff по 5 категориям (P0 безопасность → P3 UX). Гейт: нет P0/P1.
- **`security-reviewer`** — аудит auth/инъекций/секретов/cookie/валидации. Гейт: 0 критических.
- **`design-watcher`** — визуальная консистентность (hardcoded-цвета, Lora/Literata/Fira, тени, aria, dark). Только UI-фазы.
- **`seo-optimizer`** — metadata, OG, заголовки, sitemap/robots/canonical. Только фазы с публичными страницами.
- **`playwright-tester`** — прогон E2E (smoke/targeted/регресс), вердикт GO/NO-GO. Знает два стенда.

**Скиллы (`.claude/skills/`):**
- **`qa-test-planner`** *(есть)* — тест-планы, тест-кейсы, регресс-наборы, баг-репорты. Фаза 11.
- **`playwright-best-practices`** *(есть)* — локаторы, ожидания, POM, фикстуры, auth, CI. Фаза 11.
- **`next-best-practices`** *(есть)* — async/await `params`, RSC-границы, конвенции route handler, кэш. Применять во всех кодовых фазах.
- **`drizzle-schema`** *(есть)* — конвенции схемы: `snake_case`, `ulid()` PK, Unix seconds, JSON в `try/catch`, `uniqueIndex` для race-safe toggle, FK+каскады. Фазы 2, 3, 9, 10.
- **`review-flow-domain`** *(есть)* — инварианты ревью: главы/ревизии, ведущий (primary), вердикты на handle, кредит по версиям, apply-and-close, согласие/приглашения. Фазы 7, 9.
- **`security-checklist`** *(есть)* — повторяемый чеклист безопасности (auth-гейтинг на каждом роуте, валидация ввода, CSRF same-origin, rate-limit, санитизация MDX/HTML, секреты из env). Применять в **Цикле качества** каждой кодовой фазы вместе с `security-reviewer`.

> Все шесть скиллов уже лежат в `.claude/skills/` — фазы их применяют, не создают заново.

---

## Шаблон фазы

> Копия структуры, которой следует **каждая** фаза. Цикл качества — **самодостаточный чеклист внутри
> фазы** (намеренно дублируется, чтобы сессия не зависела от чтения других разделов).

```
## Фаза N — Название
**Статус:** todo            ← держи в синхроне с таблицей «Карта фаз»
**Контекст входа.** Требует фаз [..] (должны быть `done`). Читать: §README […], ENVIRONMENTS §[…].
**Разблокирует.** Фазы [..].
**Старт сессии.** Открой этот файл: проверь статусы всех фаз. Если есть `blocked` — стоп, чини её
  (правило блокировки). Прочитай эту фазу целиком + перечисленные источники. Заведи todo по подфазам.
  Полный ритуал — «Промт запуска фазы» в PROMPT.md.

**Цель.** …
**Подфазы / Todo.** (чекбоксы; крупные фазы разбиты на N.1, N.2, … — их можно делать в одной сессии)
**Скиллы и агенты.** Примени скилл …; по ходу — …

### Цикл качества (блокирующий гейт — фаза не закрывается, пока не зелено)
- [ ] `npm run build` зелёный, `npm run lint` чистый
- [ ] Применён скилл `next-best-practices` (+ `security-checklist`) к новому коду
- [ ] Сабагент `code-reviewer` на diff: нет P0/P1 (P2/P3 → backlog в Журнале)
- [ ] Сабагент `security-reviewer` на затронутом: 0 критических
- [ ] [UI-фазы] Сабагент `design-watcher`: токены/шрифты/тени/aria/dark/хит-таргеты — без P0
- [ ] [публичные страницы] Сабагент `seo-optimizer`: title/description/OG/canonical
- [ ] Сабагент `playwright-tester`: smoke на затронутых флоу = GO
- [ ] Обновлены поле «Статус» и «Журнал фазы» в этом файле

**DoD.** (чекбоксы — критерии готовности по существу)

**Журнал фазы.** (заполняется по ходу и при закрытии)
- Статус-история: todo → in progress (дата/сессия) → done
- Принятые решения и отклонения от плана:
- Доработки сверх плана:
- Backlog (P2/P3, отложенные пробелы):
- Риски / заметки для следующих фаз:

**Что дальше.** Фаза N+1 — …
```

---

## Фаза 0 — Окружение и репозиторий (bootstrap)

**Статус:** `done`
**Контекст входа.** Запускается **первой**, сразу после того как файлы кита вложены в папку. Отдельный
промт — «Промт запуска Фазы 0» в `PROMPT.md`. Читать: этот блок, `README.md` (С чего начать), `ENVIRONMENTS.md`.
**Разблокирует.** Фазу 1 и все остальные (без рабочего каркаса, env и репозитория двигаться нельзя).
**Старт сессии.** В папке уже лежат файлы кита (`CLAUDE.md`, `.claude/`, `docs/`, конфиги), но нет
каркаса Next.js и `node_modules`. Цель — довести до запускаемого состояния и залить в GitHub.

**Цель.** Полностью настроить окружение: каркас Next.js поверх уже вложенного кита, зависимости,
`.gitignore`, env-файлы с секретами, git-репозиторий и первый пуш в GitHub. После Фазы 0 проект
запускается и готов к Фазе 1.

**Подфазы / Todo.**
- [ ] **0.1 Каркас поверх кита.** `create-next-app` НЕ работает в непустой папке — поэтому: создать
      каркас во временной папке (`npx create-next-app@latest .next-scaffold --ts --app --tailwind --src-dir --import-alias "@/*" --eslint`),
      затем перенести из неё `src/`, `next.config`, `tsconfig`, `postcss`, `eslint`, `public/` и т.п.
      **не перезаписывая** вложенные `CLAUDE.md`, `.claude/`, `docs/`, `.env.example`, `.mcp.json`, `.gitignore`.
      Удалить временную папку.
- [ ] **0.2 package.json.** Влить блок `scripts` и devDeps из вложенного `package.json` в сгенерированный
      (не заменять целиком). Удалить служебные ключи-комментарии (`_comment`, `_env`, …) из финального файла.
- [ ] **0.3 Зависимости.** `npm i @libsql/client drizzle-orm iron-session bcryptjs ulid next-themes next-mdx-remote rehype-pretty-code shiki`
      и `npm i -D drizzle-kit tsx @playwright/test dotenv-cli`, затем `npx playwright install`.
- [ ] **0.4 .gitignore.** Проверить/дополнить: `.env.local`, `.env.test`, `.env*.local`, `blog.db`,
      `blog.test.db`, `*.db-journal`, `node_modules/`, `.next/`, `/testing/reports/`, `/testing/e2e/.auth/`,
      `.next-scaffold/`. **Секреты и БД никогда не коммитятся.**
- [ ] **0.5 Env + секреты.** `cp .env.example .env.local` (`DB_FILE_NAME=blog.db`) и `.env.test`
      (`DB_FILE_NAME=blog.test.db`). Сгенерировать `SESSION_SECRET` (32+ байта) и `ADMIN_PASSWORD_HASH`
      (bcrypt; `$`→`\$`); в `.env.test` — `ADMIN_PASSWORD_PLAIN`, соответствующий хэшу. **Пароль админа
      спросить у пользователя**, не выдумывать. Файлы НЕ коммитить (gitignore).
- [ ] **0.6 Git + GitHub.** Репозиторий: **`https://github.com/denjamin-ai/recenza`** (права на пуш, ветки,
      PR и пуш в `main` выданы). `git init` (если нужно), `git remote add origin git@github.com:denjamin-ai/recenza.git`
      (или https). Первый коммит кита+каркаса в `main` (стартовый bootstrap-коммит — допустимо прямо в `main`).
      `git push -u origin main`. Перед коммитом — `git status`, убедиться что `.env.local`/`.env.test`/`*.db`
      НЕ в индексе. Если доступа/remote нет — **спросить пользователя**. Дальше по проекту — **git-flow ниже**.

> **Git-flow (со следующей фазы).** Стартовый bootstrap Фазы 0 коммитится прямо в `main`. Начиная с
> Фазы 1 каждая фаза идёт через ветку и PR:
> ```bash
> git checkout main && git pull origin main
> git checkout -b phase-<N>-<краткое-имя>          # напр. phase-1-tokens
> # … работа по подфазам + Цикл качества …
> git add -A && git commit -m "phase <N>: <что сделано>"   # атомарные коммиты по подфазам тоже ок
> git push -u origin phase-<N>-<краткое-имя>
> gh pr create --base main --title "Фаза <N>: <название>" --body "<DoD + что в Журнале>"
> # после зелёного Цикла качества:
> gh pr merge --squash --delete-branch         # права на мерж в main выданы
> git checkout main && git pull origin main
> ```
> Правила: одна фаза = одна ветка = один PR; имя ветки `phase-<N>-<slug>`; squash-merge в `main`;
> ветку после мержа удалять; **секреты и `*.db` никогда не коммитить**; PR закрывать только при зелёном
> Цикле качества фазы. Блокирующий баг (правило блокировки) — отдельная ветка `hotfix-<slug>` с
> приоритетным PR.

**Скиллы и агенты.** Спец-агентов не требуется. По завершении — `security-reviewer` (быстрый проход:
секреты не в индексе, `.gitignore` корректен).

### Цикл качества (блокирующий гейт)
- [ ] `npm run dev` поднимает каркас на :3000; `npm run build` зелёный; `npm run lint` чистый
- [ ] `git status` чист от секретов и БД (`.env*`, `*.db` — игнорируются, не в индексе)
- [ ] Первый коммит запушен в `main` репозитория `denjamin-ai/recenza` (или явно отложено — отметить в Журнале)
- [ ] Вложенные файлы кита (`CLAUDE.md`, `.claude/`, `docs/`) не перезаписаны каркасом
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [ ] С нуля: `git clone` → `npm i` → `npm run dev` поднимает приложение (пустой каркас, без ошибок).
- [ ] `.env.local`/`.env.test` существуют с валидными секретами; в репозитории их нет.
- [ ] Репозиторий на GitHub содержит кит + каркас, без секретов и БД-файлов.

**Журнал фазы.**
- Статус-история: `todo` → `in progress` (2026-06-21, сессия Фазы 0) → `done` (2026-06-21).
- Решения/отклонения:
  - **Ветка `main`, не `master`.** Репозиторий уже был инициализирован (ветка `main`, upstream
    `origin/main`, remote `https://github.com/denjamin-ai/recenza.git`), а не пустой `git init`, как
    предполагал план. По решению владельца оставили `main`; упоминания `master` в `CLAUDE.md`,
    `README.md`, `PLAN.md`, `PROMPT.md` заменены на `main` (git-flow со следующей фазы — ветки от `main`).
  - **История.** Предыдущий коммит `2e5cf3f delete old version` снял весь kit с трекинга (`HEAD` = пустое
    дерево). Bootstrap-коммит Фазы 0 переносит kit обратно в трекинг + добавляет каркас — обычный коммит
    поверх истории, а не «первый».
  - **Временный каркас — `next-scaffold/` (без точки).** `create-next-app` запрещает имя проекта,
    начинающееся с точки (`.next-scaffold`), поэтому использовали `next-scaffold/`; в `.gitignore`
    добавлены оба варианта. Папка удалена после переноса.
  - **`npm run lint` = `eslint`.** Next 16 удалил `next lint`; взяли `lint: "eslint"` из каркаса
    (а не kit-овский `next lint`). В `eslint.config.mjs` в `globalIgnores` добавлены `docs/**` и
    `next-scaffold/**` — прототип/эталоны под `docs/` это не код приложения и линту не подлежат.
  - **Каркас проверялся `build` + `lint`** (по решению владельца): `npm run dev` в `.claude/settings.json`
    в `deny`, чтение `.env*` запрещено — поэтому `next dev` на :3000 не запускали. `npm run build`
    (Next 16.2.9, Turbopack) — зелёный; `npm run lint` — чисто.
  - **Скаффолд-артефакты не переносили:** сгенерированные `CLAUDE.md` (= `@AGENTS.md`) и `AGENTS.md`
    каркаса не трогали — kit-овский `CLAUDE.md` авторитетен. `next-env.d.ts` добавлен в `.gitignore`
    (стандарт Next, регенерируется).
  - **Секреты.** `.env.local`/`.env.test` сгенерированы скриптом (значения не попали в stdout/транскрипт):
    `SESSION_SECRET` по 64 символа на стенд; `ADMIN_PASSWORD_HASH` — bcrypt(пароль владельца),
    `$`→`\$`; `.env.test` содержит `ADMIN_PASSWORD_PLAIN`, соответствующий хэшу (проверено `compareSync`).
    Оба файла в `.gitignore`, в индекс не попадают.
- Backlog:
  - `npm audit`: ~6 moderate-уязвимостей в транзитивных dev-зависимостях (`drizzle-kit`/tooling).
    Не критично для bootstrap; разобрать в Фазе 12 (hardening, `npm audit`).
  - Стек зафиксирован: Next 16.2.9, React 19.2.4, Tailwind v4, ESLint 9, TS 5.
- Риски для следующих фаз:
  - Next 16: `next lint` отсутствует — все фазы используют `npm run lint` (`eslint`); CI настраивать
    под `eslint`, не `next lint`.
  - Tailwind v4 — CSS-first (нет `tailwind.config` по умолчанию). Токены Фазы 1 заводить в
    `src/app/globals.css` через `@theme`/CSS-переменные + `postcss.config.mjs` (`@tailwindcss/postcss`).
  - `.next/` игнорируется паттерном `.next/` (срабатывает после первого build — каталог создаётся им).

**Что дальше.** Фаза 1 — архитектура Claude Code + токены (каркас уже готов).

---

## Фаза 1 — Архитектура Claude Code + токены

**Статус:** `done`
**Контекст входа.** Требует Фазу 0 (`done`) — каркас, зависимости, env и репозиторий готовы. Читать:
`PROMPT.md`, `CLAUDE.md`, `DESIGN-TOKENS.md`, `ENVIRONMENTS.md`, `README.md` §1–2.
**Разблокирует.** Все продуктовые фазы (без токенов и проверенной обвязки работать нельзя).
**Старт сессии.** Проверь статусы; Фаза 0 должна быть `done` (есть рабочий `npm run dev`). Заведи todo по подфазам.

**Цель.** Подключить дизайн-токены, проверить и адаптировать всю «обвязку Claude Code» (правила,
сабагенты, скиллы, Playwright MCP), чтобы дальше работать дисциплинированно и проверяемо.

**Подфазы / Todo.**
- [ ] **1.1 Обвязка Claude Code (проверка).** `CLAUDE.md` в корне; `.claude/rules/` (`security.md`,
      `next-app-router.md`, `drizzle-queries.md`, `mdx-components.md`, `frontend-design.md`); сабагенты
      (`playwright-tester`, `code-reviewer`, `security-reviewer`, `design-watcher`, `seo-optimizer`); скиллы
      (`qa-test-planner`, `playwright-best-practices`, `next-best-practices`, `drizzle-schema`,
      `review-flow-domain`, `security-checklist`) — **уже вложены**. Проверь, что они валидны и под глава-модель.
- [ ] **1.2 Playwright MCP.** Проверить, что `mcp__playwright__*` доступны (тестовый `browser_navigate` на `about:blank`).
- [ ] **1.3 Дизайн-токены.** Перенеси все токены из **`DESIGN-TOKENS.md`** (источник правды) в
      `src/app/globals.css` значение в значение: шрифты (Lora/Literata/Fira Code через `next/font`,
      subsets `latin`+`cyrillic`), teal-акцент, семантические цвета, поверхности, тёмная/светлая темы
      (`html[data-theme]`), типо-шкала/радиусы/рельсы; анимации только на `transform`/`opacity` +
      `prefers-reduced-motion`. Tailwind-конфиг мапит `fontFamily.{sans,display,mono}` на эти переменные.
- [ ] **1.4 Базовый layout + тема.** Корневой layout (`lang="ru"`), `next-themes` провайдер, переключатель
      темы, скелет публичной оболочки на токенах (без бизнес-функционала).

**Скиллы и агенты.** Примени скилл `next-best-practices`. По завершении — `design-watcher` на токенах.

### Цикл качества (блокирующий гейт — фаза не закрывается, пока не зелено)
- [ ] `npm run dev` поднимает каркас; `npm run build` зелёный; `npm run lint` чистый
- [ ] Применён скилл `next-best-practices` (RSC-границы, конвенции проекта)
- [ ] Сабагент `code-reviewer`: нет P0/P1 (P2/P3 → backlog в Журнале)
- [ ] Сабагент `security-reviewer`: нет утечек секретов в репозиторий, `.env*` в `.gitignore`
- [ ] Сабагент `design-watcher`: hardcoded-цветов нет, переключатель темы работает
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [ ] В корне есть `CLAUDE.md`; `.claude/{rules,agents,skills}` заполнены и валидны.
- [ ] Playwright MCP отвечает (тестовый `browser_navigate` на `about:blank` проходит).
- [ ] Дизайн-токены подключены, тема переключается, hardcoded-цветов нет.

**Журнал фазы.**
- Статус-история: `todo` → `in progress` (2026-06-22, сессия Фазы 1) → `done` (2026-06-22).
- Решения/отклонения:
  - **Темизация через `html[data-theme]`.** `next-themes` с `attribute="data-theme"`,
    `defaultTheme="system"` + `enableSystem` — селектор `html[data-theme="dark"]` в `globals.css`
    совпадает с выводом провайдера. **Scaffold-блок `@media (prefers-color-scheme: dark)` удалён**
    (иначе тёмная ОС перебивала бы ручной выбор «светлая»); системную тему резолвит next-themes.
    `suppressHydrationWarning` на `<html>` (провайдер мутирует атрибут до гидрации).
  - **Гидрационный гард `ThemeToggle` — `useSyncExternalStore`, не `setState`-в-эффекте.**
    Новый eslint-rule `react-hooks/set-state-in-effect` (React 19) запрещает классический
    `useEffect(() => setMounted(true))` — заменён на SSR-false / client-true через `useSyncExternalStore`.
  - **Шрифты — переменные (variable) Lora/Literata/Fira Code** через `next/font/google`,
    subsets `latin`+`cyrillic`, имена next/font — `--ff-*`; токенные стеки `--font-display/--font-sans/--font-mono`
    в `:root`. Утилиты Tailwind `font-*` регистрируются в `@theme inline` ссылкой на `--ff-*`
    (а не самоссылкой `var(--font-*)`) — поправлено по ревью, убрана хрупкость.
  - **Отклонение от DESIGN-TOKENS: вес h1 = 700, не 800.** Переменная-ось Lora (Google Fonts)
    ограничена 700; 800 недостижим. Зафиксировано комментарием в `globals.css` (`--weight-h1: 700`).
  - **Tailwind v4 CSS-first:** токены — `@theme inline` (цвета/шрифты) + `@custom-variant dark`
    на `[data-theme="dark"]` (задел под `dark:`-утилиты); JS-конфига `tailwind.config` нет (решение Фазы 0).
  - **Подфаза 1.1:** `.claude/rules/frontend-design.md` реконсилирован к DESIGN-TOKENS.md
    (`--font-lora/literata/fira` → `--font-display/sans/mono`; тёмный акцент `#2dd4bf` → `#4a9d92`) —
    источник правды авторитетен; иначе `design-watcher` ловил бы ложные срабатывания в фазах 4–12.
  - **`.claude/settings.json`:** `Bash(npm run dev)` перенесён `deny`→`allow` (по согласованию
    с владельцем) — для живой проверки темы через Playwright MCP. `Read(.env*)` и `rm -rf` — в `deny`.
  - **`.gitignore`:** добавлен `.playwright-mcp/` (локальные артефакты MCP не коммитятся).
  - Удалены boilerplate-svg из `public/` и шрифты Geist.
- Доработки сверх плана:
  - **Витрина токенов** (`page.tsx`) вместо create-next-app boilerplate: типошкала, акцент,
    поверхности (границы, не тени), статус-чипы, моно-slug + stagger `.animate-in`.
  - По ревью: `ring-offset-2` на интерактиве, skip-link `focus:fixed`, дедуп `antialiased`,
    один `<h1>` на странице (образец H1 — стилизованный `<p>`).
- Backlog (P2/P3):
  - **(P3)** Единый источник стека шрифтов `--stack-*`, если дублирование fallback в
    `:root`/`@theme inline` начнёт мешать.
  - **(P3)** Витринная «Акцентная кнопка» без `onClick` — заменить на реальный элемент/`disabled`,
    когда появятся компоненты.
  - **(P3)** Фавикон/брендинг (пока дефолтный next favicon) — отдельная задача брендинга.
  - **(P2, унаследовано)** `npm audit`: ~6 moderate в dev-зависимостях — Фаза 12 (hardening).
- Риски для следующих фаз:
  - **Фаза 2 (схема БД):** первый код с БД — проверить правило выбора драйвера
    (`TURSO_CONNECTION_URL` → `file:${DB_FILE_NAME}`) в `db/index.ts` и `drizzle.config.ts`;
    страницы с запросом к БД → `export const dynamic = "force-dynamic"`.
  - **`dev:test` (3001) пока неработоспособен** — нет схемы/seed (Фаза 3). Живая проверка в фазах
    до 3 — только через `npm run dev` (3000).
  - **`dark:`-утилиты Tailwind** привязаны к `[data-theme="dark"]` (через `@custom-variant`) —
    использовать их, не `prefers-color-scheme`.
  - `TaskStop` останавливает обёртку фоновой задачи, но не дочерний `next dev` (порт может остаться
    занят) — при необходимости добивать процесс `taskkill /PID <pid> /F` (в Git Bash — с `MSYS_NO_PATHCONV=1`).

**Что дальше.** Фаза 2 — доменная модель и схема БД.

---

## Фаза 2 — Доменная модель и схема БД

**Статус:** `done`
**Контекст входа.** Требует фазу 1 (`done`). Читать: `README.md` §1–2, §8, §11.9; `ENVIRONMENTS.md` §«Схема БД».
**Разблокирует.** Фазу 3 (без схемы нет seed) и все продуктовые фазы.
**Старт сессии.** Проверь статусы фаз; фаза 1 должна быть `done`. Заведи todo по таблицам схемы.

**Цель.** Перенести глава-ориентированную модель прототипа в схему Drizzle со всеми таблицами и
сгенерировать миграции.

**Подфазы / Todo.**
- [ ] **2.1 Таблицы ядра + ревью** (`src/lib/db/schema.ts`; полный список — `ENVIRONMENTS.md`):
      `users`, `blogs`, `chapters`, `chapter_revisions`, `chapter_reviewers`, `reviewer_history`,
      `threads`, `thread_replies`, `review_chat`, `review_checklists`.
- [ ] **2.2 Таблицы взаимодействия/модерации:** `public_comments`, `comment_votes`, `chapter_votes`,
      `bookmarks`, `follows`, `notifications`, `portfolios`, `reports`, `primary_change_requests`, `removed_reviewers`.
- [ ] **2.3 Поля «этапа подбора»** (детали — `README.md` §11.9): `users.competencies` (+ `reviewer_rating`/`_n`,
      `review_load`/`_capacity`), `chapters.skills`, и таблицы `review_invitations`, `reviewer_ratings`,
      `recruit_requests`, `board_calls`, `reviewer_applications`, `promo_banners`, `donation_methods`.
- [ ] **2.4 Перечисления:** `role` (`reader|author|reviewer|admin`), `revision.status`
      (`draft|under-review|changes-requested|published`), `verdict` (`approve|request-changes`),
      `thread.status` (`open|resolved`), `complexity` (`simple|medium|complex`),
      `block.type` (p/h2/h3/quote/list/code/callout/mermaid/image/table/embed),
      `invitation.status` (`pending|accepted|declined|flagged`),
      `recruit/application.status`, `banner.action` (`internal|external|donate`), `donation.type` (`link|qr`).
- [ ] **2.5 Блоки + версии + связи.** Блоки главы — `JSONB`-массив в `chapter_revisions.blocks`; снапшот
      публикации — `prev_blocks`. FK+каскады; `uniqueIndex` на engagement-таблицах (race-safe toggle).
- [ ] **2.6 Клиент + типы + миграции.** `src/lib/db/index.ts` (libsql: `TURSO_CONNECTION_URL` → иначе
      `file:${DB_FILE_NAME ?? "blog.db"}`); `drizzle.config.ts` читает то же правило (БД определяется
      поданным через dotenv-cli env-файлом). `src/types/index.ts` (общие типы). `npx drizzle-kit generate`.

**Скиллы и агенты.** Примени скилл `drizzle-schema` (создай его здесь, если решено вводить). По завершении — `code-reviewer`.

### Цикл качества (блокирующий гейт)
- [ ] `npm run build` зелёный, `npm run lint` чистый
- [ ] Применены скиллы `next-best-practices` + `drizzle-schema`
- [ ] `drizzle-kit generate` без ошибок; `drizzle-kit migrate` применяет на чистый `file:`
- [ ] Сабагент `code-reviewer`: нет P0/P1; **raw SQL отсутствует**; все timestamps — Unix seconds
- [ ] Сабагент `security-reviewer`: нет инъекционных паттернов, JSON парсится в `try/catch`
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [ ] Схема покрывает **всю** модель из `README.md` (главы, ревизии, треды/правки/чат, кредит ревьюеров
      по версиям, комментарии с привязкой к блоку и ревизии, портфолио, жалобы, смена ведущего, **поля §11.9**).
- [ ] Миграции в репозитории; применяются идемпотентно на чистую БД.

**Журнал фазы.**
- Статус-история: `todo` → `in progress` (2026-06-27, сессия Фазы 2) → `done` (2026-06-28).
- Артефакты: `src/lib/db/schema.ts` (28 таблиц), `src/lib/db/index.ts`, `src/lib/db/json.ts`,
  `drizzle.config.ts`, `src/types/index.ts`, миграция `drizzle/0000_quiet_lady_deathstrike.sql`.
- Решения/отклонения (валидированы против установленных версий drizzle-orm 0.45.2 / drizzle-kit 0.31.10 / @libsql/client 0.17.4):
  - **JSON-поля — `text`, не `{mode:"json"}`.** Drizzle json-mode парсит в маппинге драйвера при SELECT
    и роняет весь запрос на битой строке; `text` + единый `parseJson()` в `try/catch` (`db/json.ts`) даёт
    безопасный дефолт. Прямой `JSON.parse` вне `json.ts` запрещён.
  - **Timestamps — plain `integer` Unix seconds** (приложение пишет `Math.floor(Date.now()/1000)`),
    не `{mode:"timestamp"}` (он гоняет `Date`/мс).
  - **Booleans — `integer({mode:"boolean"})`** с `.notNull().default(...)`.
  - **Enum — `text({enum})`** (типобезопасность на компиляции); DB-level `CHECK` НЕ добавляли (валидация
    значений и диапазонов — на API-слое; CHECK в прототипе был Postgres-псевдокодом). `reviewer_ratings.stars`
    1..5 — валидация на API.
  - **PK — `text("id").$defaultFn(() => ulid())`** (генерация на каждую вставку, не замороженный default).
  - **FK на `users.handle`** (UNIQUE non-PK) для всех ревью-таблиц — следуем спеку; `handle` объявлен
    иммутабельным (запрет переименования — на API-слое). Прочие FK — на `id`.
  - **Правило выбора БД: пустую строку трактуем как отсутствие** (`?.trim() || file:…`, не `??`). `.env.local`
    задаёт `TURSO_CONNECTION_URL=` пустым; `??` не откатывался → `drizzle-kit migrate` падал. Соответствует
    прозе ENVIRONMENTS §2 «если … пуст → file:». Правило идентично в `db/index.ts` и `drizzle.config.ts`.
  - **`PRAGMA foreign_keys = ON`** в `db/index.ts` — connection-setup (не data-запрос), с `.catch`-логом,
    чтобы каскады не отключались молча.
  - **JSON-ключи внутри блобов — camelCase** (`CommentAnchor.blockId`, `Suggestion.from/to`), тип в
    `src/types` — единый источник; snake_case только у DB-колонок. (Снимает P1 код-ревью.)
  - Отклонения от источников: `chapter_revisions.deadline` **опущен** (ENVIRONMENTS §4 + редактор «без
    дедлайна» переопределяют README §8); `chapter_reviewers` PK **per-revision** `(chapter_id, revision_number,
    handle)` (ENVIRONMENTS §4, не §8); `follows` **автор-центрично** `(user_id, author_id)` (PLAN-решение,
    не `blog_id`); добавлена KV-таблица **`app_settings`** под singleton `donations_enabled` (§11.9
    «settings/kv»); `recruit_requests.chapter_id` **nullable**; `removed_reviewers.by_admin` — **text**
    (идентификатор админа, не флаг); `primary_change_requests.status` — plain text (не в §2.4-списке enum'ов).
- Доработки сверх плана: `app_settings` KV-таблица; `stringifyJson()` (зеркало `parseJson`); `.catch`-лог на
  PRAGMA; JSDoc у `parseJson` (единая точка разбора JSON).
- Цикл качества: `npm run build` зелёный, `npm run lint` чистый; `drizzle-kit generate` без ошибок;
  `db:migrate` (`blog.db`) и `db:migrate:test` (`blog.test.db`) применяют 28 таблиц, идемпотентно;
  оба `.db` в `.gitignore`. Сабагент `code-reviewer`: **0 P0/P1-блокеров** (1 P1 — несоответствие
  `CommentAnchor` — исправлен в этом PR); `security-reviewer`: **0 критических / 0 high**.
- Backlog (P2/P3 — для будущих фаз; в схеме менять не нужно):
  - **(P2, Фаза 4)** Эскалация роли: API-апдейты пользователя — только явный allowlist полей, **никогда**
    spread тела в Drizzle `update()` (`users.role` записываемая).
  - **(P2, Фаза 4)** `users.password_hash` входит в `$inferSelect` (`User`). Ввести `PublicUser =
    Omit<User,"passwordHash">` и не сериализовать полный `User` в ответах API.
  - **(P2, Фаза 9)** `reviewer_ratings.stars` — валидация диапазона 1..5 на API.
  - **(P3, Фаза 6)** `Block` имеет широкий `[key:string]: unknown` — заменить на дискриминированный union
    по `type` в редакторе.
  - **(P3, Фаза 10)** URL-поля (`promo_banners.target`, `donation_methods.url/qr_url`) без фильтра схемы —
    валидировать `^https?://` / `^/`, отклонять `javascript:`/`data:`; санитайзить при рендере.
  - **(P3)** `primary_change_requests.status` без enum — при появлении валидных значений завести enum-массив.
  - **(унаследовано, P2)** `npm audit`: ~6 moderate в dev-зависимостях — Фаза 12 (hardening).
- Риски для следующих фаз:
  - **(Фаза 7)** `chapter_reviewers.online/typing` — эфемерное presence-состояние в БД: нужен TTL/heartbeat
    (иначе `online=true` зависнет при разрыве) и осторожность с write-amplification; апдейт этих колонок —
    только владельцем (`session.handle === row.handle`).
  - **(Фазы 4/10)** FK на `users.handle` — `ON DELETE no action` (restrict): пользователя с ревью-историей
    нельзя жёстко удалить — удаление делать soft (бан), не hard-delete.
  - **(Фаза 3)** FK-каскады зависят от `PRAGMA foreign_keys=ON` (рантайм); `drizzle-kit migrate` применяет
    DDL без рантайм-FK — seed вставляет строки **в порядке зависимостей** независимо от PRAGMA. Seed-скрипты
    (`seed.ts`/`seed-test.ts`) ещё не существуют — это Фаза 3.
  - **(Фаза 5)** `follows` автор-центрично; если понадобятся уведомления о новой главе по блогу —
    пересмотреть (выводимо из автор→блоги).

**Что дальше.** Фаза 3 — стенды + seed.

---

## Фаза 3 — Два стенда + seed + флоу БД

**Статус:** `done`
**Контекст входа.** Требует фазы 1–2 (`done`). Читать: `ENVIRONMENTS.md` целиком; `README.md` §8.
**Разблокирует.** Фазу 4 и весь слой качества (тесты гоняются на тест-стенде).
**Старт сессии.** Проверь статусы; фазы 1–2 — `done`. Заведи todo по стендам/seed.

**Цель.** Поднять **тестовый** и **продовый** стенды, создать все БД и детерминированный seed,
покрывающий все роли/статусы/сценарии. Полностью реализовать `ENVIRONMENTS.md`.

**Подфазы / Todo.**
- [ ] **3.1 Окружения.** `.env.local` (dev, 3000, `DB_FILE_NAME=blog.db`), `.env.test` (test, 3001,
      `DB_FILE_NAME=blog.test.db`, `ADMIN_PASSWORD_PLAIN`), прод-переменные (Turso/Vercel). Описать в `.env.example`.
      ⚠️ `next dev` НЕ читает `.env.test` сам — все команды тест-стенда идут через `dotenv -e .env.test --`.
- [ ] **3.2 Скрипты `package.json`.** `dev`, `dev:test` (= `test:reset` + `dotenv -e .env.test -- next dev -p 3001`),
      `build`, `lint`, `db:generate`, `db:migrate`, `db:migrate:test`, `seed`, `seed:test`,
      `test:reset` (= `db:migrate:test` + `seed:test` — схема СНАЧАЛА, потом данные), `test:e2e`, `test:e2e:ui`, `test:e2e:report`.
- [ ] **3.3 Инициализация с нуля.** `db:migrate`+`seed` создают `blog.db`; `test:reset` создаёт `blog.test.db`.
      Файлы БД в `.gitignore`; в репо — только миграции Drizzle.
- [ ] **3.4 Детерминированный seed** (`src/lib/db/seed.ts` + `seed-test.ts`): пользователи всех 4 ролей
      (+доп. ревьюеры с компетенциями/рейтингом/занятостью; +по одному заблокированному `is_blocked`,
      `commenting_blocked`), блоги/главы во **всех** статусах + `chapters.skills`, ревизии с `prev_blocks`,
      треды (open/resolved) с suggestion, чат сессии, кредит ревьюеров по двум версиям, публичные комментарии
      (вкл. к старой ревизии), портфолио, жалоба, заявка на смену ведущего, **engagement** (follows/bookmarks/votes),
      **уведомления** (прочит.+непрочит.), а также **приглашения/оценки/recruit-запросы/доска/баннеры/способы пожертвования** (§11.9). Seed завершается `process.exit()`.
- [ ] **3.5 Скрипты тест-стенда** в `.claude/playwright-tester/`: `reset-test-db.sh`, `healthcheck.sh`,
      `login.sh`, `api-check.sh`, `db-query.sh`, `session-manager.sh`, `cleanup-test-data.sh` (имена таблиц под главы).
- [ ] **3.6 Прод-флоу БД.** `drizzle-kit migrate` против Turso; bootstrap-админ через env, без self-registration.

**Скиллы и агенты.** Скилл `drizzle-schema` (seed-инварианты). По завершении — `playwright-tester` (healthcheck стенда).

### Цикл качества (блокирующий гейт)
- [ ] `npm run build` зелёный, `npm run lint` чистый
- [ ] С **чистого клона** (без `.db`) `npm run test:reset` создаёт `blog.test.db`; `db:migrate`+`seed` — `blog.db`
- [ ] `npm run dev:test` поднимает стенд на 3001 именно на `blog.test.db` (данные = seed, не dev); dev-стенд не затронут
- [ ] `db-query.sh` показывает данные во всех статусах + engagement-слой непуст; seed детерминирован (повтор = тот же снимок)
- [ ] Тестовые аккаунты (`reader/author/reviewer` = `password`, admin из `.env.test`) логинятся
- [ ] Сабагент `security-reviewer`: секреты только из env, прод-БД не доступна тестам
- [ ] Сабагент `playwright-tester`: healthcheck стенда = GO
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [ ] `test:reset` идемпотентно возвращает тестовую БД к фиксированному состоянию.
- [ ] Прод-миграции применяются к Turso в сухом прогоне без ошибок.
- [ ] Тестовый и dev-стенды изолированы (разные БД/порты).

**Журнал фазы.**
- Статус-история: `todo` → `in progress` (2026-06-28, сессия Фазы 3) → `done` (2026-06-28). Цикл
  качества полностью зелёный (build/lint/code-reviewer/security-reviewer/playwright-tester); гейт
  **3.6 Turso dry-run** выполнен реально (см. ниже).
- Артефакты: `src/lib/db/seed-core.ts` (детерминированный построитель, все 28 таблиц), `seed.ts`,
  `seed-test.ts` (раннеры); `.claude/playwright-tester/` — `db-helper.ts` + 7 bash-скриптов
  (`reset-test-db`, `healthcheck`, `login`, `api-check`, `db-query`, `session-manager`,
  `cleanup-test-data`); правки `tsconfig.json` / `eslint.config.mjs` (исключение `.claude/**`).
- Ключевая находка: 3.1–3.3 уже были на месте с фаз 0/2 (scripts в `package.json`, `.env.example`,
  `.env.local`/`.env.test`, правило выбора БД в `db/index.ts`+`drizzle.config.ts`, devDeps) —
  это была **проверка**, не создание. Схему не меняли (миграция `0000` Фазы 2), новой миграции нет.
- Решения/отклонения:
  - **Детерминизм = стабильные идентификаторы + относительные времена.** `id`/`handle`/`slug`/связи/
    counts фиксированы (читаемые строковые id: `usr_*`, `blog_*`, `chp_*`, `rev_*`, `cmt_*`); timestamps
    выводятся из единственного `NOW = Math.floor(Date.now()/1000)`. Причина: требования seed включают
    «комментарий в окне правки ≤15 мин» и «свежие» уведомления — это валидно ТОЛЬКО относительно времени
    прогона; абсолютные фикс-времена сделали бы их невалидными. Снимок структурно идентичен между
    прогонами (проверено: re-seed → diff пуст, 28 контрольных строк). ⚠️ recency-кейсы «протухают» —
    тест окна правки запускать сразу после seed (помечено в коде).
  - **Пароль — захардкоженный bcrypt-хэш `'password'` (cost 10)** для reader/author/reviewer: и
    детерминизм снимка, и нет стоимости bcrypt на каждый seed. Проверено `compareSync('password',hash)
    === true` для всех трёх. **Админ — env-based** (`POST /api/auth`, `ADMIN_PASSWORD_HASH`), строки
    `users` не имеет — seed его не создаёт (соответствует разделению эндпоинтов).
  - **«Логинятся» в Фазе 3 = construction-level** (bcrypt верифицирует seeded-хэши). Живой логин через
    эндпоинт — Фаза 4 (auth ещё нет); `login.sh`/`api-check.sh` написаны по контракту и станут live тогда.
  - **Единый seed-core для dev и test.** `seed.ts`/`seed-test.ts` — тонкие раннеры; контент идентичен,
    БД выбирается env-файлом (dotenv-cli) через `db/index.ts`. Импорты в seed-core — relative + `import
    type` (esbuild стирает type-only), чтобы tsx резолвил без tsconfig-paths.
  - **Очистка перед вставкой.** seed чистит все таблицы child→parent, затем вставляет parent→child
    (идемпотентность; самоссылка `public_comments.parent_id` — родители раньше детей).
  - **Harness (`.claude/playwright-tester/`) — тулинг, не код приложения:** исключён из `tsconfig`
    (`exclude: .claude/**`) и `eslint` (`globalIgnores`), как ранее `docs/**`. БД-скрипты ходят в БД
    через `db-helper.ts` (@libsql/client, allowlist таблиц) — без зависимости от `sqlite3` CLI на Windows.
  - **db-query `sql`-режим — одобренное tooling-исключение** из «no raw SQL»: только одиночный
    SELECT/PRAGMA (снимаем завершающий `;`, запрещаем внутренние) — вне `src/`, read-only.
- **3.6 Turso (выполнено реально):** владелец создал staging-БД `recenza-staging-denjamin-ai`
  (Turso CLI), креды — в `.env.prod.local` (gitignored). `dotenv -e .env.prod.local -- drizzle-kit
  migrate` применил миграцию `0000` → **28 таблиц на Turso, 0 строк** (прод-флоу = только миграции,
  без seed; bootstrap-админ через env — Фаза 4). DoD «сухой прогон без ошибок» закрыт буквально.
  ⚠️ Токен был показан в чате — владельцу рекомендована ротация (staging-throwaway, при желании БД переиспользуется под прод).
- Цикл качества (полностью зелёный):
  - `npm run build` ✓, `npm run lint` ✓ (0). Скиллы `drizzle-schema` + `next-best-practices` применены.
  - Чистый клон (удалены `*.db`): `test:reset` создаёт+наполняет `blog.test.db`; `db:migrate`+`seed` —
    `blog.db`. Детерминизм подтверждён (re-seed → идентичный снимок). Все 28 таблиц непусты; все 4
    статуса ревизий; engagement (votes/bookmarks/follows) непуст.
  - `dev:test` поднимает `:3001` на `blog.test.db` (Ready ~1.7с); `healthcheck.sh` = GO (200). dev-стенд
    не затронут. `db-query.sh`/guard проверены (trailing `;` ок, составной запрос отклонён).
  - **code-reviewer:** GO — 0 P0/0 P1 (2 P2, 2 P3 → backlog/исправлено). **security-reviewer:** GO —
    0 critical/0 high (2 medium harness-only, 2 low — учтены). **playwright-tester:** healthcheck = GO.
  - По ревью исправлено в этом PR: db-helper `sql` запрещает составные запросы (`;`); `login.sh`
    JSON-экранирует пароль/handle; пометки edge-case/staleness в seed; коммент про статичный список в cleanup.
- Backlog (P2/P3 — отложено):
  - **(P3, harness)** `login.sh` без `jq` (ручное JSON-экранирование); при появлении `jq` в зависимостях
    harness перейти на `jq -n --arg`.
  - **(P3, Фаза 4)** db-query `sql`-режим читает любые таблицы (вкл. `password_hash`) — harness-only,
    ФС-доступ; при желании сузить allowlist колонок.
  - **(унаследовано, P2, Фаза 12)** `npm audit`: ~6 moderate в dev/build-зависимостях (esbuild через
    старую цепочку drizzle-kit; postcss в бандле Next — фикс ломает Next, ждать релиз Next с postcss≥8.5.10).
    Не эксплуатируется в проде.
- Риски для следующих фаз:
  - **(Фаза 4)** `login.sh`/`api-check.sh` ждут эндпоинты `/api/auth` (admin) и `/api/auth/user`
    (reader/author/reviewer); форма тела `{handle,password}` в `login.sh` — провизорная, сверить с
    реализацией Фазы 4. Тогда же «тестовые аккаунты логинятся» проверяется вживую.
  - **(Фаза 5+)** recency-зависимые seed-строки (`cmt_fresh`, свежие уведомления) «протухают» —
    E2E на окно правки/бейджи запускать сразу после `test:reset` (или мокать время).
  - **(Фаза 12)** Прод-деплой: env в Vercel (`TURSO_*`, `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`,
    `CRON_SECRET`, `NEXT_PUBLIC_BASE_URL`); bootstrap-админ из env, без self-registration.

**Что дальше.** Фаза 4 — auth + UI-обвязка ролей.

---

## Фаза 4 — Auth, роли, гейтинг + UI-обвязка ролей

**Статус:** `done`
**Контекст входа.** Требует фазы 1–3 (`done`). Читать: `README.md` §1 (роли), §3 (карта экранов); `CLAUDE.md` (ролевой гейтинг).
**Разблокирует.** Все продуктовые фазы (5–10) — они наполняют готовые ролевые оболочки.
**Старт сессии.** Проверь статусы; фазы 1–3 — `done`. Эту фазу **делаем за одну сессию** двумя
  подфазами: сперва auth/гейтинг (4.1), затем оболочки всех ролей (4.2).

**Цель.** iron-session-аутентификация, 4 роли с **binding-гейтингом** и **UI-обвязка всех ролей**
(route-группы, layout’ы, навигационные оболочки кабинетов) — единый каркас, на который фазы 5–10 вешают функционал.

**Подфазы / Todo.**
- [ ] **4.1 Auth + гейтинг.**
  - [ ] `src/lib/auth.ts`: `SessionData {isAdmin, userId?, userRole?}` (инвариант: admin и userId не одновременно);
        `getSession`, `requireUser(role?)`, `requireAuthor`, `requireReviewer`, `requireAdmin`.
  - [ ] Эндпоинты: `POST/DELETE /api/auth` (admin), `POST/DELETE /api/auth/user`, `GET /api/auth/user`.
        Rate-limit логина (5/15мин по `x-forwarded-for`), CSRF same-origin на мутациях.
  - [ ] **Ролевой гейтинг (binding):** читатель комментирует везде; автор видит/читает/комментирует
        **только свои** блоги (чужие фильтруются из ленты/каталога и блокируются в ридере); ревьюер
        никогда не комментирует и не ведёт блоги; админ модерирует. Централизовать проверки.
- [ ] **4.2 UI-обвязка ролей (оболочки, без бизнес-функционала).**
  - [ ] Route-группы и layout’ы: `app/(reader)/`, `app/author/(protected)/`, `app/reviewer/(protected)/`,
        `app/admin/(protected)/`, публичный сегмент. Layout каждой группы вызывает свой `require*`.
  - [ ] Навигационные оболочки на каждую роль: общий `Nav` (по `README.md` §3) + каркасы кабинетов
        (пустые экраны-заглушки `AuthorPortal`/`ReviewerInbox`/`AdminPortal` с корректной навигацией и гейтингом).
        ⚠️ Админка — полноэкранная: при входе в админ-портал **шапка сайта скрыта** (см. §11.8), у портала свой каркас.
  - [ ] Тема/токены применены ко всем оболочкам; точки входа между кабинетами работают (заглушки рендерятся под нужной ролью).

**Скиллы и агенты.** Создай и примени скилл `security-checklist` (auth-гейтинг/CSRF/rate-limit). Агенты: `security-reviewer`, `design-watcher`.

### Цикл качества (блокирующий гейт)
- [ ] `npm run build` зелёный, `npm run lint` чистый
- [ ] Применены скиллы `next-best-practices` + `security-checklist`
- [ ] Сабагент `code-reviewer`: нет P0/P1
- [ ] Сабагент `security-reviewer`: 0 критических (без сессии `/admin|/author|/reviewer` → редирект; чужой контент → 403; rate-limit 6-я неудача → 429; пароли bcrypt; секреты из env)
- [ ] Сабагент `design-watcher`: оболочки на токенах, dark mode целостен, хит-таргеты ≥36/44px; админка реально полноэкранная (шапка сайта скрыта)
- [ ] Сабагент `playwright-tester`: smoke логина/редиректов/входа в каждую ролевую оболочку = GO
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [ ] Гейтинг проверен по матрице ролей: ни одна роль не делает запрещённого (негативные кейсы 403/редирект).
- [ ] Все 4 ролевые оболочки рендерятся под своей ролью, навигация и layout-гейтинг работают, функционал — заглушки.

**Журнал фазы.**
- Статус-история: `todo` → `in progress` (2026-06-28, сессия Фазы 4) → `done` (2026-06-28). Цикл качества
  полностью зелёный (build/lint + 4 сабагента GO + живая проверка на :3001).
- Артефакты: `src/lib/{auth,csrf,rate-limit}.ts`; `src/app/api/auth/{route,user/route}.ts`; route-группы
  `(reader)`, `author/(protected)`, `reviewer/(protected)`, `admin/(protected)` + `/login` + `/admin/login`;
  компоненты `nav/{site-nav,app-frame,avatar-menu,notification-bell}`, `auth/{login-form,admin-login-form}`;
  каркасы кабинетов (`*_components/*-shell.tsx`); типы `PublicUser`/`SessionData`; дополнен скилл
  `security-checklist`; удалён showcase `src/app/page.tsx` (home → `(reader)/page.tsx`).
- Решения/отклонения:
  - **Handler-гарды возвращают `SessionData | NextResponse`** (в хендлере `if (x instanceof NextResponse) return x`) —
    по конвенции CLAUDE.md «requireUser возвращает NextResponse». **Page-гарды** (`require*Page`) — отдельные,
    делают `redirect()` (RSC read-only по cookies; запись только в route handlers).
  - **`SessionData` объявлен канонически в `src/types`** (а не в `auth.ts`, как предполагал план «зеркалить») —
    общие типы импортируются из `@/types`, `auth.ts` импортирует тип (нет цикла, клиент-safe).
  - **Вход админа — отдельный неафишируемый `/admin/login`** (решение владельца): публичный `/login` — только
    пользователи (`/api/auth/user`), админ — только пароль (`/api/auth`), без ссылок из UI, `robots: noindex`.
  - **`secure` cookie только в проде** (`NODE_ENV==="production"`) — иначе cookie не ставится по `http://localhost`
    и логин «молча» не работает на стенде.
  - **`snapshot()` гарантирует инвариант** (админ — без `userId/userRole`); **`requireUser` отдаёт роль из БД**
    (актуальна), а не из cookie (фикс P1 ревью — задел против stale-роли в фазах 5–10).
  - **🔴 Блокер (исправлен): двойной dotenv-expand ломал `ADMIN_PASSWORD_HASH`.** На тест-стенде значение проходит
    ДВА expand-прохода (dotenv-cli `-e .env.test`, затем `@next/env` при `next dev`); `$2b$10$…` дважды
    интерпретировался как переменные → мусор → `bcrypt.compare=false` → admin login 401. Прод **не затронут**
    (Vercel задаёт env напрямую, без `.env`-файлов → `@next/env` не запускает expand на этой переменной — проверено
    prod-sim). Фикс: `ADMIN_PASSWORD_HASH` в `.env.test` экранирован **двойно** (`\\$`: dotenv-cli `\\$`→`\$`,
    затем `@next/env` `\$`→`$` = валидный 60-симв.). Проверено полным пайплайном и живым логином. Гочи занесён в
    `CLAUDE.md`. `.env.local` не трогали (нет владельческого plain) → backlog.
- Доработки сверх плана:
  - A11y: skip-link на `/login`, `/admin/login` и в admin-fullscreen; `role=tablist/tab` + `aria-selected/controls`
    в admin-sidebar; Escape возвращает фокус на триггер + закрытие при уходе фокуса в `AvatarMenu`; `min-h-9`
    (хит-таргеты ≥36px); `autoCapitalize/autoCorrect/spellCheck=off` на поле никнейма.
  - `security-checklist` дополнен: не сериализовать `password_hash` (`PublicUser`/`toPublicUser`); апдейты `users` —
    только allowlist полей (никогда spread, `role` записываема).
- Цикл качества (зелёный): `npm run build` ✓, `npm run lint` ✓ (0); скиллы `next-best-practices` +
  `security-checklist` применены. Живая проверка на :3001: harness-логины reader/author/reviewer/admin = OK;
  `ghost` (isBlocked) отклонён, `troll` входит; `GET /api/auth/user` без `passwordHash`; гость на
  `/admin|/author|/reviewer` → редирект; чужая роль → `/`; CSRF cross-origin → 403; rate-limit 6-я → 429,
  parse-ошибка НЕ засчитывается; logout гасит сессию; admin fullscreen (0 footer, 0 site-nav). Сабагенты:
  **code-reviewer** GO (0 P0, 2 P1 исправлены), **security-reviewer** GO (0 critical/high; 2 medium),
  **design-watcher** GO (0 P0, 3 P1 исправлены), **playwright-tester** GO (8/8).
- Backlog (P2/P3):
  - **(P2, Ф12)** rate-limit **in-memory** не шарится между serverless-инстансами (Vercel) — вынести в Turso/KV
    (в коде помечено). До прод-деплоя — повышается до HIGH.
  - **(✅ исправлено, hotfix-envlocal-admin-hash)** `.env.local` `ADMIN_PASSWORD_HASH` хранился **без**
    экранирования (`$2b$10$…`) → единственный expand-проход `@next/env` портил `$` → admin login на
    **dev :3000** был сломан. Исправлено: значение экранировано одинарным `\$` (сам хеш не менялся —
    валиден; владельческий пароль продолжает подходить). Проверено: оба стенда резолвят валидный
    60-симв. bcrypt (`:3000` через `@next/env`; `:3001` через dotenv-cli+`@next/env`, `compareSync=true`).
    Прод не затронут. `.env.local` gitignored — фикс локальный; правило escaping — в `CLAUDE.md` §Gotchas.
  - **(P3, Ф5)** `NotificationBell` — server-заглушка; при поллинге добавить `"use client"`.
  - **(P3)** `toPublicUser` через `delete`+`as` → деструктуризация при случае. **(P3, Ф12)** `bcryptjs` timing →
    рассмотреть native/`timingSafeEqual`. **(P3)** login: бренд визуально крупнее `<h1>` (косметика).
  - **(унаследовано P2, Ф12)** `npm audit` ~6 moderate (dev/build-зависимости).
- Риски для следующих фаз:
  - **(Ф5–8)** `require*`-гарды только **аутентифицируют роль**; ownership (`blog.authorId===userId`) и assignment
    (назначение ревьюера на главу) каждый новый `/api/{author,reviewer}/*` обязан проверять явно.
  - **(Ф5)** В `AvatarMenu`/`SiteNav` профиль/закладки/«Руководство» **не выведены** (нет маршрутов) — добавить ссылки
    в своих фазах; в `(reader)/page.tsx` оставлен комментарий-слот под карусель промо-баннеров (Ф10).
  - **(env-гочи)** секреты с `$` в `.env.test` требуют **двойного** `\\$` (двойной expand на тест-стенде), в
    `.env.local` — одинарного `\$`, в проде — без экранирования (см. `CLAUDE.md` §Gotchas).

**Что дальше.** Фаза 5 — читательский слой.

---

## Фаза 5 — Читательский слой (публичный)

**Статус:** `done`
**Контекст входа.** Требует фазы 1–4 (`done`). Читать: `README.md` §3 (ридер, регресс-ловушка), §4 (engagement), §11.1 (навыки-чипы).
**Разблокирует.** Кредит ревьюеров в ридере (фазы 7, 9) и комментарии (фаза 8).
**Старт сессии.** Проверь статусы; фазы 1–4 — `done`.

**Цель.** Публичное чтение многоглавных блогов + читательский engagement-слой.

**Подфазы / Todo.**
- [ ] `HomeScreen`/`ReaderFeed` (лента, фильтры-чипы), `ArticleIndex` (каталог карточек блогов).
      На ленте — **карусель промо-баннеров** (наполнение/логика — фаза 10; здесь только место и контракт).
- [ ] `BlogReader`: широкая колонка + правый `SeriesNav` (главы + вложенный ToC активной главы; одна глава → только ToC),
      прогресс, режим **«Весь блог»**. Рендер всех типов блоков идентично ревью-виду. **Чипы навыков главы** (§11.1).
- [ ] Реакции: голоса (±1), закладки — race-safe `db.transaction()`, `uniqueIndex`, rate-limit. `BookmarksScreen`.
      Подписки (follow автора) + лента по подпискам (`/reader`).
- [ ] Уведомления: polling-бейдж (новые главы в подписках + «ваш ход» в ревью), read-state.
- [ ] Кредит ревьюеров в конце главы: текущие чипами, прошлые версии — за раскрытием.
- [ ] SEO/Feed: `generateMetadata`, OG, `/feed.xml`, `/sitemap.ts`, `/robots.ts`, JSON-LD.

**Скиллы и агенты.** Скилл `next-best-practices`. Агенты: `seo-optimizer` (публичные страницы), `design-watcher`.

### Цикл качества (блокирующий гейт)
- [ ] `npm run build` зелёный, `npm run lint` чистый
- [ ] Применён скилл `next-best-practices`
- [ ] Сабагент `code-reviewer`: нет P0/P1
- [ ] Сабагент `security-reviewer`: голоса/закладки race-safe и идемпотентны; rate-limit на реакциях; гость-intent безопасен
- [ ] Сабагент `design-watcher`: токены/шрифты/тени/aria/dark — без P0
- [ ] Сабагент `seo-optimizer`: у каждой публичной страницы уникальные title/description/OG; sitemap/robots/feed валидны
- [ ] Сабагент `playwright-tester`: открытие разных блогов рендерит разный контент (регресс-ловушка §3) = GO
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [ ] Открытие разных блогов рендерит **разный** контент; `document.title`/OG обновляются.
- [ ] Гость, голосуя/закладывая, уходит на логин; intent реплеится после входа.
- [ ] Закладки/голоса/подписки идемпотентны и race-safe (тест на дабл-клик).

**Журнал фазы.**
- Статус-история: `todo` → `in progress` (2026-06-28, сессия Фазы 5) → `done` (2026-06-28). Цикл качества
  полностью зелёный (build/lint/tsc + 4 сабагента + живая верификация на :3001).
- Решения пользователя (закреплены до старта через AskUserQuestion): URL **namespaced** —
  `/blog/[slug]`, `/blog/[slug]/[chapter]`, профили `/u/[slug]`, закладки `/bookmarks`; главная `/` —
  одна страница с **табами** «Лента/Каталог/Подписки» (через `?tab=`).
- Артефакты:
  - Общий рендерер блоков `src/components/blocks/` (`block-renderer` + `code-block` (Shiki на сервере,
    dual-theme) + `copy-button` + `mermaid-block` (source-stub, RSC `<details>`) + `image-block`
    (next/image + onError-плейсхолдер) + `anchors`/`headings`/`extract-plain-text`). Проп `mode`/`prefix`
    — задел под идентичный рендер в ревью (Фаза 7).
  - Data-access `src/lib/queries/` (`feed`, `chapters`, `engagement`, `reviewer-credit`, `bookmarks`,
    `notifications`, `profile`, `reader-sections`, `sitemap`, `types`) с `cache()` и инвариантами видимости.
  - Страницы `(reader)/{page, blog/[slug]/page, blog/[slug]/[chapter]/page, blog/[slug]/not-found,
    u/[slug]/page, bookmarks/page}`; SEO-роуты корня `app/{sitemap.ts, robots.ts, feed.xml/route.ts}`.
  - API `api/{chapters/[id]/vote, bookmarks, follows, notifications, notifications/read}/route.ts`.
  - Компоненты ридера/профиля/навигации; `src/lib/{seo,intent,jsonld,format}.ts`; расширен `rate-limit`
    (`hitActionRate` 1/сек на реакции); апгрейд `notification-bell` (клиентский поллинг); ссылки
    профиль/закладки в `avatar-menu` (+ `slug` в проп из `site-nav`); intent-replay в `login-form`/`login`.
- Решения/отклонения:
  - **Регресс-ловушка** закрыта `getReadableBlog(slug)`: контент главы полностью выводится из
    `(blogSlug, chapterSlug)`, `generateMetadata` зовёт ту же функцию (title/OG = контенту). Разные
    блоги/главы → разный контент. `/blog/[slug]` без `?mode` → **редирект на первую published-главу**
    (единственная поверхность контента, без дубликата); `?mode=whole` — режим «Весь блог».
  - **Видимость (binding)**: заблокированные авторы (`isBlocked`) скрыты везде (лента/каталог/ридер/
    sitemap/feed → 404 в ридере); публично видна только **последняя published-ревизия** главы (seed
    `chp_published` rev1+rev2 → отдаём rev2). Неопубликованные главы → 404.
  - **Ролевая изоляция автора**: viewer-author видит ТОЛЬКО свои блоги (`restrictAuthorId` в ленте/
    каталоге; `notFound()` в ридере для чужого блога). Профиль читателя/админа → 404 (нет публичного профиля).
  - **Счёт голосов — на чтении через `SUM`** (drizzle `sql`-агрегат), без денормализации/миграции;
    транзакционно обновляется только `blogs.bookmarkCount`. `blogs.rating` (1–5, seed) не смешиваем с ±1.
  - **Гостевой intent-replay без localStorage**: гость видит кнопки реакций → клик шлёт
    `/login?next=&intent=` (`intent.ts`, allowlist + `safeNext` anti-open-redirect); после входа
    `login-form` реплеит один intent авторизованным API и уходит на `next`. Проверено вживую: гость →
    `intent=vote:chp_published:1` → вход → возврат на главу + голос применён (toggle).
  - **canVote/canFollow для гостя = true** (по находке playwright): голосовать/подписываться может кто
    угодно, КРОМЕ автора этой главы/блога; гость видит кнопку и уходит на логин (иначе intent-flow
    невозможен). Автор не голосует за свою главу — дублируется на API (403).
  - **mermaid/KaTeX/реальная загрузка картинок — Фаза 12.** Mermaid = source-stub (`<details>`),
    инлайн-`$…$` остаётся текстом; картинки `next/image` `unoptimized` + onError-плейсхолдер; `src`
    валидируется на `/uploads/`.
  - **Уведомления — чтение СОХРАнённых строк** (seed создаёт `new_chapter`/`review_turn`); генерация
    (cron/реалтайм) — позже. Bell: поллинг ~45с + on-focus, `aria-live` бейдж, read-state.
  - **Главные табы — `nav` + `aria-current`** (не ARIA-виджет `tablist/tab`): это навигация по URL,
    а не tab-widget с tabpanel (правка по design-review).
  - **mermaid-block / chapter-reviewer-credit / comments-slot — RSC** (нативный `<details>`), меньше
    клиентских компонентов, чем предполагал план.
- Цикл качества (зелёный):
  - `npm run build` ✓, `npm run lint` ✓ (0), `tsc --noEmit` ✓. Скиллы `next-best-practices` +
    `security-checklist` применены (self-audit).
  - **code-reviewer: GO** (0 P0; 1 P1 — неявный guard пустого `chapters[]` — исправлен явным `notFound()`).
  - **security-reviewer: PASS** (0 critical/0 high; 3 medium — все carry-forward/known: in-memory
    rate-limit→Ф12, `toPublicUser`-конвенция, CSRF-на-GET-notifications [см. backlog]).
  - **design-watcher: GO** (0 P0; 2 P1 исправлены: `aria-current="page"`, хит-таргет чипов `h-9`).
  - **seo-optimizer + живая проверка**: sitemap включает published-главу и исключает `hidden-blog`;
    robots/feed валидны; canonical/OG/JSON-LD/title корректны.
  - **playwright-tester**: автопрогон агента ушёл в NO-GO из-за артефактов тестового окружения
    (MCP-клик деградировал после рестарта dev-сервера под живым браузером; Cyrillic в `evaluate`;
    onChange формы логина; login rate-limit). **Все спорные пункты перепроверены вручную через
    Playwright MCP (in-page) = GREEN**: регресс-ловушка, гость→login→intent-replay (голос применён),
    тоггл закладки через `POST /api/bookmarks` (200), попап колокола с уведомлениями, таб-навигация
    (`?tab=catalog`), 404 скрытого блога/неопубликованной главы. Единственная реальная находка
    (vote/follow скрыты у гостя) — исправлена.
- Backlog (P2/P3 — для будущих фаз):
  - **(P2, Ф12)** rate-limit (логин + реакции) — in-memory, не шарится между serverless-инстансами;
    вынести в Turso/KV. До прод-деплоя — HIGH.
  - **(P2, Ф12)** Seed-картинки `/uploads/*.png` отсутствуют → 404 + console error на стендах (UX уже
    деградирует в плейсхолдер). Реальная загрузка/сторедж — Фаза 12; либо добавить плейсхолдер-файлы.
  - **(P3)** `GET /api/notifications` без `assertSameOrigin` (info-disclosure минимизирован `sameSite=lax`;
    добавлять same-origin к GET нельзя — браузер не шлёт `Origin` на same-origin GET → сломает поллинг.
    Рассмотреть строгую CORS-политику на API в Ф12).
  - **(P3)** JSON-LD `<script>` даёт dev-only React-варнинг (в прод-сборке отсутствует; паттерн — по
    докам Next). При желании заменить на иной механизм инъекции.
  - **(P3)** `getSubscriptionFeed` — `includes` по массиву подписок (O(n·m)); при росте перейти на `Set`.
  - **(P3)** Режим «Весь блог» — `buildReaderSections` шлёт 2 запроса на главу; при многоглавных блогах
    добавить батчинг. **(P3)** профиль `/u/[slug]` без `og:image`; NotificationBell без loading-скелета.
- Риски для следующих фаз:
  - **(Ф7)** `BlockRenderer` — общий с ревью: ревью-хром (маркеры тредов, инлайн-дифф) навешивать
    ОБЁРТКАМИ вокруг (`mode="review"`, `prefix`/`data-block-id` уже есть), не форком рендерера.
  - **(Ф6)** Редактор обязан писать блоки в тех же seed-формах, что потребляет рендерер
    (`list{variant,items}`, `code{lang,text}`, `callout{variant}`, `image{src,alt}`, `table{rows}`).
    Портфолио сейчас рендерится read-only в профиле — редактор портфолио добавляет Фаза 6.
  - **(Ф8)** Слот комментариев — якорный `<section id="comments">` (ключ ревизии в `data-revision`);
    наполнять там же.
  - **(тест-инфра)** Артефакты этой сессии: login rate-limit (5/15мин) копится на стенде — E2E
    логиниться один раз на роль; рестарт dev-сервера под живым MCP-браузером ломает MCP-клики; Cyrillic
    в `browser_evaluate`-литералах транскодируется — матчить элементы по индексу/латинице, не по кириллице.

**Что дальше.** Фаза 6 — авторский слой.

---

## Фаза 6 — Авторский слой: кабинет, редактор, портфолио

**Статус:** `done`
**Контекст входа.** Требует фазы 1–5 (`done`). Читать: `README.md` §5 (редактор), §6 (портфолио), §11.1 (навыки-гейт).
**Разблокирует.** Фазу 7 (на ревью отправляет редактор) и фазу 9 (навыки/пикер).
**Старт сессии.** Проверь статусы; фазы 1–5 — `done`. Три подфазы в одной сессии: кабинет → редактор → портфолио.

**Цель.** Кабинет автора, блочный редактор «writing-first» и портфолио «Об авторе» (без ревью).

**Подфазы / Todo.**
- [ ] **6.1 Кабинет.** `AuthorPortal` (карточки блогов; плитка «создать» первой; пин → вперёд + кольцо).
      `BlogDetail` (главы блога: пин/превью/+глава). Ownership на всех `/api/author/*`.
- [ ] **6.2 Редактор.** Минимальный топбар (save-state, превью, split ≥lg, ⚙ настройки, «Отправить на ревью →»);
      тело-документ (хлебные крошки → авто-растущий заголовок → dashed-чип настроек → блоки); слэш-меню (`/`, 4 группы, 14 типов);
      markdown-шорткаты; инлайн-тулбар (B/I/Code/Link); левый рельс (add/drag). `ChapterSettingsPopover` (slug авто+override, теги, обложка).
      `SubmitSheet` (правая шторка): чек-лист готовности (гейт) + **блок ключевых навыков (§11.1, обязателен)** + сложность +
      ревьюеры с выбором ведущего + заметка. Submit заблокирован до прохождения гейта. **Без поля дедлайна.**
      Версионирование: при `PUT` главы — снапшот предыдущей ревизии. (Сам матчинг-пикер — фаза 9; здесь базовая форма.)
- [ ] **6.3 Портфолио «Об авторе».** `portfolios` (одно на автора): мини-статья из блоков, флаг видимости, **без ревью**.
      `ProfileScreen` — табы автора «Об авторе · Блоги»; вход в редактор портфолио из профиля и кабинета. У читателей/ревьюеров вкладки нет.
      Публичный профиль ревьюера: список отрецензированных глав (`getReviewedChapters`).

**Скиллы и агенты.** Скилл `next-best-practices`. Агенты: `design-watcher`, `code-reviewer`, `seo-optimizer` (страница профиля).

### Цикл качества (блокирующий гейт)
- [ ] `npm run build` зелёный, `npm run lint` чистый
- [ ] Применён скилл `next-best-practices`
- [ ] Сабагент `code-reviewer`: нет P0/P1; ownership на `/api/author/*`
- [ ] Сабагент `security-reviewer`: автор не видит/не правит чужие блоги (403); валидация ввода редактора
- [ ] Сабагент `design-watcher`: редактор на токенах; хит-таргеты ≥36/44px; dark mode целостен
- [ ] Сабагент `seo-optimizer`: страница профиля корректна
- [ ] Сабагент `playwright-tester`: создать блог → главу → черновик → отправить на ревью = GO
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [ ] Автор: блог → глава → блоки → черновик → отправка на ревью (статус главы меняется); навыки обязательны для отправки.
- [ ] Портфолио публикуется **минуя** review-flow; профиль ролеспецифичен (автор — табы; ревьюер — «что отрецензировал»; читатель — без портфолио).

**Журнал фазы.**
- Статус-история: `todo` → `in progress` (2026-06-30) → `done` (2026-06-30). Ветка `phase-6-author`,
  9 подфаз S0–S9 (атомарные коммиты). Цикл качества полностью зелёный.
- Артефакты: миграция `0001_*` (`users.pinned_blog_id`); `src/lib/queries/author.ts`; `src/lib/slug.ts`;
  `src/lib/blocks/{constants,normalize,validate}.ts`; `src/components/blocks/inline.tsx`; роуты
  `src/app/api/author/**` (blogs, blogs/[id], blogs/[id]/chapters, chapters/reorder, chapters/[id],
  chapters/[id]/submit, pin, portfolio); страницы `src/app/author/(protected)/**` (кабинет, blog/[slug],
  …/[chapter]/edit, …/preview, new, portfolio); клиент `src/app/author/_components/**`
  (author-cabinet, blog-detail-view, editor/*); профиль-табы `src/components/profile/{profile-tabs,author-profile}`.
- Решения/отклонения:
  - **create-then-edit.** Создание блога/главы делает скелет (блог + глава + ПУСТАЯ draft-ревизия);
    редактор всегда только `PATCH`-ит реальную главу (никогда не создаёт ревизию). `POST /api/author/blogs`
    принимает лишь `{title}` (контент пишется потом) — отклонение от плана, где POST нёс `blocks`.
  - **Инлайн-rich-text = безопасный markdown в `block.text`** + расширён `BlockRenderer` (`inline.tsx`):
    `**b**/*i*/`code`/[l](url)`. Курсив только `*..*` (без `_`, чтобы `snake_case` не курсивился); ссылки —
    только `^https?://` или `/` (иначе литерал). Fast-path: текст без марок возвращается байт-в-байт →
    seed не меняется (проверено: 28/28 инлайн-фрагментов идентичны). `extractPlainText`/`headings` снимают
    марки (`stripInlineMarks`) для SEO/ToC.
  - **Константы блоков вынесены в клиент-безопасный `src/lib/blocks/constants.ts`** (без drizzle), `@/types`
    ре-экспортит — чтобы редактор-клиент не тащил схему БД в бандл.
  - **Новый транслитерирующий `src/lib/slug.ts`** (НЕ кириллический `slugify` из `blocks/anchors.ts`).
  - **`normalizeBlock` лечит дрейф имён** прототипа → рендерера (`subtype→variant`, `tone→variant`,
    `caption→alt`). Валидатор + чек-лист готовности (`validate.ts`) изоморфны (клиент-гейт ⇄ сервер-гейт).
  - **Редактор без `execCommand`/contenteditable** — управляемые textarea с raw-markdown; markdown-шорткаты,
    слэш-меню, инлайн-тулбар (строковые обёртки), drag + клавиатурные ↑/↓. **LaTeX опущен** (нет block-типа
    и поддержки в рендерере) — задел на Фазу 12.
  - **Submit (R1, forward-incompat):** ревьюеры пишутся НАПРЯМУЮ в `chapter_reviewers` — заглушка, изолирована
    в `assignReviewers()`; модель согласия (`review_invitations`) — Фаза 9. `review_invitations` НЕ пишем
    (без двойного моделирования). Шейп ровно как ждёт Фаза 7: `verdict=null`, `isPrimary` выставлен,
    `online/typing=false`.
  - **Портфолио:** один `PUT /api/author/portfolio` (upsert блоков + видимость) обслуживает и редактор, и
    тоггл на профиле — консолидация запланированного отдельного visibility-эндпоинта.
  - **Профиль:** клиентская оболочка табов + RSC-панели (`BlockRenderer` серверный). Владелец видит своё
    портфолио даже скрытым (баннер) + вход в редактор; не-владелец — только видимое.
  - **Картинки — только путь `/uploads/`** (без эндпоинта загрузки) — реальная загрузка в Фазе 12.
  - **Миграция `0001`:** drizzle-kit опускает `onDelete` для `ADD COLUMN` FK в SQLite — `ON DELETE SET NULL`
    дописан вручную (snapshot уже фиксирует `set null`, дрейфа нет). Применена на blog.db, blog.test.db, Turso.
  - ⚠️ **Расхождение окружения:** `.env.local` указывает dev (:3000) на **Turso**, а не `blog.db` (CLAUDE.md
    говорит blog.db). `db:migrate` (dev) применил `0001` к Turso (аддитивно, безопасно). Всё тестирование —
    на тест-стенде (:3001, `blog.test.db`). `npm run seed` НЕ запускался (он целит в Turso). Уточнить у владельца.
- Доработки сверх плана: переиспользуемый `BlockListEditor` (главы+портфолио); чип-фильтр «Нужны правки»;
  `try/catch` вокруг транзакций PATCH/submit; токен `--overlay`; aria `tabpanel↔tab`; хит-таргеты ≥36px;
  регресс-проверка инлайн-seam на seed.
- Цикл качества (зелёный): `build`/`lint` чисто; **code-reviewer** GO (0 P0/P1); **security-reviewer** PASS
  (0 critical/0 high; 1 medium — небезопасный `href` в профиле — **исправлен**; 3 low → backlog);
  **design-watcher** GO (0 P0; P1 overlay/aria/autofocus + дешёвые P2 хит-таргеты исправлены);
  **seo-optimizer** GO (профиль-метаданные ок, author-страницы noindex, марки стрипаются);
  **playwright-tester** GO (7/7: create→editor(## шорткат)→preview→submit 7/7→under-review→pin→portfolio→
  негативы 404). 0 P0.
- Backlog (P2/P3):
  - **(P2)** Полный focus-trap в модалках (autofocus есть; циклический Tab-containment — нет).
  - **(P2)** `window.prompt/alert` для URL ссылки → инлайн-форма в тулбаре.
  - **(P3)** Клавиатурный drag (ручка — нефокусируемый `span`; клавиатурный reorder есть через ↑/↓).
  - **(P2)** `ring-offset-2` на outline/ghost-кнопках (консистентность, унаследовано).
  - **(P2)** reorder TOCTOU: параллельное создание главы может рассинхронить `order` (низкий риск — один автор).
  - **(P3)** `uniqueSlug` сдаётся на 50 → полагается на `409`-catch.
  - **(P2, Фаза 12)** Реальная загрузка изображений (`/api/uploads`).
  - **(P2, унаследовано Фаза 5)** `jsonld.tsx` — React-warning про `<script>` (косметика, не регресс) — Фаза 12.
  - **(унаследовано, Фаза 12)** in-memory rate-limit (serverless); `npm audit` moderate в dev-зависимостях.
- Риски для следующих фаз:
  - **(Фаза 7)** Потребляет главы с последней ревизией `under-review` + `chapter_reviewers` (verdict=null,
    isPrimary, online/typing=false) — ровно это оставляет submit. Публикация + снапшот `prev_blocks` +
    `reviewer_history` — задача Фазы 7. Главу `under-review`/`published` редактор править не даёт (409).
  - **(Фаза 9)** R1: заменить прямой `assignReviewers()` на согласие (invitation→accept), не трогая редактор.
    Пикер ревьюеров в SubmitSheet — базовая форма (без match%/скоринга/занятости-фильтра) — Фаза 9 добавит матчинг.
  - **(Фаза 8)** Блоки имеют стабильные `id` (якоря) — комментарии к блокам привяжутся к ним.
  - **(всё)** dev=Turso (см. расхождение выше) — осторожно с `seed`/деструктивными командами на :3000.

**Что дальше.** Фаза 7 — review-flow.

---

## Фаза 7 — Редакционный review-flow (ReviewPage)

**Статус:** `done`
**Контекст входа.** Требует фазы 1–6 (`done`). Читать: `README.md` §3 (ReviewPage), §11.3 (согласие — учесть на будущее); `CLAUDE.md` (review-flow).
**Разблокирует.** Фазу 8 (комментарии к ревизиям) и фазу 9 (согласие/оценка поверх ревью).
**Старт сессии.** Проверь статусы; фазы 1–6 — `done`. Это сердце продукта — самый крупный экран.

**Цель.** Двухколоночное ревью с тредами, баблами, предложениями правок, вердиктами, чатом сессии
и кросс-экранной синхронизацией статусов.

**Подфазы / Todo.**
- [ ] **7.1 Модель ревью.** Назначения на главу, **ведущий (primary)**, статусы вердиктов на handle,
      `reviewer_history` (кредит по ревизиям), чат сессии (вне тредов), чек-лист готовности.
- [ ] **7.2 Хедер.** `ReviewHeaderV2`: топбар (назад / составной тайтл Блог→Глава / ревизия / статус /
      выбор POV / триггер модалки команды); strip глав (`role="tablist"`); presence-strip (онлайн-точки).
- [ ] **7.3 Канвас.** `ConvoCanvas`: колонка статьи (инлайн-дифф `diffWords(prev,curr)`; правый гаттер: **bauble**
      со счётчиком + `BlockVerdictStamp` циклом approve/fix/discuss; двойной клик → инлайн-правка для автора) +
      `ThreadsRail` (`VerdictLedger` 3 счётчика; `ThreadCard` с якорем-цитатой, suggestion-диффом, вложенными ответами; композер с typing-индикатором).
- [ ] **7.4 Sync + apply.** Двунаправленный клик bauble↔thread (scroll+flash, мобильные табы). **Apply-and-close:**
      `chapter.blocks[i].text` ← replace(suggestion), тред → resolved, бродкаст стора.
- [ ] **7.5 Действия + модалки.** `ActionBar` (sticky): POV ревьюера (Нужны правки / Одобрить — только при `under-review`);
      POV автора (Сменить ведущего / Опубликовать при всех approve / Отправить v{N+1}). `PrimaryChangeModal`, `TeamSheet`,
      `Toast` (`aria-live`). Кросс-экранный стор статусов (на проде — серверное состояние; задел под websocket). Указание ревьюеров в публикации **по версиям**.

**Скиллы и агенты.** Создай и примени скилл `review-flow-domain` (инварианты). Скилл `next-best-practices`. Агенты: `design-watcher`, `code-reviewer`.

### Цикл качества (блокирующий гейт)
- [x] `npm run build` зелёный, `npm run lint` чистый
- [x] Применены скиллы `next-best-practices` + `review-flow-domain`
- [x] Сабагент `code-reviewer`: нет P0/P1 (4 P1 исправлены)
- [x] Сабагент `security-reviewer`: ревьюер не комментирует как читатель; автор не ставит вердикты; гейтинг POV серверный (PASS, 0 critical/high)
- [x] Сабагент `design-watcher`: токены/aria/dark; мобильные табы Статья/Обсуждения; `aria-live` тосты (3 P1 исправлены)
- [x] Сабагент `playwright-tester`: полный цикл v1→тред→apply→approve→publish, sync статусов кросс-экранно = GO
- [x] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [x] Полный цикл проходит; статус синхронно меняется во всех экранах (инбокс/кабинет/ридер).
- [x] Ведущий назначается/меняется; вердикты считаются; публикация — только при всех approve (или force-approve, фаза 10).
- [x] Опубликованная глава показывает ревьюеров (текущие + прошлые версии).

**Журнал фазы.**
- Статус-история: `todo` → `in progress` (2026-06-30) → `done` (2026-06-30). Ветка `phase-7-review-flow`,
  3 коммита (реализация → правки цикла качества → fix live-sync). Цикл качества зелёный.
- Артефакты: `src/lib/diff.ts` (zero-dep `diffWords`), `src/lib/review-links.ts` (клиент-безопасные
  ссылки/константы), `src/lib/queries/review.ts` (`getReviewSession`/`getReviewerQueue`/`resolveReviewAccess`/
  `isAssignedReviewer`/`userIdsByHandle`/`getChapterIdBySlugs`), `createNotifications` в `queries/notifications.ts`;
  9 роутов `src/app/api/review/**` (verdict, threads, threads/[id]/{replies,resolve,apply}, chat,
  submit-revision, publish, primary-change); страницы `author/.../[chapter]/review`,
  `reviewer/review/[chapterId]` (+ `loading.tsx`); клиент `src/components/review/**` (review-screen,
  review-header, convo-canvas, threads-rail, action-bar, review-modals, review-chat, review-primitives,
  review-skeleton); расширён `BlockRenderer` (review-дифф, проп `prev`) + CSS (`.diff-edit`/`.diff-stripe-*`/
  `.blog-fragment-flash`/`.anchor-hi` + dark-border-токены); submit-роут Ф6 уведомляет ревьюеров;
  реальный инбокс ревьюера; ссылка «Ревью» в `blog-detail-view`; href-метки ревью в `NotificationBell`.
- Решения/отклонения:
  - **D1 POV — серверный, без переключателя.** Демо-дропдаун POV прототипа НЕ перенесён: автор-роут →
    POV автора (только владелец), reviewer-роут → POV назначенного ревьюера. Действия гейтятся сервером
    (`resolveReviewAccess`): автор не ставит вердикт; ревьюер не публикует/не применяет правки.
  - **D2 Без вебсокетов.** Состояние — серверное; кросс-экранный sync = поллинг (30с) + `router.refresh()`
    после действия. Presence-точки статичны из `chapter_reviewers.online` (сид). Фейковый «печатает» убран.
  - **D3 Дифф — серверный, zero-dep** (`diffWords` в `BlockRenderer` review-режиме). Изменённый text-блок
    рендерится словесным диффом по СЫРОМУ тексту (инлайн-markdown в изменённом блоке — литералом; это
    осознанное упрощение, markdown-aware дифф — backlog). prev = последняя published-ревизия; нет baseline → без полос.
  - **D4 Apply-and-close — in-place** в текущей under-review ревизии + тред→resolved. Новая ревизия —
    только «Отправить v{N+1}» (`submit-revision`): snapshot текущих блоков в новую ревизию, `prev_blocks` =
    блоки последней published, вердикты обнулены. publish пишет `reviewer_history` (кредит) + `prev_blocks`-baseline
    через submit-revision (не на самой публикации).
  - **D5** Включён чат сессии (`review_chat`). Отложены: инлайн-правка блока двойным кликом, per-block verdict-штампы.
  - **R1 сохранён:** ревьюеры назначаются напрямую в `chapter_reviewers` (submit Ф6 + submit-revision Ф7);
    модель согласия (`review_invitations`) — Фаза 9 (см. риски).
  - **fix live-sync:** `router.refresh()` ловил Suspense-границу `loading.tsx` → ReviewScreen
    перемонтировался (терялся тост, статус не обновлялся live). Обёрнут в `startTransition` — фоновое
    обновление без перемонтажа. Проверено вручную на чистом стенде.
- Цикл качества (зелёный): `build`/`lint`/`tsc` чисто; скиллы `next-best-practices` + `review-flow-domain`
  применены. **code-reviewer**: 0 P0, было 4 P1 — исправлены (verdict race → пересчёт в tx; apply/resolve 409
  на закрытом треде; publish blog.publishedAt в tx; P1-3 «завышенный счётчик инбокса» оказался ложным —
  ключ уже скоупится ревизией). **security-reviewer**: PASS, 0 critical/0 high (все binding-гейты
  подтверждены; single-arg `and()` убран). **design-watcher**: 0 P0, было 3 P1 — исправлены (dark-border-токены;
  мобильные табы → role=tablist; aria-label чата). **playwright-tester**: GO — P0 6/6, P1 7/7; 3×P2/P3
  (тост/live-sync, thread→reply, floating-toolbar) — устранены fix-ом live-sync либо подтверждены как
  артефакты автоматизации (ручная проверка: тост ms:50, reply ок, toolbar ок).
- Backlog (P2/P3):
  - **(P2)** Markdown-aware инлайн-дифф (сейчас словесный дифф по сырому тексту в изменённых блоках).
  - **(P2, Ф9)** `submit-revision` обходит модель согласия (переносит ревьюеров напрямую) — при Ф9 заменить на `review_invitations`.
  - **(P2)** per-block verdict-штампы и инлайн-правка блока двойным кликом (отложены пользователем).
  - **(P3)** ThreadCard — кликабельный `div` (мышь); клавиатурный доступ дан через кнопку «→ блок».
  - **(P2, унаследовано Ф12)** in-memory rate-limit не шарится между serverless-инстансами.
  - **(LOW)** `getReviewSession` в `React.cache` — при расширении роутов (Ф10 force-approve) передавать session вниз, не звать повторно.
  - **(LOW)** defense-in-depth: явный `isBlocked`-гейт в `resolveReviewAccess` (сейчас гасится `getCurrentUser`).
- Риски для следующих фаз:
  - **(Ф8)** review-`threads` ≠ публичные `public_comments` (разные таблицы/роуты) — не смешивать; ревьюер не комментирует как читатель.
  - **(Ф9)** заменить прямое назначение (`assignReviewers`/submit-revision) на приглашение→accept; роуты
    verdict/threads опираются на членство в `chapter_reviewers` — accept будет его наполнять. Пикер SubmitSheet получит матчинг.
  - **(Ф10)** админ: force-approve (обойти гейт all-approve), разбор `primary_change_requests` (Ф7 их пишет +
    уведомляет админа типом `primary_change_request`), `removed_reviewers`. Реальная смена ведущего — Ф10.

**Что дальше.** Фаза 8 — комментирование.

---

## Фаза 8 — Комментирование (читатель ↔ автор ↔ читатель)

**Статус:** `done`
**Контекст входа.** Требует фазы 1–7 (`done`). Читать: `README.md` §7; `CLAUDE.md` (гейтинг комментариев).
**Разблокирует.** Полноту матрицы ролей для фазы 11 (тесты).
**Старт сессии.** Проверь статусы; фазы 1–7 — `done`.

**Цель.** Публичный слой комментариев с привязкой к блокам и ревизиям, окном правки и ролевым
гейтингом. Особый сценарий: диалог **читатель → автор → читатель**.

**Подфазы / Todo.**
- [x] `public_comments`: ключ `blogSlug+chapterSlug+revision`, опц. `anchor {blockId, quote}` (скролл к блоку),
      `editedAt`, `parentId` (вложенность ≤2), `deletedAt` (soft delete). → `src/lib/queries/comments.ts`, `src/app/api/comments/**`.
- [x] `CommentsSection`: фильтр к открытой главе; комментарии к **старой** ревизии — в спойлер «прошлые версии»
      (бейдж «к версии vN»); окно правки 15 мин; клик по цитате — скролл к блоку; новый комментарий наследует главу+ревизию.
- [x] **Гейтинг:** комментируют только читатели (и автор — в своих блогах как участник); ревьюеры не комментируют;
      автор не комментирует чужие блоги; `commentingBlocked` блокирует. Серверный предикат `commentGate` + перепроверка в роутах.
- [x] Голоса за комментарии (±1, race-safe). Stale-детект по ревизии (спойлер). Уведомления `comment_new`/`comment_reply`.
- [x] **(сверх плана)** Фрагментные якоря (выделение текста → «Комментировать» → anchor) + комментарии в режиме `whole`.

**Скиллы и агенты.** Скиллы `next-best-practices`, `security-checklist`. Агенты: `security-reviewer`, `code-reviewer`.

### Цикл качества (блокирующий гейт)
- [x] `npm run build` зелёный, `npm run lint` чистый
- [x] Применены скиллы `next-best-practices` + `security-checklist`
- [x] Сабагент `code-reviewer`: нет P0/P1 (0 P0/P1/P2, 1 P3 исправлен — немой catch в delete)
- [x] Сабагент `security-reviewer`: ревьюер→403 на POST; автор→403 на чужой блог; заблокированный→403; вложенность >2 запрещена сервером; окно правки истекает серверно (PASS, 0 critical/0 high)
- [x] Сабагент `design-watcher`: токены/aria/dark (спойлер прошлых версий, якоря) — 0 P0; pre-existing P1 (focus-ring summary) + 2 P2 (ring-offset) исправлены
- [x] Сабагент `playwright-tester`: «читатель спросил → автор ответил → читатель уточнил» + уведомления = **GO** (9/9 сценариев)
- [x] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [x] Сквозной диалог читатель↔автор↔читатель проходит; уведомления летят.
- [x] Комментарий к старой ревизии уезжает в спойлер; окно правки истекает на 16-й минуте → 403.
- [x] Гейтинг ролей и `commentingBlocked` соблюдаются сервером.

**Журнал фазы.**
- Статус-история: `todo` → `in progress` (2026-06-30, сессия Фазы 8) → `done` (2026-06-30). Ветка `phase-8-comments`.
- Артефакты: `src/lib/queries/comments.ts` (`getChapterComments`/`resolveCommentTarget`/`commentGate`/`EDIT_WINDOW_S`,
  дерево ≤2, soft-delete tombstone, score/myVote батчем); 3 роута `src/app/api/comments/**`
  (`POST` create top-level/reply, `PATCH`+`DELETE` правка/soft-delete, `[id]/vote` toggle ±1);
  клиент `src/components/reader/{comments-slot(RSC),comments-section,comment-item,comment-composer,comment-vote,fragment-comment-button}.tsx`;
  разводка `blog-reader-view.tsx` (single+whole, `data-chapter-slug`, `FragmentCommentButton`, проп `viewer`) +
  передача `viewer` из обеих ридер-страниц; label `comment_new` в `NotificationBell`; `formatRelativeTime` в `lib/format.ts`.
- Решения/отклонения:
  - **D1 Листинг — RSC**, не GET-роут: комментарии грузятся в серверном рендере (как engagement/credit); мутации — роуты.
  - **D2 Глубина ≤2 = глубина от 0**: `cmt_reply_reader` (root→author→reader) — ВАЛИДНАЯ глубина 2 (есть в seed);
    ответ разрешён только если глубина родителя ≤1, ответ на узел глубины 2 → 409. (Перебило черновой вывод Plan-агента «только top-level».)
  - **D3 Ревизия штампуется сервером** (`resolveCommentTarget`), клиентское значение игнорируется (anti-tamper).
  - **D4 Якоря через `[data-block-id]`** (есть на каждом блоке, mode-независим) — `anchorPrefix` не понадобился для скролла.
  - **D5 (сверх плана, по выбору заказчика)** Фрагментный капчур выделения (FragmentCommentButton → CustomEvent → секция)
    и комментарии в режиме `whole` (секция на главу, `sectionId=comments-<slug>`).
  - **D6 Ресинк голоса — через `key`-remount** в CommentItem (не `useEffect` — правило `react-hooks/set-state-in-effect`).
  - **D7 XSS by construction**: текст и `anchor.quote` — текстовые узлы React, без `dangerouslySetInnerHTML`/MDX.
- Backlog (P2/P3):
  - **(P2, Ф12)** `window.confirm` при удалении — заменить на тематизированный инлайн-подтверждение/модалку (design-watcher).
  - **(P2, Ф12)** Гейт глубины — 2 последовательных SELECT (parent→grand); при будущем physical-delete заменить на колонку `depth`/CTE (security medium-1).
  - **(P2, Ф12)** PATCH правки — SELECT до парсинга тела (микро-fail-fast), переставить (security medium-2).
  - **(P3, Ф10)** `publicComments.parentId onDelete: cascade` — при появлении admin hard-delete заменить на `set null` + фильтр осиротевших (иначе снос живых ответов).
  - **(P3)** intent-replay не несёт черновик комментария — гость после логина перенабирает (сейчас просто `?next=…#comments`).
  - **(P2, унаследовано Ф12)** in-memory rate-limit не шарится между serverless-инстансами.
- Риски для следующих фаз:
  - **(Ф9)** Комментарии (`public_comments`/`comment_votes`) независимы от `review_invitations` — Ф9 их не трогает; ревьюер по-прежнему НЕ комментирует (binding).
  - **(Ф10)** Модерация комментариев (жалобы `reports` уже есть, seed `rpt_1`): админ-разбор + (опц.) hard-delete → тогда применить P3-фикс cascade.
  - **(Ф11)** Матрица ролей по комментированию теперь полна — добавить TS-автотесты диалога/гейтов/окна правки.

**Что дальше.** Фаза 9 — подбор ревьюеров.

---

## Фаза 9 — Подбор ревьюеров, согласие, оценка

**Статус:** `done`
**Контекст входа.** Требует фазы 1–8 (`done`). Читать: `README.md` §11 целиком (схема — §11.9). Связано с редактором (фаза 6) и ревью (фаза 7).
**Разблокирует.** Админ-обработку запросов/заявок и доску (фаза 10).
**Старт сессии.** Проверь статусы; фазы 1–8 — `done`. Монетизация и доска-как-страница — НЕ здесь (фаза 10).

**Цель.** Переработать назначение ревьюеров в систему **матчинга + согласия + репутации**.

**Подфазы / Todo.**
- [ ] **9.1 Матчинг + «Топ».** Сервис подбора: `match(skills)` → `pct`; композит = навыки 50% + рейтинг 30% + объём 20%;
      занятость (`load/capacity` → `free|busy|full`, `full` не выбирается). Пикер в `SubmitSheet` (вкладки «По навыкам / Все», поиск). Пустое состояние «нет совпадений».
- [ ] **9.2 Согласие.** `review_invitations` (pending/accepted/declined/flagged). Отправка на ревью создаёт приглашения;
      ревью стартует **только после accept**. Кабинет ревьюера: входящие + Принять/Отклонить; автор уведомляется мгновенно.
      Жалоба `flagged` (при match<50%) снимает главу с ревью → автору вердикт «исправьте навыки».
- [ ] **9.3 Оценка ревьюера.** `reviewer_ratings` (1–5, **приватно**: ревьюер+админ; в «Топ» — только агрегат). Запрос оценки в кабинете автора после публикации.
- [ ] **9.4 Запрос админу (со стороны автора).** `recruit_requests` (pending/approved/rejected + reason) при «нет совпадений»;
      статус виден в кабинете автора. (Обработка админом и публикация на доску — фаза 10.) Блог не публикуется без ревью.

**Скиллы и агенты.** Скиллы `review-flow-domain`, `drizzle-schema`, `next-best-practices`. Агенты: `code-reviewer`, `security-reviewer`, `design-watcher`.

### Цикл качества (блокирующий гейт)
- [ ] `npm run build` зелёный, `npm run lint` чистый
- [ ] Применены скиллы `next-best-practices` + `review-flow-domain` + `drizzle-schema`
- [ ] Сабагент `code-reviewer`: нет P0/P1
- [ ] Сабагент `security-reviewer`: оценки приватны (доступ только ревьюер+админ); согласие нельзя обойти; публикация без ревью невозможна
- [ ] Сабагент `design-watcher`: пикер/кабинет/чипы навыков на токенах; dark mode
- [ ] Сабагент `playwright-tester`: навыки → подбор → приглашение → accept/decline (автор узнаёт сразу) → publish → оценка = GO
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [ ] Полный цикл подбора/согласия/оценки работает; оценка приватная, в «Топ» идёт агрегат.
- [ ] «Нет совпадений» → recruit-запрос со статусом в кабинете автора; жалоба «навыки не совпадают» снимает главу с ревью.
- [ ] Навыки статьи видны читателю и обязательны для отправки.

**Журнал фазы.**
- Статус-история: `todo` → `in progress` (2026-06-30, сессия Фазы 9) → `done` (2026-06-30). Ветка
  `phase-9-reviewer-matching`. Цикл качества зелёный: build/lint ✓; скиллы `next-best-practices` +
  `review-flow-domain` + `drizzle-schema`; `code-reviewer` (P1 пофикшен), `security-reviewer`
  (0 критич., 2 MEDIUM пофикшены), `design-watcher` (0 P0, P1 пофикшены), `playwright-tester` — **GO** (7/7 smoke).
- Решения/отклонения:
  - **`chapter_reviewers` — единственная точка членства в ревью.** submit создаёт `review_invitations`
    (pending), accept наполняет `chapter_reviewers`. Все downstream-гейты (verdict/threads/chat/publish/
    инбокс/queue) уже опираются на `chapter_reviewers` → согласие соблюдается без правок этих роутов.
  - Чистый `src/lib/reviewer-match.ts` (как `review-links.ts`): клиент пересчитывает match%/«Топ»
    вживую при правке навыков; сервер — источник правды (flag-гейт перепроверяет match<50%).
  - «Топ» = навыки 50% + рейтинг 30% + объём 20%; объём = distinct-главы в `reviewer_history` / 60
    (НЕ `reviewerRatingsN`). Занятость: load≥capacity → `full` (не выбирается).
  - **Preview-before-accept:** решение пользователя — «только по карточке» (прототип-faithful);
    экран ревью доступен лишь после accept (resolveReviewAccess не менялся).
  - **Flag (match<50%):** ревизия → `changes-requested`; sibling pending → `declined`; уже принявшие
    остаются; `reviewLoad` не трогаем. Автору — уведомление + плашка «Навыки не совпадают» в кабинете.
  - **`reviewLoad`:** +1 на accept, −1 на publish (закрыт цикл занятости). TOCTOU-защита: статус
    приглашения перечитывается ВНУТРИ транзакции (accept/decline/flag); publish перечитывает вердикты +
    статус ревизии в транзакции (иначе двойной decrement при параллельной публикации).
  - **Приватность оценок:** наружу только агрегат `users.reviewerRating`; `reviewer_ratings.stars`
    читается лишь самим автором (`byHandle`) в `getRatingPrompts`.
  - **Recruit — только автор-сторона** (создание + статус в кабинете; админ-уведомление `recruit_requested`).
    Обработка/доска/заявки — Фаза 10.
  - Новый дизайн-токен `--accent-bg` (light/dark, в `:root`/`.dark` и `@theme inline`).
  - Миграция `0002_*.sql` — только `CREATE UNIQUE INDEX review_invitations(chapter,rev,handle)` (без дрейфа FK).
  - Seed приведён к инвариантному виду: каждая строка `chapter_reviewers` ↔ accepted-приглашение;
    `reviewLoad` = число активных назначений (есть free/busy/full для покрытия пикера).
- Backlog:
  - **(P2, Ф10)** `submit-revision` переносит принявших ревьюеров на новую ревизию напрямую (carry-forward
    из Ф7) — намеренно (re-consent не требуется по доменке), но формально минует приглашения. Если нужна
    строгая модель — создавать ретроспективные accepted-приглашения при carry-forward.
  - **(P2)** `getRatingPrompts`: «последняя» ревизия берётся из `reviewer_history` (пишется только при
    publish — корректно); для явности можно `JOIN chapter_revisions WHERE status='published'`.
  - **(P3)** пикер не маркирует уже принявших ревьюеров как «уже в ревью» (снятие галочки согласие не отзывает).
  - **(P3)** мелкие a11y/UX: `aria-label` на бейдже match%; мигание карточки оценки до `router.refresh`.
  - **(Ф12)** rate-limit in-memory — не шарится между serverless-инстансами (вынести в Turso/KV).
- Риски для следующих фаз:
  - **(Ф10)** force-approve и снятие ревьюера должны консистентно корректировать `reviewLoad`
    (accept=+1 / publish=−1) и статусы приглашений — иначе занятость «поедет».
  - **(Ф10)** админ-обработка `recruit_requests` (approve→`board_calls`, reject→reason автору) и
    заявки/доска: строки recruit + admin-уведомление `recruit_requested` уже создаются автор-стороной.

**Что дальше.** Фаза 10 — админка, модерация, монетизация.

---

## Фаза 10 — Админка, модерация и монетизация

**Статус:** `done`
**Контекст входа.** Требует фазы 1–9 (`done`). Читать: `README.md` §11.5–11.8 (доска/баннеры/пожертвования/rework админки); `CLAUDE.md` (админ).
**Разблокирует.** Полноту продукта перед слоем качества.
**Старт сессии.** Проверь статусы; фазы 1–9 — `done`. Админка строится **один раз** и сразу в финальном виде (rework включён). Четыре подфазы — в одной сессии.

**Цель.** Модерация, роли, баны, публикация, жалобы, смена ведущего + админ-обработка
запросов/заявок ревьюеров + доска «Ищем ревьюеров» + монетизация (баннеры/пожертвования), всё в
переработанной полноэкранной админке.

**Подфазы / Todo.**
- [ ] **10.1 Модерация.** `AdminUsers`/`AdminUserDetail` (создание пользователей — **только админ**, без self-registration;
      тумблеры `isBlocked`/`commentingBlocked`), `AdminReports`/`AdminReportDetail`, `AdminReview` (очередь глав).
      Действия: force-approve (с уведомлением автора), смена ведущего (`primary_change_requests`), снятие ревьюера (`removed_reviewers`+причина),
      hide/show блога, модерация комментариев (soft delete), баны. Кросс-экранный стор (pcRequests/forced/removedReviewers).
- [ ] **10.2 Запросы и заявки ревьюеров.** Очередь `recruit_requests` (approve → публикует направление на доску; reject → причина автору).
      Доска `board_calls` (ведёт админ) + `reviewer_applications` (apply-to-review с доски → принять/отклонить). Точка входа на доску — баннер ленты.
- [ ] **10.3 Монетизация (независимо).** `promo_banners` (карусель ленты; action `internal|external|donate`) и
      `donation_methods` (`link|qr` + флаг включения; QR — загрузка, **без генерации**; **без сумм**). Админ-экраны «Баннеры» и «Пожертвования» — **раздельные**. Модалка «Поддержать» адаптируется под число способов.
- [ ] **10.4 Rework админки.** Полноэкранный портал (шапка сайта скрыта), свой топбар (поиск/крошки),
      сгруппированный сайдбар (Модерация/Люди/Платформа) с единым icon-set, единый ритм дашборда (KPI-плитки + карточки очередей), плотная таблица пользователей.

**Скиллы и агенты.** Скиллы `drizzle-schema`, `next-best-practices`, `security-checklist`. Агенты: `security-reviewer`, `code-reviewer`, `design-watcher`.

### Цикл качества (блокирующий гейт)
- [ ] `npm run build` зелёный, `npm run lint` чистый
- [ ] Применены скиллы `next-best-practices` + `security-checklist` + `drizzle-schema`
- [ ] Сабагент `code-reviewer`: нет P0/P1
- [ ] Сабагент `security-reviewer`: админ-действия под `requireAdmin`; роль не редактируется обычным API; админ не создаёт блоги/главы; QR/ссылки валидируются
- [ ] Сабагент `design-watcher`: админка полноэкранная, единый icon-set, токены/dark; баннеры/модалка пожертвования на токенах
- [ ] Сабагент `playwright-tester`: бан скрывает блоги; force-approve+уведомление; recruit approve→доска / reject→причина; заявка с доски→админка; баннер→модалка = GO
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [ ] Бан автора скрывает все его блоги во всех поверхностях; force-approve публикует и уведомляет; смена ведущего кросс-экранна.
- [ ] Recruit-запрос: approve публикует направление на доску, reject возвращает причину автору; заявки с доски обрабатываются.
- [ ] Баннеры и пожертвования управляются раздельно; админка переработана (полноэкранная, сгруппированная навигация).

**Журнал фазы.**
- Статус-история: `todo` → `in progress` (2026-06-30, сессия Фазы 10) → `done` (2026-06-30). Ветка `phase-10-admin`.
- Артефакты: миграция `0003_*` (`blogs.hidden`); `src/lib/queries/{admin,settings,monetization,board}.ts`;
  `src/components/icons.tsx`; admin-портал RSC route-сегментами `src/app/admin/(protected)/{dashboard,users(+[handle]),
  reports(+[id]),review,recruit,banners,donation}` + `src/app/admin/_components/**` (admin-shell, primitives,
  client, *-actions, banner/donation-manager); `src/app/api/admin/**` (users, blogs, reports, review/{force-approve,
  remove-reviewer,primary}, recruit-requests, board-calls, applications, banners, donation-methods, settings);
  публичная доска `src/app/(reader)/board` + `src/app/api/board/applications`; монетизация на ленте
  `src/components/reader/{promo-carousel,promo-carousel-slot,donate-modal,reviewer-board}.tsx`; расширены
  `review-links.ts` (ADMIN_NOTIFY), `notification-bell.tsx`, `queries/notifications.ts` (clearAdminNotifications),
  `queries/{feed,chapters}.ts` (фильтр `blogs.hidden`); seed: `pcr_1`→`lena_review`, `pb_recruit`→`/board`.
- Решения/отклонения:
  - **Админка = RSC route-сегменты, не клиент-табы** (решение владельца через AskUserQuestion). Каркас Фазы 4
    (`admin-portal-shell.tsx`, useState-табы) переработан в `(protected)/layout.tsx` → клиентский `AdminShell`
    (fullscreen, сгруппированный сайдбар `<Link>`+`aria-current` — паттерн Фазы 5, не tablist) + RSC-страницы на
    экран; мутации — `api/admin/**`. Это даёт deep-link URL (под Playwright Ф11) и RSC-чтение без параллельного
    GET-API-слоя. `(protected)/page.tsx` → redirect на `/admin/dashboard`.
  - **Accept заявки с доски ВЫДАЁТ роль reviewer** зарегистрированному заявителю (решение владельца) + переносит
    навыки в `competencies` (merge). Это **единственный** admin-путь смены роли (остальное чтит «роль не меняется
    обычным API»; `users/[handle]` PATCH — строгий allowlist `isBlocked/commentingBlocked/reviewCapacity`, без `role`,
    admin-роль не трогаем). Гость (`byHandle=null`) — только `accepted`, без аккаунта. (Отклонение от §11.10 gap#14,
    который откладывал role-grant; сделано сейчас осознанно.)
  - **Миграция `0003` `blogs.hidden`** — единственное изменение схемы (плоский boolean ADD COLUMN, без FK-правки
    в отличие от `0001`). Бэкенд скрытия отдельного блога админом (10.1 «hide/show блога»); фильтр `hidden=false`
    добавлен в `getReadableChapters`/`getReadableBlog` → закрывает feed/каталог/подписки/ридер/sitemap/feed.
    Бан автора скрывает все блоги через существующий `users.isBlocked` (отдельного действия не нужно).
  - **Force-approve** = клон `publish`-роута минус гейт «все approve»: published + `reviewer_history` + `reviewLoad −1`
    + `publishedAt` блога + уведомления (автор `force_approved`, ревьюеры `published`). TOCTOU-перечтение статуса в tx.
  - **Снятие ревьюера / смена ведущего** консистентно правят `reviewLoad`/`isPrimary`/`primaryHandle`, гасят
    приглашения; TOCTOU-перечтение в tx (правка по ревью code-reviewer). Кросс-экранно = серверное состояние +
    поллинг ReviewScreen (30с), без вебсокетов (модель Фазы 7).
  - **Модерация комментариев — только soft-delete** (tombstone Фазы 8) при разборе жалобы; hard-delete не вводим
    (избегаем замены `public_comments.parentId` cascade→set null) — в backlog.
  - **«Требует внимания» дашборда синтезируется из реальных pending-сущностей** (reports/recruit/applications/
    primary-changes), не из потока admin-уведомлений — точнее и без хрупкого матчинга payload. У админа нет колокола
    (нет SiteNav); admin-уведомления (`report_filed`/`recruit_requested`/`primary_change_request`) гасятся при разборе
    (`clearAdminNotifications`, где есть стабильный ключ).
  - **DonateModal адаптивна** (одиночный QR — герой / только ссылки — кнопки / смешанно — кнопки+переключатель QR),
    **без сумм**, QR — `next/image` по `/uploads/` (загрузка, без генерации). Баннеры и пожертвования — раздельные
    экраны и независимые флаги; «Стать ревьюером» переехала в баннер `pb_recruit`→`/board`.
  - **Валидация URL** (`src/lib/url.ts`): external→`^https?://`, internal→`/path` (не `//`), QR/cover→`/uploads/`;
    отклоняем `javascript:`/`data:` — закрывает Phase-2 backlog P3-Ф10. Клиентские guard'ы в карусели (defence-in-depth).
- Цикл качества (зелёный): `npm run build` ✓ (24/24 страниц), `npm run lint` ✓ (0), `tsc --noEmit` ✓.
  Скиллы `next-best-practices` + `security-checklist` + `drizzle-schema` применены.
  **code-reviewer**: 0 P0, 3 P1 исправлены (recruit-notify при отсутствующем авторе → guard; `getAdminReportDetail`
  точечный запрос вместо full-scan; TOCTOU-перечтение в `remove-reviewer`); 4 P2/3 P3 — частью исправлены (review-queue
  фильтр активных ревизий; carousel sequential), частью в backlog. **security-reviewer**: PASS — 0 critical/0 high
  (3 medium: in-memory rate-limit→Ф12, 2× defence-in-depth URL guard в карусели — исправлены; 3 low: sort-bounds
  исправлены, `byAdmin`-строка/`npm audit` — приняты). **design-watcher**: GO — 0 P0, 3 P1 исправлены (Esc+focus в
  ApplyModal/HowItWorksModal; `transition-all`→`transition-colors` на точках карусели; +pause-on-hover/focus и
  reduced-motion в карусели — WCAG 2.2.2). **playwright-tester** на :3001: GO — флоу 1–7 (гейтинг/бан→скрытие/
  скрытие блога/force-approve/смена ведущего/recruit→доска/заявка→роль) PASS без багов и console-ошибок; флоу 8
  (board-apply гостя) подтверждён в БД (новая pending-заявка); флоу 9 (DonateModal: ссылки+QR, без сумм)
  перепроверен вручную через MCP. Единственная console-ошибка — 404 seed-QR `/uploads/donations/sbp-qr.png`
  (нет реальных `/uploads/`-файлов до Ф12; не баг кода) → backlog.
- Backlog (P2/P3):
  - **(P3, Ф11/12)** Комментарии: hard-delete жалобщиком/админом + замена `public_comments.parentId` cascade→`set null`
    (сейчас только soft-delete).
  - **(P2, Ф12)** Полный focus-trap в модалках (Esc+автофокус есть; циклический Tab — нет; унаследовано с Ф6/8).
  - **(P3)** `getAdminUsers`/поиск — фильтрация в памяти; при росте вынести в SQL-`LIKE`/пагинацию.
  - **(P3)** Заявки `reviewer_applications` не связаны FK с `board_calls` (свободный `area`); `board_calls.waiting` —
    admin-curated счётчик, не пересчитывается автоматически.
  - **(P3, Ф12)** Онбординг принятых заявок: email + (для гостей) приглашение завести аккаунт (§11.10 gap#14).
  - **(P3)** `removed_reviewers.byAdmin` — строка `"admin"` (у admin-сессии нет `userId`/handle); при мультиадмине ввести идентификатор.
  - **(P2, унаследовано Ф12)** in-memory rate-limit (логин/реакции/board-apply) не шарится между serverless-инстансами.
  - **(P2, унаследовано Ф12)** `npm audit` ~6 moderate (dev/build-зависимости).
- Риски для следующих фаз:
  - **(Ф11)** Матрица ролей пополнилась admin-портал/доской/монетизацией — добавить TS-автотесты: бан→скрытие,
    force-approve, recruit→доска, заявка→роль, баннер→DonateModal, публичный board-apply (вкл. гостя). Admin-логин в
    global-setup — через `ADMIN_PASSWORD_PLAIN` (.env.test); у админа нет колокола (проверять дашборд-очередь, не bell).
  - **(Ф12)** Реальная загрузка QR/обложек (эндпоинт `/uploads/`); seed QR `/uploads/donations/sbp-qr.png` ещё 404
    (DonateModal деградирует в alt/плейсхолдер). Вынести rate-limit в общий стор перед прод-деплоем.
  - **(Ф12)** `blogs.hidden` фильтруется в read-слое ленты/ридера; при добавлении новых публичных поверхностей —
    не забыть фильтр (как и `users.isBlocked`).

**Что дальше.** Фаза 11 — слой качества.

---

## Фаза 11 — Слой качества: тест-кейсы + Playwright

**Статус:** `done`
**Контекст входа.** Требует фазы 1–10 (`done` — продукт собран). Читать: `TESTING.md` целиком; DoD всех продуктовых фаз.
**Разблокирует.** Фазу 12 (hardening идёт по найденным дырам).
**Старт сессии.** Проверь статусы; фазы 1–10 — `done`. Подфазы строго по порядку: документация → MCP → автотесты.

**Цель.** Двухуровневое тестирование: полная тестовая документация (скилл `qa-test-planner`), живое
MCP-исследование и закоммиченные TS-автотесты (`@playwright/test`, скилл `playwright-best-practices`, сабагент `playwright-tester`).

**Подфазы / Todo.**
- [ ] **11.1 Тест-документация** (скилл `qa-test-planner`). `testing/TEST-PLAN.md` (scope, стратегия, тест-стенд, entry/exit, риски);
      `testing/test-cases/TC-{GUEST,READER,AUTHOR,REVIEWER,ADMIN}.md` (шаги/ожидания/предусловия/тест-данные/приоритеты P0–P3);
      сквозные сценарии: **ревью** (глава / весь блог / чат сессии), **публикации** (черновик / v2 с обновлением кредита / портфолио без ревью / в каталог),
      **комментирование** (читатель→автор→читатель, старая версия, окно правки, гейтинг, бан), **подбор** (навыки→приглашение→accept→оценка; recruit; заявка с доски),
      **матрица ролей** (негативные 403/редиректы). `testing/smoke/SMOKE-SUITE.md` (~15 кейсов) и `regression/REGRESSION-SUITE.md`. Шаблон баг-репорта; критические инварианты.
- [ ] **11.2 MCP-исследование.** Через `mcp__playwright__*` пройти ключевые флоу на тест-стенде (3001), снять snapshot/console/network, зафиксировать реальные локаторы и тайминги — основа спеков.
- [ ] **11.3 TS-автотесты + CI.** `playwright.config.ts` (порт 3001, `workers:1`, `fullyParallel:false`, `reuseExistingServer`, репорт `testing/reports/playwright-html`);
      `testing/e2e/global-setup.ts` (auth-state на роль `.auth/{admin,author,reader,reviewer}.json`); POM/фикстуры (Reader, Editor, ReviewPage, Comments, Admin) + ролевые фикстуры;
      спеки `e2e/{guest,reader,author,reviewer,admin}.spec.ts` + `e2e/flows/{review-chapter,review-whole-blog,session-chat,publish,comment-thread,reviewer-matching}.spec.ts` (теги `@smoke`/`@critical`/`@regression`);
      CI (GitHub Actions): поднять стенд, seed, `@smoke` на PR + полный регресс ночью; безопасность/реалтайм (XSS-в-MDX, CSRF, rate-limit, multi-user, console-error monitoring).

**Скиллы и агенты.** Скиллы `qa-test-planner`, `playwright-best-practices`. Сабагент `playwright-tester` (вердикт GO/NO-GO).

### Цикл качества (блокирующий гейт)
- [ ] `npm run build` зелёный, `npm run lint` чистый
- [ ] Применены скиллы `qa-test-planner` + `playwright-best-practices`
- [ ] `npm run test:e2e` зелёный на чистом seed; критические `--repeat-each=5` стабильны (не флакают)
- [ ] Каждый акцентный сценарий имеет TS-спек **и** воспроизведён через MCP
- [ ] Сабагент `code-reviewer` на тест-коде: нет P0/P1
- [ ] Сабагент `playwright-tester`: **GO** (все P0, ≥90% P1) на smoke и регрессе
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [ ] Матрица «роль × действие» полна (позитив+негатив); три акцентных кластера покрыты сквозными сценариями.
- [ ] Auth-state на 4 роли в global-setup; тесты изолированы (единый тест-стенд, sequential); CI настроен.

**Журнал фазы.**
- Статус-история: `todo` → `in progress` (2026-07-08, сессия Фазы 11) → `done` (2026-07-08).
- Итог: **107 TS-тестов в 12 spec-файлах**, полный `test:e2e` зелёный на чистом seed
  (**106 passed / 1 skipped / 0 failed**, ~3.4 мин, workers:1); `test:smoke` — **17/17** изолированно;
  стабильность `guest+reader+security --repeat-each=3` — **120/120** без флаков. `build`+`lint` зелёные.
  16/16 акцентных сценариев пройдены и через MCP (`testing/mcp/MCP-FINDINGS.md`), и TS-спеком.
  Сабагенты: `code-reviewer` — 0 P0, P1 исправлен; `playwright-tester` — GO после фикса самодостаточности smoke.
- Решения/отклонения:
  - **`playwright.config.ts` — в КОРНЕ** (не в `testing/e2e/`, как рисует TESTING.md §6): `package.json`
    гоняет `playwright test` без `-c`; `testDir: testing/e2e`. Схему TESTING.md трактуем как неточность.
  - **Отдельные файлы сверх буквы 11.3:** `security.spec.ts` (CSRF/XSS/rate-limit/httpOnly/timestamps —
    сведены из инвариантов §4), `test-cases/TC-FLOWS.md` (16 мультиролевых сценариев), `testing/mcp/**`
    (артефакт 11.2 — доказательство MCP-прохода), `helpers/{seed,auth,db,throttle}.ts`.
  - **devDep `dotenv`** — конфиг и global-setup читают `.env.test` (нужен `ADMIN_PASSWORD_PLAIN`).
  - **Console-guard** (`fixtures.ts`) падает на `console.error`/`pageerror` с allowlist: `Failed to load
    resource` (сетевой HTTP-шум 404/429, статусы проверяются отдельными API-тестами), `/uploads/*`
    (файлов нет до Ф12), preload-шум turbopack, not-found dev-warning «script tag». Реальные JS-краши
    ловит `pageerror`.
  - **Обход гидрации/rate-limit:** «мёртвые» клики до гидрации Next dev (MCP-FINDINGS §4) — ретрай через
    `expect().toPass`; action rate-limit 1/сек — `throttleMutation` ≥1.5с в POM-мутациях + `toPass`-ретрай
    на негативных API (429→ретрай до 403); login rate-limit — уникальный `X-Forwarded-For` на кейс.
  - **Изоляция:** мутирующие файлы (`admin.spec` + все `flows/*`) — `serial` + `reseed()` в `beforeAll`
    **и `afterAll`** (последнее добавлено после NO-GO от `playwright-tester`: `--grep @smoke` отфильтровывал
    спасавшие reseed'ы соседних flow-файлов, и `review-chapter` оставлял `chp_draft` опубликованным).
    Ролевые файлы — read-only/additive/self-restoring (toggle туда-обратно).
  - **CI без GitHub-секретов:** `scripts/ci/write-env-test.mjs` генерирует `.env.test` на лету (random
    `SESSION_SECRET`, bcrypt-хэш админа с двойным `\\$`-экранированием); `.github/workflows/e2e-smoke.yml`
    (PR: lint+build+@smoke) и `e2e-nightly.yml` (cron: полный регресс + `@critical --repeat-each=3`).
  - **`test.fixme`:** PUB-ARTICLE-уведомление подписчику (баг №1 ниже) — 1 skipped.
- Backlog (из MCP-FINDINGS §6 и code-review):
  - **P1-баги продукта → Фаза 12:** (1) publish не уведомляет подписчиков автора (только команду ревью);
    (2) force-approve не гасит pending `primary_change_request`; (3) снятие ведущего не переназначает
    `primary` (dangling primary).
  - **P2 тест-код:** негативные API-тесты, проверяющие только статус без тела ошибки (security/reader/admin —
    выровнять по соседям); дедуп inline-хелперов `reviewCard`; сузить eslint-override только на `fixtures.ts`/спеки.
  - **Тест-данные:** нет второго видимого автора+блога (полный COM-GATING «автор на чужом видимом»);
    нет ревьюера с match≥50% (негативный UI-тест flag невозможен — покрыт только серверным гейтом).
  - **CI на вырост:** кэш браузеров Playwright, авто-issue при провале nightly, smoke на prod-сборке
    (`next build && next start`).
  - **UI/UX-инварианты** (dark/375px/a11y/reduced-motion, TESTING.md §4) — отложены на Фазу 12.
- Риски для следующих фаз:
  - In-memory rate-limit и review-состояние умрут на Vercel serverless (каждый инстанс — своя Map) →
    durable store в 12.1; тогда `security.spec` rate-limit-кейсы (семантика сброса/XFF-ключ) придётся адаптировать.
  - Тесты гоняются на `next dev` + SQLite-файле; прод — prod-build + Turso: кэш/dynamic прод-сборки e2e не
    покрывает → минимум один smoke на prod-preview в 12.2 (НЕ на тест-стенде).
  - Красный `security.spec` (XSS/CSRF/гейтинг) = NO-GO деплоя. Console-guard allowlist `/uploads/*` снять
    после реальной загрузки изображений (12.1). Carry-forward без re-consent зафиксирован тестом — при
    реализации re-consent (backlog P2 Ф10) спек сломается намеренно.

**Что дальше.** Фаза 12 — hardening + деплой.

---

## Фаза 12 — Hardening + прод-деплой

**Статус:** `done`
**Контекст входа.** Требует фазы 1–11 (`done`, `playwright-tester` = GO). Читать: `README.md` §9 (пробелы); `ENVIRONMENTS.md` (прод).
**Разблокирует.** Релиз (Глобальный DoD).
**Старт сессии.** Проверь статусы; фазы 1–11 — `done`. Две подфазы: сперва закрыть пробелы/прогнать флот агентов (12.1), затем деплой (12.2). Деплой — только после зелёного hardening.

**Цель.** Закрыть production-пробелы (`README.md` §9), прогнать весь флот сабагентов и выкатить
монолит на прод (Turso + Vercel).

**Подфазы / Todo.**
- [x] **12.1 Hardening.**
  - [x] Пробелы: реальный mermaid-js (клиентский, ленивый, тема-aware) · KaTeX (блок `latex` + инлайн `$...$`) ·
        загрузка изображений (`/api/uploads` + UploadField: image/cover/QR; magic-bytes, 4МБ) · серверное
        review-состояние (было готово с Ф7) · presence по heartbeat (`last_seen_at`, поллинг 30с; typing → backlog) ·
        iron-session (было готово с Ф4) · `published_at` по ревизиям (было готово) · уведомление о force-approve
        (было готово) + P1-фиксы Ф11: publish уведомляет подписчиков (`new_chapter`), force-approve/publish гасят
        pending PCR, снятие ведущего переназначает primary · создание пользователей админом (альфа-доступы).
  - [x] a11y: skip-to-content/фокус-кольца/`aria-live`/`tablist`/`reduced-motion` — были готовы (Ф5–10),
        подтверждено аудитом; новые UI (UploadField/PublishModal/форма пользователя) — по тем же правилам.
  - [x] Perf: Lighthouse CI (`lighthouserc.json` + nightly workflow, a11y/bp/seo ≥0.9 error, perf ≥0.8 warn).
- [x] **12.2 Прод-деплой (решение: VPS вместо Vercel+Turso — см. Журнал).**
  - [x] Прод-БД: локальный SQLite `file:/srv/recenza/shared/data/blog.prod.db`, миграции `scripts/migrate.mjs`
        (drizzle-orm migrator, без drizzle-kit), bootstrap-админ через env (self-registration нет).
  - [x] Прод-env: `/srv/recenza/shared/env` (systemd EnvironmentFile, chmod 600; БЕЗ `\$`-escape) —
        `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`, `CRON_SECRET`, `NEXT_PUBLIC_BASE_URL`, `DB_FILE_NAME`, `UPLOADS_DIR`.
  - [x] Cron отложенной публикации: `/api/cron/publish` (Bearer) + systemd `recenza-publish.timer` каждые 5 мин.
  - [x] Прод-проверки: RSS/sitemap/robots с `https://recenza.ru`; security-заголовки; финальный build;
        smoke на живом проде (localhost-контур; HTTPS — после DNS). Runbook (ENVIRONMENTS.md §6) —
        откат/бэкапы/ротация; секреты dev/test/prod разделены, dev возвращён на `file:blog.db`.

**Скиллы и агенты.** **Весь флот:** `security-reviewer`, `code-reviewer`, `design-watcher`, `seo-optimizer`, `playwright-tester`. Скиллы `security-checklist`, `next-best-practices`.

### Цикл качества (блокирующий гейт)
- [x] Финальный `npm run build` зелёный, `npm run lint` чистый
- [x] Сабагент `security-reviewer`: 0 критических (вердикт в Журнале)
- [x] Сабагент `code-reviewer`: без P0/P1 на затронутом (вердикт в Журнале)
- [x] Сабагент `design-watcher`: GO — 0 P0/P1, 2 P2 → backlog (focus-паттерн datetime-local; хит-таргет «Прочитать всё»)
- [x] Сабагент `seo-optimizer`: NO-GO→GO — все 6 находок исправлены в этой же фазе (description на 4 страницах;
      `latex` в SKIP plain-text экстрактора; math-токены выбрасываются из `stripInlineMarks`)
- [x] Сабагент `playwright-tester`: полный `test:e2e` **118/118** (0 skip) на :3001 + прод-smoke на живом сервере = GO
- [x] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [x] Пробелы README §9 закрыты (mermaid-js, KaTeX, загрузка изображений; §9.4/6/7/8 были закрыты в Ф4–10)
      либо в backlog с обоснованием (typing-индикатор — нет realtime-инфраструктуры; см. Backlog).
- [x] Прод поднят (https://recenza.ru, VPS): миграции 0000→0005 применены, админ входит (bootstrap из env),
      гость читает; cron публикует отложенную главу (Bearer `CRON_SECRET`, systemd-timer 5 мин; e2e CRON-01/02).
- [x] Стенды изолированы: dev=`blog.db` (Turso-креды заархивированы), test=`blog.test.db`,
      prod=`/srv/recenza/shared/data/blog.prod.db`; секреты только в `/srv/recenza/shared/env` (chmod 600) и GH Secrets.

**Журнал фазы.**
- Статус-история: `todo` → `in progress` (2026-07-08) → `done` (2026-07-08).
- Решения/отклонения:
  - **Прод — собственный VPS (Ubuntu 24.04, Хельсинки) вместо Vercel+Turso** (решение пользователя).
    Мотив: single-process делает in-memory rate-limit корректным; локальный диск для загрузок (без Vercel Blob);
    systemd-cron без лимитов Hobby-тарифа; близость к RU-аудитории; локальный SQLite тем же libsql-драйвером
    (возврат на Turso — одной env-переменной). Домен `recenza.ru` (до 08.07.2027). Деплой: GH Actions
    `deploy.yml` → standalone-артефакт → rsync → migrate → symlink → restart; конфиги в `deploy/`.
  - **Durable rate-limit ОТМЕНЁН** (был в плане фазы): на одном systemd-инстансе in-memory корректен;
    ограничение «один инстанс, без cluster/pm2» зафиксировано в runbook. Вынос в стор — при масштабировании.
  - **Presence — polling-heartbeat** (`POST /api/review/[id]/heartbeat` раз в 30с, `online = last_seen_at ≥ now−90с`),
    НЕ websocket (serverless-ограничений больше нет, но ws-инфраструктура для альфы избыточна). Typing → backlog.
  - **Отложенная публикация**: `chapter_revisions.scheduled_at` + PublishModal («сейчас»/datetime) + cron
    перепроверяет гейт all-approve в транзакции; провал гейта снимает план и уведомляет автора.
  - **publishRevision()** (`src/lib/queries/publish.ts`) — единая транзакция публикации для publish/force-approve/cron;
    попутно закрыты P1-баги Ф11: (a) fan-out `new_chapter` подписчикам, (b) void pending PCR, (c) переназначение primary.
  - **Создание пользователей админом** (`POST /api/admin/users` + форма) — альфа-модель доступа
    (self-registration в приложении отсутствует по построению).
  - **KaTeX — серверный** (renderToString в RSC, ноль клиентского JS); инлайн `$...$` с анти-ценовой эвристикой
    (нужен LaTeX-подобный символ, кириллица внутри → литерал — найдено e2e на «цена $5 и 10$ рублей»).
    **mermaid — клиентский ленивый** (IntersectionObserver + dynamic import, securityLevel strict, тема-aware).
  - **HSTS — в Caddy** (не в next.config: отравил бы localhost); **CSP → backlog** (нужен nonce-middleware
    для inline-скриптов Next/next-themes). Остальные security-заголовки — в `next.config.ts`.
  - **`outputFileTracingExcludes` обязателен**: без него standalone-трейсер утаскивал в артефакт `.env*`,
    `.git` и `blog.db` (утечка секретов — поймано при первом деплое, исправлено до публикации артефакта).
  - **Миграции на проде — `scripts/migrate.mjs`** (drizzle-orm/libsql migrator): drizzle-kit — devDep и на
    сервер не едет; drizzle-orm докладывается в артефакт (Next бандлит его в чанки, в standalone node_modules его нет).
  - Миграции 0004/0005 — двумя чистыми ALTER (генерация в 2 прохода обходит интерактивный rename-промпт
    drizzle-kit; table-recreate composite-PK не случился — SQLite ≥3.35 умеет DROP COLUMN).
  - `CRON_SECRET` для e2e генерируется эфемерно в `playwright.config.ts` и передаётся webServer-у через env
    (в `.env.test` можно задать постоянный — тогда используется он).
- Backlog:
  - **(P2)** Typing-индикатор в ревью (нужен realtime; колонка `typing` оставлена).
  - **(P2)** CSP (Report-Only → enforce) через nonce-middleware.
  - **(P2)** Durable rate-limit — при горизонтальном масштабировании.
  - **(P2)** Offsite-копии бэкапов (сейчас — локальная ротация 7 на том же диске).
  - **(P2, design)** Унифицировать focus-паттерн `datetime-local`/textarea в review-модалках (ring вместо border);
    ревизия хит-таргетов мелких текстовых кнопок («Прочитать всё» ≈32px).
  - **(P2, унаследовано Ф10)** re-consent при submit-revision (carry-forward без повторного согласия).
  - **(P3)** Смена пароля пользователем (сейчас пароль выдаёт админ лично); e-mail-уведомления.
  - **(P3)** `npm audit`: 6 moderate в dev-цепочках (esbuild/drizzle-kit, postcss/next) — не эксплуатируются в проде.
  - **(P3)** Lighthouse CI — прогнать после стабилизации DNS и включить perf-порог в error.
- Риски / заметки:
  - **DNS recenza.ru** на момент закрытия фазы ещё распространялся (домен зарегистрирован в день деплоя);
    Caddy автоматически ретраит выпуск сертификата (до 30 суток) — HTTPS поднимется без действий.
    До этого прод доступен только с сервера (localhost-smoke пройден полностью).
  - На VPS рядом живёт **AmneziaWG в Docker** (51820/udp, 51821/tcp) — при любых правках ufw не отрезать;
    правило уже добавлено provision.sh.
  - **Один Node-инстанс** — жёсткое условие корректности rate-limit (см. runbook).
  - Прод-секреты сгенерированы свежими и живут только в `/srv/recenza/shared/env` + GH Secrets
    (`DEPLOY_HOST/USER/SSH_KEY`); root-пароль сервера, засветившийся в переписке, отключён
    (PasswordAuthentication no, вход только по ключам).
  - E2E гоняются на dev-сервере (`next dev`); прод — standalone-билд: паритет подтверждён smoke-ом
    на проде; полный e2e на прод-сборке — можно добавить в CI (backlog CI Ф11 «smoke на prod-сборке»).

**Что дальше.** Релиз — см. Глобальный DoD ниже.

---

## Перепроектирование модели (Фазы 13–15) — общий контекст

> Владелец принёс 6 замечаний по альфе; разбор кода показал, что это **одна** корневая проблема:
> **ревью встроено как барьер на входе, а не как награда на выходе**. Отсюда всё остальное — автор
> заблокирован без ревьюера, роли взаимоисключающие, кабинет ревьюера пуст, главная показывает всё подряд.
> Фазы 13–15 меняют модель, а не интерфейс; интерфейс едет за ней.

**Целевая модель.** Публикация свободна. Ревью — сертификат, который покупает распространение.
Автор публикует когда хочет и правит что хочет; ревью запрашивает добровольно, до или после публикации;
прошедшая ревью глава получает бейдж и кредит, а блог с бейджем попадает на главную. Блог без ревью
полностью работоспособен и живёт по прямой ссылке — это канал самопродвижения автора.

**Решения владельца (закреплены, менять только его решением).**

| Вопрос | Решение |
|---|---|
| Публикация | Свободная; ревью — отдельный трек; гейта нет никогда |
| Каналы ревьюера | Три канала + автоэскалация: очередь · инвайт-ссылка эксперта через анкету · запрос в редакцию → доска |
| Главная | Только проверенные блоги; без ревью — по прямой ссылке |
| Ролевая модель | Единый аккаунт с возможностями (`role` → флаги/`roles[]`) |
| Приглашённый автором эксперт | Два уровня бейджа (прозрачность, не запрет) |
| Состав ревью | Один ревьюер достаточен; «ведущий» убрать; тиры по сложности убрать |
| Рейтинг ревьюеров | Убрать полностью. Взамен: SLA + приватная жалоба админу + счётчик объёма + отзыв статуса |
| Регистрация | Остаётся админской — админ создаёт аккаунт и лично выдаёт данные |
| После публикации | Правка всегда → ревизия-черновик поверх; бейдж привязан к номеру ревизии |
| Прозрачность ревью | Только бейдж и имена (публичного заключения ревьюера нет) |
| Профиль «пустого» аккаунта | Есть, но `noindex`; в sitemap — только у кого есть блоги/ревью |
| Блог без ревью | В профиле автора виден, с пометкой; на главную не попадает |
| SEO/RSS | `sitemap.xml` — всё опубликованное, `feed.xml` — только проверенное |
| Ревью-активность ревьюера | **Публично**: таб «Ревью (N)» в профиле + метрика «Отрецензировано» (реверс решения прототипа) |
| Админ | **Остаётся env-based, без строки в `users`** — инвариант `SessionData` не трогаем |

**Прототипы (источник UI-правды для Ф13).** Экспорт Claude Design от 2026-07-25:
`docs/prototype/ui_kits/blog/src/public/feed.jsx` (`ProfileScreen`, `ProfileEditModal`) ·
`docs/prototype/ui_kits/blog/src/private/workspace.jsx` (`WorkspaceScreen`) ·
`docs/prototype/ui_kits/blog/src/shared/components.jsx` (`Nav`, `AvatarMenu`, `rolesOf`/`hasRole`, `ROLE_ORDER`) ·
`docs/prototype/ui_kits/blog/src/app.jsx` (роуты `profile`, `workspace`, `adminlogin`) ·
`docs/prototype/ui_kits/blog/src/data/fake-data.js` (`roles: [...]` у `alex` и `moderator`).
⚠️ Прототип §11 старого `docs/prototype/README.md` (подбор + согласие + рейтинг) с Ф14 становится
историческим — см. 14.8.

**Реестр замечаний.** 62 замечания (12 P0 · 24 P1 · 21 P2 · 5 P3) разобраны по подфазам ниже;
идентификаторы `З-NN` проставлены у соответствующих пунктов, чтобы ничего не потерялось.

**Риски модели и страховки.** Названы при проектировании; каждый закреплён за подфазой, а не оставлен
в переписке. Проверять при закрытии соответствующей фазы.

| # | Риск | Страховка | Где |
|---|------|-----------|-----|
| R-1 | **Мотивация ревьюера тонкая.** Рейтинга нет, публичного заключения нет (решение владельца) — ревьюер получает строчку в кредите и счётчик в профиле. Для альфы на личных договорённостях достаточно; при масштабировании может перестать хватать. | Триггер: если ревьюеры перестают брать заявки из очереди (заявки уходят в SLA-эскалацию чаще, чем берутся) — вводить публичное «Заключение ревьюера» на 2–4 фразы при одобрении: витрина его работы и доказательство читателю, что ревью было содержательным. Решение владельца — **сейчас не делать**. | Ф14, backlog + метрика в 14.3 |
| R-2 | **Главная может оказаться пустой.** Каталог фильтруется по бейджу; если ни один блог не прошёл ревью, витрина пуста — это хуже, чем «все подряд». | Пока проверенных меньше 3 — главная показывает «Выбор редакции» (ручное закрепление админом), то есть витрину наполняет редакция, не открывая её всем. | Ф15, подфаза 15.1 |
| R-3 | **Объём тестов недооценивается.** 134 спека написаны против старой модели: роли, гейт публикации, пикер, рейтинг, «ведущий» зашиты в них. Ориентир: ~40 кейсов переписать, ~15 удалить, ~25 добавить. | Тест-работа вынесена отдельной подфазой в каждой фазе, а не «в конце»; `TEST-PLAN.md` ресинкается в Ф13 первым делом, иначе расхождение 116/134 растёт дальше. | 13.9, 14.8, 15.9 |
| R-4 | **Прототип вводит в заблуждение.** `docs/prototype/README.md` §11 — детальная спека того, что удаляется (подбор + согласие + рейтинг). Без пометки следующая сессия честно реализует пикер и рейтинг заново. | Явная пометка «superseded Фазой 14» в §11 + запись в `CLAUDE.md`. | Ф14, подфаза 14.8 |
| R-5 | **Ф13 меняет ролевую модель на живом проде.** `users.role` читается в ~45 файлах; там, где раньше защищала роль, должен работать ownership — риск незаметно ослабить гейт. | Отдельный блокирующий пункт Цикла качества Ф13 («ни один гейт не ослаблен непреднамеренно») + `security-reviewer` по всему диффу, а не по изменённым роутам. Миграции только аддитивные — откат кода безопасен. | Ф13, Цикл качества |

---

## Фаза 13 — Единый аккаунт, профиль и свободная публикация

**Статус:** `done`
**Контекст входа.** Требует фаз 0–12 (`done`). Читать: общий контекст выше целиком; `CLAUDE.md`
§«Ролевой гейтинг» и §«Архитектура/Auth»; прототипы `feed.jsx` (`ProfileScreen`, `ProfileEditModal`),
`private/workspace.jsx`, `shared/components.jsx` (`rolesOf`/`hasRole`, `Nav`, `AvatarMenu`);
`ENVIRONMENTS.md` §4. Ревью-механику (очередь, бейджи, снос рейтинга) в этой фазе НЕ трогаем — это Ф14.
**Разблокирует.** Фазу 14 (заявки/бейджи опираются на две оси состояния) и Фазу 15 (главная — на бейдж).
**Старт сессии.** Проверь статусы фаз; `blocked` нет. Прочитай эту фазу целиком + прототипы.
Ветка `phase-13-unified-account` от свежего `main`. Класс **L** по `WORKFLOW.md` §0 → журнальная запись
до начала работы, полный флот сабагентов, обязательные новые спеки.

**Цель.** Снять с продукта две ложные посылки: «роль — это одна взаимоисключающая сущность» и
«публикация возможна только через ревью». После фазы любой аккаунт читает, комментирует, ведёт блог
и публикует без ревьюера; профиль един и редактируем; опубликованная глава перестаёт быть терминальной.

**Подфазы / Todo.**
- [ ] **13.1 Возможности вместо ролей.** Миграция `0007`: `users.is_reviewer`, `users.introduced_by`
      (handle пригласившего автора, nullable), `users.can_author` (default true); бэкфилл из `role`
      (`role='reviewer'` → `is_reviewer=1`). Колонка `role` НЕ дропается — код перестаёт её читать
      (З-07…З-09). Гейты: `requireAuthor()` → `requireUser()` + ownership; `requireReviewer()` →
      новый `requireCapability("reviewer")`; `requireRolePage()` → `requireCapabilityPage()`
      (`src/lib/auth.ts` — вся ролевая проверка сходится в `requireUser(role?)`, правок ровно 4 функции).
      Прототипный хелпер `rolesOf`/`hasRole` (`shared/components.jsx:186-191`) переносится как
      `src/lib/roles.ts`: `ROLE_ORDER = ["author","reviewer","admin"]`, **reader — базовый уровень и
      никогда не кабинет**. `users.role` читается в ~45 файлах — ветвление UI переводится на возможности.
      Починить `getSitemapData` (`role === "reviewer"` → флаг) — З-45.
- [ ] **13.2 Снятие ролевых запретов.** Убрать `restrictAuthorId` из `src/app/(reader)/page.tsx`
      (автор видит чужие блоги — З-07). Engagement (голос/закладка/подписка) — любому аккаунту:
      `requireUser("reader")` → `requireUser()` в vote/bookmarks/follows, `/bookmarks` без 307,
      бар «Реакции» всем (З-10) — ⚠️ **реверс uif-5 П4**. Комментарии: ролевой запрет ревьюеру
      заменяется **конфликтом интересов** — нельзя комментировать главу, которую ревьюишь или ревьюил
      (проверка в `commentGate`, `src/lib/queries/comments.ts`) — З-08. «Завести блог» доступно любому
      аккаунту (З-09). Панель «Реакции» не рендерить админу (`canEngage` истинен из-за
      `getCurrentUser() === null`) — З-60.
- [ ] **13.3 Две оси состояния.** Миграция `0007` (та же): `chapter_revisions.review_status`
      (`none|requested|in-review|changes-requested|reviewed`, default `none`). Бэкфилл:
      `under-review` → `status='draft'` + `review_status='in-review'`; `changes-requested` →
      `draft` + `changes-requested`; `published` → `published` + (`reviewed`, если есть строки
      `reviewer_history`, иначе `none`). Значения `under-review`/`changes-requested` в enum `status`
      остаются мёртвыми — **деструктивных миграций нет** (З-04). Перевести все чтения статуса
      (`queries/{author,review,feed,publish}.ts`, кабинет автора, ридер, админ-очередь) на две оси.
- [ ] **13.4 Свободная публикация и жизнь после публикации.** Author-роут публикации ВНЕ review-flow;
      `publishRevision()` (`src/lib/queries/publish.ts`) переиспользуется с новым `gate: "none"`
      (З-01). «Редактировать» у опубликованной главы создаёт **ревизию-черновик поверх** опубликованной;
      читатель видит опубликованную, пока автор не опубликует новую (З-02). Чек-лист готовности
      `readinessChecklist()` (`src/lib/blocks/validate.ts`): 7 пунктов → 5, пункты `reviewers` и
      `primary` уходят; навыки статьи обязательны для **заявки на ревью**, а не для публикации.
      **Здесь же фикс З-05**: при повторной отправке в ту же ревизию сбрасывать
      `chapter_reviewers.verdict` (сейчас роут `submit` таблицу не трогает вовсе → `approve` остаётся
      на изменённом тексте). `submit-revision` привести к новым осям.
- [ ] **13.5 Публичный профиль (полное перепроектирование по прототипу).** Единый профиль вместо union
      `author|reviewer` в `getProfileBySlug` (З-37); снять условие 404 по роли — профиль есть у любого
      аккаунта, у «пустого» — `robots: noindex` (З-36, З-47). По `feed.jsx` `ProfileScreen`:
      **чипы ролей множественные** (map по `rolesOf`), био переезжает в таб «О себе» и не дублируется
      в шапке, соц-ссылки, статистика — авторская только при наличии блогов. Табы: «О себе» ·
      «Блоги (N)» · **«Ревью (N)»** (последний — решение владельца, реверс прототипа, который унёс
      ревью в приватное) + метрика «Отрецензировано» в шапке. В табе «Блоги» — ВСЕ опубликованные блоги
      автора, непроверенные с нейтральной пометкой «без ревью». Пилюля роли `kind === "author" ? …`
      удаляется (З-40), рейтинг ★ из профиля убирается (З-41 — окончательный снос в Ф14),
      статистика перестаёт ветвиться по типу (З-42). Вынести список отрецензированного из
      `getProfileBySlug:136-164` в переиспользуемую функцию (З-44).
- [ ] **13.6 «Рабочее место» — новый приватный роут.** По `private/workspace.jsx`: `/workspace`
      (гард `requireUser()`, `noindex`) — карточки кабинетов по каждой возможности с цифрами
      (автор: Черновики/На ревью/Опубликовано + «N глав ждут ваших правок»; ревьюер: В очереди/Ваш ход/
      Вердиктов + приглашения), кросс-ролевой список **«Требует внимания»**, кнопка «Мой публичный
      профиль», подвал «Аккаунт» (Закладки · Настройки), пустое состояние «Роли выдаёт администратор».
      Карточка «Кабинет администратора» **НЕ реализуется** — админ остаётся env-based без строки
      в `users` (решение владельца). Новый токен `--private` (light/dark) в `globals.css` +
      `DESIGN-TOKENS.md` — иначе пунктирные приватные поверхности не отрисуются.
      ⚠️ **Иконку-замок убрать полностью**, а не заменять — она в ТРЁХ местах прототипа:
      `workspace.jsx:29` (`WsPrivateTag`), `components.jsx:387` (пункт Nav), `components.jsx:558`
      (пункт AvatarMenu). Текстовые подписи («Рабочее место», «Приватная страница · только вы») остаются.
- [ ] **13.7 Настройки аккаунта.** Сейчас `displayName`/`bio`/`links` **не обновляются нигде** — ни
      пользователем, ни админом (allowlist PATCH админа: `isBlocked`/`commentingBlocked`/
      `reviewCapacity`/`password`), значения попадают в БД только при создании (З-38). Реализовать
      `ProfileEditModal` из прототипа (`feed.jsx:744`): имя, био, ссылки + аватар. Отдельно —
      **компетенции ревьюера**: сейчас меняются только при accept заявки, а в Ф14 по ним сортируется
      очередь заявок (З-39). `AvatarChanger` доступен любому аккаунту (З-43).
- [ ] **13.8 Ссылки на профили.** Чипы кредита УЖЕ ссылки на `/u/{slug}`
      (`chapter-reviewer-credit.tsx:9-11`, `blog-reviewer-credit.tsx:41`), но визуально неотличимы
      от статики — усилить аффорданс (З-46). Добавить ссылки там, где `slug` уже есть в данных:
      автор комментария (`comment-item.tsx`, `CommentAuthorView.slug`) — З-48; `TeamSheet` и
      presence-аватарки ревью (`ReviewReviewer.slug`) — З-49. Добавить `slug` в тип
      `AuthorReviewerChip` (`queries/author.ts:30-35`) и сделать `ReviewerChips` в кабинете автора
      ссылками (З-50). `Nav`/`AvatarMenu` по прототипу: «Мой профиль» и «Закладки» — всем,
      «Рабочее место» — при наличии возможностей, подзаголовок меню = роли через « · ».
- [ ] **13.9 Тесты и документация.** Новые спеки: `flows/publish-free.spec.ts` (публикация без ревью +
      правка опубликованной + бейдж-нейтральность), `workspace.spec.ts`, `profile.spec.ts`,
      `settings.spec.ts`. Переписать ролевые негативы (`author.spec`, `reader.spec`, `reviewer.spec`) —
      матрица ролей меняется полностью. Ресинк `testing/TEST-PLAN.md`: в §9 сейчас 116 кейсов против
      134 фактических, отсутствуют TC-AUTHOR-26/27/28, TC-REVIEWER-19, TC-ADMIN-24/25, TC-GUEST-15/16,
      UPL-01..05, BLK-*, CRON-*, SEC-*, PUB-GATE, COM-DEPTH, BLOG-MANAGE (З-32). Обновить `TESTING.md`
      §2 (матрица ролей) и §4 (инварианты) — они описывают старую модель (З-33). `CLAUDE.md`:
      §«Ролевой гейтинг», §Auth, §Gotchas. `ENVIRONMENTS.md` §4: новые колонки. Дубль TC-READER-21 (З-35).

**Скиллы и агенты.** Скиллы `drizzle-schema` (миграция), `next-best-practices`, `security-checklist`
(ролевые гейты — самая опасная зона фазы), `qa-test-planner` (переписывание матрицы),
`playwright-best-practices`. Агенты: `code-reviewer`, `security-reviewer`, `design-watcher`, `seo-optimizer`
(профиль/`noindex`/sitemap), `playwright-tester`.

### Цикл качества (блокирующий гейт)
- [ ] `npm run build` зелёный, `npm run lint` чистый
- [ ] Применены скиллы `next-best-practices` + `security-checklist` + `drizzle-schema`
- [ ] Миграция `0007` проверена вручную (drizzle-kit опускает `onDelete` для `ADD COLUMN`), бэкфилл
      прогнан на копии прод-БД, откат кода безопасен (только аддитивные колонки)
- [ ] Сабагент `code-reviewer` на diff: нет P0/P1
- [ ] Сабагент `security-reviewer`: **ни один гейт не ослаблен непреднамеренно** — ownership на месте
      всюду, где раньше спасала роль; конфликт интересов у комментариев ревьюера проверяется на сервере
- [ ] Сабагент `design-watcher`: профиль/рабочее место/токен `--private` — токены, dark, 375px, хит-таргеты
- [ ] Сабагент `seo-optimizer`: `noindex` у пустого профиля и `/workspace`, sitemap не отдаёт пустые профили
- [ ] Сабагент `playwright-tester`: полный прогон зелёный, 0 skip; GO
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [x] Любой аккаунт читает, комментирует, голосует, подписывается; автор видит чужие блоги.
      ⚠️ «завести блог» — по возможности `can_author`, которую выдаёт админ (решение владельца,
      реверс З-09), а не «любой аккаунт».
- [x] Автор публикует главу без единого ревьюера; опубликованную главу можно править (ревизия-черновик поверх).
- [x] Профиль един, есть у любого аккаунта, редактируется владельцем (имя/био/ссылки/аватар/компетенции).
- [x] `/workspace` собирает кабинеты возможностей; иконки-замка нет ни в одном из трёх мест
      (не портирована вовсе — в `src/components/icons.tsx` её и не было).
- [x] Имя ревьюера и автора комментария ведут на профиль из всех поверхностей.
- [x] З-05 закрыт: вердикт не переживает повторную отправку.
- [x] Доки и тест-документация синхронны коду; полный e2e зелёный (145/145, 0 skip).

**Журнал фазы.** (заполняется по ходу и при закрытии)
- Статус-история: `todo` → `in progress` (2026-07-25) → `done` (2026-07-25, две ветки/два PR).
- **Выкат — два PR подряд** (решение владельца; класс L, но дифф ~80 файлов на живом проде):
  **PR-A `phase-13-capabilities`** = 13.1–13.4 (миграция `0007`, возможности, снятие запретов, две оси,
  свободная публикация, фикс З-05) + свои тесты; **PR-B `phase-13-profile`** = 13.5–13.9 (профиль,
  `/workspace`, `/settings`, ссылки, доки, ресинк TEST-PLAN). Каждый PR самодостаточен, зелён и
  деплоится отдельно — откат точечный. Отклонение от «одна фаза = одна ветка = один PR» осознанное.
- **⚠️ Реверс З-09 (решение владельца).** План закладывал `users.can_author` = true по умолчанию
  («Завести блог» доступно любому аккаунту). Владелец решил иначе: **возможности «автор» и «ревьюер»
  выдаёт админ**, читатель — базовый уровень. Следствия: (1) `can_author` default **false**, бэкфилл
  из `role`; (2) `requireAuthor()`/`requireReviewer()` становятся не `requireUser()+ownership`, а
  `requireCapability(...)` — гейт НЕ ослабляется, что прямо снимает риск R-5; (3) управление
  возможностями (allowlist PATCH + форма создания) поднимается из 15.5 в Ф13 — без него модель
  неадминистрируема; (4) пустое состояние «Рабочего места» («Роли выдаёт администратор») из прототипа
  становится буквально верным; (5) у читателя ЕСТЬ публичный профиль, но нет кабинетов — пункта
  «Рабочее место» в шапке ему не показываем; таб «Ревью» в профиле — только при `is_reviewer`.
- **⚠️ Реверс uif-6 П3 (решение владельца).** Редактирование профиля живёт на новой странице
  `/settings` (канонический адрес, ссылки из «Рабочего места» и меню аватара) **и** модалкой
  «Изменить профиль» на своём `/u/[slug]` — кнопку, убранную в uif-6 П3, возвращаем.
- **⚠️ Реверс uif-5 П4** (заложен планом, подтверждается здесь): engagement (голос/закладка/подписка) —
  любому аккаунту, а не только `reader`.
- **Бэкфилл проверяется на КОПИИ прод-БД на самом VPS** (решение владельца): `cp` прод-БД во временный
  файл → миграция `0007` на копии → сверка счётчиков по `status`/`review_status`/возможностям → `rm`.
  Персональные данные (bcrypt-хэши) не покидают сервер; прод-БД не трогается.
- Отклонения от буквы плана, принятые при проектировании (обоснование — в записи PR-A):
  - `REVISION_STATUSES` **сужается** до `["draft","published"]` (вместо «значения остаются мёртвыми»):
    бэкфилл в той же миграции гарантирует отсутствие мёртвых значений в данных, а компилятор
    превращается в исчерпывающий чек-лист по 47 файлам, читающим статус. Деструктивных изменений нет —
    на уровне SQLite колонка остаётся свободным `text`.
  - `publishRevision()` теряет параметр `gate` целиком (вместо добавления `gate:"none"`): при свободной
    публикации `all-approve` — мёртвый код, а `force` и `none` различались бы только уведомлением.
  - Публикация переезжает в новый `POST /api/author/chapters/[chapterId]/publish` (вместе с
    отложенной), старый `POST /api/review/[chapterId]/publish` удаляется — публикация перестала быть
    частью review-flow.
  - Из 15.3 вынужденно тянется первый пункт (h1 каталога «Все блоги» для всех + «Лента» автору):
    после снятия `restrictAuthorId` заголовок «Все мои блоги» над чужими блогами становится ложью.
  - `commentGate` теряет ОБА ролевых запрета: не только «ревьюер никогда» (З-08), но и «автор только
    в своём блоге» — DoD фазы требует «любой аккаунт читает и комментирует». Вместо них — конфликт
    интересов (нельзя комментировать главу, которую ревьюишь/ревьюил).
- **PR-A `phase-13-capabilities` (13.1–13.4) — что сделано:**
  - Миграция `0007` (аддитив + бэкфилл): `users.is_reviewer/can_author/introduced_by`,
    `chapter_revisions.review_status`. **Проверена на КОПИИ прод-БД на самом VPS** (`cp` → миграция →
    сверка → `rm`; прод-БД не тронута): 5 published → `review_status='none'` (кредита ревью на проде
    нет вовсе), 2 автора → `can_author`, мёртвых `status` — 0, `integrity_check ok`.
  - `src/lib/auth.ts`: `requireCapability`/`requireCapabilityPage`/`requireUserPage`; у `requireUser()`
    **удалён параметр роли** — случайный ролевой гейт стал невозможен (страховка R-5). Имена
    `requireAuthor`/`requireReviewer` сохранены → ~30 роутов не редактировались вовсе.
  - `src/lib/roles.ts` (порт `rolesOf`/`hasRole` прототипа) и `src/lib/review-status.ts` —
    один источник вместо **9 копий** множества активных статусов и **5 копий** UI-словаря.
  - Свободная публикация: новый `POST /api/author/chapters/[id]/publish`, старый
    `/api/review/[id]/publish` удалён; правка опубликованной главы заводит ревизию-черновик поверх;
    чек-лист готовности 7 → 5; фикс **З-05** (вердикты обнуляются при пересдаче).
  - Управление возможностями в админке (поднято из 15.5 — без него модель неадминистрируема).
  - Тесты: **138/138 зелёных, 0 skip** (было 134): новая `flows/publish-free.spec.ts` (4 кейса) +
    переписаны TC-REVIEWER-15/19, TC-AUTHOR-02/08/10+11/23/28, TC-ADMIN-23, COM-GATING, PUB-GATE→
    PUB-FREE, PUB-DRAFT, MATCH-BOARD, CRON-01/02. Сид: возможности, две оси, аккаунт `duo` с обеими.
- **Цикл качества PR-A: GO.** `lint`/`tsc` чистые, полный e2e зелёный, бэкфилл на копии прод-БД.
  Сабагенты нашли **7 P1** — все закрыты до PR и перепроверены (повторный вердикт GO):
  accept заявки с доски писал legacy-`role` вместо `isReviewer` (флоу доски был сломан целиком) ·
  профиль гейтился по `role` (у аккаунта с выданным `canAuthor` профиля не было никогда, а пункт
  «Мой профиль» — теперь у всех — вёл в 404) · `homeForCapabilities` вёл аккаунт с двумя
  возможностями на несуществующий `/workspace` · удаление блога проверяло только `draft` и после
  разведения осей разрешало снести блог из-под ревьюеров с вечно завышенным `reviewLoad` ·
  accept приглашения не переводил ось в `in-review` · кредит `reviewer_history` выдавался всем
  назначенным независимо от вердикта · вакуумное утверждение в новой спеке. Дополнительно закрыты
  P2: fan-out «новая глава» только при первой публикации; `scheduledAt` гасится при появлении новой
  ревизии; cron публикует только последнюю ревизию; «Роль» → «Возможности» в админке; бар реакций
  не предлагает автору подписаться на себя.
- Решения/отклонения (по ходу работы):
  - **`REVISION_STATUSES` сужен до `draft|published`** — компилятор использован как исчерпывающий
    чек-лист по 47 файлам, читавшим статус. Сработало: `tsc` выдал ровно 42 точки, дубли
    `const ACTIVE` (Set<string>) пришлось искать грепом отдельно — типы их не ловят.
  - **`publishRevision()` потерял параметр `gate` целиком** (вместо `gate:"none"` по плану).
  - **Кредит только за `approve`** — следствие свободной публикации: раньше «назначен» и «одобрил»
    совпадали по построению, теперь публиковать можно посреди ревью, и ревьюер, запросивший правки,
    получал бы публичное «проверил это». Побочный эффект: admin force-approve без одобрений больше
    не выдаёт кредит (PUB-DRAFT приведён к этой семантике).
  - **`isReviewOpen` считается по ОБЕИМ осям** (`status !== "published" && review_status !== "none"`):
    `reviewed` намеренно входит в «открытые», чтобы ревьюер мог передумать после общего approve —
    паритет с поведением до Ф13.
  - **Из 15.3 вынужденно поднят первый пункт** (h1 каталога «Все блоги» для всех + «Лента» в шапке
    автору): после снятия `restrictAuthorId` заголовок «Все мои блоги» над чужими блогами стал ложью.
  - **`commentGate` потерял ОБА ролевых запрета** (не только «ревьюер никогда», но и «автор только
    свой блог») — этого требует DoD «любой аккаунт читает и комментирует».
  - **Известное отклонение:** `chapters.title`/`skills` не версионируются, поэтому переименование
    опубликованной главы видно читателю сразу, до публикации новой ревизии. КОНТЕНТ (блоки) не
    протекает — подтверждено спекой и ревью. Версионирование = смена схемы → backlog Ф14.
- Backlog (P2/P3):
  - **(P2, Ф14)** Версионировать `title`/`skills` главы — см. «известное отклонение» выше.
  - **(P2, Ф14)** Отзыв `isReviewer` не чистит `chapter_reviewers`/pending-приглашения/`reviewLoad` —
    доступ закрывается, но назначение «висит».
  - **(P2, Ф14)** Публикация не гасит pending-приглашения этой ревизии: ревьюер видит живое
    приглашение, accept отвечает 409.
  - **(P2)** legacy-shim `users.role` дрейфует: POST его выставляет, PATCH — нет. Снести все чтения
    (после Ф15) либо синхронить в PATCH.
  - **(P2, Ф14)** Конфликт интересов не учитывает **pending**-приглашение: приглашённый, но ещё не
    принявший, может публично комментировать главу, которую вот-вот начнёт рецензировать.
  - **(P3)** cron снимает устаревший план молча, без уведомления автора.
  - **(P3)** `chapter-editor` показывает «Отправить на ревью →» на опубликованной ревизии (сервер
    отвечает 409 до первого форка); баннер/подпись статуса не перечитываются после форка.
  - **(P3)** 375px: h1 и кнопки «Редактировать» в деталях блога дают ~10px горизонтального
    переполнения — **преэкзистующее**, не регресс Ф13 (проверено измерением: пара бейджей 249px
    при ширине 360px укладывается).
  - **(P2, унаследовано)** `npm audit --omit=dev`: 3 high в `next@16.2.9` — бамп отдельным hotfix'ом.
- **PR-B `phase-13-profile` (13.5–13.9) — что сделано:**
  - **Профиль (13.5)** — union `author|reviewer` схлопнут в один `ProfileView`; 404 только у
    заблокированного (З-36/З-37), «пустой» профиль отдаётся с `noindex` и вне sitemap (З-47);
    чипы возможностей множественные (З-40), био в табе «О себе», статистика не ветвится (З-42),
    ★ убран (З-41), `getReviewedChapters` вынесен (З-44). Табы «О себе» · «Блоги (N)» · «Ревью (N)».
  - **«Рабочее место» (13.6)** — новая группа `(account)` (гард + `noindex`), карточки кабинетов,
    «Требует внимания», подвал «Аккаунт», пустое состояние. Карточка админа не реализована.
    Иконка-замок не портирована. Токен `--private` (+`-bg`/`-border`) в обеих темах.
  - **Настройки (13.7)** — `/settings` + `PATCH /api/profile` (строгий allowlist). Закрыты З-38
    (имя/био/ссылки не редактировались нигде) и З-39 (компетенции — только через accept заявки).
    Та же форма модалкой на своём `/u/` (⚠️ реверс uif-6 П3). Попутно закрыт backlog uif-6
    «читателю негде сменить аватар» — аватар доступен любому аккаунту из «Настроек».
  - **Ссылки на профили (13.8)** — З-46/З-48/З-49/З-50; в меню аватара «Настройки» и «Рабочее место».
  - **Тесты/доки (13.9)** — 138 → **145**: новая `account.spec.ts` (WS-01/02, SET-01/02,
    PROF-01/02/03). `TESTING.md` §2 — матрица возможностей вместо ролей, §4 — инварианты Ф13;
    `TEST-PLAN.md` §9 — ресинк traceability (З-32), `DESIGN-TOKENS.md` — `--private`.
- **Цикл качества PR-B: GO.** security-reviewer — 0 critical/high (эскалация через `PATCH /api/profile`
  невозможна, приватное в публичный профиль не течёт); code-reviewer — 1 P1 + 6 P2, все закрыты:
  необработанный `new URL("https://")` → 500 вместо 400 · `/workspace` терял «одобрено, ждёт
  публикации» · ручная плюрализация вместо `plural.ts` · таб «Ревью» гейтился флагом, а не фактом
  ревью · условный рендер панелей выкидывал ссылки на блоги из первичного HTML (SEO) ·
  `homeForCapabilities` не вернули на `/workspace` · флагманский сценарий «единый аккаунт» не был
  воспроизводим в сиде (у `duo` не было ни блога, ни кредита).
- **Проверка на проде (оба PR, read-only — мутирующих сценариев на проде не делали):**
  - **PR-A** (deploy #30158258259, success): миграция `0007` на живой БД дала РОВНО те же числа,
    что сухой прогон на копии — 5 `published/none` + 1 `draft/none`, 2 аккаунта с `can_author`,
    мёртвых `status` — 0, `integrity_check ok`; h1 каталога «Все блоги», «Лента» в шапке,
    удалённый `POST /api/review/[id]/publish` → 404.
  - **PR-B** (deploy по #32, success): `/workspace` и `/settings` гостю → 307 на `/login`;
    профиль автора с публикациями → 200 и два таба (`about` + `blogs`), он же единственный в
    `sitemap.xml`; **профиль читателя `mazzanya` → 200** (до Ф13 был 404) с
    `robots: noindex, nofollow`; профиль автора, у которого блог пока только черновик, тоже
    `noindex` и вне sitemap — «пустой профиль» отрабатывает по определению (З-47), а не по роли.
- Риски для следующих фаз:
  - **Ф14:** `review_status='requested'` теперь реально используется (submit → requested, accept →
    in-review) — очередь заявок должна строиться поверх этого, а не заводить третье состояние.
  - **Ф14:** кредит `reviewer_history` пишется только за `approve` — бейдж уровня (14.4) должен
    опираться на него, а не на состав `chapter_reviewers`.
  - **Ф15:** админка ещё показывает рейтинг ревьюера в карточке пользователя и «ведущего» —
    это снос Ф14/14.5, здесь намеренно не трогали.

**Что дальше.** Фаза 14 — Ревью 2.0: заявки, каналы, бейджи.

---

## Фаза 14 — Ревью 2.0: заявки, каналы, бейджи

**Статус:** `done` (2026-07-25, ветка `phase-14-review-queue`, один PR)
**Контекст входа.** Требует фазы 13 (`done`) — две оси состояния и возможности аккаунта. Читать: общий
контекст выше; `CLAUDE.md` §Review-flow и §Gotchas (submit создаёт приглашения, apply-and-close правит
in-place, `router.refresh()` в `startTransition`); скилл `review-flow-domain`.
**Разблокирует.** Фазу 15 (главная фильтруется по бейджу).
**Старт сессии.** Ветка `phase-14-review-queue`. Класс **L**. Помни: downstream-роуты тредов/вердиктов/
чата опираются на `chapter_reviewers` — при смене способа НАЗНАЧЕНИЯ их править не нужно, и это главная
экономия фазы.

**Цель.** Заменить «автор выбирает ревьюеров и ждёт их согласия» на «автор оставляет заявку, ревьюер
берёт её сам», а результат ревью превратить в бейдж, который открывает распространение.

**Подфазы / Todo.**
- [ ] **14.1 Заявка и очередь.** Миграция `0008`: `review_requests` (`id`, `chapter_id`,
      `revision_number`, `by_handle`, `skills` JSON, `note`, `channel` `queue|invite|editorial`,
      `status` `open|claimed|done|cancelled|expired`, `claimed_by`, `claimed_at`, `due_at`,
      `created_at`, `resolved_at`). Заявку можно создать в ЛЮБОМ статусе главы, включая `published`
      (З-03). Очередь в кабинете ревьюера сортируется по совпадению с ЕГО компетенциями —
      `src/lib/reviewer-match.ts` переворачивается (чистая функция, переиспользуется как есть; раньше
      считала «какой ревьюер подходит автору», теперь «какая заявка подходит мне»). Claim → строка
      `chapter_reviewers` + `reviewLoad +1` + **серверная проверка capacity** (сейчас `full` проверяется
      только в UI — З-06).
- [ ] **14.2 Три канала.** (1) Очередь — 14.1. (2) **Инвайт-ссылка эксперта**: `expert_invites`
      (`token` unique, `by_handle`, `chapter_id` nullable, `status`, `expires_at`), публичная страница
      `/invite/[token]` → анкета → строка в существующей `reviewer_applications` с новыми
      `invited_by` + `invite_token`; **аккаунт создаёт админ** через `POST /api/admin/users` и выдаёт
      данные лично (регистрация остаётся закрытой), на созданном аккаунте — `users.introduced_by`
      (З-18). (3) Запрос в редакцию — существующие `recruit_requests` → `/board`; переписать тексты
      `RECRUIT_HINT` («Блог нельзя опубликовать, пока нет подходящих ревьюеров» перестаёт быть правдой).
- [ ] **14.3 SLA и автоэскалация.** `review_requests.due_at` + роут `/api/cron/review-sla` по образцу
      `/api/cron/publish` (Bearer `CRON_SECRET`, constant-time сравнение). Никто не взял N дней →
      уведомление админу + направление на доску. Взял и молчит M дней → заявка возвращается в очередь,
      `reviewLoad −1`, уведомления автору и админу (З-17). Автор видит таймер в кабинете.
- [ ] **14.4 Бейджи двух уровней.** Уровень выводится из происхождения ревьюера:
      `users.introduced_by == author.handle` → `invited`, иначе `independent` (отдельного флага нет).
      Бейдж привязан к НОМЕРУ ревизии: опубликована v3, ревью прошла v2 → «Проверена версия 2 ·
      текущая версия без ревью». Денормализация в `blogs`: `verified_at`, `verified_tier` —
      пересчёт в той же транзакции, что выдаёт бейдж (по образцу `lastActivityAt` в `publishRevision`).
      «Проверено на Recenza» (independent) пускает блог на главную; «Проверено приглашённым экспертом»
      (invited) — нет (З-19). Поверхности: бейдж у h1 главы, чип на карточке блога, тексты карточек
      кредита.
- [ ] **14.5 Снос устаревшего.** Пикер ревьюеров в `SubmitSheet` (`submit-sheet.tsx:239-413`) — З-13.
      Рейтинг ревьюера в СЕМИ местах: пикер, `topScore` в `reviewer-match.ts:70-75` (вес 30%), плитка
      «Ваш рейтинг» в кабинете, публичный профиль, пилл на карточке админа
      (`admin/users/[handle]/page.tsx:27-29`), `rating-prompt.tsx` + секция «Оцените ревьюеров»,
      слой запросов (`author.ts`, `profile.ts`, `admin.ts`) + роут `POST /api/author/ratings` — З-14, З-41.
      «Ведущий»: `chapter_reviewers.is_primary`, `chapters.primary_handle`, `primary_change_requests`,
      роут `/api/admin/review/[id]/primary`, `/api/review/[id]/primary-change`, метка «ведущий» в
      кредите/чипах/`TeamSheet`, плитка «Смена ведущего» и блок запроса в админке — З-16, З-56.
      `COMPLEXITY_TIERS` (`validate.ts:46-50`) — `complexity` остаётся меткой для читателя и ничего
      не гейтит. `review_invitations` выводится из эксплуатации (снимается и вопрос re-consent при
      `submit-revision` — З-20, и «пикер не помечает принявших» — З-21). **Колонки и таблицы не
      дропаются** — код перестаёт их читать (деструктивные миграции запрещены).
- [ ] **14.6 Кабинет ревьюера.** Из одного экрана-инбокса (`reviewer-inbox-shell.tsx`) — в рабочее
      место с тремя табами: «Очередь» (заявки по компетенциям + таймер SLA), «Мои ревью» (активные,
      **сгруппированные по блогам** — прямое требование владельца), «Завершённые» (опубликованные,
      где я в кредите) — З-15. Вместо плитки рейтинга — «Отрецензировал N глав в M блогах».
      Согласовать с «Рабочим местом» из Ф13 (карточка ревьюера ведёт сюда).
- [ ] **14.7 Уведомления.** Новые типы: заявка взята/возвращена/просрочена, бейдж выдан. Убрать мёртвые:
      `review_primary_change` (объявлен в `review-links.ts`, не отправляется никогда — З-29),
      `reviewer_application_filed` (нет case в `notificationLabel` → рендерится как «Уведомление» —
      З-30), `review_turn` (есть только в сиде — З-31). Тексты — в общем `src/lib/notification-text.ts`.
- [ ] **14.8 Данные и документация.** Сид (`seed-core.ts`) под новую модель: заявки в очереди, главы
      с бейджами обоих уровней, ревьюер с `introduced_by`. Синхронизировать `testing/e2e/helpers/seed.ts`.
      Новые/переписанные спеки: `flows/review-queue.spec.ts` (заявка → claim → вердикт → бейдж),
      `flows/expert-invite.spec.ts`, `cron-sla.spec.ts`; `flows/reviewer-matching.spec.ts` переписать
      целиком (MATCH-INVITE/RECRUIT/BOARD), удалить кейсы рейтинга и ведущего (TC-AUTHOR-17,
      TC-ADMIN-10, TC-REVIEWER-14, REV-PRIMARY). Пометить `docs/prototype/README.md` §11 как
      **superseded Фазой 14** — иначе следующая сессия реализует рейтинг и пикер заново (З-34).
      Обновить `CLAUDE.md` §«Подбор ревьюеров» и §Review-flow, `ENVIRONMENTS.md` §4.

**Скиллы и агенты.** Скиллы `review-flow-domain` (инварианты кредита/вердиктов), `drizzle-schema`,
`next-best-practices`, `security-checklist`. Агенты: `code-reviewer`, `security-reviewer`
(claim нельзя обойти, бейдж нельзя подделать, cron защищён), `design-watcher`, `playwright-tester`.

### Цикл качества (блокирующий гейт)
- [ ] `npm run build` зелёный, `npm run lint` чистый
- [ ] Применены скиллы `review-flow-domain` + `drizzle-schema` + `security-checklist`
- [ ] Миграция `0008` проверена вручную; ничего не дропнуто; откат кода безопасен
- [ ] Сабагент `code-reviewer`: нет P0/P1
- [ ] Сабагент `security-reviewer`: claim проверяет capacity и возможность на сервере; бейдж выдаётся
      только транзакцией ревью; `/api/cron/review-sla` — Bearer + constant-time; приватная жалоба
      видна только админу
- [ ] Сабагент `design-watcher`: бейджи, три таба кабинета, чипы кредита — токены, dark, 375px
- [ ] Сабагент `playwright-tester`: заявка → claim → вердикт → бейдж → главная; SLA-возврат; GO
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [x] Автор нигде не выбирает ревьюеров; ревьюер берёт заявку сам из очереди по своим компетенциям.
- [x] Заявку можно оставить на опубликованную главу; ревью не блокирует публикацию ни в одном сценарии.
      ⚠️ Потребовало смены предиката `isReviewOpen` — без неё пункт был нереализуем (см. Журнал).
- [x] Рейтинг ревьюеров и «ведущий» удалены из кода и UI полностью (таблицы остались, чтения нет).
- [x] Бейдж двух уровней виден читателю и привязан к номеру ревизии. ⚠️ Уточнение владельца:
      бейдж БЛОГА правку переживает (историчен), бейдж ГЛАВЫ — нет; у устаревшего показываются
      номер и ДАТА проверенной версии + ссылка `?v=N` на её чтение.
- [x] SLA возвращает зависшую заявку в очередь без участия человека (14/21 день, покрыто SLA-02).
- [x] Кабинет ревьюера показывает блоги, где он участвует: активные и завершённые (три таба).
- [x] Прототип §11 помечен superseded; доки и тесты синхронны (166/166, 0 skip).

**Журнал фазы.** (заполняется по ходу и при закрытии)
- Статус-история: `todo` → `in progress` (2026-07-25) → `done` (2026-07-25, ветка `phase-14-review-queue`, один PR)
- **Решения владельца, принятые на старте фазы** (AskUserQuestion, закреплены — менять только его решением):
  1. **SLA = 14 / 21 день.** 14 дней заявка висит в очереди без claim → эскалация (уведомление админу +
     направление на доску); 21 день молчания после claim → автовозврат заявки в очередь, `reviewLoad −1`,
     уведомления автору и админу. Константы — в одном модуле (`src/lib/review-sla.ts`).
  2. **Бейдж блога переживает правку.** `blogs.verified_at` — исторический факт «блог проходил ревью»
     (иначе правка опечатки выкидывала бы блог с главной в Ф15). Точная правда живёт на уровне ГЛАВЫ:
     номер и **дата** последней проверенной версии + явная пометка «текущая версия изменилась».
     Сверх плана: читателю дать **прочитать** последнюю проверенную версию (`?v=N`) — старые
     published-ревизии остаются в БД со своими блоками, селектор ревизии в `getReadableBlog` уже
     выбирает max(number) среди published, так что это добавление селектора, а не смена модели.
  3. **Версионирование `chapters.title`/`skills` ВКЛЮЧЕНО в фазу** (backlog Ф13 P2 «(P2, Ф14)»):
     без него бейдж «проверена версия 2» врёт — навыки и заголовок можно поменять задним числом.
  4. **Один PR на всю фазу** (не два, как в Ф13).
- Класс изменения по `WORKFLOW.md` §0 — **L** (новые таблицы + миграция + новые роуты и страницы):
  обязательны новые спеки (happy-path + гейтинг + негатив) и полный флот сабагентов.
- План тестов: новые `flows/review-queue.spec.ts`, `flows/expert-invite.spec.ts`, `cron-sla.spec.ts`,
  бейджи и чтение проверенной версии; переписать `flows/reviewer-matching.spec.ts`; удалить кейсы
  рейтинга и «ведущего» (TC-AUTHOR-17, TC-ADMIN-10, TC-REVIEWER-14, REV-PRIMARY).
- **Две находки, изменившие форму фазы** (обе — в коде, не в плане):
  1. **`isReviewOpen` возвращал `false` для любой `published`-ревизии** — то есть требование 14.1
     «заявку можно оставить в ЛЮБОМ статусе, включая published» (З-03) было НЕРЕАЛИЗУЕМО: вердикт
     отвечал 409 «Глава не на активном ревью». Ось публикации убрана из предиката, закрытие сессии
     стало явным токеном `chapter_revisions.review_closed_at`. Несовместимая смена сигнатуры дала
     компилятор как исчерпывающий чек-лист по 14 точкам (приём Ф13 с `REVISION_STATUSES`).
  2. **Кредит писался ТОЛЬКО в `publishRevision()`.** Ревью уже опубликованной главы не давало бы
     ни кредита, ни бейджа, а `review_load` ревьюера тёк бы навсегда — публикации после одобрения
     не происходит. Выделен общий `closeReviewSession()` (`queries/review-session.ts`) с двумя
     точками вызова: публикация и вердикт-all-approve на published-ревизии.
- Решения/отклонения по ходу работы:
  - **Уровень бейджа при НЕСКОЛЬКИХ ревьюерах** план не определял. Решение: `invited` только если
    ВСЕ кредитованные приведены автором; один независимый поднимает уровень всей ревизии — бейдж
    отвечает на вопрос «проверял ли текст кто-то, кого автор не приводил».
  - **`recomputeBlogVerified()` зовётся БЕЗУСЛОВНО**, а не только при выдаче бейджа: публикация
    непроверенной ревизии тоже меняет картину (у главы бейдж пропадает).
  - **Заявка едет за ревью на новую ревизию** (`submit-revision`): иначе висела бы на устаревшем
    номере, из очереди её отфильтровало бы, а SLA вернул бы в очередь работающего ревьюера.
  - **З-30 диагностирован верно, вылечен иначе:** `reviewer_application_filed` — ЖИВОЙ тип
    (шлётся из `POST /api/board/applications`), у него просто не было `case`. Удаление отняло бы
    у админа уведомления о заявках с доски; вместо этого добавлена подпись.
  - **`COMPLEXITY_TIERS` удалён целиком**, а не «оставлен меткой»: константа состояла из min/max
    ревьюеров, метка там была побочной. Подписи сложности — `COMPLEXITY_LABELS` в `blocks/constants.ts`.
  - Из `reviewer-match.ts` снесены `topScore`/`rankReviewers`/`availability`/`VOLUME_CAP`: без
    рейтинга композит «Топ» не из чего считать, а ранжировать кандидатов больше некому.
    `skillMatch` переиспользован КАК ЕСТЬ — «переворот» подбора свёлся к смене аргументов местами.
  - **Инвариант сида** (найден тест-агентом): у живой заявки ревизия обязана нести
    `requested`/`in-review`. `chp_draft` намеренно оставлен без заявки — живая заявка блокирует
    редактор (`isRevisionEditable(draft, requested) === false`), а на нём стоят все editor-спеки.
- **Цикл качества: GO.** `lint`/`tsc` чистые, `build` зелёный, **e2e 147 → 166, 0 skip**.
  Миграция `0008` прогнана на КОПИИ прод-БД на VPS (`cp` → миграция → сверка → `rm`): `integrity ok`,
  FK чисто, 6 ревизий получили снапшот метаданных, 5 published закрыли исторические сессии,
  бейджей 0 — совпало с журналом Ф13 «кредита ревью на проде нет вовсе».
  Сабагенты: **P0 = 0, P1 = 0**.
  - `security-reviewer` — 0 critical; **1 HIGH закрыт**: apply-and-close правил блоки ЖИВОЙ
    опубликованной ревизии (до Ф14 роут был недостижим на published — это гарантировал предикат).
    Автор мог подменить уже одобренный текст до закрытия сессии и получить бейдж на то, чего
    ревьюеры не видели, — ровно подрыв смысла фазы. 2 MEDIUM закрыты: claim захватывал заявку
    безусловным UPDATE (два параллельных claim'а оба проходили, «потерянный» ревьюер выпадал из
    SLA с зависшим слотом) и не перепроверял видимость автора. 3 LOW закрыты.
  - `code-reviewer` — 0 P0/P1; из 7 P2 закрыты 5 (мёртвый код 14.5, TOCTOU вердикта — поздний голос
    записывался с ответом 200, но кредит уже посчитан без него; пустой PATCH заводил форк).
  - `design-watcher` — 0 P0; **1 P1 закрыт**: уровень бейджа `invited` рисовался разным цветом
    в кабинете и в ридере (локальная копия чипа) — переведено на общий `VerifiedChip`.
  - `seo-optimizer` — дублей в индексе нет: `?v=N` под `noindex` + canonical, редирект при
    `v` = текущей, архив вне sitemap, JSON-LD подавлен.
  - MCP-визуал (:3001, light/dark, 375px): исправлены «2026 г..», акцентный чип у «совпадение 0%»
    и 9px переполнения на `/invite` из-за длинного слова в h1.
- **Функциональные пробелы, которых не было в плане** (найдены прогоном, все закрыты): у автора не
  было UI для выпуска инвайт-ссылки — канал 2 был недостижим; у канала 3 («запрос в редакцию»)
  точка входа ушла вместе с пикером; анкета по инвайту не помечалась у админа и поле «Кто пригласил»
  отсутствовало в форме создания аккаунта — без него уровень `invited` недостижим на практике.
- Backlog (P2/P3):
  - **(P2)** N+1 в свипе 3 SLA-крона: до 4 запросов на заявку в цикле. При десятках заявок неважно,
    при росте — батчить через `inArray`.
  - **(P2)** «Продлить `dueAt`» в свипе 3 идёт вне транзакции и без перепроверки статуса (запись
    безвредна: следующий тик такие строки не выбирает).
  - **(P2)** legacy-shim `users.role` по-прежнему дрейфует (POST выставляет, PATCH — нет).
  - **(P3)** после claim нет `aria-live`: карточка молча исчезает, скринридер этого не объявляет.
  - **(P3)** нет roving `tabindex` в табах кабинета ревьюера — существующий паттерн проекта
    (тот же в `profile-tabs.tsx`), не регресс фазы.
  - **(P2, унаследовано)** `npm audit --omit=dev`: high в `next` — бампом отдельным hotfix'ом.
- **Проверка на проде** (PR #34, deploy 30169204935 = success; read-only, мутирующих сценариев
  на проде не делали):
  - Миграция `0008` на ЖИВОЙ БД дала РОВНО те же числа, что сухой прогон на копии: 6 ревизий
    получили снапшот `title`, 5 `published` закрыли исторические сессии (`review_closed_at`),
    бейджей 0 (кредита ревью на проде нет), `integrity_check ok`, новые таблицы на месте.
  - Снесённые роуты отвечают **404**: `…/submit`, `/api/author/ratings`, `…/primary-change`,
    `/api/reviewer/invitations/…`.
  - `/api/cron/review-sla` без Bearer → **401**; с боевым секретом с самого сервера → 200
    `{ok:true, due:0, …}` (заявок на проде пока нет).
  - `/invite/<мусорный токен>` → нейтральная заглушка «Ссылка недействительна» + `noindex`,
    автор не раскрывается (анти-оракул работает на живом стенде).
  - Архивное чтение: `?v=1` на главе, где 1 — текущая ревизия, отдаёт **307** на канонический URL
    (дубля в индексе не возникает), `?v=99` → **404**.
  - ⚠️ **Потребовалось действие руками:** `deploy.yml` раскатывает код, а systemd-юниты ставит
    `provision.sh`, который на деплое не запускается. Таймер `recenza-review-sla.timer` был
    `not-found` — установлен и включён на сервере (`enable --now`, следующий запуск подтверждён
    в `list-timers`). Без этого SLA-эскалация в проде не работала бы вовсе, хотя код выкатился.
    **Урок на будущее: новый systemd-юнит требует ручной установки после деплоя** — записано
    в `ENVIRONMENTS.md` §6.
- Риски для следующих фаз:
  - **Ф15:** главная ещё НЕ фильтруется по `blogs.verified_at`/`verified_tier` — Ф14 дала только
    данные и поверхности. Страховка пустой витрины (R-2, «Выбор редакции», порог 3) — обязательна:
    на проде сейчас 0 блогов с бейджем, каталог по фильтру был бы пуст.
  - **Ф15:** приватная жалоба на ревью (замена рейтингу) в Ф14 НЕ реализована — она вошла в решение
    владельца, но не в подфазы 14.1–14.8; её место — 15.4 вместе с `POST /api/reports`.
  - **Ф15:** `board_calls.waiting` по-прежнему всегда 0, хотя теперь его можно честно считать
    из `review_requests` (З-57).

**Что дальше.** Фаза 15 — UX читателя/автора и кабинет администратора.

---

## Фаза 15 — UX читателя/автора и кабинет администратора

**Статус:** `done` (2026-07-26, ветка `phase-15-ux-and-admin`, PR #35, один PR)
**Контекст входа.** Требует фаз 13 и 14 (`done`) — главная фильтруется по бейджу из Ф14, админка
управляет возможностями из Ф13. Читать: общий контекст выше; `CLAUDE.md` §«Админка/модерация»;
`docs/prototype/README.md` §3 (карта экранов) и `ui_kits/blog/src/growth/reviewer-board.jsx`.
**Разблокирует.** Ничего — завершает перепроектирование.
**Старт сессии.** Ветка `phase-15-ux-and-admin`. Класс **L**.

**Цель.** Довести до конца читательский и авторский UX под новую модель и **перепроектировать админку**:
при едином аккаунте она становится единственным местом регуляции, а сейчас половина её функций
обслуживает удалённое, и два раздела мертвы по построению.

**Подфазы / Todo.**
- [ ] **15.1 Главная — только проверенные.** Каталог фильтруется по `blogs.verified_at`/`verified_tier`
      (З-24); сортировка перестаёт быть чисто механической (`lastActivityAt desc`). **«Выбор редакции»**:
      `blogs.featured_at` (миграция `0009`) + страница в разделе «Платформа» админки. Страховка пустой
      витрины: пока проверенных меньше 3 — главная показывает «Выбор редакции». `feed.xml` — только
      проверенное, `sitemap.xml` — всё опубликованное (решение владельца). Непроверенный блог виден
      в профиле автора с пометкой «без ревью». Вернуть сортировку/пагинацию вместо жёсткого
      `others.slice(0, 4)` (З-25).
- [ ] **15.2 Ридер.** **«← Предыдущая глава / Следующая глава →» внизу главы** с названиями — сейчас
      перехода нет вообще, единственный путь — правый рельс `SeriesNav` или крошки (З-23, замечание
      владельца №1). Рендер в `ChapterBody` (`blog-reader-view.tsx`) после кредита и комментариев,
      данные уже есть в `blog.chapters`. Страница блога как оглавление вместо редиректа на первую
      главу (З-26). Гид читателя — раздел про ревью и бейджи (З-27). Минимальный футер: о платформе ·
      как стать ревьюером · доска (З-28).
- [ ] **15.3 Навигация и тексты.** «Лента» в шапке ВСЕМ (⚠️ **реверс uif-6 П6 / uif-4 П2**), h1 каталога
      «Все блоги» для всех, «Мои блоги» остаётся только в кабинете (З-12). Гиды (`guide-modal.tsx`)
      переписать под возможности вместо ролей: текст автора про «публикация когда все ревьюеры одобрили»
      становится ложью. Крошка админ-топбара — с вложенностью (З-62).
- [ ] **15.4 Админка: восстановить модерацию.** **Жалобу сейчас невозможно создать** — роута нет,
      кнопки «Пожаловаться» нет, `insert(reports)` существует только в `seed-core.ts:665`; раздел
      «Жалобы» с детальной страницей и soft-delete работает на одной seed-строке (З-51). Реализовать
      `POST /api/reports` + кнопку в ридере и комментариях; `reports.targetType` → enum (сейчас
      свободная строка, поддержан только `"comment"`, остальное печатается «как есть» — З-61).
      **Приватная жалоба на ревью** (замена рейтингу, решение владельца) — расширением `reports`
      полем «о ком», чтобы не плодить экран.
- [ ] **15.5 Админка: управление возможностями.** Выдача/отзыв флага ревьюера **без бана аккаунта**
      (человек остаётся читателем и автором) — сейчас единственный путь смены роли — accept заявки
      с доски (`api/admin/applications/[id]/route.ts:85`), отдельного API нет (З-53). Разбор анкет
      по инвайт-ссылкам из Ф14 (с указанием, кто пригласил). Фильтры в списке пользователей по
      возможностям и статусу + сортировка — сейчас только `?q=` (З-58). Убрать из выборки
      `reviewerRating`, который запрашивается и не отображается.
- [ ] **15.6 Админка: ревью и аудит.** Очередь заявок с **ручным назначением** (подстраховка холодного
      старта) и просроченными SLA. Read-only просмотр ревью для админа: ссылка с `/admin/review` ведёт
      на `/author/blog/.../review`, откуда `requireAuthorPage` редиректит админа на `/admin` — мёртвая
      ссылка (З-54); `resolveReviewAccess` намеренно исключает админа, поэтому нужен отдельный
      admin-view. Журнал действий: подключить существующий `getRemovedReviewers()`
      (`queries/admin.ts:536-540` — написан и не вызывается ни разу) — З-55.
- [ ] **15.7 Админка: информирование.** Админ не видит своих уведомлений: строки `isAdminRecipient=true`
      пишутся (4 типа), `getNotifications` их фильтрует (`notifications.ts:100`), колокола в
      админ-оболочке нет — единственная операция над ними — гашение (З-52). Сделать панель/колокол
      админ-событий. Переработать плитки «Сводки»: убрать «Смена ведущего», добавить заявки в очереди,
      просроченные SLA, выданные бейджи.
- [ ] **15.8 Мелочи из аудита.** `board_calls.waiting` — счётчик «в ожидании: N» всегда 0 (ставится 0
      при создании, API его не меняет, автопересчёта нет): либо автопересчёт из `review_requests`,
      либо убрать из публичного UI (З-57). `coverUrl` баннера есть в схеме и API, но поля в форме нет —
      обложку задать невозможно (З-59).
- [ ] **15.9 Тесты и документация.** Новые спеки: `flows/reports.spec.ts` (создание жалобы → разбор),
      `flows/featured.spec.ts` (главная = проверенные + «Выбор редакции»), `reader-chapter-nav.spec.ts`.
      Переписать `admin.spec.ts` (плитки, фильтры, возможности), `TC-ADMIN.md`, `TC-READER.md`,
      `TC-GUEST.md`. Обновить `CLAUDE.md` §Админка, `TESTING.md` §3, `ENVIRONMENTS.md` §4.

**Скиллы и агенты.** Скиллы `next-best-practices`, `security-checklist` (новый публичный
мутирующий роут жалоб — валидация, rate-limit, CSRF), `qa-test-planner`, `playwright-best-practices`.
Агенты: `code-reviewer`, `security-reviewer`, `design-watcher`, `seo-optimizer` (каталог/`feed.xml`/
`sitemap.xml` расходятся по правилам — проверить оба), `playwright-tester`.

### Цикл качества (блокирующий гейт) — GO
- [x] `npm run build` зелёный, `npm run lint` чистый, `tsc --noEmit` чистый
- [x] Применены скиллы `next-best-practices` + `security-checklist`
- [x] Сабагент `code-reviewer`: **0 P0/P1**; из P2/P3 исправлены два (ревьюер не узнавал о ручном
      назначении; обезличенное сообщение о ёмкости после выноса claim'а), остальные — в backlog
- [x] Сабагент `security-reviewer`: **0 CRITICAL/HIGH/MEDIUM**, 2 LOW → backlog. Подтверждено:
      `resolveReviewAccess` и весь `src/app/api/review/**` имеют НУЛЕВОЙ дифф к `main`
- [x] Сабагент `design-watcher`: **0 P0/P1**, 3 P2 → backlog (дубль модального a11y-хука,
      некликабельные крошки админки, 32px стрелки карусели — преэкзистующее)
- [x] SEO: `sitemap.xml` — всё опубликованное, `feed.xml` — только проверенное (валидный XML и при
      нуле), canonical/OG оглавления блога и `/about` на месте. ⚠️ Сабагент `seo-optimizer` дважды
      обрывался, не выдав отчёт, — проверка сделана вручную по его чек-листу
- [x] Полный регресс: **182/182, 0 skip** (было 166). MCP-визуал: витрина, оглавление, пейджер,
      модалка жалобы — light/dark, 375px
- [x] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [x] Главная — подборка проверенных блогов + «Выбор редакции»; непроверенный блог доступен по ссылке
      и виден в профиле автора с пометкой. ⚠️ Уточнение владельца: пустая витрина показывает пустое
      состояние со ссылкой на каталог, а НЕ откатывается на «показать всё».
- [x] Внизу главы работают переходы к предыдущей и следующей главе (+ страница блога стала оглавлением).
- [x] Жалобу может создать читатель, и админ её разбирает — раздел перестаёт быть декорацией.
- [x] Админ выдаёт и отзывает возможность ревьюера без бана (это работало с Ф13/Ф14 — здесь добавлены
      фильтры, разбор анкет по инвайтам и колокол событий); мёртвых ссылок нет — `/admin/review`
      ведёт на собственный read-only просмотр.
- [x] В админке нет ни одного элемента, управляющего удалённой сущностью (снят и публичный
      рудимент «1–5 звёзд» на доске, оставшийся от рейтинга Ф14).
- [x] Замечания реестра закрыты либо перенесены в backlog. ⚠️ Оговорка: по документам прослеживаются
      **60 из 62** — идентификаторы **З-11** и **З-22** не встречаются в `PLAN.md` ни разу
      (Ф13 — 27, Ф14 — 18, Ф15 — 17), исходный разбор жил в переписке и не восстанавливается.

**Журнал фазы.** (заполняется по ходу и при закрытии)
- Статус-история: `todo` → `in progress` (2026-07-25) → `done` (2026-07-26, PR #35, deploy 30177722937 = success)
- **Решения владельца, полученные на старте фазы** (закрепить, менять только его решением):

  | Вопрос | Решение |
  |---|---|
  | Разбиение фазы | **Один PR** на все подфазы (как Ф14), ветка `phase-15-ux-and-admin` |
  | Что пускает блог на главную | **Только `verified_tier='independent'`** (подтверждение З-19 из Ф14); `invited` — по прямой ссылке и в профиле автора |
  | Пустая витрина (R-2) | Ни проверенных, ни закреплённых → **пустое состояние + ссылка «Все блоги»** (`/?view=all`). Отката на «показать всё подряд» НЕТ — витрина честно отражает состояние платформы |
  | `board_calls.waiting` (З-57) | **Убрать счётчик из UI** (публичная доска + админка); колонка остаётся в БД как legacy, автопересчёт не делаем |

- **Правило витрины** (интерпретация страховки R-2, зафиксирована до кода):
  `verified` = published + `verified_at IS NOT NULL` + `verified_tier='independent'`;
  `featured` = published + `featured_at IS NOT NULL`. При `verified ≥ 3` главная показывает
  «Проверенные блоги» (и «Выбор редакции» сверху, если он не пуст); иначе — «Выбор редакции»
  как `featured ∪ verified` (featured первыми), чтобы 1–2 уже проверенных блога не пропадали
  с витрины; оба пусты → пустое состояние. Каталог `/?view=all` продолжает показывать ВСЁ
  опубликованное — это escape hatch и для читателя, и для автора.
- **Уже закрыто в Ф13 — в объём фазы не входит** (проверено по коду, не переоткрывать):
  «Лента» в шапке видна ВСЕМ (`site-nav.tsx:33-38`, безусловно), h1 каталога «Все блоги» для всех
  (`app/(reader)/page.tsx:46`), текст гида автора про «публикация когда все ревьюеры одобрили»
  переписан (`guide-modal.tsx:44-45`), плитки «Смена ведущего» в дашборде нет (её место заняла
  «Заявки без ревьюера»). Из 15.3 остаются гид «по возможностям вместо ролей» и крошка админки.
- ⚠️ **Реестр 62 замечаний прослеживается по документам только на 60**: идентификаторы **З-11** и
  **З-22** не встречаются в `PLAN.md` ни разу (Ф13 — 27 шт., Ф14 — 18, Ф15 — 17). Восстановить их
  из доков невозможно — исходный разбор жил в переписке. DoD «все 62 закрыты» трактуется как
  «все 60 прослеживаемых закрыты либо перенесены в backlog».
- **Что сделано по подфазам:**
  - **15.1 витрина.** Миграция `0009` (`blogs.featured_at`). Новый чистый `src/lib/showcase.ts`
    (порог, сортировки каталога, пагинация) + `src/lib/queries/showcase.ts`. ⚠️ Ключевое решение:
    фильтр витрины НЕ в `getReadableChapters` — это общий предок ПЯТИ поверхностей, и фильтр в нём
    схлопнул бы `sitemap.xml`, профиль автора и закладки. Каталог `/?view=all` получил сортировку
    и пагинацию вместо жёсткого `others.slice(0, 4)` (З-25). Админ-экран «Выбор редакции».
  - **15.2 ридер.** `ChapterPager` (З-23) считается из уже загруженного `blog.chapters` — новых
    запросов ноль; `/blog/[slug]` стал ОГЛАВЛЕНИЕМ (З-26), `?mode=whole` не тронут; подвал (З-28)
    и страница `/about`.
  - **15.3.** Гид перестроен по возможностям; крошки админки с группой и третьим уровнем (З-62).
  - **15.4 жалобы.** Полный цикл от кнопки до разбора (З-51), типы целей (З-61), приватная жалоба
    на ревью, `hide_blog` одной транзакцией.
  - **15.5.** Фильтры пользователей уехали в SQL (З-58), `introducedBy` подставляется из анкеты,
    снят мёртвый `reviewerRating` из `profile.ts`.
  - **15.6.** `claimReviewRequest()` вынесен в общий модуль, ручное назначение админом идёт через
    него же; read-only просмотр ревью (З-54); подключён `getRemovedReviewers()` (З-55).
  - **15.7.** Колокол админ-событий (З-52) + плитки очереди/SLA/бейджей; дорогой полный
    `getAdminReviewQueue()` в счётчике заменён на `$count`.
  - **15.8.** `board_calls.waiting` убран из UI (З-57), обложка баннера доведена до карусели (З-59).
  - **15.9.** Сид получил три проверенных блога, уровень `invited`, закреплённый блог, многоглавный
    блог и жалобы всех типов; три новых спека; ресинк доков.
- **Решения/отклонения (важное — читать при следующей правке витрины):**
  - **Правило витрины принято как «лестница по режимам», а не «или-или»:** при `verified ≥ 3` —
    секция «Проверенные блоги» (+ «Выбор редакции» сверху, если закрепления есть); иначе —
    «Выбор редакции» = `featured ∪ verified`, чтобы 1–2 уже проверенных блога не пропадали
    с витрины, пока порог не набран. Оба пусты → пустое состояние.
  - **Порог считается по ВСЕЙ платформе, а не по отфильтрованному пулу.** Иначе у читателя,
    подписанного на всех проверенных авторов, витрина молча меняла бы режим.
  - **Секция «Подписки» витринной политикой НЕ фильтруется** — подписка это явный выбор читателя.
  - **`/blog/[slug]` не редиректит, но `?mode=whole` сохранён**: оглавление стало ТРЕТЬИМ
    представлением, а не заменой сплошного чтения (на нём стоит `review-whole-blog.spec`).
  - **`resolveReviewAccess` не тронут ни строкой.** «Read-only» админ-просмотра обеспечено
    отсутствием мутирующих поверхностей, а не послаблением гарда: он намеренно 401-ит админа,
    и на нём стоят 8 роутов `/api/review/**`.
  - **Ручное назначение переиспользует ядро claim'а.** Копия гейтов запрещена — именно так в Ф14
    всплыли непроверяемая ёмкость (З-06) и гонка двух claim'ов.
  - **Rate-limit жалоб — 10 секунд, а не минута.** Против спама работает не окно, а дедуп
    (одна ОТКРЫТАЯ жалоба на цель от одного автора); минутное окно ломало бы негативные спеки.
  - **На доске снята ещё и метрика «1–5 звёзд — оценка авторов»**: рейтинг удалён в Ф14, а публичная
    доска продолжала его обещать. Вместо неё — срок SLA до эскалации.
  - **Два УСТАРЕВШИХ утверждения в `CLAUDE.md` исправлены попутно** (обнаружены сверкой с кодом):
    «engagement — только роль reader» (на деле `requireUser()` без параметра) и «commentGate:
    reviewer никогда» (оба ролевых запрета сняты ещё Ф13). Документ описывал доролевую модель.
- Backlog (P2/P3):
  - **(P3, security-reviewer LOW)** `resolveComment` в `queries/reports.ts` не проверяет видимость
    РОДИТЕЛЬСКОГО блога: пожаловаться можно на комментарий к уже скрытому блогу. Не оракул (ответ
    тот же), но семантически стоит гейтить так же, как `resolveBlog`.
  - **(P3, security-reviewer LOW)** У `POST /api/admin/review-requests/[id]/assign` нет rate-limit
    (в отличие от `report`/`claim`). Actor — только админ, риск минимален.
  - **(P2, SEO)** Страницы пагинации каталога канонизируются на `/` (metadata главной статична).
    Дублей в индексе не создаёт, но self-referencing canonical на `?page=N` был бы корректнее.
  - **(P2, унаследовано)** `npm audit --omit=dev`: high в `next` — бампом отдельным hotfix'ом.
- Риски / заметки:
  - ⚠️ **Гоча стенда, стоившая часа отладки:** `CRON_SECRET` в `.env.test` ПУСТОЙ, а рабочий
    эфемерный секрет генерирует сам `playwright.config.ts` и отдаёт его ТОЛЬКО тому стенду,
    который поднял сам. Если :3001 уже поднят вручную, `cron.spec`/`cron-sla.spec` получают 401.
    Перед полным прогоном стенд надо гасить.
  - **Проверка на проде** (PR #35, deploy 30177722937 = success; read-only, мутирующих сценариев
    не делали): миграция `0009` легла чисто — `blogs.featured_at` и `reports.{note,about_handle,
    resolved_at}` на месте, `integrity_check ok`. Оглавление блога, пейджер между главами, подвал,
    `/about` — 200 и корректный контент. `POST /api/reports`: гостю 401, без Origin 403.
    `GET /api/admin/notifications` гостю 401, `/admin/featured` — 307. `feed.xml` при нуле
    проверенных остаётся валидным XML (пустой канал), `sitemap.xml` отдаёт всё опубликованное.
  - ⚠️ **Витрина на проде ПУСТА и это ожидаемо** (риск R-15.1 материализовался): у обоих
    опубликованных блогов нет ни бейджа, ни закрепления, поэтому главная показывает пустое
    состояние. Наполнить её — редакционное действие: «Платформа → Выбор редакции» → «Закрепить».
  - ⚠️ **Правка `src/**` во время идущего прогона отравляет кэш Turbopack**: битый JSX уронил
    модуль, после чего dev-сервер отдавал 404 на существующие роуты (`/api/auth/user`,
    claim-роут) уже после исправления. Лечится удалением `.next`. Не редактировать исходники,
    пока идёт e2e.

**Что дальше.** Перепроектирование закрыто — дальше пост-релизные итерации по фидбеку.

---

## Пост-релизные итерации (живой журнал)

> Все 12 фаз закрыты; дальнейшая работа — hotfix-ветки/полиш по фидбеку владельца.
> Формат: одна итерация = одна ветка = один PR (squash-merge в `main` → автодеплой на прод).
> **Полный процесс** (классификация изменения, тесты, Цикл качества, чек-лист закрытия) —
> `docs/migration/WORKFLOW.md`; каждая итерация получает запись здесь.

### 2026-07-26 · PR — `feature-ui-feedback-7` (класс M)

- **Задача владельца:** (1) меню аватара — порядок «Мой профиль · Рабочее место · Закладки ·
  Настройки · Выйти», кабинетные пункты и строку роли убрать (маршрут в кабинеты — через
  «Рабочее место»); (2) в гиде «Руководство» убрать кнопки перехода в кабинет, закрытие —
  «Понятно»/крестик/фон/Escape; (3) разобраться в механике «Моя лента»/«Все блоги» и дать
  явный доступ «чётко к проверенным» — переключаемый фильтр.
- **Сделано:**
  - `avatar-menu.tsx`: новый порядок пунктов; `PORTAL`-пункты и `capabilitiesLabel`-подзаголовок
    удалены; «Рабочее место» — по-прежнему только при `caps.length > 0` (решение владельца:
    читателю в пустом хабе делать нечего, «Закладки»/«Настройки» и так рядом). Пункты меню
    подняты до хит-таргета ≥36px (`flex min-h-9`). Шрифты проверены: пункты — Literata,
    `@handle` — осознанный Fira Code; утечек display/mono нет.
  - `guide-modal.tsx`: `GuideSection.cta` стал опциональным; CTA рендерится только при
    `caps.length === 0` — гость «Войти», читатель «Доска "Ищем ревьюеров"»; у автора/ревьюера/duo
    футер = только «Понятно» (у duo и раньше была одна кнопка — ревьюерская, авторская терялась).
  - **Фильтр каталога** (`/?view=all&filter=verified`): чипы «Все / Проверенные» — новый
    `catalog-filter-nav.tsx` (nav «Фильтр каталога», НЕ «Разделы ленты» — на то имя негативные
    e2e); критерий «проверен» = ЛЮБОЙ бейдж (`isReviewVerified`, оба tier) — витринное правило
    «только independent» осталось правилом главной (З-19), у каталога вопрос другой: «прошёл ли
    ревью», уровень виден чипом на карточке. Единый `catalogQuery()` строит query для canonical,
    чипов сортировки/фильтра и пагинации (три рукописные копии схлопнуты — расхождение порядка
    параметров ломало бы canonical, повтор бага Ф15.1). Мусорный `?filter` → «все», не 404.
    В hero «Вашей ленты» вторая ссылка «Проверенные →». Механика лент НЕ менялась (решение
    владельца после разбора: «Подписки» без витринного фильтра + витринная секция; каталог —
    всё опубликованное).
- **Тесты:** TC-AUTHOR-28 — состав И порядок меню одним `toHaveText`, негатив на строку роли,
  «Выйти» — первый реальный клик за всю историю спеков (POM `logout()` был мёртвым, теперь
  идемпотентен); TC-AUTHOR-27 — негатив на кабинетный CTA + «Понятно»; FEATURED-03 — фильтр:
  independent+invited проходят, закреплённый без бейджа нет, смена сортировки сохраняет фильтр,
  «Все» сбрасывает, мусор → дефолт; TC-READER-23 (spec TC-READER-21) — «Проверенные →» из hero.
  TC-доки: TC-AUTHOR-23 переписан (изоляция автора снята ещё З-07, док утверждал обратное),
  TC-REVIEWER-01/22, TC-READER-06/23.
- **Доки:** CLAUDE.md — bullet ui-feedback-7, поправлены устаревшие ui-feedback-4 («Свежее»
  не существует, сплит не ролевой) и ui-feedback-6 (реверс «автор без Ленты»).

### 2026-07-26 · PR — `hotfix-security-audit` (класс L, сквозной аудит ИБ)

- **Задача владельца:** сквозная проверка проекта на ИБ с гарантией «пользователи не получают
  доступ к чужим данным, нет утечек и взломов» + обновление CLAUDE.md.
- **Итог аудита — главное свойство ВЫПОЛНЯЕТСЯ.** Проверены все 57 файлов `src/app/api/**`
  (67 хендлеров), гарды всех четырёх `(protected)/layout.tsx`, auth/csrf/rate-limit, рендер блоков,
  загрузки, запросы Drizzle, секреты, `next.config.ts`, `deploy/**`, git-история.
  **Классического IDOR не найдено ни одного**: ownership проверяется на сервере, возможности
  перечитываются из БД на каждый запрос, `passwordHash` срезается `toPublicUser`, admin-роуты
  используют allowlist'ы без spread, cron-секреты сравниваются `timingSafeEqual`, raw SQL и
  `JSON.parse` вне `db/json.ts` отсутствуют, секретов в git не было никогда
  (`git log --diff-filter=A` по `*.env*`/`*.db`/`*.pem` → только `.env.example`).
  Прод-сид `seed-recenza.mjs` генерирует пароль `randomBytes(24)` — слабый хэш `password`
  из `seed-core.ts` на прод не попадает.
- **Найденное — периметр, учётные данные и модерация**, а не разграничение доступа. 15 находок:

  | # | Риск | Суть |
  |---|------|------|
  | V1 | **HIGH** | Лимит логина обходился подделкой `X-Forwarded-For` (ключ — первый хоп) |
  | V2 | MED | `resolveReviewAccess` не проверял `canAuthor` — снятая возможность не закрывала запись в `/api/review/**` |
  | V3 | MED | Комментарии принимались к блогу, **скрытому админом** (`blogs.hidden` не фильтровался) |
  | V4 | MED | Голоса/закладки без гейта видимости и без запрета self-vote |
  | V5 | MED | `//host` в ссылках блоков рендерился как «внутренний» (без `rel`, фишинг) |
  | V6 | MED | `/uploads/*` в проде отдавался Caddy без security-заголовков |
  | V7 | LOW | Обходимый ранний 413 (chunked), `in` вместо `hasOwn`, путь аватара без нормализации |
  | V8 | LOW | CSRF сверял host без схемы |
  | V9 | LOW | Тайминг-оракул перечисления аккаунтов на логине |
  | V10 | LOW | Треды отдавали 404/409 **до** гарда доступа |
  | V11 | LOW | `anchor.blockId` без лимита длины |
  | V12 | LOW | `heartbeat` без троттлинга |
  | V13 | LOW | Прод-БД читаема группой `caddy`; `NODE_ENV` не закреплён в юните |
  | V14 | INFO | CSP отсутствовал при 5 `dangerouslySetInnerHTML` |
  | V15 | INFO | Дрейф документации (MDX, `stripDangerousHtml`, модель XFF) |

- **V1 — почему это было HIGH.** Первый хоп XFF задаёт клиент: CF *дописывает* реальный IP к
  присланному, Caddy дописывает свой. Ротация заголовка на каждый запрос давала свежее ведро →
  неограниченный перебор `ADMIN_PASSWORD_HASH` и паролей; при одном Node-процессе и чистом JS
  bcryptjs это ещё и CPU-DoS. `store` вдобавок никогда не чистился. ⚠️ **Ошибочная модель была
  ЗАПИСАНА в `ENVIRONMENTS.md` §6.6** («CF передаёт IP первым элементом… лимит работает») — правка
  документа входит в этот PR, иначе находку «починили бы обратно».
  Решение: `clientKey()` = `CF-Connecting-IP` → последний хоп XFF → `"local"`, **плюс второе,
  пер-аккаунтное ведро** (`acct:<handle>`/`acct:admin`, 15/15мин), не зависящее от IP вовсе.
  Проверено вручную: ротация первого хопа → 429 на 6-й; уникальные доверенные IP → 429 на 15-й.
  ⚠️ **Принятый владельцем риск:** админ-аккаунт можно запереть снаружи на 15 минут.
  Аварийный выход — `sudo systemctl restart recenza` (вёдра in-memory). Зафиксировано в CLAUDE.md.
- **V14 — CSP сделан полным nonce-based** (решение владельца), `src/middleware.ts`.
  Две ловушки, найденные прогоном e2e (35 падений → 0):
  1. **`<script type="application/ld+json">` nonce ставить НЕЛЬЗЯ.** Браузер скрывает значение
     nonce от чтения из DOM (антиэксфильтрация), поэтому React при гидрации видит `nonce=""` против
     серверного → hydration mismatch на КАЖДОЙ странице главы. И он не нужен: data-block по спеке
     выходит из «prepare the script element» до проверки CSP и не блокируется.
  2. **`next-themes` обязан получить nonce** — иначе его инлайн-скрипт темы блокируется.
  `style-src` оставлен с `'unsafe-inline'` осознанно: KaTeX/Shiki/Mermaid пишут инлайн-стили,
  а риск инлайн-стиля несопоставим со скриптом. В dev добавляются `'unsafe-eval'` и `ws:` (HMR).
  ⚠️ Middleware заведён ТОЛЬКО ради заголовков и **не является гейтом аутентификации** —
  гейтинг остаётся пороутовым; превращать его в гард запрещено.
- **V12 — троттлинг heartbeat сделан условным UPDATE, а не `hitActionRate`.** In-memory лимит
  «пропускал» запись молча, и presence разъезжался с реальностью (поймано e2e REV-PRESENCE: `reseed()`
  откатывает `last_seen_at` в БД, а память процесса о недавней записи остаётся). Порог теперь живёт
  в данных: `WHERE last_seen_at IS NULL OR last_seen_at < now-5`. ⚠️ Ветка `IS NULL` обязательна —
  у только что взявшего заявку ревьюера отметки нет, а `NULL < x` даёт NULL, и первый heartbeat
  не записался бы никогда.
- **V4 меняет публичное поведение:** голос за СВОЙ блог теперь 403 (накрутка `?sort=top` и витрины;
  симметрично давнему запрету голоса за свой комментарий). Кейс `TC-AUTHOR-28` переписан: голосует
  за чужой блог (смысл кейса — «возможность реагировать не зависит от роли»), плюс добавлена
  проверка нового инварианта.
- **Инфраструктура** (файлы в репозитории; применение на сервере — отдельным шагом после деплоя):
  `deploy/Caddyfile` — `nosniff`/`X-Frame-Options`/узкий CSP на `handle_path /uploads/*`;
  `deploy/provision.sh` — `chmod 700 /srv/recenza/shared/data` (группа `caddy` читала `blog.prod.db`
  с bcrypt-хэшами — она в группе `recenza` ради `uploads`); `deploy/recenza.service` —
  явный `Environment=NODE_ENV=production` (от него зависит флаг `secure` у cookie и требование
  https в CSRF; раньше держалось на поведении standalone-артефакта).
- **Мёртвые зависимости удалены:** `next-mdx-remote` и `rehype-pretty-code` были объявлены без
  единой ссылки в `src/`. MDX-конвейера в проекте нет — блоки это структурный JSON → React-узлы.
  Правила `.claude/rules/mdx-components.md` и `security.md` требовали несуществующей
  `stripDangerousHtml()` — исправлено, чтобы ревьюер не делал ложных выводов.
- **Проверка:** `npm run lint` + `npm run build` зелёные; полный `npx playwright test` — **182
  passed, 0 skipped**. Вручную на стенде: ротация XFF, пер-аккаунтный лимит, CSP-заголовок с
  nonce, комментарий/голос/закладка к скрытому админом блогу → 404, политика ссылок.
- **Инфра применена на сервере 2026-07-26** (после мержа PR): `chmod 700` на `shared/data`
  (проверено: `caddy` доступ потерял, `recenza` сохранил), заголовки на `/uploads/*` (валидация
  конфига → `systemctl reload caddy`), `NODE_ENV=production` в юните (`daemon-reload` + restart,
  подтверждено в `/proc/<pid>/environ`). Сайт после перезапуска: `/`, `/board`, `/about` → 200.
  ⚠️ **Найдено попутно и записано в `ENVIRONMENTS.md` §6.3: `deploy.yml` конфиги из `deploy/**`
  на сервер НЕ возит** — правка `Caddyfile`/юнита в PR сама по себе прод не меняет.
- **Осталось в backlog:** allowlist CF-диапазонов в ufw (закрыл бы подделку `CF-Connecting-IP` при
  прямом заходе на origin мимо CF); инвалидация сессий при смене пароля; вынос rate-limit в
  durable-стор при горизонтальном масштабировании.

### 2026-07-25 · PR — `hotfix-author-default-visibility` (класс M)

- **Уточнение модели Ф13 по решению владельца** (сразу после закрытия фазы), два пункта:
  1. **Авторство включено по умолчанию.** Новый аккаунт может вести блоги; чекбокс «Автор» в форме
     создания предотмечен, `POST /api/admin/users` трактует отсутствие поля как `true`
     (`body.canAuthor !== false`). Ревьюерство по-прежнему выдаётся явно.
     ⚠️ Это **частичный откат** решения «обе возможности выдаёт админ» (оно же было реверсом З-09):
     теперь админ авторство **снимает**, а не выдаёт. Ревьюерство модель не меняет.
  2. **Снятие `can_author` ПРЯЧЕТ все блоги автора** — новое требование, которого не было ни в
     плане Ф13, ни в реестре замечаний.
- **Почему дефолт живёт в API, а не в схеме.** Сменить `DEFAULT` колонки в SQLite можно только
  пересозданием таблицы, а на `users.handle` ссылаются FK всех ревью-таблиц — это ровно тот класс
  деструктивных миграций, который запрещён. Поэтому колонка осталась `default(false)`, а дефолт
  задаёт единственный путь создания пользователя (админ-роут). Комментарий об этом — в схеме и роуте.
- **Скрытие деривационное, не мутирующее.** Добавлен фильтр `eq(users.canAuthor, true)` в
  ридер-запросы — ровно там же, где уже стоял `isBlocked`: `feed.ts` (`getReadableChapters` —
  лента, каталог, подписки, `sitemap.xml`, `feed.xml`, блоги в профиле), `chapters.ts`
  (`getReadableBlog` — прямая ссылка теперь 404, а не только пропажа из каталога), `comments.ts`
  (`resolveCommentTarget` — новые комментарии к скрытой главе не принимаются), `bookmarks.ts`.
  `blogs.hidden` и данные НЕ трогаются: вернули флаг — вернулись блоги в прежнем виде.
  Кредит `reviewer_history` не затрагивается никогда (история ревью иммутабельна).
- **Портфолио «Об авторе» скрывается вместе с блогами** (находка security-review): это тоже
  авторский контент, иначе у скрытого автора оставалась бы публичная витрина. Био и ссылки —
  личные данные профиля — остаются, профиль не 404-ится (это не бан).
- **`scripts/seed-recenza.mjs` чинит мину доступности** (находка security-review, была
  блокирующей): скрипт вставлял пользователя `recenza` без `can_author`, а `DEFAULT` колонки —
  `false`. На текущем проде флаг проставила миграция `0007`, но на ЛЮБОЙ свежей БД официальный
  блог опубликовался бы и молча пропал из каталога/прямой ссылки/sitemap. Теперь `canAuthor: true`
  в inline-схеме и вставке, а guard существующего пользователя проверяет возможность вместо
  legacy-роли и останавливает сид с внятной ошибкой, если флаг снят админом.
- **Следствие, о котором стоит помнить:** вместе с блогами автор теряет и доступ к `/author`
  (это поведение существующего capability-гарда, не новое) — то есть не видит и своих черновиков,
  пока админ не вернёт флаг.
- **Цикл качества: GO.** `security-reviewer` по всем публичным поверхностям — **обхода скрытия
  нет** (лента, каталог, прямая ссылка + метаданные/OG, sitemap, feed.xml, закладки, профиль
  включая кредит ревью, приём комментариев, подписка). 0 critical/high; оба medium закрыты в этом
  же PR. Трактовка дефолта проверена: `"false"`/`null`/`0` отбиваются 400 type-guard'ом ДО
  дефолта, так что «админ хотел выключить, а включилось» невозможно.
- **Проверка на проде** (PR #33, deploy success): выкат поведенчески нейтрален — у обоих
  прод-авторов `can_author = 1` (проставила миграция `0007`), поэтому ничего не скрылось.
  Сверено после деплоя: официальный блог в каталоге и в `sitemap.xml`, `/blog/o-recenza` → 307 на
  первую главу (штатный редирект) → 200 с контентом, `/u/recenza` → 200. Единственный аккаунт
  с `can_author = 0` — читатель `mazzanya`; блогов у него нет, новый дефолт на существующие
  строки не распространяется (по решению владельца — «для новых пользователей»).
- **Backlog (low, не регресс этой ветки):** `POST /api/blogs/[id]/vote` и `POST /api/bookmarks`
  проверяют только существование блога (можно голосовать за скрытый, зная ULID — оракул
  существования) · `/api/cron/publish` не смотрит на `can_author`: отложенная публикация скрытого
  автора разошлёт подписчикам ссылку на 404 · старые уведомления хранят href на скрытые главы ·
  файлы `/uploads/` скрытого автора остаются доступны по прямому URL (как и при бане).
- **Тексты админки** переписаны: форма создания объясняет дефолт, карточка пользователя
  предупреждает, что снятие «вести блоги» скрывает блоги отовсюду и что это обратимо.
- **Тесты**: 145 → **147**, полный прогон зелёный, 0 skip. Новые кейсы в `account.spec.ts`:
  **CAP-01** (снятие → каталог/прямая ссылка 404/sitemap/приём комментариев; возврат
  восстанавливает) и **CAP-02** (новый аккаунт по умолчанию заводит блог). `TC-ADMIN-23` приведён
  к новому дефолту: «читателя» админ создаёт, СНЯВ отметку.
- Доки: `CLAUDE.md` §«Гейтинг по возможностям», `TESTING.md` §2/§4, `TEST-PLAN.md` §9.7.

### 2026-07-25 · PR — `docs-phases-13-15` (класс S, docs-PR)
- **Продуктовый разбор альфы по 6 замечаниям владельца** → оформлены **Фазы 13–15** (перепроектирование
  модели) + раздел «Перепроектирование модели — общий контекст». Кода не касались: изменён ровно один
  файл `docs/migration/PLAN.md` (+~420 строк).
- **Диагноз**: 6 замечаний оказались одной корневой проблемой — **ревью встроено как барьер на входе,
  а не как награда на выходе**. Проверено в коде: `status='published'` пишется единственно в
  `publishRevision()`, роут — `/api/review/[id]/publish` с гейтом all-approve (пути публикации без ревью
  не существует); «сложный» блог требует 3–5 ревьюеров + ведущего (`COMPLEXITY_TIERS`); опубликованная
  глава терминальна (`PATCH` → 409, `submit` → 409); роли взаимоисключающие (автор не видит чужие блоги).
- **Реестр 62 замечаний** (12 P0 · 24 P1 · 21 P2 · 5 P3), из них найдено при разборе, а не заявлено
  владельцем: **З-05** вердикты не сбрасываются при повторной отправке в ту же ревизию (`approve`
  остаётся на изменённом тексте — роут `submit` не трогает `chapter_reviewers` вовсе) · **З-38/З-39**
  `displayName`/`bio`/`links` не обновляются НИГДЕ, компетенции ревьюера — только через accept заявки ·
  **З-51** жалобу невозможно создать (нет роута и кнопки, `insert(reports)` только в сиде — раздел
  «Жалобы» живёт на одной seed-строке) · **З-52** админ не видит своих уведомлений
  (`isAdminRecipient` пишется, `getNotifications` фильтрует, колокола нет) · **З-54** ссылка с
  `/admin/review` мёртвая (`requireAuthorPage` редиректит админа) · **З-55** `getRemovedReviewers()`
  написан и не вызывается · **З-57** `board_calls.waiting` всегда 0.
- **14 решений владельца** через AskUserQuestion (все в таблице раздела): свободная публикация ·
  три канала ревьюера + автоэскалация · главная только проверенные · единый аккаунт с возможностями ·
  два уровня бейджа · один ревьюер, без «ведущего» · регистрация остаётся админской · правка после
  публикации → ревизия-черновик поверх · только бейдж и имена · SLA + приватная жалоба + счётчик +
  отзыв статуса взамен рейтинга · профиль есть у всех, у пустого `noindex` · sitemap всё / RSS только
  проверенное · ревью-активность **публично** (реверс прототипа) · админ **остаётся env-based**.
- ⚠️ **Два реверса прежних решений владельца** зафиксированы явно: engagement всем аккаунтам
  (было uif-5 П4 — только `reader`) и «Лента» в шапке всем (было uif-6 П6 — автор без неё).
- **Прототипы**: экспорт Claude Design от 2026-07-25 (`public/feed.jsx` `ProfileScreen`+
  `ProfileEditModal`, новый `private/workspace.jsx` `WorkspaceScreen`, `shared/components.jsx`
  `rolesOf`/`hasRole`+`Nav`+`AvatarMenu`, `app.jsx` роуты `profile`/`workspace`/`adminlogin`,
  `fake-data.js` `roles: [...]`) принят источником UI-правды для Ф13. Модель прототипа
  (`reader` — базовый уровень, `ROLE_ORDER` только рабочие роли) совпала с заложенной в план.
  Требование владельца: **иконку-замок убрать полностью** — она в трёх местах (`workspace.jsx:29`,
  `components.jsx:387`, `components.jsx:558`). Новый токен `--private` в проекте отсутствует — заведён
  пунктом 13.6. Расхождение прототипа с решением владельца (ревью-активность приватная vs публичная)
  разрешено в пользу публичной — таб «Ревью (N)» в профиле.
- **Риски R-1…R-5** вынесены таблицей в раздел и закреплены за подфазами (мотивация ревьюера · пустая
  витрина · объём тестов · superseded-прототип · ослабление гейтов при смене ролевой модели) — раньше
  жили только в переписке.
- **Тесты**: не менялись (docs-only). Ориентир на Ф13–15 записан в R-3: ~40 переписать, ~15 удалить,
  ~25 добавить; `TEST-PLAN.md` отстал (116 кейсов в §9 против 134 фактических) — ресинк в 13.9.
- **Backlog**: R-1 (публичное «Заключение ревьюера») — по триггеру, решение владельца «сейчас не делать».

### 2026-07-11 · инцидент «сайт не открывается из РФ» → Cloudflare-прокси (класс S, docs-PR)
- **Симптом:** браузеры владельца (Яндекс, оба ПК, инкогнито) висли на recenza.ru; curl/чистый
  Chromium/телефон работали; сервер здоров, ошибок нет. **Диагноз (tcpdump на VPS):** ТСПУ-DPI
  на российском участке съедает ВТОРОЙ TCP-сегмент больших браузерных ClientHello (~1.8КБ,
  пост-квантовый ML-KEM) к IP Aeza-диапазона; первый сегмент доходит, хвост — никогда. QUIC
  проходил; SOCKS мимо РФ-участка — проходил; «мусорный» split — проходил (фильтр по сигнатуре
  настоящих hello). **Решение:** DNS → Cloudflare + HTTPS-RR `alpn=h3,h2` (чинит Chrome/Firefox;
  Яндекс Браузер HTTPS-RR игнорирует — ноль QUIC-пакетов, проверено) → **прокси CF (оранжевое
  облачко) + SSL Full (strict)** — сайт открывается везде (fresh-YaBrowser 795мс). Попутно:
  в момент переноса зоны владелец опечатался в A-записи (`.10` вместо `.106`) — полчаса сайт
  смотрел на чужой IP (ERR_QUIC_PROTOCOL_ERROR у всех). Целостность через прокси проверена:
  CSRF 403/401, rate-limit (XFF первый хоп = реальный IP), HTML DYNAMIC (не кэшируется),
  www-редирект, /board, бар реакций. Документация: **ENVIRONMENTS.md §6.6** (порядок включения,
  откат, ⚠️ проверка продления LE-сертификата в сентябре — HTTP-01 через прокси), CLAUDE.md.
- Backlog: ключевать rate-limit по `CF-Connecting-IP`; ufw-allowlist CF-диапазонов; при падении
  ACME — DNS-01 через CF token.

### 2026-07-10 · PR — `feature-ui-feedback-6` (класс L)
- **6 замечаний владельца** (следующая итерация после #27):
  **П1** бар «Реакции» — наверху и в режиме главы (после h1/навыков, до контента; в whole уже так) ·
  **П2** убрать «Сменить аватар» из меню пользователя (⚠️ следствие: читателю негде менять аватар —
  у него нет /u/-страницы; зафиксировано как осознанное, backlog «настройки профиля») ·
  **П3** убрать «Изменить профиль» с `/u/[slug]` — редактирование остаётся кнопкой
  «Редактировать»/«Создать „Об авторе“» внутри таба «Об авторе» (уже есть) и в кабинете ·
  **П4** убрать футер-строку «Recenza — девблог с редакционным ревью.» (футер содержал только её —
  элемент снимается целиком) ·
  **П5** (решение владельца через AskUserQuestion — «Отдельная страница»): новый пункт админ-меню
  «Доска ревьюеров» в разделе «Платформа» (`/admin/board`): сразу открытая форма создания
  направления + список с действиями + «Открыть доску →»; секция доски уходит со страницы
  «Заявки ревьюеров» (там остаются запросы авторов и отклики) ·
  **П6** (владелец: «а лучше…») автор — БЕЗ «Ленты» в шапке; в меню пользователя пункт
  «Все мои блоги» → `/`; h1 каталога для автора «Все блоги» → «Все мои блоги» (+крошка в ридере).
- **Тесты**: 133 → **134** (полный прогон зелёный, 0 skip; admin.spec перегнан отдельно после
  переименования): +TC-ADMIN-19 (доска на /admin/board: форма без кликов, создание → публичная
  /board, удаление; номер взят из существующего кейса тест-доков, не новый); обновлены TC-ADMIN-01
  (навигация с «Доска ревьюеров»), TC-ADMIN-12+13 (список направлений теперь на /admin/board),
  TC-AUTHOR-23 (h1 «Все мои блоги»), TC-AUTHOR-28 (меню: нет «Сменить аватар», есть «Все мои
  блоги»; в шапке нет «Ленты»), TC-READER-05 (+ассерт «бар до контента» через
  compareDocumentPosition); POM: homeHeading +«Все мои блоги», gotoSection +«Доска ревьюеров»,
  удалён неиспользуемый addBoardCall.
- **Цикл качества**: 4 зональных сабагента (code/security/design/seo) по диффу — **P0/P1 = 0**;
  1 P2 (перекрёстная ссылка на recruit-странице вне Card) и 2 P3 (мёртвые `relative`-класс и
  `onDone`-проп) — починены в этой же ветке. MCP-визуал: глава light/dark/375 (бар наверху),
  главная и меню автора («Все мои блоги», без «Ленты»/«Сменить аватар»), /u/ владельца
  (без «Изменить профиль», «Редактировать» в табе), /admin/board (форма раскрыта, сайдбар).
- **Среда (⚠️ урок)**: краши Claude Code (exit 3221226505) и падение TS-воркера `next build`
  оказались одним корнем — **1211 утёкших Turbopack-воркеров** (~18ГБ) от прежних паник копились
  днями → «Insufficient system resources» (os 1450). Чистка: kill node.exe с `next|turbopack`
  в CommandLine (НЕ все node.exe — там VSCode/MCP) + rmtree .next → build зелёный. Записано
  в память проекта (windows-node-leak-crashes).
- **Backlog**: читателю негде сменить аватар (нет /u/-страницы, пункт меню убран по П2) —
  «настройки профиля» при следующем заходе; TC-READER-21 numbering-дубль остаётся из uif5.

### 2026-07-10 · PR #27 `feature-ui-feedback-5` (класс L)
- **5 замечаний владельца.** П1 голоса «Полезно/Не полезно» — МИГРАЦИЯ на уровень блога (решение
  владельца; так и в прототипе — votes по blogSlug): таблица `blog_votes` (миграция **0006**:
  CREATE + data-INSERT — голос пользователя за блог = знак суммы его голосов по главам; `chapter_votes`
  deprecated, НЕ дропается); роут `POST /api/blogs/[id]/vote` (reader-only), старый chapters-роут
  удалён; engagement считается ОДИН раз на страницу (не в `buildReaderSections`); бар «Реакции»
  один: whole — в шапке блога под h1, глава — после контента · П2 аватарки: kind=avatar в
  `/api/uploads` (любой пользователь) + `PATCH /api/profile/avatar` (self, строго `/uploads/avatars/`);
  `avatar-changer.tsx` — menuitem «Сменить аватар» в меню шапки (все роли, у читателя нет /u/-страницы)
  + кнопка на своём `/u/…`; `Avatar` рендерит картинку (`src`), включая комментарии/шапку/профиль ·
  П3 карусель крутится ВСЕГДА (reduced-motion гард снят: смена слайда мгновенная — не «анимация»;
  WCAG-контроль остаётся: пауза hover/focus + точки/стрелки; диагноз «не обновляется» у владельца —
  системная настройка reduced-motion) · П4 голоса/закладки/подписки — ТОЛЬКО reader (модель ролей):
  `requireUser("reader")` в трёх роутах, `/bookmarks` 307 для не-reader, «Закладки» в меню только
  reader, бар скрыт для author/reviewer · П5 доска /board по `reviewer-board.jsx`: «К блогам»,
  центрированный hero (eyebrow между линиями, 2 CTA, 3 метрики), «Открытые направления» + «Список
  ведёт редакция», toggle-фильтр, карточки с футером «N глав ждут» + solid CTA; в админке
  BoardCallCreate перенесён НАВЕРХ секции (владелец не находил) + ссылка «Открыть доску →».
- **Тесты**: 130 → **133** (полный прогон зелёный, 0 skip): +TC-AUTHOR-28 и +TC-REVIEWER-19
  (engagement 403 + отсутствие бара/«Закладок»), +UPL-05 (аватарка: kind + PATCH + негативы);
  переписаны TC-GUEST-07 (intent `vote:{blogId}`, реплей под troll — reader без seed-голоса),
  SEC-CSRF/rate-limit (blog-роут, troll вместо ревьюера), TC-READER-05 (блоговый голос),
  REV-WHOLE-BLOG-comments (+ассерт одного бара в шапке), TC-GUEST-12 (hero-метрики доски);
  UPL-03: «avatar» больше не невалидный kind. Seed: `bv_1` (reader), troll намеренно без голоса.
- **Цикл качества**: сабагент-флот (4 зоны + 2×адверсариальная верификация, 12 агентов) нашёл
  **подтверждённый P1**: intent-replay в `login-form.tsx` бил в удалённый chapters-роут (правка
  потерялась из-за упавшего Edit) — починен, guest.spec перегнан зелёным; прочих P0/P1 нет.
  MCP-визуал: доска light/dark/375, whole-режим (один бар наверху), профиль ревьюера (кнопка
  аватара), меню без «Закладок» у не-reader. ⚠️ Два краша хост-процесса Claude Code за сессию —
  совпали с mio/tokio-паниками Turbopack dev-стенда на Windows; лечится перезапуском + чисткой .next.
- **Прод**: деплой применит 0006 автоматически (data-миграция конвертирует существующие голоса);
  после деплоя проверить `/blog/o-recenza?mode=whole` (бар наверху), /board (hero), карусель
  (авторотация), счётчик голосов на любом блоге.
- **Backlog**: e2e-нумерация TC-READER-21 задвоена (reader.spec «Ваша лента» vs security.spec
  rate-limit) — переименовать при следующем заходе в тест-доки; UI-клик-тест смены аватарки
  (сейчас API-уровень + видимость кнопок).

### 2026-07-10 · PR #25 `hotfix-seed-recruit-insert` (класс S)
- **Находка прод-прогона seed-recenza после #24**: строки `pb_recruit` в прод-БД НЕТ — карусель на
  проде заводилась админом с нуля (там был только donate-баннер), UPDATE-only секция П7 была no-op.
  Секция 2 переведена в upsert: нет строки → **INSERT первым слайдом** (sort = min−1) с текстами
  прототипа; старый сидовый title → UPDATE; прототипный title → no-op «уже актуален»; иной → no-op
  (правки админа не затираются). Проверено на копии тест-БД: INSERT-путь + идемпотентность повтора.
- Урок для будущих сид-секций: прод-БД содержит ТОЛЬКО контент, заведённый руками/скриптами —
  ничего из seed-core; секции `seed-recenza.mjs` должны уметь создавать сущность с нуля.

### 2026-07-10 · PR #24 `feature-ui-feedback-4` (класс L)
- **Пакет из 8 замечаний владельца + сверка с прототипами** (эталон, кроме логина):
  П1 кабинет «Мои блоги» по `author-portal.jsx` — 2 колонки карточек + aside 300px (мismatch-нотисы /
  оценки / recruit / карточка «Об авторе» с тогглом видимости / «События» из уведомлений; общий
  словарь текстов `src/lib/notification-text.ts`); карточка: точки-прогресс, чипы «Закреплён»/«ваш ход»,
  футер «＋ Глава» (создание из карточки) + pin 38px; бейдж «Опубликован/Черновик» и «Открыть →» убраны ·
  П2 главная БЕЗ табов «Лента/Каталог/Подписки», фильтров и поиска — карточки БЛОГОВ
  (`blog-index-card.tsx`; плейсхолдер обложки — детерминированный градиент `.cover-ph-*`); **ролевой
  сплит** (решение владельца): reader → «Ваша лента» («Подписки»/«Свежее», каталог `/?view=all`),
  прочие → «Все блоги»; удалены 6 компонентов + `getAllTags`/`getSubscriptionFeed` (`getFeed` жив —
  feed.xml); `BlogCardView`+`publishedAt`, новый `getFollowedAuthorIds` · П3 «Лента» в шапке справа ·
  П4 donate-модалка по `donation-ui.jsx` (золотая шапка с подписью, карточки-ссылки, «или по QR-коду»,
  сегменты, QR 150/108; токены `--gold*`, прототипный #b8860b затемнён до AA) · П5 админ-кнопки —
  общий `admin/_components/buttons.tsx` (7 вариантов + ActionBtn-карточки жалоб + inputCls), рефакторинг
  6 файлов, тексты кнопок не менялись · П6 CTA карусели белым ПОД текстом слева (`--promo-cta-bg`,
  dark-затемнение ink; ⚠️ реверс «всегда справа» из ui-feedback-3 П4 — новое указание владельца) ·
  П7 recruit-слайд → тексты прототипа «Ищем ревьюеров / Стать ревьюером» (замена — решение владельца);
  `seed-recenza.mjs` реструктурирован в 2 НЕЗАВИСИМЫЕ идемпотентные секции (UPDATE только пока title
  равен старому сидовому) · П8 «Весь блог»: ОДИН merged-блок комментариев (`getBlogComments` — один
  SELECT по published-главам, «старость» по ревизии СВОЕЙ главы, eyebrow главы, композер с селектом
  «К главе»; сервер перепроверяет `resolveCommentTarget`) + ОДНА карточка «Блог ревьюили»
  (чистая агрегация `section.credit`); реакции per-chapter сохранены. Общий `src/lib/plural.ts`.
- **Тесты**: 127 → **130** (полный прогон зелёный, 0 skip): +TC-GUEST-16 (слайд «Ищем ревьюеров» →
  /board), +TC-READER-21 («Ваша лента»/«Подписки»/переход в каталог), +REV-WHOLE-BLOG-comments
  (merged-блок: единственность, eyebrow, постинг через селект, спойлер старых версий). Починены:
  `feedTab` удалён из POM (+`homeHeading`/`blogCard`), TC-GUEST-01/11, TC-AUTHOR-01 (h1 «Мои блоги»,
  aside-регионы) и 03+04 (счётчики вместо бейджа), TC-AUTHOR-23, PUB-ARTICLE (главы проверяются
  в ридере), TC-ADMIN-25 (restore из `BANNER_TEXTS` seed-хелпера). Гоча подтверждена: cron.spec
  валиден только на Playwright-managed стенде (на ручном — 401).
- **Цикл качества**: lint/build/tsc чистые; MCP-визуал light/dark/375px (главная, кабинет,
  donate-модалка, whole-режим) — соответствие прототипам, CTA не наезжает на стрелку на мобиле
  (`max-sm:pl-12`). ⚠️ Мульти-агентный флот дважды упёрся в session-limit — заменён инлайн-проходом
  по тем же чек-листам: raw-цвета/тени/JSON.parse/dangerouslySetInnerHTML в диффе — 0; merged-комментарии
  получают только published-главы (`getReadableBlog`); metadata/canonical/feed.xml сохранены;
  ?tab=-ссылок не осталось. P0/P1 = 0. A11y-фиксы по ходу: aside-заголовки — h2 (heading-локаторы),
  PortfolioCard — `<section aria-label>`.
- **Backlog (P2/P3)**: bookmark-чип на карточках каталога (прототип); перевод `/bookmarks` и
  `author-profile` на `BlogIndexCard`; сортировка каталога (прототип; отложена вместе с поиском —
  указание владельца); повторный прогон полного сабагент-флота после сброса лимитов.
- **Прод**: после deploy — бэкап БД → `node scripts/seed-recenza.mjs` (обновит recruit-слайд) →
  проверить главную (каталог, белые CTA), кабинет автора, `?mode=whole` (merged-комментарии).

### 2026-07-10 · PR #23 `feature-ui-feedback-3` (класс L)
- **Пакет из 13 замечаний владельца + сверка с прототипами** (`docs/prototype/ui_kits/blog/src/**`;
  логин не тронут — эталон): П1 hover карточек по `BlogIndexCard` (подъём/акцент/зум) · П2 rename
  блога (inline-dblclick по прототипу + поле в настройках) и **`DELETE /api/author/blogs/[blogId]`**
  (только полностью черновиковые — решение владельца; гейт в транзакции, анти-TOCTOU) · П3 лимиты
  баннеров (`src/lib/banners.ts`: 40/90/30; 400 вместо тихого slice; maxLength+счётчик) · П4 CTA
  баннера по donation-ui (pill цвета ink + иконка в круге), **всегда справа**, мобайл — под текстом
  вправо, `--promo-ink-contrast` (AA обе темы) · П5 профиль по `ProfileScreen` (back сверху,
  карточка-шапка, пилюля роли, «на платформе с …» (родительный падеж), соц-иконки, статистика,
  закреплённый блог, счётчик таба) · П6 AlphaBadge удалён из админ-сайдбара · П7 смена пароля
  админом (`password` в PATCH users/[handle], bcrypt 8–200; сессии не гасятся — backlog) ·
  П8 меню блоков: 4 категории с шорткатами (`block-menu.ts`), якорь к кнопке, click-outside+Escape,
  клавиатура в слэш-меню, пустой док — кнопка слева · П9 «Руководство» (GuideModal) портировано,
  тексты переписаны под реальную модель (легаси прототипа не годился) · П10 автосейв структурных
  правок (дебаунс 1.6с > рейт-лимита, refs, сериализация, 429-ретрай) + «Просмотр» сохраняет ·
  П11 единый `BackLink` (8 замен) · П12 пикер ревьюеров по макету (сегмент-контрол, аватар, звёзды,
  балл «Топ»), **дефолт «Все»** — решение владельца · П13 `scripts/seed-recenza.mjs` — идемпотентный
  additive-сид «О Recenza» (5 published-глав; deploy.yml докладывает скрипт+ulid+bcryptjs).
- **Тесты**: 118 → **127** (все зелёные, 0 skip): `flows/blog-manage.spec.ts` (rename/DELETE:
  happy+гейтинг+негативы), TC-ADMIN-24 (пароль), TC-ADMIN-25 (лимиты), TC-GUEST-15 + TC-AUTHOR-27
  (гид), TC-AUTHOR-26 (автосейв+Просмотр); POM `fillTitle` (refill против «домерживания» SSR-текста
  при fill до гидрации), `makePrimary` → «вести/ведущий». Console-guard: allowlist для dev-шума
  React RSC perf track («negative time stamp» — только dev, в прод-сборке трека нет).
- **Цикл качества** (полный флот + адверсариальная верификация): 0 подтверждённых P0/P1; дешёвые
  P2/P3 исправлены в ветке (TOCTOU-гейт, label-обёртка чекбокса пикера, initial focus GuideModal,
  aria-label icon-only BackLink, `--bg`→`--background` в шапках редакторов, structural-флаг
  markdown-шортката, родительный падеж месяца, summary глав сида, гейт роли в сиде). MCP-визуал
  light/dark/375px: найден и исправлен клип «Войти» в шапке на мобиле (гэпы + «Лента» скрыта на <sm).
- **Backlog (P2/P3 из ревью)**: инвалидация сессий при смене пароля (session_epoch); чип закладки
  на карточках; rename-комментарии по blogSlug (перекеивание при смене slug — общий долг Ф8);
  focus-trap модалок (системно, вкл. SubmitSheet); хит-таргеты стрелок/точек карусели и «вести»;
  плюрализация «Блогов»; datetime у `<time>`; twitter-мета профиля; aria-live карусели; стрелочная
  навигация в tablist/menu; «Просмотр» для read-only глав можно вернуть в Link; лимит названия блога
  рассинхронизирован (создание 200 / rename 64); faux-bold 800 при Lora-700.
- **Прод**: после deploy — бэкап БД → `node scripts/seed-recenza.mjs` на сервере → проверка
  `/blog/o-recenza` (сид проверен на dev: идемпотентен, рендер корректный).

### 2026-07-09 · PR #14 `hotfix-caddy-uploads-access`
- **Права Caddy на `/srv/recenza/shared/uploads`** (HTTPS-smoke нашёл 403 на `/uploads/*`):
  caddy добавлен в группу recenza + `g+rX`; зафиксировано в `deploy/provision.sh`; на сервере
  применено вживую; seed-плейсхолдеры скопированы в shared.
- **Фикс гонки e2e engagement-toggle**: `EngagementBar` оптимистичен — aria-pressed менялся до
  ответа сервера, немедленный `reload` обрывал POST в полёте. `toggleUntilPressed` в `reader.spec`:
  идемпотентный клик-ретрай + `waitForResponse` (TC-READER-05/06/07).
- Открыт UDP 443 (HTTP/3 Caddy).

### 2026-07-09 · PR #15 `hotfix-login-alpha-polish`
- **Фикс каскада (системный)**: базовые правила `h1–h4/body/code` в `globals.css` были вне `@layer`
  и побеждали layered-утилиты Tailwind — size-утилиты на 47 заголовках приложения молча
  игнорировались (симптом — гигантский «Вход в аккаунт»). Обёрнуты в `@layer base`.
- **AlphaBadge** (`src/components/alpha-badge.tsx`): пилюля warning-тоном + поповер
  (`ALPHA_COPY`, клик-вне/Escape, aria, без теней) — в шапке, админ-сайдбаре, на логинах.
- **Редизайн /login и /admin/login**: карточка, компактный логотип, описание платформы, инфоблок.
- title главной — `absolute` (шаблон дублировал «| Recenza»); e2e-шаг бейджа в `guest.spec`.
- Верификация шрифтов: фактические токены = эталон DESIGN-TOKENS §2 (расхождений нет).

### 2026-07-09 · PR #16 `hotfix-ui-feedback-2`
- **Логин v2** (фидбек): логотип + кликабельный Alpha-бейдж вынесены НАД карточкой; «Вход в
  аккаунт» уменьшен до `--type-small`; `ALPHA_COPY` убран из-под формы (живёт в поповере бейджа).
- **Карусель по прототипу** (`donation-ui.jsx`): слайд h-36 с декоративной панелью-иконкой и
  градиентной заливкой (классы `.promo-slide*` в globals на `--promo-ink`), стрелки — «плавающие»
  круги с фоном/рамкой (не сливаются с CTA), точки 7/22px как в прототипе.
- **VPN hairpin-доступ** (recenza.ru не открывался через AmneziaWG этого же сервера) — диагноз и
  фикс на сервере, задокументировано в ENVIRONMENTS §6.4. Подтверждено владельцем с телефона.
- Доки: этот журнал; CLAUDE.md § «Деплой изменений».

### 2026-07-09 · PR #17 `hotfix-login-variant-a`
- Логин — вариант A (дизайн владельца через Claude Design): логотип (1.875rem extrabold) +
  кликабельный Alpha-бейдж над голой формой, карточка/подписи убраны; `h1` — sr-only
  «Вход в аккаунт Recenza». Админ-логин не тронут (видимый заголовок под e2e-ассертом).

### 2026-07-09 · PR #18 `hotfix-badge-popover-mobile`
- Поповер Alpha-бейджа вылезал за правый край экрана на телефоне (`absolute left-0`).
  Теперь fixed-позиционирование от rect триггера с прижимом к вьюпорту (отступ 8px, ширина
  ужимается на ультра-узких); скролл/резайз закрывают. Проверено на 375px.

### 2026-07-09 · PR #22 `docs-cleanup`
- **Ревизия документов + чистка**: удалены 5 случайно закоммиченных скриншотов `smoke-phase7-*.png`
  (корень) и `docs/migration/REVIEW-PROMPT.md` (одноразовый аудит стадии планирования — отработал,
  остался в git-истории). Корневой `README.md` переписан из bootstrap-гайда миграции в актуальную
  витрину репозитория (что это, прод, карта доков, быстрый старт, деплой).
- **SSH-ключ владельца зафиксирован в промтах**: добавлен на сервер (root + `recenza`),
  путь `~/.ssh/recenza_ed25519` вписан в PROMPT.md (карта + промты диагностики/инцидента)
  и CLAUDE.md § «Деплой» — будущие сессии Claude Code ходят на сервер без вопросов.

### 2026-07-09 · PR #21 `docs-ssh-access-howto`
- **ENVIRONMENTS §6.5** — инструкция «SSH-доступ: как добавить свой ключ»: генерация ed25519,
  3 способа доставки `.pub` на сервер (через живую сессию Claude Code / веб-консоль хостера /
  с машины со старым ключом; `ssh-copy-id` не работает — пароли отключены), проверка, использование
  в сессиях Claude Code. Указатель из CLAUDE.md § «Деплой». Контекст: приватный deploy-ключ живёт
  только в GH Secrets — без своего ключа будущие сессии не смогут администрировать сервер вручную.

### 2026-07-09 · PR #20 `docs-prompts-post-release`
- **PROMPT.md переписан под пост-релиз** (аудит всех доков для контекста Claude Code):
  карта документов (какой док какую роль играет и когда читается) + 4 актуальных промта —
  «итерация изменений» (основной, по WORKFLOW), «экстренный фикс прода», «диагностика прода
  (read-only)», «работа с тестами». Миграционные промты фаз 0–12 сжаты в архив-справку
  (пути `/recenza-prototype/*` → `docs/prototype/*`, скиллы/MCP давно созданы).

### 2026-07-09 · PR #19 `docs-change-workflow`
- **`docs/migration/WORKFLOW.md`** — сквозной флоу пост-релизных изменений (по запросу владельца):
  классификация S/M/L → ветка → разработка → какие тесты обязательны → Цикл качества по зоне →
  PR/автодеплой → проверка прода → запись в этот журнал + чек-лист закрытия. Ссылки из
  CLAUDE.md (раздел «Флоу изменений») и шапки этого журнала. Дозаполнены записи PR #17/#18.

---

## Ревизия бэклога (2026-07-26, `hotfix-backlog-sweep`)

Сквозной разбор ВСЕХ записей «Backlog (P2/P3)» из журналов Фаз 1–15 (~55 строк). Раньше они
накапливались и переносились из фазы в фазу без пересмотра, поэтому часть уже была сделана, а часть
описывала механику, которой больше не существует. Ниже — итог по каждой группе; журналы фаз оставлены
как есть (это исторические записи), актуальный статус — здесь.

### Сделано в этой ревизии

| Пункт | Откуда | Что сделано |
|---|---|---|
| Полный focus-trap в модалках | Ф6, Ф8, Ф10, Ф12 (переносился 4 раза) | Общий хук `src/lib/use-modal-a11y.ts`: Escape + автофокус + циклический Tab + возврат фокуса. На него переведены donate/guide/report/review-модалки — раньше каждая городила свой `useEffect`, а trap'а не было НИ В ОДНОЙ |
| `users.role` дрейфует (POST пишет, PATCH — нет) | Ф13, Ф14 | `PATCH /api/admin/users/[handle]` синхронизирует legacy-shim с возможностями. Колонку не дропаем (на `users` завязаны FK ревью-таблиц), но лживых значений в ней больше нет |
| N+1 в свипе 3 SLA-крона | Ф14 | Три запроса на заявку (вердикт/тред/чат) свёрнуты в один `UNION ALL … LIMIT 1` |
| «Продлить `dueAt`» вне транзакции без перепроверки | Ф14 | Продление идёт только по строке, всё ещё `claimed` (условие в `WHERE`) |
| Нет `aria-live` после claim | Ф14 | Карточка объявляет результат (`role="status"`), а не исчезает молча |
| Нет roving `tabindex` в табах | Ф14 | Roving tabindex + навигация ←/→/Home/End в кабинете ревьюера и в табах профиля |
| `cron` снимает устаревший план молча | Ф13 | Автор получает уведомление, когда правка опубликованной главы гасит отложенную публикацию |
| `resolveComment` не проверяет видимость блога | Ф15 | Жалоба на комментарий скрытого блога больше не принимается — гейт как в `resolveBlog` |
| Нет rate-limit на admin-assign | Ф15 | Добавлен (единообразие со всеми мутациями назначения) |
| Крошки админки некликабельны | Ф15 | Раздел кликабелен, когда мы глубже него |
| Стрелки карусели 32px | Ф15 | 36px — минимум `DESIGN-TOKENS.md` §5 |
| Canonical страниц пагинации | Ф15 | `generateMetadata` стала динамической: каталог и страницы `?page=N` самореферентны, а не канонизируются на другую страницу |
| `npm audit`: high в `next` | Ф13, Ф14, Ф15 | Бамп `next` 16.2.9 → **16.2.12** (патч). Все ПРЯМЫЕ advisories Next закрыты |

### Уже было сделано раньше — записи устарели

`PublicUser` без `passwordHash` и allowlist полей при апдейте (Ф2) — сделано в Ф4/Ф13 ·
`NotificationBell` как клиентский компонент (Ф4) — сделано в Ф5 · загрузка изображений (Ф6) —
сделана в Ф12 · `getAdminUsers` фильтрует в памяти (Ф10) — уехало в SQL в Ф15 ·
`board_calls.waiting` (Ф10) — снят из UI в Ф15 · версионирование `title`/`skills` (Ф13) и очистка
назначений при отзыве `isReviewer` (Ф13) — сделаны в Ф14 · seed-картинки `/uploads/*` (Ф5) — лежат
в `public/uploads/`.

### Неактуально — механики больше нет

- **In-memory rate-limit «не шарится между serverless-инстансами»** (Ф4, Ф5, Ф6, Ф7, Ф8, Ф9, Ф10, Ф12 —
  восемь повторов). Проект живёт на ОДНОМ Node-инстансе на VPS; Vercel/serverless из планов ушёл ещё
  в Ф12. Пункт актуален только при горизонтальном масштабировании — и тогда это будет новая задача,
  а не долг.
- **Рейтинг ревьюеров**: валидация `stars` 1..5 (Ф2), `getRatingPrompts` (Ф9), `aria-label` на бейдже
  match% в пикере (Ф9) — рейтинг и пикер снесены в Ф14.
- **Модель согласия**: re-consent при `submit-revision` (Ф7, Ф9, Ф10, Ф12), «пикер не маркирует
  принявших» (Ф9), pending-приглашения при публикации и в конфликте интересов (Ф13) — приглашений
  не существует с Ф14, ревьюер берёт заявку сам.
- **`primary_change_requests.status` без enum** (Ф2) — таблица legacy, не читается с Ф14.
- **`GET /api/notifications` без `assertSameOrigin`** (Ф5) — ⚠️ применить НЕЛЬЗЯ: браузер не шлёт
  `Origin` на same-origin GET, и проверка сломала бы колокол. Защита обеспечена `sameSite`-cookie.

### Осознанно отложено (с триггером пересмотра)

| Пункт | Почему не сейчас | Триггер |
|---|---|---|
| `postcss`/`sharp` high в `npm audit --omit=dev` | Обе — ВНУТРИ дерева самого `next`; единственный «фикс» от npm — откат до `next@9.3.3`, то есть заведомо неверный совет. Экспозиция: `sharp` стоит в пути `/_next/image`, но загрузка картинок закрыта гейтом author/admin + magic-bytes + лимит 4МБ | Релиз Next с `sharp ≥ 0.35` — тогда обычный бамп |
| CSP `Report-Only` → enforce | Нужен nonce-middleware; на альфе ломать рендер дороже, чем ждать | Стабилизация набора внешних ресурсов |
| Offsite-копии бэкапов | Инфраструктурная задача (нужен внешний storage и его креды), кодом не решается | Появление хранилища |
| Typing-индикатор в ревью | Нужен realtime-транспорт (WS), которого в проекте нет | Появление WS |
| Markdown-aware инлайн-дифф, per-block verdict-штампы | Отложены владельцем ещё в Ф7 | Решение владельца |
| Hard-delete комментариев + `parentId` cascade→`set null` | Сейчас soft-delete — осознанная модель (tombstone сохраняет ветку) | Продуктовое решение |
| E-mail-онбординг принятых заявок, смена пароля пользователем | Нет почтовой инфраструктуры; на альфе пароль выдаёт админ лично | Появление почты |
| `window.confirm` при удалении, `window.prompt` для URL ссылки | Заметная UI-работа в редакторе; функционально корректно | Отдельная UI-итерация |
| `Block` с широким `[key: string]: unknown` | Рефактор типов задел бы редактор, рендерер и валидатор разом | Отдельная типовая итерация |
| reorder TOCTOU, `uniqueSlug` 50 попыток, гейт глубины в 2 SELECT | Реальный риск близок к нулю (один автор на блог), цена фикса выше | Рост нагрузки |
| Фавикон/брендинг, Lighthouse-порог в error | Задачи дизайна и метрик, не кода | Отдельная задача |

## Глобальный Definition of Done (релиз)

- [x] Все фазы (0–15) в статусе `done` по своим DoD; ни одной `blocked`.
- [ ] Монолит собирается (`npm run build`) и проходит регресс на тестовом стенде (`playwright-tester` = GO).
- [ ] Два стенда (тест/прод) изолированы; все БД создаются миграциями; seed тест-стенда детерминирован.
- [ ] Ревью (глава/весь блог/чат), публикации (профиль/статья/глава/черновик), комментирование
      (читатель↔автор↔читатель) и подбор ревьюеров (навыки/согласие/оценка) покрыты тест-кейсами **и**
      TS-автотестами, верифицированы через Playwright MCP.
- [ ] Флот сабагентов (security/code/design/seo) чист; a11y-кейсы проходят.
- [ ] Цикл качества пройден на каждой кодовой фазе (Журналы заполнены, backlog зафиксирован).
- [ ] `CLAUDE.md`, `.claude/{rules,agents,skills}`, `ENVIRONMENTS.md`, `TESTING.md`, этот `PLAN.md` актуальны.
