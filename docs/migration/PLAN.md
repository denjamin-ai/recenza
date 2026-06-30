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
| 6 | Авторский слой: кабинет, редактор, портфолио | Продукт | `in progress` |
| 7 | Редакционный review-flow (ReviewPage) | Продукт | `todo` |
| 8 | Комментирование (читатель↔автор↔читатель) | Продукт | `todo` |
| 9 | Подбор ревьюеров, согласие, оценка | Продукт | `todo` |
| 10 | Админка, модерация и монетизация | Продукт | `todo` |
| 11 | Слой качества: тест-кейсы + Playwright | Качество | `todo` |
| 12 | Hardening + прод-деплой | Релиз | `todo` |

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

**Статус:** `in progress`
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
- Статус-история:
- Решения/отклонения:
- Backlog:
- Риски для следующих фаз:

**Что дальше.** Фаза 7 — review-flow.

---

## Фаза 7 — Редакционный review-flow (ReviewPage)

**Статус:** `todo`
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
- [ ] `npm run build` зелёный, `npm run lint` чистый
- [ ] Применены скиллы `next-best-practices` + `review-flow-domain`
- [ ] Сабагент `code-reviewer`: нет P0/P1
- [ ] Сабагент `security-reviewer`: ревьюер не комментирует как читатель; автор не ставит вердикты; гейтинг POV серверный
- [ ] Сабагент `design-watcher`: токены/aria/dark; мобильные табы Статья/Обсуждения; `aria-live` тосты
- [ ] Сабагент `playwright-tester`: полный цикл v1→тред→apply→approve→publish, sync статусов кросс-экранно = GO
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [ ] Полный цикл проходит; статус синхронно меняется во всех экранах (инбокс/кабинет/ридер).
- [ ] Ведущий назначается/меняется; вердикты считаются; публикация — только при всех approve (или force-approve, фаза 10).
- [ ] Опубликованная глава показывает ревьюеров (текущие + прошлые версии).

**Журнал фазы.**
- Статус-история:
- Решения/отклонения:
- Backlog:
- Риски для следующих фаз:

**Что дальше.** Фаза 8 — комментирование.

---

## Фаза 8 — Комментирование (читатель ↔ автор ↔ читатель)

**Статус:** `todo`
**Контекст входа.** Требует фазы 1–7 (`done`). Читать: `README.md` §7; `CLAUDE.md` (гейтинг комментариев).
**Разблокирует.** Полноту матрицы ролей для фазы 11 (тесты).
**Старт сессии.** Проверь статусы; фазы 1–7 — `done`.

**Цель.** Публичный слой комментариев с привязкой к блокам и ревизиям, окном правки и ролевым
гейтингом. Особый сценарий: диалог **читатель → автор → читатель**.

**Подфазы / Todo.**
- [ ] `public_comments`: ключ `blogSlug+chapterSlug+revision`, опц. `anchor {blockId, quote}` (скролл к `id="block-<id>"`),
      `editedAt`, `parentId` (вложенность ≤2), `deletedAt` (soft delete).
- [ ] `CommentsSection`: фильтр к открытой главе; комментарии к **старой** ревизии — в спойлер «прошлые версии»
      (бейдж «к версии vN»); окно правки 15 мин; клик по цитате — скролл к блоку; новый комментарий наследует главу+ревизию.
- [ ] **Гейтинг:** комментируют только читатели (и автор — в своих блогах как участник); ревьюеры не комментируют;
      автор не комментирует чужие блоги; `commentingBlocked` блокирует.
- [ ] Голоса за комментарии (±1, race-safe). Stale-детект по ревизии. Уведомления нити читатель↔автор↔читатель.

**Скиллы и агенты.** Скиллы `next-best-practices`, `security-checklist`. Агенты: `security-reviewer`, `code-reviewer`.

### Цикл качества (блокирующий гейт)
- [ ] `npm run build` зелёный, `npm run lint` чистый
- [ ] Применены скиллы `next-best-practices` + `security-checklist`
- [ ] Сабагент `code-reviewer`: нет P0/P1
- [ ] Сабагент `security-reviewer`: ревьюер→403 на POST; автор→403 на чужой блог; заблокированный→403; вложенность >2 запрещена сервером; окно правки истекает серверно
- [ ] Сабагент `design-watcher`: токены/aria/dark (спойлер прошлых версий, якоря)
- [ ] Сабагент `playwright-tester`: «читатель спросил → автор ответил → читатель уточнил» + уведомления = GO
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [ ] Сквозной диалог читатель↔автор↔читатель проходит; уведомления летят.
- [ ] Комментарий к старой ревизии уезжает в спойлер; окно правки истекает на 16-й минуте → 403.
- [ ] Гейтинг ролей и `commentingBlocked` соблюдаются сервером.

**Журнал фазы.**
- Статус-история:
- Решения/отклонения:
- Backlog:
- Риски для следующих фаз:

**Что дальше.** Фаза 9 — подбор ревьюеров.

---

## Фаза 9 — Подбор ревьюеров, согласие, оценка

**Статус:** `todo`
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
- Статус-история:
- Решения/отклонения:
- Backlog:
- Риски для следующих фаз:

**Что дальше.** Фаза 10 — админка, модерация, монетизация.

---

## Фаза 10 — Админка, модерация и монетизация

**Статус:** `todo`
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
- Статус-история:
- Решения/отклонения:
- Backlog:
- Риски для следующих фаз:

**Что дальше.** Фаза 11 — слой качества.

---

## Фаза 11 — Слой качества: тест-кейсы + Playwright

**Статус:** `todo`
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
- Статус-история:
- Решения/отклонения:
- Backlog:
- Риски для следующих фаз:

**Что дальше.** Фаза 12 — hardening + деплой.

---

## Фаза 12 — Hardening + прод-деплой

**Статус:** `todo`
**Контекст входа.** Требует фазы 1–11 (`done`, `playwright-tester` = GO). Читать: `README.md` §9 (пробелы); `ENVIRONMENTS.md` (прод).
**Разблокирует.** Релиз (Глобальный DoD).
**Старт сессии.** Проверь статусы; фазы 1–11 — `done`. Две подфазы: сперва закрыть пробелы/прогнать флот агентов (12.1), затем деплой (12.2). Деплой — только после зелёного hardening.

**Цель.** Закрыть production-пробелы (`README.md` §9), прогнать весь флот сабагентов и выкатить
монолит на прод (Turso + Vercel).

**Подфазы / Todo.**
- [ ] **12.1 Hardening.**
  - [ ] Пробелы: реальный mermaid-js, KaTeX, загрузка изображений (file-input + сторедж), серверное review-состояние вместо in-memory,
        реальные presence/typing (websocket-задел), iron-session вместо демо-аккаунтов, `published_at` по ревизиям, уведомление автора о force-approve, реальная загрузка QR пожертвований.
  - [ ] a11y: skip-to-content, focus-management при смене главы, фокус-кольца, навигация с клавиатуры по баблам/тредам, high-contrast ревью, `aria-live` тосты, `role=tablist` на strip глав.
  - [ ] Perf: Web Vitals/Lighthouse-бюджеты; анимации только `transform`/`opacity`; `reduced-motion`.
- [ ] **12.2 Прод-деплой.**
  - [ ] Прод-БД: Turso, `drizzle-kit migrate`, bootstrap-админ через env (без self-registration).
  - [ ] Прод-env (Vercel): `SESSION_SECRET`, `ADMIN_PASSWORD_HASH` (`\$`-escape), `TURSO_*`, `CRON_SECRET`, `NEXT_PUBLIC_BASE_URL`.
  - [ ] Cron публикации отложенных глав (`/api/cron/publish`, Bearer `CRON_SECRET`, расписание в `vercel.json`).
  - [ ] Прод-проверки: RSS/sitemap/robots с прод-URL; security-заголовки; финальный `npm run build`; smoke на prod-preview (не на тест-стенде!). Runbook отката и бэкапов; разделение секретов dev/test/prod.

**Скиллы и агенты.** **Весь флот:** `security-reviewer`, `code-reviewer`, `design-watcher`, `seo-optimizer`, `playwright-tester`. Скиллы `security-checklist`, `next-best-practices`.

### Цикл качества (блокирующий гейт)
- [ ] Финальный `npm run build` зелёный, `npm run lint` чистый
- [ ] Сабагент `security-reviewer`: **0 критических** (auth-bypass, инъекции, секреты, cookie, `npm audit`, security-заголовки)
- [ ] Сабагент `code-reviewer`: без P0/P1 на затронутом
- [ ] Сабагент `design-watcher`: без P0 (hardcoded-цвета/шрифты/тени/aria/dark)
- [ ] Сабагент `seo-optimizer`: все публичные страницы с метаданными; sitemap/robots/feed валидны (прод-URL)
- [ ] Сабагент `playwright-tester`: a11y-кейсы (skip-link, focus-visible, reduced-motion, mobile-nav) + smoke на prod-preview = GO
- [ ] Обновлены «Статус» и «Журнал фазы»

**DoD.**
- [ ] Известные пробелы README §9 закрыты либо явно в backlog с обоснованием (в Журнале).
- [ ] Прод поднимается, миграции применены, админ заходит, гость читает опубликованные блоги; cron публикует отложенную главу (защищён `CRON_SECRET`).
- [ ] Тестовый и продовый стенды полностью изолированы; секреты не утекли (нет в репозитории/логах).

**Журнал фазы.**
- Статус-история:
- Решения/отклонения:
- Backlog:
- Риски / заметки:

**Что дальше.** Релиз — см. Глобальный DoD ниже.

---

## Глобальный Definition of Done (релиз)

- [ ] Все 12 фаз в статусе `done` по своим DoD; ни одной `blocked`.
- [ ] Монолит собирается (`npm run build`) и проходит регресс на тестовом стенде (`playwright-tester` = GO).
- [ ] Два стенда (тест/прод) изолированы; все БД создаются миграциями; seed тест-стенда детерминирован.
- [ ] Ревью (глава/весь блог/чат), публикации (профиль/статья/глава/черновик), комментирование
      (читатель↔автор↔читатель) и подбор ревьюеров (навыки/согласие/оценка) покрыты тест-кейсами **и**
      TS-автотестами, верифицированы через Playwright MCP.
- [ ] Флот сабагентов (security/code/design/seo) чист; a11y-кейсы проходят.
- [ ] Цикл качества пройден на каждой кодовой фазе (Журналы заполнены, backlog зафиксирован).
- [ ] `CLAUDE.md`, `.claude/{rules,agents,skills}`, `ENVIRONMENTS.md`, `TESTING.md`, этот `PLAN.md` актуальны.
