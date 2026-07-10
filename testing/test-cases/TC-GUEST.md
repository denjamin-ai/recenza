# TC-GUEST — Тест-кейсы: Гость (аноним)

Роль: **гость** (нет сессии, cookie `blog_session` отсутствует). Проверяем публичное чтение,
редиректы на логин, intent-replay после входа и скрытие непубличного контента.

**Кейсов: 14** (P0 — 6 · P1 — 6 · P2 — 2 · P3 — 0; негативных — 7)

**Легенда приоритетов:** P0 — security/data-loss/критический инвариант/основной путь публикации · P1 — основная фича роли сломана без workaround · P2 — частичная деградация с workaround · P3 — косметика.

**Общие предусловия для всех кейсов:** тест-стенд `http://localhost:3001`, БД `blog.test.db`, seed выполнен (`npm run test:reset`), стенд запущен (`npm run dev:test`). Браузер — чистый профиль / cookies очищены (гость). Никогда не выполнять на `:3000`.

---

## TC-GUEST-01: Главная-каталог доступна гостю, карусель промо-баннеров видна

**Priority:** P1
**Type:** Functional / UI

### Objective
Гость без сессии видит главную страницу — каталог «Все блоги» с карточками БЛОГОВ (ui-feedback-4 П2:
табы «Лента/Каталог/Подписки» и поиск удалены) и карусель промо-баннеров (в т.ч. слайд
«Ищем ревьюеров» с CTA «Стать ревьюером»).

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Сессии нет (cookies очищены).

### Test Steps
1. Открыть `http://localhost:3001/`.
   **Expected:** Страница отдаётся без редиректа; в шапке — ссылка «Войти» (меню пользователя отсутствует, «Лента» — в правом кластере шапки); h1 «Все блоги» + счётчик публикаций; сетка карточек БЛОГОВ — видна карточка «Глубоко в асинхронность JavaScript» (обложка, eyebrow «N глав», автор, теги). Табов и строки поиска НЕТ.
2. Осмотреть карусель промо-баннеров под счётчиком.
   **Expected:** Карусель отображается; среди слайдов — `pb_recruit` «Ищем ревьюеров / Рецензируйте статьи по своим навыкам» с CTA «Стать ревьюером», партнёрский `pb_partner` и donate-баннер `pb_donate`. CTA каждого слайда — белым текстом, ПОД текстами слева (не справа).
3. Кликнуть CTA баннера `pb_recruit` («Стать ревьюером»).
   **Expected:** Внутренний переход на `/board` (доска «Ищем ревьюеров»), без открытия новой вкладки.
4. Вернуться на `/`, дождаться/долистать до donate-баннера и кликнуть его CTA.
   **Expected:** Открывается модалка «Поддержать Recenza» (aria-label «Поддержать проект»): золотая шапка с подписью «Пожертвования идут на оплату ревьюеров», карточка-ссылка DonationAlerts (`dm_link`) и QR СБП (`dm_qr`); суммы не запрашиваются.

### Test Data
- Блог: `blog_async` / slug `async-deep-dive` / «Глубоко в асинхронность JavaScript».
- Глава: `chp_published` / slug `event-loop` / «Цикл событий».
- Баннеры: `pb_recruit` (internal → `/board`), `pb_partner` (external), `pb_donate` (donate).
- Способы пожертвований: `dm_link` (DonationAlerts), `dm_qr` (СБП QR); `donations_enabled=true`.

### Post-conditions
- Состояние БД не изменилось (только чтение).

### Notes
- Акцент PUB-ARTICLE (гостевая часть): опубликованная глава видна в ленте/каталоге.
- Внешний баннер `pb_partner` должен открываться в новой вкладке (`target=_blank`) — проверить попутно.
- Связанные кейсы: TC-GUEST-11 (скрытый блог не в выдаче), TC-GUEST-12 (доска).

---

## TC-GUEST-02: Открытие блога и главы — data-driven рендер, title/OG меняются по контенту (регресс-ловушка article)

**Priority:** P0
**Type:** Regression / Functional

### Objective
Роут ридера рендерит data-driven `BlogReaderScreen`: контент, `<title>` и OG-теги выводятся из БД по slug (не легаси single-article вид); переходы блог ↔ глава меняют title и контент.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Сессии нет.

### Test Steps
1. Открыть `http://localhost:3001/blog/async-deep-dive`.
   **Expected:** Страница блога «Глубоко в асинхронность JavaScript»: заголовок, summary, автор `author`; `document.title` содержит название блога и суффикс «| Recenza».
2. Осмотреть список/strip глав блога.
   **Expected:** Гостю видна только опубликованная глава «Цикл событий» (`event-loop`); главы `promises` (under-review), `async-await` (changes-requested) и `generators` (draft) в списке отсутствуют.
3. Перейти в главу `http://localhost:3001/blog/async-deep-dive/event-loop`.
   **Expected:** Рендерятся блоки главы: заголовки h2/h3, абзацы, код с подсветкой Shiki и кнопкой копирования, изображение с `alt` («Схема цикла событий»); контент соответствует именно этой главе. `document.title` сменился — содержит «Цикл событий».
4. Проверить метатеги главы (DevTools → `<head>`).
   **Expected:** Присутствуют OG-теги (`og:title`/`og:description`) и `canonical`, значения соответствуют главе `event-loop`, а не статичной заглушке.
5. Вернуться на `/blog/async-deep-dive` (кнопкой браузера «Назад» или по хлебной крошке).
   **Expected:** `document.title` снова соответствует блогу; контент страницы обновился (обзор блога, не глава).
6. Открыть заведомо несуществующий блог `http://localhost:3001/blog/no-such-blog`.
   **Expected:** 404 «Страница не найдена» (не пустой рендер и не легаси-вид).

### Test Data
- `blog_async` / `async-deep-dive`; `chp_published` / `event-loop` / «Цикл событий» (published, v2).
- Непубличные главы: `chp_under_review` (`promises`), `chp_changes` (`async-await`), `chp_draft` (`generators`).

### Post-conditions
- Состояние БД не изменилось.

### Notes
- Регресс-ловушка из CLAUDE.md §Review-flow: «разные блоги → разный контент, обновление title/OG». В seed один видимый блог, поэтому «разные блоги» полноценно проверяются в TC-AUTHOR/TC-ADMIN; здесь фиксируем data-driven вывод и смену title блог↔глава.
- Шаг 2 — заодно негатив на утечку непубличных ревизий гостю.

---

## TC-GUEST-03: Чипы ревьюеров текущей версии + «Прошлые версии» за раскрытием

**Priority:** P1
**Type:** Functional

### Objective
Опубликованная глава указывает ревьюеров текущей версии чипами, а ревьюеров прошлых версий — за раскрытием `<details>` «Прошлые версии» (кредит по версиям, REV-VERSIONS).

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Сессии нет.

### Test Steps
1. Открыть `http://localhost:3001/blog/async-deep-dive/event-loop` и проскроллить к концу главы.
   **Expected:** Секция кредита ревьюеров (aria-label «Ревьюеры главы») присутствует.
2. Осмотреть чипы текущей версии (v2).
   **Expected:** Чипами указаны ревьюеры v2: `reviewer` (ведущий) и `max_review`; `lena_review` среди текущих чипов НЕТ.
3. Раскрыть элемент «Прошлые версии» (`<details>`).
   **Expected:** Показан состав прошлой версии v1: `reviewer` и `lena_review`.
4. Свернуть «Прошлые версии».
   **Expected:** Список v1 скрыт, чипы v2 остаются на месте.

### Test Data
- `chp_published` («Цикл событий», ревизии v1+v2).
- `reviewer_history`: v1 → `reviewer` (primary) + `lena_review`; v2 → `reviewer` (primary) + `max_review`.

### Post-conditions
- Состояние БД не изменилось.

### Notes
- Акцентный сценарий REV-VERSIONS (гостевая проекция кредита по версиям).
- Компонент: `src/components/reader/chapter-reviewer-credit.tsx` (RSC).

---

## TC-GUEST-04: GET /author без сессии → 307 на /login (негатив, критический инвариант)

**Priority:** P0
**Type:** Security

### Objective
Защищённый сегмент автора недоступен гостю: серверный редирект 307 на `/login`, никакого клиентского гейтинга или мигания контента.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Запросы выполняются без cookie `blog_session`.

### Test Steps
1. Выполнить `curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}" http://localhost:3001/author`.
   **Expected:** Статус `307`; `Location` ведёт на `/login`.
2. Повторить для `http://localhost:3001/author/portfolio`.
   **Expected:** `307` → `/login` (портфолио — тот же защищённый сегмент; матрица §2 «Портфолио: гость ❌»).
3. Повторить для страницы редактора `http://localhost:3001/author/blog/async-deep-dive/generators/edit`.
   **Expected:** `307` → `/login`; ни одного байта авторского контента в теле ответа.
4. Открыть `http://localhost:3001/author` в браузере (гость).
   **Expected:** Мгновенная посадка на `/login`: форма «Никнейм» / «Пароль», кнопка «Войти»; кабинет автора не мелькает.

### Test Data
- URL: `/author`, `/author/portfolio`, `/author/blog/async-deep-dive/generators/edit`.

### Post-conditions
- Состояние БД не изменилось; сессия не создана.

### Notes
- Критический инвариант TESTING.md §4 «Редирект без сессии».
- Покрывает строки матрицы §2 для гостя: «Вести блоги/главы ❌», «Отправлять на ревью ❌», «Портфолио ❌».

---

## TC-GUEST-05: GET /reviewer без сессии → 307 на /login (негатив, критический инвариант)

**Priority:** P0
**Type:** Security

### Objective
Инбокс и рабочее место ревьюера недоступны гостю — серверный 307 на `/login`.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Запросы без cookie `blog_session`.

### Test Steps
1. Выполнить `curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}" http://localhost:3001/reviewer`.
   **Expected:** `307` → `/login`.
2. Повторить для `http://localhost:3001/reviewer/review/chp_under_review`.
   **Expected:** `307` → `/login`; содержимое ревью-сессии (треды, чат, вердикты) не отдаётся.
3. Открыть `/reviewer` в браузере (гость).
   **Expected:** Посадка на `/login` без мигания инбокса ревьюера.

### Test Data
- URL: `/reviewer`, `/reviewer/review/chp_under_review` (глава «Промисы изнутри», under-review).

### Post-conditions
- Состояние БД не изменилось.

### Notes
- Критический инвариант §4 «Редирект без сессии»; строка матрицы §2 «Рецензировать: гость ❌».
- Ревью-треды `thr_open_1`/`thr_open_2` не должны быть достижимы ни через страницу, ни через прямой URL.

---

## TC-GUEST-06: GET /admin/dashboard без сессии → 307 на /admin/login (негатив, критический инвариант)

**Priority:** P0
**Type:** Security

### Objective
Админ-портал недоступен гостю: серверный 307 на `/admin/login` (отдельная форма входа админа).

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Запросы без cookie `blog_session`.

### Test Steps
1. Выполнить `curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}" http://localhost:3001/admin/dashboard`.
   **Expected:** `307` → `/admin/login`.
2. Повторить для `http://localhost:3001/admin/users` и `http://localhost:3001/admin/reports`.
   **Expected:** `307` → `/admin/login` на каждом; данные модерации (жалоба `rpt_1`, список пользователей) не отдаются.
3. Открыть `/admin/dashboard` в браузере (гость).
   **Expected:** Посадка на `/admin/login`: форма с кнопкой «Войти как администратор»; полноэкранный админ-портал не мелькает.

### Test Data
- URL: `/admin/dashboard`, `/admin/users`, `/admin/reports`.
- Админ не в seed — вход только `POST /api/auth` c паролем из env `ADMIN_PASSWORD_PLAIN` (в этом кейсе вход не выполняется).

### Post-conditions
- Состояние БД не изменилось.

### Notes
- Критический инвариант §4 «Редирект без сессии»; строка матрицы §2 «Роли/баны/жалобы/смена ведущего: гость ❌».

---

## TC-GUEST-07: Голос гостя «Полезно» → редирект /login с intent, реплей голоса после входа (негатив + replay)

**Priority:** P0
**Type:** Security / Functional

### Objective
Гость не может голосовать: клик по реакции уводит на `/login?next=…&intent=vote:…`; после входа намерение реплеится через авторизованный API, и голос применяется.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Сессии нет; открыта глава `/blog/async-deep-dive/event-loop`.

### Test Steps
1. В панели реакций (aria-label «Реакции») кликнуть кнопку «Полезно», запомнив текущий счётчик.
   **Expected:** Полный переход на `/login?next=%2Fblog%2Fasync-deep-dive%2Fevent-loop…&intent=vote:blog_async:1` (ui-feedback-5: голос блоговый); голос НЕ записан (нет сессии — мутация не выполняется).
2. На `/login` ввести «Никнейм» = `troll`, «Пароль» = `password`, нажать «Войти» (troll — reader БЕЗ seed-голоса; у `reader` голос bv_1 уже стоит, и реплей-toggle снял бы его).
   **Expected:** Вход успешен; выполняется реплей intent (`POST /api/blogs/blog_async/vote`, value 1); браузер возвращается на страницу главы из `next`.
3. Осмотреть панель реакций после возврата.
   **Expected:** Кнопка «Полезно» в активном состоянии, счётчик увеличен на 1 относительно шага 1.
4. (Изоляция) Кликнуть «Полезно» повторно, чтобы снять голос, и выйти через меню (aria-label «Меню пользователя») → «Выйти».
   **Expected:** Голос снят (toggle), сессия завершена, в шапке снова «Войти».

### Test Data
- Пользователь: `troll` / `password` (reader).
- Intent-токен: `vote:blog_async:1`; `next=/blog/async-deep-dive/event-loop`.

### Post-conditions
- После шага 4 состояние `blog_votes` возвращено к seed; иначе — `npm run test:reset`.

### Notes
- Строка матрицы §2 «Голос/закладка/подписка: гость → login».
- Реплей идемпотентен (toggle-API не задваивает) — повторный вход с тем же intent не должен ломать состояние.
- Кнопка «Не полезно» ведёт себя симметрично (`intent=vote:blog_async:-1`) — быстрая доп. проверка.
- ui-feedback-5: голосовать может ТОЛЬКО роль reader — вход автором/ревьюером реплей не применит (API 403).

---

## TC-GUEST-08: Закладка и подписка гостя → /login + intent-replay; /bookmarks гостю недоступна (негатив + replay)

**Priority:** P1
**Type:** Functional

### Objective
Закладка и подписка для гостя уводят на `/login` с intent и реплеятся после входа; страница `/bookmarks` без сессии редиректит на логин.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Сессии нет.

### Test Steps
1. Гостем открыть `http://localhost:3001/bookmarks`.
   **Expected:** Серверный редирект на `/login?next=/bookmarks` (страница закладок не рендерится).
2. Открыть `/blog/async-deep-dive/event-loop`, кликнуть кнопку «В закладки».
   **Expected:** Переход на `/login?next=…&intent=bookmark:blog_async`; закладка не создана.
3. Войти: «Никнейм» = `reader`, «Пароль» = `password`, «Войти».
   **Expected:** Реплей intent (`POST /api/bookmarks`), возврат на страницу из `next`; кнопка закладки в активном состоянии (aria-label «Убрать из закладок»).
4. Открыть `/bookmarks`.
   **Expected:** Блог «Глубоко в асинхронность JavaScript» в списке закладок.
5. Выйти (меню aria-label «Меню пользователя» → «Выйти»); гостем на странице главы кликнуть «Подписаться на автора».
   **Expected:** Переход на `/login?next=…&intent=follow:usr_author`; подписка не создана.
6. Войти снова как `reader` / `password`.
   **Expected:** Реплей intent (`POST /api/follows`); после возврата кнопка показывает «Вы подписаны».
7. Открыть `/` (главная читателя — «Ваша лента», ui-feedback-4 П2).
   **Expected:** В секции «Подписки» видна карточка блога автора `author` («Глубоко в асинхронность JavaScript»).

### Test Data
- Пользователь: `reader` / `password`.
- Intent-токены: `bookmark:blog_async`, `follow:usr_author`.

### Post-conditions
- Созданы закладка и подписка `reader` — снять повторным кликом («Убрать из закладок» / «Вы подписаны») или выполнить `npm run test:reset`.

### Notes
- Строка матрицы §2 «Голос/закладка/подписка: гость → login» (закладка/подписка).
- `next` обязан быть относительным (anti-open-redirect, `safeNext`) — подмена `next=https://evil.example` должна падать в fallback `/` (смежный security-кейс для TC-READER/security-сьюта).

---

## TC-GUEST-09: Публичные комментарии видны гостю read-only (дерево ≤2, tombstone, спойлер прошлых версий)

**Priority:** P1
**Type:** Functional

### Objective
Гость видит комментарии опубликованной главы целиком: дерево вложенности до глубины 2, заглушку удалённого комментария и спойлер «прошлые версии», но не имеет органов управления (правка/удаление/активное голосование).

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Сессии нет.

### Test Steps
1. Открыть `/blog/async-deep-dive/event-loop` и проскроллить к секции комментариев (`#comments`).
   **Expected:** Секция отрендерена сервером (RSC), комментарии видны без входа.
2. Осмотреть ветку `cmt_root`.
   **Expected:** Дерево трёх уровней: `cmt_root` (гл. 0, от `reader`) → ответ автора `cmt_reply_author` (гл. 1) → уточнение `cmt_reply_reader` (гл. 2, максимум); визуальная вложенность соответствует.
3. Найти `cmt_deleted`.
   **Expected:** Отображается tombstone-заглушка удалённого комментария (текст скрыт, действий нет).
4. Найти и раскрыть спойлер «Комментарии к прошлым версиям (…)».
   **Expected:** Внутри — `cmt_old_revision` с пометкой принадлежности прошлой ревизии (бейдж «к версии v1»).
5. Осмотреть карточки `cmt_fresh` и `cmt_stale`.
   **Expected:** Обе видны как обычные комментарии; кнопок «Изменить»/«Удалить» у гостя нет ни на одном комментарии.
6. Проверить composer/призыв к действию для гостя.
   **Expected:** Вместо активной отправки — приглашение войти (ссылка «Войти» с `next` на `…#comments`); счётчики голосов видны, но неинтерактивны без входа (клик уводит на логин — см. TC-GUEST-10).

### Test Data
- Комментарии seed: `cmt_root`, `cmt_reply_author`, `cmt_reply_reader`, `cmt_old_revision` (ревизия v1), `cmt_fresh`, `cmt_stale`, `cmt_deleted` (tombstone).

### Post-conditions
- Состояние БД не изменилось.

### Notes
- Акцент COM-STALE (гостевая проекция): комментарий к прошлой ревизии — в спойлере с бейджем версии.
- ⚠️ `cmt_fresh` протухает через 15 минут после seed — на видимость это не влияет (важно только для кейсов правки в TC-READER).

---

## TC-GUEST-10: Попытка гостя комментировать или голосовать за комментарий → /login; POST /api/comments без сессии отклоняется (негатив)

**Priority:** P1
**Type:** Security

### Objective
Мутации комментариев гостю запрещены: UI уводит на `/login` (с возвратом к `#comments`), прямой API-запрос без сессии отклоняется и записи не создаёт.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Сессии нет; открыта `/blog/async-deep-dive/event-loop#comments`.

### Test Steps
1. Кликнуть в поле композера «Оставьте комментарий…» / нажать отправку.
   **Expected:** Полный переход на `/login?next=%2Fblog%2Fasync-deep-dive%2Fevent-loop%23comments`; комментарий не создан.
2. Кликнуть стрелку голосования на комментарии `cmt_root`.
   **Expected:** Переход на `/login?next=…%23comments`; голос не записан.
3. Войти как `reader` / `password` («Войти»).
   **Expected:** Возврат по `next` на страницу главы с якорем `#comments` — страница проскроллена к секции комментариев, композер активен.
4. Выйти («Меню пользователя» → «Выйти»). Без сессии выполнить прямой запрос:
   `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/comments -H "Content-Type: application/json" -H "Origin: http://localhost:3001" -d '{"blogSlug":"async-deep-dive","chapterSlug":"event-loop","text":"guest-api-probe"}'`.
   **Expected:** `401` (нет сессии); комментарий в БД не создан.
5. Обновить страницу главы гостем и осмотреть секцию комментариев.
   **Expected:** Текста `guest-api-probe` нет; состав комментариев соответствует seed.

### Test Data
- URL: `/blog/async-deep-dive/event-loop#comments`; пользователь для шага 3: `reader` / `password`.

### Post-conditions
- Новых строк в `public_comments`/`comment_votes` нет; сессия завершена.

### Notes
- Строка матрицы §2 «Комментировать: гость → login».
- Для комментария intent-replay не выполняется (реплеятся только vote/bookmark/follow) — гарантируется лишь возврат к `#comments`; это ожидаемое поведение.

---

## TC-GUEST-11: Скрытый блог: нет в ленте/каталоге, прямой URL → 404 (негатив)

**Priority:** P0
**Type:** Security

### Objective
Блог заблокированного автора (`blogs.hidden` / `users.isBlocked`) полностью исключён из публичной выдачи: не встречается в ленте/каталоге, а прямые URL блога и его главы возвращают 404 без утечки данных.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Сессии нет.

### Test Steps
1. Открыть `/` (главная-каталог «Все блоги», ui-feedback-4 П2).
   **Expected:** Карточки «Скрытый блог» (`hidden-blog`) нет; карточка seed-блога видна (страница загрузилась).
3. Открыть напрямую `http://localhost:3001/blog/hidden-blog`.
   **Expected:** 404 «Страница не найдена»; ни название, ни summary скрытого блога не отдаются.
4. Открыть главу скрытого блога `http://localhost:3001/blog/hidden-blog/intro`.
   **Expected:** 404; контент главы «Вступление» не отдаётся.
5. Выполнить поиск текста в HTML-ответах шагов 3–4 (например, `curl -s http://localhost:3001/blog/hidden-blog | grep -c "Скрытый блог"`).
   **Expected:** Вхождений нет (0) — данные не просачиваются в разметку 404.

### Test Data
- Блог: `blog_ghost` / slug `hidden-blog` / «Скрытый блог» (автор `ghost`, `isBlocked=true`).
- Глава: `chp_ghost` / slug `intro` / «Вступление» (draft).

### Post-conditions
- Состояние БД не изменилось.

### Notes
- Отсутствие скрытого блога в `feed.xml`/`sitemap.xml` проверяется в TC-GUEST-13.
- Смежная проверка (для TC-READER/TC-ADMIN): профиль `/u/ghost` заблокированного автора также не должен светить контент.

---

## TC-GUEST-12: Публичная доска /board: направления видны, гостевая заявка «Стать ревьюером» отправляется

**Priority:** P1
**Type:** Functional

### Objective
Доска «Ищем ревьюеров» публична: гость видит открытые направления и может отправить заявку без входа (публичная мутация `POST /api/board/applications`).

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Сессии нет.

### Test Steps
1. Открыть `http://localhost:3001/board`.
   **Expected:** Страница отдаётся без редиректа; видны карточки направлений `bc_frontend` (React/TypeScript, отмечено как hot) и `bc_backend` (Node.js/SQL).
2. Нажать кнопку «Стать ревьюером» (или «Откликнуться» на карточке направления).
   **Expected:** Открывается модалка «Стать ревьюером»; для гостя есть поле «Ваше имя» (aria-label «Имя»), поля «Направление (Frontend, Backend…)», «Навык + Enter» и необязательное сообщение.
3. Заполнить: имя `Гость Тестовый`, направление `Frontend`, навыки `React`, `TypeScript`; нажать «Отправить заявку».
   **Expected:** Успешное состояние (заявка принята, администратор рассмотрит); ошибок нет, редиректа на логин нет.
4. Повторно открыть модалку и нажать «Отправить заявку» с пустым направлением/навыками.
   **Expected:** Валидационная ошибка формы; заявка не отправляется.

### Test Data
- Направления seed: `bc_frontend` (React/TypeScript, hot), `bc_backend` (Node.js/SQL).
- Существующие заявки seed: `app_user` (от `reader`, pending), `app_guest` (гостевая, accepted) — для сверки, что механизм гостевых заявок поддержан.

### Post-conditions
- Создана новая строка `reviewer_applications` (pending) от гостя — виден админу в `/admin/recruit`; очистка — `npm run test:reset`.

### Notes
- Единственная разрешённая гостевая мутация (без `requireUser`); должна сохранять same-origin проверку (CSRF) — кросс-ориджин POST → 403 (закрепляется в security-сьюте).
- Разбор заявки админом — TC-ADMIN.

---

## TC-GUEST-13: SEO-эндпоинты: /feed.xml, /sitemap.xml, /robots.txt отдаются и не светят скрытое

**Priority:** P2
**Type:** Integration / SEO

### Objective
Публичные SEO-эндпоинты доступны гостю, корректны по формату и не содержат скрытый блог и служебные сегменты.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Запросы без cookie.

### Test Steps
1. Выполнить `curl -s -i http://localhost:3001/feed.xml`.
   **Expected:** `200`, XML-фид (RSS); содержит запись опубликованной главы «Цикл событий» (`/blog/async-deep-dive/event-loop`).
2. Проверить фид на скрытое: `curl -s http://localhost:3001/feed.xml | grep -c "hidden-blog"`.
   **Expected:** `0` — скрытый блог в фиде отсутствует; непубличные главы (`promises`, `async-await`, `generators`) тоже.
3. Выполнить `curl -s -i http://localhost:3001/sitemap.xml`.
   **Expected:** `200`, валидный sitemap; содержит URL главной, блога `async-deep-dive` и главы `event-loop`; `hidden-blog` отсутствует.
4. Выполнить `curl -s http://localhost:3001/robots.txt`.
   **Expected:** `200`; `User-agent: *`, `Allow: /`, `Disallow` для `/api/`, `/admin`, `/author`, `/reviewer`, `/login`, `/bookmarks`; строка `Sitemap: …/sitemap.xml`.

### Test Data
- Публичный контент: `blog_async`/`chp_published`. Скрытый: `blog_ghost` (`hidden-blog`).

### Post-conditions
- Состояние БД не изменилось.

### Notes
- Реализация: `src/app/feed.xml/route.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`; фильтр `blogs.hidden=false` общий с лентой (`src/lib/queries/feed.ts`).

---

## TC-GUEST-14: Публичный профиль автора /u/author доступен гостю

**Priority:** P2
**Type:** Functional

### Objective
Страница публичного профиля автора открывается гостю: имя, блоги автора, title страницы соответствует профилю; непубличный контент не отображается.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Сессии нет.

### Test Steps
1. Открыть `http://localhost:3001/u/author`.
   **Expected:** `200` без редиректа; страница профиля автора `author`: имя/аватар, роль/подпись автора.
2. Осмотреть список блогов на профиле.
   **Expected:** Виден блог «Глубоко в асинхронность JavaScript» с переходом на `/blog/async-deep-dive`; черновики и непубличные главы не перечислены.
3. Проверить `document.title`.
   **Expected:** Содержит имя автора и суффикс «| Recenza» (метаданные генерируются по данным профиля).
4. Кликнуть по карточке блога.
   **Expected:** Переход на страницу блога `/blog/async-deep-dive` (связность навигации профиль → блог).

### Test Data
- Пользователь: `author` (владелец `blog_async`); URL `/u/author`.

### Post-conditions
- Состояние БД не изменилось.

### Notes
- Профиль заблокированного автора (`/u/ghost`) не должен отдавать контент — фиксируется вместе с TC-GUEST-11 в регресс-сьюте.
- Публичное портфолио «Об авторе» (если опубликовано) проверяется в TC-AUTHOR (PUB-PORTFOLIO); здесь — только доступность страницы гостю.
