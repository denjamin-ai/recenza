# Recenza

Многоглавный девблог с встроенным редакционным review-flow. Монолит на **Next.js 16**.
Этот репозиторий — **bootstrap-кит для миграции** дизайн-прототипа в production через Claude Code.
Код приложения генерируется по фазам плана; здесь — вся обвязка, документы и эталоны.

## С чего начать

1. Прочитай **`docs/migration/SETUP.md`** — старт с нуля (create-next-app → зависимости → секреты → MCP).
2. Открой Claude Code в этой папке и вставь первым сообщением **`docs/migration/PROMPT.md`**.
3. Дальше Claude идёт по **`docs/migration/PLAN.md`** (14 фаз), начиная с Фазы 0.

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
│   └── skills/                    # qa-test-planner · playwright-best-practices
└── docs/
    ├── migration/                 # PLAN · PROMPT · SETUP · ENVIRONMENTS · TESTING
    └── prototype/                 # README прототипа + ui_kits/blog (UX-эталон) + legacy CLAUDE
```

## Документы миграции (`docs/migration/`)

| Файл | Назначение |
|------|------------|
| `PLAN.md` | Фазовый план (14 фаз: Название · Цель · Todo · DoD) — основной рабочий документ |
| `PROMPT.md` | Промт запуска — первое сообщение для Claude Code |
| `SETUP.md` | Старт проекта с нуля (Фаза 0) |
| `ENVIRONMENTS.md` | Тестовый + продовый стенды, полная схема БД, флоу seed |
| `TESTING.md` | Тест-кейсы, юзер-сценарии, Playwright MCP + TS-автотесты |

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

> Примечание: файлы в `.claude/agents/` и `.claude/skills/` внутри ссылаются на пути вида
> `.agents/...` (исходная конвенция автора) — при необходимости поправь на `.claude/...`.
