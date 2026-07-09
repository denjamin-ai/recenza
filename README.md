# Recenza

Многоглавные девблоги с редакционным review-flow. Монолит на **Next.js 16** (App Router,
TypeScript, Tailwind v4, Drizzle ORM/libsql, iron-session). Интерфейс на русском.

**Прод:** https://recenza.ru — VPS (Caddy → Node standalone → systemd), локальный SQLite,
автодеплой из `main` через GitHub Actions. Альфа: аккаунты выдаёт администратор, регистрации нет.

## Как устроено

- Доменная модель — глава-ориентированная: Blog → Chapter → Revision → blocks.
- 4 роли с жёстким гейтингом: читатель / автор / ревьюер / админ.
- Публикация главы — только через ревью (приглашения → вердикты → «все approve»), либо
  force-approve админом. Отложенная публикация — cron.

## Документы

| Что нужно | Куда смотреть |
|---|---|
| Конвенции, архитектура, гочи (контекст Claude Code) | `CLAUDE.md` |
| Процесс изменений: тесты → качество → PR → автодеплой | `docs/migration/WORKFLOW.md` |
| Промты для сессий Claude Code | `docs/migration/PROMPT.md` |
| Стенды, прод-runbook (откат, бэкапы, SSH) | `docs/migration/ENVIRONMENTS.md` |
| История: 12 фаз миграции + журнал итераций | `docs/migration/PLAN.md` |
| Тест-слой (118+ e2e) | `docs/migration/TESTING.md`, `testing/**` |
| Дизайн-токены и UX-эталон | `docs/migration/DESIGN-TOKENS.md`, `docs/prototype/**` |

## Быстрый старт (dev)

```bash
npm install
npm run db:migrate && npm run seed   # локальная blog.db с демо-данными
npm run dev                          # http://localhost:3000
```

Тестовый стенд и e2e:

```bash
npm run dev:test        # :3001, детерминированный seed (blog.test.db)
npx playwright test     # полный прогон (только на :3001)
```

Демо-логины тестового стенда: `reader` / `author` / `reviewer`, пароль `password`.

## Деплой

Merge в `main` → workflow `deploy.yml` сам собирает, доставляет на сервер, применяет миграции
и перезапускает сервис. Подробности и откат — `CLAUDE.md` § «Деплой изменений» и
`ENVIRONMENTS.md` §6.
