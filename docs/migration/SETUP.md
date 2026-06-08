# SETUP.md — Проект Claude Code с нуля (Фаза 0)

Пошаговый старт «с чистого листа» до момента, когда Claude Code готов идти по `PLAN.md`.
Цель — собрать пустой, но рабочий каркас монолита + всю обвязку Claude Code (правила, агенты,
скиллы, Playwright MCP). Соответствует **Фазе 0** плана.

---

## Шаг 0. Что должно быть на машине
- Node.js 20+, npm, Git
- `sqlite3` CLI (для `db-query.sh`)
- Аккаунт GitHub (CI), Claude Code (CLI)
- Turso/Vercel — **не нужны на старте**, только к Фазе 13

## Шаг 1. Создать репозиторий и каркас
```bash
mkdir recenza && cd recenza
git init
# Каркас Next.js 16 (App Router, TS, Tailwind, src/, alias @/*)
npx create-next-app@latest . --ts --app --tailwind --src-dir --import-alias "@/*" --eslint
```

## Шаг 2. Положить артефакты миграции
Скопируй в репозиторий:
```
recenza/
├── CLAUDE.md                      ← из claude-migration/CLAUDE.md (в КОРЕНЬ)
├── docs/migration/
│   ├── PLAN.md  PROMPT.md  ENVIRONMENTS.md  TESTING.md   ← из claude-migration/
├── docs/prototype/
│   ├── README.md                  ← README прототипа
│   └── ui_kits/blog/*             ← исходники прототипа (UX-эталон)
├── .claude/
│   ├── settings.json              ← из bootstrap/.claude/settings.json
│   ├── rules/*.md                 ← из bootstrap/.claude/rules/
│   ├── agents/*.md                ← из uploads/: playwright-tester, code-reviewer,
│   │                                 security-reviewer, design-watcher, seo-optimizer
│   ├── skills/                    ← qa-test-planner (SKILL.md), playwright-best-practices
│   │                                 (SKILL-d54f14eb.md) → next-best-practices (создать)
│   └── playwright-tester/*.sh     ← скрипты тест-стенда (создаются в Фазе 2)
├── .mcp.json                      ← из bootstrap/.mcp.json
├── .env.example                   ← из bootstrap/.env.example
└── package.json                   ← дополнить скриптами из bootstrap/package.json
```
> Имена агентов адаптируй: «статья» → «глава/ревизия» (модель глава-ориентированная).

## Шаг 3. Установить зависимости ядра
```bash
npm i @libsql/client drizzle-orm iron-session bcryptjs ulid next-themes \
      next-mdx-remote rehype-pretty-code shiki
npm i -D drizzle-kit tsx @playwright/test
npx playwright install
```

## Шаг 4. Секреты (заглушки на старте)
```bash
cp .env.example .env.local
cp .env.example .env.test
# Сгенерировать значения:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # SESSION_SECRET
node -e "console.log(require('bcryptjs').hashSync('admin-pass',10))"        # ADMIN_PASSWORD_HASH ('$' → '\$')
# В .env.test добавить ADMIN_PASSWORD_PLAIN=admin-pass (открытый пароль ТОЛЬКО здесь)
```
`.gitignore`: `.env.local`, `.env.test`, `blog.db`, `blog.test.db`, `/.auth`, `node_modules`, `.next`.

## Шаг 5. Настроить Playwright MCP в Claude Code
`.mcp.json` уже подключает сервер. Проверь, что инструменты `mcp__playwright__*` доступны
(тестовый `browser_navigate` на `about:blank`). Если Claude Code читает MCP из своего конфига —
скопируй туда содержимое `.mcp.json`.

## Шаг 6. Первый запуск Claude Code
```bash
claude         # в папке recenza
```
Вставь содержимое **`docs/migration/PROMPT.md`** первым сообщением. Claude:
1. прочитает `CLAUDE.md`, `PLAN.md`, `README.md` прототипа, `ENVIRONMENTS.md`, `TESTING.md`;
2. заведёт todo по фазам;
3. начнёт с Фазы 0 (дотянет каркас, токены дизайна, правила/агенты/скиллы) и пойдёт дальше.

## Шаг 7. Критерий, что Фаза 0 закрыта
- `npm run dev` поднимает каркас, `npm run build` зелёный, `npm run lint` чистый
- В корне `CLAUDE.md`; `.claude/{rules,agents,skills}` заполнены; `.mcp.json` рабочий
- Playwright MCP отвечает
- Дизайн-токены (Lora/Literata/Fira Code, teal, без теней, dark/light) подключены, hardcoded-цветов нет

---

## Карта обвязки Claude Code (что за что отвечает)

| Файл/папка | Назначение |
|---|---|
| `CLAUDE.md` | Постоянный контекст: стек, конвенции, гейтинг ролей, gotchas |
| `.claude/rules/*.md` | Правила с `globs` — авто-подключаются по путям файлов |
| `.claude/agents/*.md` | Сабагенты-проверяющие (security/code/design/seo/playwright) |
| `.claude/skills/*` | Скиллы: планирование тестов, Playwright best-practices |
| `.mcp.json` | MCP-серверы (Playwright) |
| `docs/migration/PLAN.md` | План фаз — основной рабочий документ |
| `docs/migration/PROMPT.md` | Промт запуска (первое сообщение) |

После Фазы 0 — переходи к Фазе 1 (схема БД) и Фазе 2 (два стенда + seed) по `PLAN.md`.
