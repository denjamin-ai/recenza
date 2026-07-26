---
description: Безопасность — секреты, auth, инъекции, XSS, валидация ввода. Всегда активно.
alwaysApply: true
---

# Правило: Безопасность (always-on)

- **Auth-гейтинг на каждом роуте.** Admin-API → `await requireAdmin()` первой строкой;
  author-API → `requireAuthor()` + проверка ownership (`blog.authorId === session.userId`);
  reviewer-API → `requireReviewer()` + проверка назначения на главу. Смешанный доступ — `resolveAccess()`.
- **Ролевой гейтинг (binding).** Ревьюер никогда не комментирует; автор не комментирует/не читает
  чужие блоги; админ не создаёт блоги/главы; роль не меняется обычным API. Проверять на сервере, не в UI.
- **Никакого raw SQL.** Только Drizzle. Запрещены `db.run`/`db.execute` со строковой интерполяцией.
- **XSS.** Блоки — структурный JSON, рендерятся в React-узлы (текст экранируется автоматически);
  HTML-санитайзера в проекте нет и он не нужен — ⚠️ функции `stripDangerousHtml()` НЕ существует,
  не ссылаться на неё. `dangerouslySetInnerHTML` допустим только там, где экранирует источник
  (JSON-LD, Shiki, KaTeX `trust:false`, Mermaid `securityLevel:"strict"`) — новые сайты добавлять
  нельзя. URL в контенте — http(s) либо одиночный `/`; `javascript:`, `data:`, `//host` → литерал.
  Второй рубеж — nonce-CSP (`src/middleware.ts`).
- **Секреты.** Только из env. `SESSION_SECRET` без fallback. bcrypt в `.env*` — `'$' → '\$'`.
  Запрещён хардкод `SECRET/PASSWORD/TOKEN` в `src/`.
- **CSRF.** Все мутирующие запросы — проверка same-origin (`origin`/`host`). Cookie: `httpOnly`,
  `secure`, `sameSite`.
- **Rate-limit.** Логин — ДВА ведра: по IP 5/15мин и по аккаунту 15/15мин (`acct:<handle>`/`acct:admin`).
  ⚠️ IP берётся ТОЛЬКО из доверенного хопа (`CF-Connecting-IP` → последний хоп `x-forwarded-for`):
  первый хоп XFF задаёт клиент, и ключ по нему обходится ротацией заголовка. Голоса — 1/сек на
  пользователя (429 при превышении). Промах логина обязан платить фиктивный `bcrypt.compare`.
- **Валидация ввода.** Типы/длины/форматы на каждом POST/PUT. `cover_url` обязан начинаться с `/uploads/`.
- `requireUser()` кидает `NextResponse`, а не Error — в хендлере его нужно `return`.
