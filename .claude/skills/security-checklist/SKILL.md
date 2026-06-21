---
name: security-checklist
description: >
  Повторяемый чеклист безопасности Recenza: auth-гейтинг на каждом роуте, валидация
  ввода, CSRF same-origin, rate-limit, санитизация MDX/HTML, секреты из env, ролевые
  границы. Применяй в Цикле качества каждой кодовой фазы вместе с агентом security-reviewer.
---

# Security-чеклист Recenza

Проходи перед закрытием любой кодовой фазы. Любой невыполненный пункт уровня P0/P1 — блокирует.

## Аутентификация и сессии
- [ ] `SessionData { isAdmin, userId?, userRole? }` — инвариант: `isAdmin` и `userId` НЕ одновременно.
- [ ] `iron-session`, cookie `blog_session`, httpOnly + secure (prod) + sameSite=lax, срок 7д.
- [ ] `SESSION_SECRET` — из env, без fallback (приложение падает при старте, если не задан).
- [ ] Пароли — `bcryptjs`; в `.env*` `$` экранируется как `\$` (dotenv-expand).

## Гейтинг роутов (binding)
- [ ] Каждый `/api/admin/*` — `await requireAdmin()` первой строкой.
- [ ] `/api/author/*` — `requireAuthor()` + проверка ownership (`blog.authorId === session.userId`).
- [ ] `/api/reviewer/*` — `requireReviewer()` + проверка назначения на главу.
- [ ] Смешанный доступ — `resolveAccess()` (auth → fetch → ownership). Без сессии на `/admin|/author|/reviewer` → редирект.
- [ ] **Роль пользователя НЕ редактируется обычным API** (нет поля `role` в `PUT /api/admin/users/[id]`).
- [ ] **Админ не создаёт блоги/главы** (`POST` создания → 403 для admin-сессии).
- [ ] Ревьюер никогда не постит публичные комментарии; автор не комментирует/не правит чужие блоги (403).

## Ввод и инъекции
- [ ] Тело мутаций валидируется до записи (типы, длины, перечисления).
- [ ] Только Drizzle, никакого raw SQL/конкатенации. JSON-поля — `try/catch`.
- [ ] MDX/HTML из пользовательского ввода санитизируется (нет `<script>`, on*-атрибутов); проверь XSS-в-MDX.
- [ ] `cover_url` валидируется на префикс `/uploads/` — внешние URL отклоняются. Загрузка QR — только изображение.

## CSRF / rate-limit / cron
- [ ] Все мутации — same-origin (проверка `Origin`).
- [ ] Rate-limit логина (5/15 мин по `x-forwarded-for`) → 6-я попытка = 429. Лимит на голосах/реакциях.
- [ ] Cron-роуты — `Authorization: Bearer CRON_SECRET`.

## Секреты и стенды
- [ ] Секреты только из env; `.env.local`/`.env.test` в `.gitignore`, не в репозитории/логах.
- [ ] Прод-БД недоступна тестам; `ADMIN_PASSWORD_PLAIN` — только в `.env.test`, никогда в проде.
- [ ] `npm audit` без критических; security-заголовки на проде (фаза 12).

> Прогоняй вместе с сабагентом `security-reviewer` (0 критических = гейт). Негативные кейсы (403/редирект/429)
> подтверждай сабагентом `playwright-tester`.
