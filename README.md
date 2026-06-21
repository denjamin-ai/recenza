# Recenza

Многоглавный девблог с встроенным редакционным review-flow. Монолит на **Next.js 16**.
Этот репозиторий — **bootstrap-кит для миграции** дизайн-прототипа в production через Claude Code.
Код приложения генерируется по фазам плана; здесь — вся обвязка, документы и эталоны.

## С чего начать (bootstrap — делаешь ты, до Claude)

1. **Каркас** в пустой папке:
   ```bash
   git init
   npx create-next-app@latest . --ts --app --tailwind --src-dir --import-alias "@/*" --eslint
   ```
2. **Вложи кит** поверх каркаса: `CLAUDE.md`, `.mcp.json`, `.env.example`, `.gitignore`, `.claude/`, `docs/` — в корень.
   Блок `scripts` и devDeps из `package.json` влей в тот, что создал create-next-app (не заменяй целиком).
3. **Зависимости:**
   ```bash
   npm i @libsql/client drizzle-orm iron-session bcryptjs ulid next-themes next-mdx-remote rehype-pretty-code shiki
   npm i -D drizzle-kit tsx @playwright/test dotenv-cli && npx playwright install
   ```
4. **Секреты:** `cp .env.example .env.local` (внутри `DB_FILE_NAME=blog.db`) и `.env.test` (`DB_FILE_NAME=blog.test.db` +
   `ADMIN_PASSWORD_PLAIN`). Сгенерируй `SESSION_SECRET` (32+ байт) и `ADMIN_PASSWORD_HASH` (bcrypt, `$`→`\$`).
   `dotenv-cli` обязателен: `next dev` НЕ читает `.env.test` сам.
5. **Запусти Claude Code** в этой папке и вставь первым сообщением **`docs/migration/PROMPT.md`**.
   Дальше Claude идёт по **`docs/migration/PLAN.md`** (12 фаз) с Фазы 1; файлы БД создадут миграции+seed в Фазах 2–3.

> Подробнее о стендах и создании БД — `docs/migration/ENVIRONMENTS.md`.

## Репозиторий и git-flow

Репозиторий: **https://github.com/denjamin-ai/recenza** (права на ветки, PR, мерж и пуш в `main` выданы).

- Bootstrap Фазы 0 — первый коммит прямо в `main`.
- Со следующей фазы: одна фаза = ветка `phase-<N>-<slug>` = PR → squash-merge в `main` после зелёного
  Цикла качества → удалить ветку. Блокирующий баг — `hotfix-<slug>`.
- Секреты и `*.db` не коммитятся (`.gitignore`); перед коммитом — `git status`.

## Структура

```
recenza/
├── CLAUDE.md                      # постоянный контекст для Claude Code (стек, конвенции, гейтинг)
├── .mcp.json                      # Playwright MCP
├── .env.example                   # переменные окружения (скопируй в .env.local и .env.test)
├── package.json                   # блок scripts (слить с тем, что создаст create-next-app)
├── .gitignore
├── .claude/
│   ├── settings.json              # permissions Claude Code
│   ├── rules/                     # security · next-app-router · drizzle · mdx · frontend-design
│   ├── agents/                    # playwright-tester · code/security/design/seo reviewers
│   └── skills/                    # qa-test-planner · playwright-best-practices (+ next-best-practices — фаза 1)
└── docs/
    ├── migration/                 # PLAN · PROMPT · ENVIRONMENTS · DESIGN-TOKENS · TESTING · REVIEW-PROMPT
    └── prototype/                 # README прототипа + ui_kits/blog (UX-эталон) + legacy CLAUDE
```

## Документы миграции (`docs/migration/`)

| Файл | Назначение |
|------|------------|
| `PLAN.md` | Фазовый план (12 фаз: Статус · Контекст входа · Цель · Подфазы/Todo · Цикл качества · DoD · Журнал фазы) — основной рабочий документ и живой журнал прогресса |
| `PROMPT.md` | Промт запуска проекта + промт запуска отдельной фазы (для новых сессий) |
| `ENVIRONMENTS.md` | Тестовый + продовый стенды, полная схема БД, флоу seed |
| `DESIGN-TOKENS.md` | Дизайн-токены (цвет/шрифт/шкалы/темы) — источник правды для `globals.css` |
| `TESTING.md` | Тест-кейсы, юзер-сценарии, Playwright MCP + TS-автотесты |
| `REVIEW-PROMPT.md` | Промт для ревью самого миграционного пакета |

## Эталоны (`docs/prototype/`)

- `README.md` — архитектура прототипа и **глава-ориентированная** доменная модель (источник истины).
- `ui_kits/blog/*` — исходники прототипа (реальное поведение экранов, UX-эталон).
- `legacy-article-model-CLAUDE.md` — CLAUDE.md прежней **статейной** версии: референс по стеку и
  тест-инфре, **не** образец доменной модели.

## Ключевые принципы

- Монолит. Глава-ориентированная модель (Blog → Chapter → Revision → blocks).
- Два стенда: **тест** (`:3001`, `blog.test.db`) и **прод** (Turso/Vercel). Тесты — только на тесте.
- Все БД — миграциями Drizzle. Timestamps — Unix seconds. ID — `ulid()`. Интерфейс на русском.
- Эстетика: Lora / Literata / Fira Code, teal-акцент, тонкие границы, без теней, dark/light.

> Примечание: сабагенты и скиллы в `.claude/` уже приведены к глава-ориентированной модели и путям
> `.claude/...`. Файл `docs/prototype/legacy-article-model-CLAUDE.md` — исторический референс прежней
> статейной версии (пути `.agents/`, таблицы `articles`), **не** образец текущей модели.
