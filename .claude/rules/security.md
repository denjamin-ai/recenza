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
- **XSS.** Пользовательский контент (блоки, MDX, suggestion) санитизировать: вырезать
  `<script>/<iframe>/<object>/<embed>`, `on*=`, `javascript:`. Никаких сырых `dangerouslySetInnerHTML`
  без санитайза.
- **Секреты.** Только из env. `SESSION_SECRET` без fallback. bcrypt в `.env*` — `'$' → '\$'`.
  Запрещён хардкод `SECRET/PASSWORD/TOKEN` в `src/`.
- **CSRF.** Все мутирующие запросы — проверка same-origin (`origin`/`host`). Cookie: `httpOnly`,
  `secure`, `sameSite`.
- **Rate-limit.** Логин 5/15мин по `x-forwarded-for`; голоса 1/сек на пользователя (429 при превышении).
- **Валидация ввода.** Типы/длины/форматы на каждом POST/PUT. `cover_url` обязан начинаться с `/uploads/`.
- `requireUser()` кидает `NextResponse`, а не Error — в хендлере его нужно `return`.
