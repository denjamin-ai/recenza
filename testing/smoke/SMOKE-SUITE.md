# SMOKE-SUITE — Smoke-набор Recenza (Фаза 11.1)

**Кейсов: 15** (P0: 12 · P1: 3) · **Целевое время прогона: ~15 минут.**
**Легенда приоритетов:** P0 — security/data-loss/критический инвариант/основной путь публикации · P1 — основная фича роли сломана без workaround · P2 — частичная деградация с workaround · P3 — косметика.

> ⛔ **Правило стопа: провал ЛЮБОГО smoke-кейса = стоп тестированию.** Прогон прерывается, заводится
> баг-репорт (`testing/BUG-REPORT-TEMPLATE.md`), сборка получает вердикт **NO-GO** — регресс не стартует
> до фикса. `npm run build` — необходимое, но недостаточное условие: минимальная планка готовности =
> сборка + зелёный smoke на тест-стенде (TESTING.md §7).

## Предусловия прогона

- Тест-стенд **http://localhost:3001**, БД `blog.test.db`, seed выполнен (`npm run test:reset`),
  стенд запущен (`npm run dev:test`). **Никогда не выполнять на `:3000`** (dev указывает на прод-Turso).
- Чистый профиль браузера (cookies `blog_session` очищены). Пароль всех seed-пользователей: `password`;
  пароль админа — env `ADMIN_PASSWORD_PLAIN` из `.env.test`.
- Смена роли — через меню aria-label «Меню пользователя» → «Выйти» (или отдельные браузерные контексты).
- Кейсы выполняются **строго по порядку**: SMK-10 → SMK-11 — связанная цепочка (вердикты → публикация);
  SMK-05, 06, 08, 10, 11, 15 мутируют БД — после smoke и перед регрессом обязателен свежий `npm run test:reset`.

## Таблица прогона

| № | ID | P | Кейс-источник | Краткие шаги | Ожидание |
|---|----|---|---------------|--------------|----------|
| 1 | SMK-01 | P1 | [TC-GUEST-01](../test-cases/TC-GUEST.md) | Гость открывает `/`; осмотреть ленту и карусель; клик по donate-CTA | Лента рендерится: глава «Цикл событий», ссылка «Войти» в шапке; карусель с баннерами `pb_recruit`/`pb_partner`/`pb_donate`; donate-CTA открывает модалку «Поддержать» (кнопка DonationAlerts + QR СБП, без сумм) |
| 2 | SMK-02 | P0 | [TC-GUEST-02](../test-cases/TC-GUEST.md) | Открыть `/blog/async-deep-dive`, затем `/blog/async-deep-dive/event-loop`; проверить `<title>`/OG; открыть `/blog/no-such-blog` | Data-driven рендер (регресс-ловушка article): блоки главы (код Shiki, изображение с alt) рендерятся; `<title>`/OG меняются при переходе блог↔глава; в списке глав только published («Цикл событий»); несуществующий блог → 404 |
| 3 | SMK-03 | P0 | [TC-GUEST-04/05/06](../test-cases/TC-GUEST.md) | Без cookie: GET `/author`, `/reviewer`, `/admin/dashboard` (адресная строка или curl `-I`) | Серверный 307: `/author` и `/reviewer` → `/login`, `/admin/dashboard` → `/admin/login`; защищённый контент не отдаётся |
| 4 | SMK-04 | P0 | [TC-READER-01](../test-cases/TC-READER.md) | `/login` → `reader` / `password` → кнопка «Войти» | Редирект на главную; в шапке меню aria-label «Меню пользователя»; сессия установлена (httpOnly cookie `blog_session`) |
| 5 | SMK-05 | P1 | [TC-READER-05](../test-cases/TC-READER.md), [TC-READER-06](../test-cases/TC-READER.md) | Под `reader` в ридере `event-loop`: ▲ «Полезно» — снять и вернуть голос (пауза ≥1 с между кликами); toggle закладки; открыть `/bookmarks` | Toggle работает в обе стороны, счётчики и `aria-pressed` синхронны, состояние переживает F5; `/bookmarks` отражает текущее состояние закладки `blog_async` |
| 6 | SMK-06 | P1 | [TC-READER-09](../test-cases/TC-READER.md) | Под `reader` на `event-loop` оставить root-комментарий с привязкой к блоку (anchor) | Комментарий появляется в дереве с цитатой-якорем, счётчик комментариев +1; клик по цитате скроллит к блоку |
| 7 | SMK-07 | P1 | [TC-AUTHOR-01](../test-cases/TC-AUTHOR.md) | Выйти, войти `author` / `password`; открыть `/author` | Кабинет автора: карточка блога «Глубоко в асинхронность JavaScript» с агрегатами статусов глав (published/на ревью/правки/черновик) |
| 8 | SMK-08 | P0 | [TC-AUTHOR-09](../test-cases/TC-AUTHOR.md) | Открыть `/author/blog/async-deep-dive/generators/edit` → «Отправить на ревью →»; в SubmitSheet проверить навыки (заполнены), выбрать `sergey_review` (ведущий) + `max_review` → «Отправить» | Без навыков submit заблокирован (чек-лист); после отправки глава — «На ревью»; созданы **pending-приглашения**, чипов активной команды НЕТ (`chapter_reviewers` пуст до accept) |
| 9 | SMK-09 | P0 | [TC-REVIEWER-01](../test-cases/TC-REVIEWER.md) | Выйти, войти `reviewer` / `password` | Редирект в инбокс `/reviewer`; видны назначенные главы, в т.ч. «Промисы изнутри» (ваш ход) |
| 10 | SMK-10 | P0 | [TC-REVIEWER-10](../test-cases/TC-REVIEWER.md) | Открыть `/reviewer/review/chp_under_review`, нажать «Одобрить» | Вердикт approve зафиксирован (кнопка в активном состоянии); в инбоксе у главы бейдж «одобрено»; «все одобрили» НЕ появляется (у `lena_review` request-changes) |
| 11 | SMK-11 | P0 | [TC-AUTHOR-16](../test-cases/TC-AUTHOR.md) | Выйти, войти `lena_review` → «Одобрить» на той же главе; выйти, войти `author` → `/author/blog/async-deep-dive/promises/review` → «Опубликовать» | Кнопка «Опубликовать» появляется **только** после всех approve; publish → 200 (гейт перепроверен в БД); глава «Опубликовано»; гость читает `/blog/async-deep-dive/promises`, указаны ревьюеры версии |
| 12 | SMK-12 | P0 | [TC-REVIEWER-15](../test-cases/TC-REVIEWER.md) | Войти `reviewer`, открыть ридер `event-loop`; из консоли (same-origin): `fetch("/api/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chapterId:"chp_published",text:"попытка"})}).then(r=>r.status)` | Формы комментария в UI нет; API → **403** («ревьюер никогда не комментирует»); комментарий не создан (после F5 отсутствует) |
| 13 | SMK-13 | P0 | [TC-ADMIN-01](../test-cases/TC-ADMIN.md) | Выйти, открыть `/admin/login`, пароль из env `ADMIN_PASSWORD_PLAIN`, «Войти как администратор»; затем «Выйти к блогу» | Вход → `/admin/dashboard` («Сводка»), портал полноэкранный (шапка сайта скрыта), навигация Модерация/Люди/Платформа; выход завершает сессию — повторный GET `/admin/dashboard` → 307 |
| 14 | SMK-14 | P0 | инвариант CSRF (TESTING.md §4; заметки в [TC-GUEST-12](../test-cases/TC-GUEST.md), [TC-REVIEWER-15](../test-cases/TC-REVIEWER.md)) | Из терминала: `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/comments -H "Origin: https://evil.example" -H "Content-Type: application/json" -d '{"chapterId":"chp_published","text":"csrf"}'` (при 401 — повторить с cookie `blog_session` читателя) | Кросс-ориджин мутация отклонена: **403** (same-origin CSRF), в любом случае НЕ 2xx; комментарий в БД не создан |
| 15 | SMK-15 | P0 | инвариант XSS (TESTING.md §4) | Войти `author`, в блоге создать новую главу («+ Новая глава»), в абзац вставить `<script>alert(1)</script><img src=x onerror=alert(2)>`, сохранить, открыть предпросмотр (`…/preview`) | Ни один `alert` не срабатывает; `script`/`onerror` санитизированы (payload экранирован или вырезан); консоль без ошибок исполнения инжектированного кода |

## Критерий выхода

- **PASS (smoke зелёный):** все 15 кейсов прошли → выполняется `npm run test:reset` и стартует
  регресс (`testing/regression/REGRESSION-SUITE.md`).
- **FAIL:** любой кейс провален → стоп, баг-репорт со ссылкой на SMK-ID и TC-источник, вердикт NO-GO.

## Примечания

- Соответствие требуемым критическим путям: главная (SMK-01), логин всех ролей (SMK-04/07/09/13),
  чтение главы (SMK-02), 307 без сессии (SMK-03), 403 ревьюер-комментирует (SMK-12),
  голос/закладка (SMK-05), отправка на ревью (SMK-08), вердикт (SMK-10), публикация при всех
  approve (SMK-11), комментарий читателя (SMK-06), админ-логин + дашборд (SMK-13),
  CSRF-отказ (SMK-14), XSS-санитизация (SMK-15).
- SMK-14/SMK-15 не имеют отдельного TC-документа — это инварианты TESTING.md §4; в регрессе они
  закреплены как SEC-CSRF-01 / SEC-XSS-01 (см. REGRESSION-SUITE, блок Security).
- Для Playwright (Фаза 11.2) весь набор тегируется `@smoke` и гоняется `npm run test:smoke`.
