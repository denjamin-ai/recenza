# TC-REVIEWER — Тест-кейсы роли «Ревьюер»

Recenza · Фаза 11.1 · Роль: **ревьюер** (handle `reviewer`; для сценариев приглашений — `sergey_review`).
Покрытие: логин и кабинет-инбокс, приглашения (accept/decline/flag), ReviewPage (треды, suggestion,
вердикты, чат сессии), публичный профиль, приватность оценок, негативы ролевого гейтинга.

**Всего кейсов: 18** (P0 — 8 · P1 — 9 · P2 — 1; негативных — 6)

Легенда приоритетов: **P0** — security/data-loss/критический инвариант/основной путь публикации · **P1** — основная фича роли сломана без workaround · **P2** — частичная деградация с workaround · **P3** — косметика.

Окружение: **только тест-стенд `http://localhost:3001`** (БД `blog.test.db`). Прод/`:3000` не трогать.
Все ID/slug/handle — из детерминированного seed (`npm run test:reset`). Пароль всех пользователей: `password`.

> ⚠️ Кейсы TC-REVIEWER-03/04/05, 08/09, 10/11 мутируют seed-данные (приглашения, треды, вердикты) —
> перед каждым таким кейсом выполняйте `npm run test:reset`.

---

## TC-REVIEWER-01: Логин ревьюера и редирект в кабинет /reviewer

**Priority:** P0
**Type:** Functional

### Objective
Проверить, что ревьюер входит через общий /login и попадает в свой кабинет /reviewer (роль берётся из БД).

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Сессия отсутствует (cookies очищены).

### Test Steps
1. Открыть `http://localhost:3001/login`.
   **Expected:** Центрированная карточка «Вход в аккаунт» с полями хендла и «Пароль», кнопка «Войти». Шапка сайта скрыта.
2. Ввести handle `reviewer`, пароль `password`, нажать «Войти».
   **Expected:** Редирект на `/reviewer`. Заголовок «Кабинет ревьюера», подзаголовок «Раиса Ревьюер · Приглашения и ревью».
3. Открыть меню аватара (кнопка с aria-label «Меню пользователя») в шапке.
   **Expected:** В меню есть пункты «Кабинет ревьюера» и «Выйти»; пунктов автора («Кабинет автора») нет.
4. Нажать «Выйти».
   **Expected:** Сессия завершена; повторный GET `/reviewer` → 307-редирект на `/login`.

### Test Data
- Пользователь: `reviewer` / `password` (роль reviewer).

### Post-conditions
- После шага 4 сессии нет; данные БД не изменены.

### Notes
- Инвариант TESTING.md §4 «Редирект без сессии»: GET `/reviewer` без cookie → 307 (шаг 4).
- Rate-limit логина (5 неудач/15 мин → 429) — отдельный кейс в TC-GUEST.

---

## TC-REVIEWER-02: Инбокс — назначенные главы со статусами и плитки-счётчики

**Priority:** P1
**Type:** Functional

### Objective
Проверить, что кабинет ревьюера показывает активные ревью (только из `chapter_reviewers`) с корректными статусами, бейджами вердиктов и счётчиками.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход выполнен как `reviewer` / `password`.

### Test Steps
1. Открыть `http://localhost:3001/reviewer`.
   **Expected:** Плитки: «Приглашения» = 0, «Ваш ход» = 1, «Активные ревью» = 2, «Ваш рейтинг» = 4.6 (12).
2. Проверить секцию «Входящие приглашения».
   **Expected:** Текст «Новых приглашений нет.» (pending-приглашение `inv_pending` адресовано `sergey_review`, не `reviewer`).
3. Проверить секцию «Активные ревью» — карточку главы «Промисы изнутри».
   **Expected:** Подпись «Глубоко в асинхронность JavaScript · вы ведущий · 2 открытых»; бейджи «ваш ход» (вердикт не поставлен) и «На ревью».
4. Проверить карточку главы «Async/await на практике».
   **Expected:** Бейджи «одобрено» (мой вердикт approve) и «Нужны правки» (статус ревизии changes-requested; ведущий — lena_review).
5. Кликнуть по карточке «Промисы изнутри».
   **Expected:** Переход на `/reviewer/review/chp_under_review` (ReviewPage открылась без ошибок).

### Test Data
- Назначения из seed: `chp_under_review` (slug `promises`, primary `reviewer`, статус under-review), `chp_changes` (slug `async-await`, primary `lena_review`, статус changes-requested, вердикт reviewer=approve).

### Post-conditions
- Данные БД не изменены.

### Notes
- Глава `chp_published` в активных ревью отсутствует (published — ревью завершено).
- Счётчик «2 открытых» = треды `thr_open_1`, `thr_open_2`.

---

## TC-REVIEWER-03: Приглашение — карточка pending видна и «Принять» стартует ревью

**Priority:** P0
**Type:** Functional / Integration

### Objective
Проверить модель согласия (Фаза 9): pending-приглашение отображается с match% и деталями; accept наполняет `chapter_reviewers` (reviewLoad +1), открывает доступ к ревью и уведомляет автора.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход выполнен как `sergey_review` / `password`.

### Test Steps
1. Открыть `http://localhost:3001/reviewer`.
   **Expected:** Плитка «Приглашения» = 1, «Активные ревью» = 0 («Сейчас на вас не назначено активных ревью.»).
2. Осмотреть карточку приглашения в секции «Входящие приглашения».
   **Expected:** Глава «Промисы изнутри», подпись «Глубоко в асинхронность JavaScript · v1», бейдж «0% совпадение»; чипы навыков «Промисы», «Then/Catch» (без отметки ✓ — компетенции не совпали); заметка автора «Нужен взгляд по безопасности.»; кнопки «Принять», «Отклонить» и «Навыки не совпадают» (последняя видна, т.к. match 0% < 50%).
3. Нажать «Принять».
   **Expected:** Карточка сменяется статусом «✓ Принято — автор уведомлён»; после авто-обновления приглашений 0, «Активные ревью» = 1 — «Промисы изнутри» с бейджем «ваш ход».
4. Открыть `/reviewer/review/chp_under_review`.
   **Expected:** ReviewPage открывается (доступ появился — запись в `chapter_reviewers` создана accept'ом, не самим приглашением).
5. Выйти, войти как `author` / `password`, открыть уведомления (колокольчик).
   **Expected:** Уведомление о принятии приглашения по главе «Промисы изнутри».

### Test Data
- Приглашение `inv_pending`: `sergey_review` → `chp_under_review`, revision 1, status pending.
- Компетенции `sergey_review`: Безопасность, Криптография; навыки главы: Промисы, Then/Catch → match 0%.

### Post-conditions
- `review_invitations.inv_pending` → accepted; `chapter_reviewers` содержит (`chp_under_review`, rev 1, `sergey_review`); `users.reviewLoad` sergey_review: 0 → 1. **БД мутирована — `npm run test:reset` перед следующим кейсом.**
- API: POST `/api/reviewer/invitations/inv_pending` `{action:"accept"}` → 200 `{status:"accepted"}`.

### Notes
- Повторный ответ на то же приглашение → 409 «На приглашение уже дан ответ» (TOCTOU-защита).
- Accept при `reviewLoad ≥ reviewCapacity` → 409 (в seed sergey 0/3 — не воспроизводится без подготовки).

---

## TC-REVIEWER-04: Приглашение — «Отклонить»: назначение не создаётся, автор уведомлён

**Priority:** P1
**Type:** Functional

### Objective
Проверить, что decline не создаёт назначение (`chapter_reviewers` пуст, reviewLoad не растёт) и автор получает уведомление об отказе.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`) — `inv_pending` снова pending.
- Вход выполнен как `sergey_review` / `password`.

### Test Steps
1. Открыть `/reviewer`, найти карточку приглашения «Промисы изнутри».
   **Expected:** Карточка отображается с кнопками «Принять» / «Отклонить» / «Навыки не совпадают».
2. Нажать «Отклонить».
   **Expected:** Карточка сменяется статусом «Отклонено — автор уведомлён»; после обновления «Приглашения» = 0.
3. Проверить секцию «Активные ревью».
   **Expected:** По-прежнему пусто — глава в ревью НЕ появилась.
4. Открыть `/reviewer/review/chp_under_review` напрямую.
   **Expected:** Доступа нет (страница ревью недоступна: ошибка доступа/редирект, треды не отображаются).
5. Выйти, войти как `author` / `password`, открыть уведомления.
   **Expected:** Уведомление об отказе от приглашения по главе «Промисы изнутри».

### Test Data
- Приглашение `inv_pending` (sergey_review → chp_under_review, pending).

### Post-conditions
- `inv_pending` → declined; `chapter_reviewers` без строки sergey_review; `reviewLoad` sergey = 0. **БД мутирована — `npm run test:reset`.**

### Notes
- Ревью текущих участников (`reviewer`, `lena_review`) не затрагивается — статус главы остаётся under-review.

---

## TC-REVIEWER-05: Приглашение — flag «навыки не совпадают» (доступен только при match < 50%)

**Priority:** P1
**Type:** Functional / Negative

### Objective
Проверить жалобу «навыки не совпадают»: кнопка доступна только при match < 50%, flag снимает главу с ревью (ревизия → changes-requested) и уведомляет автора.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход выполнен как `sergey_review` / `password` (match с `chp_under_review` = 0%).

### Test Steps
1. Открыть `/reviewer`, осмотреть карточку приглашения «Промисы изнутри».
   **Expected:** Кнопка «Навыки не совпадают» видна (match 0% < 50%). (Для сравнения: у приглашений с match ≥ 50% кнопка в UI отсутствует.)
2. Нажать «Навыки не совпадают».
   **Expected:** Карточка сменяется статусом «Жалоба отправлена — глава снята с ревью».
3. Выйти, войти как `reviewer` / `password`, открыть `/reviewer`.
   **Expected:** Глава «Промисы изнутри» осталась в «Активные ревью», но статус-бейдж сменился на «Нужны правки» (ревизия → changes-requested; уже принявшие ревьюеры остаются).
4. Выйти, войти как `author` / `password`, открыть уведомления.
   **Expected:** Уведомление «навыки не совпадают» с предложением исправить навыки главы.

### Test Data
- Приглашение `inv_pending`; компетенции sergey (Безопасность, Криптография) vs навыки главы (Промисы, Then/Catch) → 0%.
- Исторический пример flagged в seed: `inv_flagged` (sergey_review → chp_changes).

### Post-conditions
- `inv_pending` → flagged (+flagReason); последняя ревизия `chp_under_review` → changes-requested; прочие pending-приглашения этой ревизии погашены (declined). **БД мутирована — `npm run test:reset`.**

### Notes
- Серверная перепроверка: POST `{action:"flag"}` при match ≥ 50% → 409 «Жалоба … доступна только при совпадении < 50%». В seed нет pending-приглашения с match ≥ 50% — для API-проверки нужна фикстура (приглашение автору `reviewer` через флоу SubmitSheet).
- Кнопка UI — вторична; binding — серверная проверка.

---

## TC-REVIEWER-06: ReviewPage — треды thr_open_1/thr_open_2 видны с диффом и ответами

**Priority:** P1
**Type:** Functional / UI

### Objective
Проверить отображение ReviewPage для назначенного ревьюера: панель тредов, бейджи «правка», дифф suggestion, ответы, панель действий.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход выполнен как `reviewer` / `password`.

### Test Steps
1. Открыть `http://localhost:3001/reviewer/review/chp_under_review`.
   **Expected:** Слева — текст главы «Промисы изнутри» (v1), справа — панель тредов со счётчиками: правок — 1, обсуждений — 1.
2. Осмотреть карточку треда `thr_open_1`.
   **Expected:** Автор треда @reviewer, цитата-якорь «Этот абзац ещё сыроват», текст «Этот абзац стоит переписать — слишком расплывчато.», два ответа: @author «Принято, перепишу к следующей версии.» и @reviewer «Спасибо!».
3. Осмотреть карточку треда `thr_open_2`.
   **Expected:** Автор @lena_review, бейдж «правка», дифф: зачёркнуто «Промис либо разрешается, либо отклоняется — ровно один раз.», зелёным «Промис переходит из pending ровно один раз — в fulfilled или rejected.».
4. Нажать «→ блок» на карточке `thr_open_1`.
   **Expected:** Статья скроллится к блоку `blk_pr_p_2`, блок подсвечивается.
5. Осмотреть нижнюю панель действий.
   **Expected:** «2 открытых · 2 реценз.», плашка «есть запрос правок» (вердикт lena_review = request-changes); кнопки ревьюера «Нужны правки» и «Одобрить».

### Test Data
- `thr_open_1` (блок `blk_pr_p_2`, без suggestion), `thr_open_2` (блок `blk_pr_quote_1`, с suggestion) на `chp_under_review` rev 1.

### Post-conditions
- Данные БД не изменены.

### Notes
- POV серверный: те же треды у автора отображаются с кнопкой «Применить и закрыть» — см. TC-REVIEWER-17 и TC-AUTHOR.

---

## TC-REVIEWER-07: ReviewPage — новый тред на блоке через выделение фрагмента

**Priority:** P1
**Type:** Functional

### Objective
Проверить создание нового треда-обсуждения на блоке через выделение текста в статье.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reviewer`, открыт `/reviewer/review/chp_under_review`.

### Test Steps
1. Выделить мышью фрагмент текста в любом абзаце статьи (слева).
   **Expected:** В композере (низ правой панели) появляется переключатель «Комментарий»/«Правка» и якорь «↳ «<выделенный фрагмент>»»; placeholder «Комментарий к выделенному…».
2. Ввести текст «Здесь не хватает примера с Promise.all.» и нажать «Отправить» (или Ctrl+Enter).
   **Expected:** В панели появляется новая карточка треда: @reviewer, цитата-якорь = выделенный фрагмент, введённый текст; поле ввода очищено.
3. Проверить счётчики.
   **Expected:** «Обсуждений» +1; панель действий показывает «3 открытых».
4. Обновить страницу (F5).
   **Expected:** Новый тред сохранён и отображается (персистентность).

### Test Data
- Глава `chp_under_review`; текст треда: «Здесь не хватает примера с Promise.all.».

### Post-conditions
- В `threads` добавлена строка (status open). **БД мутирована — `npm run test:reset`.**

### Notes
- Кнопка «Отправить» неактивна при пустом тексте или без выделения/активного треда.

---

## TC-REVIEWER-08: ReviewPage — ответ в тред и «Отметить решённым»

**Priority:** P1
**Type:** Functional

### Objective
Проверить ответ (reply) в существующий тред и закрытие треда ревьюером без применения правки.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reviewer`, открыт `/reviewer/review/chp_under_review`.

### Test Steps
1. Кликнуть по карточке треда `thr_open_1`.
   **Expected:** Карточка становится активной (акцентная рамка); в композере якорь «↳ ответ @reviewer», placeholder «Ответить или дополнить…».
2. Ввести «Договорились, жду в следующей версии.» и нажать «Ответить».
   **Expected:** Ответ появляется в карточке треда под существующими (@reviewer, текст ответа).
3. На карточке `thr_open_1` нажать «Отметить решённым».
   **Expected:** Тост «Тред отмечен решённым.»; на карточке бейдж «решено»; кнопки действий треда исчезают.
4. Проверить счётчики.
   **Expected:** Открытых тредов стало на 1 меньше («1 открытых» в панели действий).

### Test Data
- Тред `thr_open_1` (open, от @reviewer, блок `blk_pr_p_2`).

### Post-conditions
- `thread_replies` +1 строка; `threads.thr_open_1.status` → resolved. **БД мутирована — `npm run test:reset`.**

### Notes
- Resolve закрытого треда повторно → 409 «Тред уже закрыт» (идемпотентность).
- Текст блока при «Отметить решённым» НЕ меняется (в отличие от «Применить и закрыть» у автора).

---

## TC-REVIEWER-09: ReviewPage — suggestion: предложение правки (from/to) через режим «Правка»

**Priority:** P1
**Type:** Functional
**Accent:** REV-CHAPTER

### Objective
Проверить создание треда-правки (suggestion) с диффом «было/стало»; убедиться, что применить её ревьюер не может (кнопка применения — только у автора).

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reviewer`, открыт `/reviewer/review/chp_under_review`.

### Test Steps
1. Выделить точный фрагмент текста в абзаце статьи.
   **Expected:** В композере появляется переключатель; нажать «Правка» → появляется блок «Было» с зачёркнутым выделенным фрагментом; placeholder «Как должно стать — замена выделенного…»; рамка композера меняется (success-тон).
2. Ввести исправленный текст и нажать «Предложить».
   **Expected:** Новая карточка треда: @reviewer, бейдж «правка», дифф — зачёркнутый исходный фрагмент и зелёный новый текст; счётчик «правок» +1.
3. Осмотреть кнопки действий на созданном треде (и на `thr_open_2`).
   **Expected:** У ревьюера доступна только «Отметить решённым». Кнопки «Применить и закрыть» НЕТ — она видна только автору.
4. Обновить страницу.
   **Expected:** Тред-правка с диффом сохранён.

### Test Data
- Глава `chp_under_review`; эталонный suggestion в seed — `thr_open_2` (from: «Промис либо разрешается, либо отклоняется — ровно один раз.» → to: «Промис переходит из pending ровно один раз — в fulfilled или rejected.»).

### Post-conditions
- `threads` +1 строка с заполненным `suggestion` (JSON from/to). **БД мутирована — `npm run test:reset`.**

### Notes
- Шаг ревьюера в сквозном сценарии REV-CHAPTER (продолжение — «Применить и закрыть» автором в TC-AUTHOR).
- Применение правки ревьюером через API → 403 — отдельный кейс TC-REVIEWER-17.

---

## TC-REVIEWER-10: Вердикт «Одобрить» на назначенной главе

**Priority:** P0
**Type:** Functional
**Accent:** REV-CHAPTER

### Objective
Проверить постановку вердикта approve назначенным ревьюером и синхронное отражение в инбоксе (гейт публикации «все approve» опирается на эти вердикты).

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reviewer`, открыт `/reviewer/review/chp_under_review` (мой вердикт не поставлен).

### Test Steps
1. Нажать «Одобрить» в нижней панели действий.
   **Expected:** Запрос успешен; кнопка «Одобрить» переходит в активное залитое состояние (вердикт зафиксирован).
2. Проверить панель действий.
   **Expected:** Плашка «есть запрос правок» сохраняется (у lena_review остаётся request-changes) — «все одобрили» НЕ появляется.
3. Открыть `/reviewer` (инбокс).
   **Expected:** У «Промисы изнутри» бейдж «одобрено» вместо «ваш ход»; плитка «Ваш ход» = 0; статус-бейдж главы — «Нужны правки» (статус ревизии пересчитан по всем вердиктам: любой request-changes → changes-requested).
4. (API-проверка из консоли браузера) `fetch("/api/review/chp_under_review/verdict", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({verdict:"approve"})})`.
   **Expected:** 200, тело `{ok:true, verdict:"approve", allApproved:false}` (идемпотентная перезапись своего вердикта).

### Test Data
- Глава `chp_under_review` rev 1; вердикты до теста: reviewer=null, lena_review=request-changes.

### Post-conditions
- `chapter_reviewers.verdict` (reviewer) = approve; статус ревизии — changes-requested. **БД мутирована — `npm run test:reset`.**

### Notes
- Уведомление автору «всё одобрено» не отправляется (не все approve). Полный путь до публикации — сквозной REV-CHAPTER (TC-AUTHOR: публикация только при всех approve).
- Два быстрых POST verdict подряд → 429 на втором (rate-limit действий 1/сек).

---

## TC-REVIEWER-11: Вердикт «Нужны правки» → статус changes-requested и уведомление автору

**Priority:** P0
**Type:** Functional / Integration

### Objective
Проверить вердикт request-changes: статус ревизии меняется, автор уведомляется, статус синхронно виден кросс-экранно.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reviewer`, открыт `/reviewer/review/chp_under_review` (статус «На ревью»).

### Test Steps
1. Нажать «Нужны правки» в нижней панели действий.
   **Expected:** Кнопка переходит в активное состояние (warning-тон); плашка «есть запрос правок» отображается.
2. Открыть `/reviewer` (инбокс).
   **Expected:** У «Промисы изнутри» статус-бейдж «Нужны правки»; бейдж «ваш ход» исчез.
3. Выйти, войти как `author` / `password`, открыть уведомления.
   **Expected:** Уведомление о запрошенных правках по главе «Промисы изнутри» (v1) со ссылкой на review-экран автора.
4. В кабинете автора открыть блог `async-deep-dive`.
   **Expected:** Глава «Промисы изнутри» отображается со статусом «Нужны правки» (кросс-экранный sync).

### Test Data
- Глава `chp_under_review` rev 1 (until: under-review).

### Post-conditions
- Вердикт reviewer = request-changes; статус ревизии → changes-requested; у автора уведомление. **БД мутирована — `npm run test:reset`.**

### Notes
- Вердикт допустим только в статусах under-review/changes-requested; на published-главе → 409 «Глава не на активном ревью».

---

## TC-REVIEWER-12: Чат сессии ревью — отдельно от тредов

**Priority:** P1
**Type:** Functional
**Accent:** REV-SESSION-CHAT

### Objective
Проверить чат сессии (review_chat): история участников видна, отправка работает, сообщения не смешиваются с тредами.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reviewer`, открыт `/reviewer/review/chp_under_review`.

### Test Steps
1. Найти свёрнутую панель «Чат сессии 3» над панелью действий и нажать её.
   **Expected:** Панель разворачивается (aria-expanded=true); история: @reviewer «Начинаю смотреть главу.», @author «Спасибо! Жду замечаний.», @lena_review «Подключилась к ревью.» — участники сессии, включая автора.
2. Ввести в поле «Сообщение команде…» текст «Сегодня досмотрю раздел про then.» и отправить (Ctrl+Enter или кнопка).
   **Expected:** Сообщение появляется в конце чата от @reviewer; счётчик — «Чат сессии 4».
3. Осмотреть панель тредов.
   **Expected:** Новых тредов НЕ появилось — сообщение чата не попало в треды (счётчики тредов не изменились).
4. Выйти, войти как `author`, открыть review-экран главы «Промисы изнутри».
   **Expected:** В чате сессии видно сообщение ревьюера (все участники сессии видят чат).

### Test Data
- Чат seed: `rch_1`–`rch_3` на `chp_under_review` rev 1.

### Post-conditions
- `review_chat` +1 строка. **БД мутирована — `npm run test:reset`.**

### Notes
- Кросс-экранный sync — поллинг 30с + refresh (вебсокетов нет); при проверке шага 4 допустимо обновить страницу.
- Поле ввода чата доступно только при активном статусе ревью.

---

## TC-REVIEWER-13: Публичный профиль ревьюера — «Отрецензировал»

**Priority:** P2
**Type:** Functional / UI

### Objective
Проверить публичный профиль ревьюера: роль, компетенции, агрегатный рейтинг и список отрецензированных опубликованных глав.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Сессия не требуется (профиль публичный) — проверять гостем.

### Test Steps
1. Открыть `http://localhost:3001/u/reviewer`.
   **Expected:** Заголовок «Раиса Ревьюер», подпись «@reviewer · Ревьюер», bio «Рецензирую статьи по фронтенду и архитектуре.».
2. Осмотреть секцию компетенций и рейтинга.
   **Expected:** Агрегат «★ 4.6 · 12 оценок»; чипы компетенций: TypeScript, React, Архитектура, Event Loop.
3. Осмотреть секцию «Отрецензировал».
   **Expected:** В списке — «Цикл событий» (блог «Глубоко в асинхронность JavaScript»); клик ведёт на `/blog/async-deep-dive/event-loop`.
4. Убедиться, что непубличные ревью скрыты.
   **Expected:** Глав «Промисы изнутри» (under-review) и «Async/await на практике» (changes-requested) в списке НЕТ — только published.

### Test Data
- Профиль slug `reviewer`; кредит из `reviewer_history`: chp_published v1+v2.

### Post-conditions
- Данные БД не изменены.

### Notes
- Профиль читателя/админа по /u/[slug] → 404 (кейс TC-READER/TC-ADMIN).
- title страницы: «Раиса Ревьюер | Recenza» (SEO-метаданные).

---

## TC-REVIEWER-14: Приватность оценок — свой рейтинг виден, наружу только агрегат

**Priority:** P0
**Type:** Security / Negative

### Objective
Проверить, что индивидуальные оценки ревьюера (reviewer_ratings, ставит автор) приватны: ревьюер видит свой рейтинг-агрегат, публично доступен только агрегат, поштучные оценки не раскрываются.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- В seed: индивидуальные оценки — reviewer = 5★, max_review = 4★ (за chp_published); агрегат reviewer: 4.6 (12).

### Test Steps
1. Войти как `reviewer`, открыть `/reviewer`.
   **Expected:** Плитка «Ваш рейтинг» = «4.6 (12)» — ревьюер видит свой рейтинг (агрегат).
2. Выйти; гостем открыть `/u/reviewer`.
   **Expected:** Отображается только агрегат «★ 4.6 · 12 оценок». Индивидуальной оценки «5» от автора (за «Цикл событий») нигде на странице нет.
3. Просмотреть исходный HTML страницы `/u/reviewer` (View Source / DevTools).
   **Expected:** В разметке и сериализованных RSC-данных нет поштучных оценок (кто поставил, за какую главу, сколько звёзд) — только агрегатные `reviewerRating`/`reviewerRatingsN`.
4. Войти как `reader`; повторить шаги 2–3.
   **Expected:** То же — только агрегат.

### Test Data
- Оценки seed: (author → reviewer, chp_published, 5★), (author → max_review, chp_published, 4★).

### Post-conditions
- Данные БД не изменены.

### Notes
- Поштучные оценки видят только сам ревьюер-агрегат и админ (`/admin/users/reviewer` — покрывается в TC-ADMIN).
- Эндпоинт `POST /api/author/ratings` доступен только автору-владельцу — попытка ревьюера поставить оценку гасится `requireAuthor` (403).

---

## TC-REVIEWER-15: Негатив — ревьюер НИКОГДА не комментирует публично (403)

**Priority:** P0
**Type:** Security / Negative
**Accent:** COM-GATING

### Objective
Проверить критический инвариант «Гейтинг ролей» (TESTING.md §4): ревьюер не может оставлять публичные комментарии — ни через UI, ни через API.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход выполнен как `reviewer` / `password`.

### Test Steps
1. Открыть ридер `http://localhost:3001/blog/async-deep-dive/event-loop`, промотать к секции комментариев.
   **Expected:** Формы ввода комментария НЕТ; отображается пояснение «Ревьюеры не участвуют в публичных обсуждениях.»; существующие комментарии (`cmt_root` и др.) читаются.
2. Убедиться в отсутствии кнопок «Ответить» у комментариев для ревьюера.
   **Expected:** Ответить на `cmt_root` невозможно (нет элементов ввода).
3. Из консоли браузера (same-origin, чтобы пройти CSRF и проверить именно ролевой гейт) выполнить: `fetch("/api/comments", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({chapterId:"chp_published", text:"попытка ревьюера"})}).then(r=>r.status)`.
   **Expected:** **403**; тело `{error:"Ревьюеры не участвуют в публичных обсуждениях."}`.
4. Обновить страницу.
   **Expected:** Комментарий не появился, счётчик комментариев не изменился.

### Test Data
- Глава `chp_published` (slug `event-loop`); пользователь `reviewer`.

### Post-conditions
- `public_comments` не изменена.

### Notes
- Инвариант матрицы ролей §2: «Комментировать: Ревьюер ❌ 403» — binding, проверяется на сервере (`commentGate`), UI-скрытие вторично.
- Запрос без same-origin (например, curl с чужим Origin) тоже даст 403, но по CSRF — это отдельный кейс, не подменять им ролевой.

---

## TC-REVIEWER-16: Негатив — вердикт на неназначенную главу → 403 (до accept приглашения)

**Priority:** P0
**Type:** Security / Negative

### Objective
Проверить, что приглашённый, но не принявший ревьюер не имеет доступа к ревью: вердикт до accept → 403 (ревью стартует только после согласия).

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`) — `inv_pending` в статусе pending, sergey_review НЕ в `chapter_reviewers`.
- Вход выполнен как `sergey_review` / `password`.

### Test Steps
1. Из консоли браузера выполнить: `fetch("/api/review/chp_under_review/verdict", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({verdict:"approve"})}).then(r=>r.json().then(j=>[r.status,j]))`.
   **Expected:** **403**, тело `{error:"Нет доступа к этому ревью."}` — приглашение (pending) не даёт доступа.
2. Открыть `/reviewer/review/chp_under_review` напрямую.
   **Expected:** Страница ревью недоступна (ошибка доступа/редирект) — треды и чат не видны.
3. В инбоксе `/reviewer` нажать «Принять» на приглашении «Промисы изнутри».
   **Expected:** «✓ Принято — автор уведомлён».
4. Повторить запрос из шага 1.
   **Expected:** **200**, `{ok:true, verdict:"approve", …}` — доступ появился ТОЛЬКО после accept (запись в `chapter_reviewers`).

### Test Data
- `sergey_review` / `password`; глава `chp_under_review`; приглашение `inv_pending`.

### Post-conditions
- После шагов 3–4 БД мутирована (accept + вердикт) — **`npm run test:reset`**.

### Notes
- Покрывает инвариант §4 «403 на чужой контент» и модель согласия Фазы 9 (submit создаёт `review_invitations`, а не `chapter_reviewers`).
- Аналогично гасятся треды/ответы/чат для неназначенного ревьюера (`resolveReviewAccess`).

---

## TC-REVIEWER-17: Негатив — «Применить и закрыть» ревьюеру запрещено (403, только автор)

**Priority:** P0
**Type:** Security / Negative
**Accent:** REV-CHAPTER

### Objective
Проверить, что применение suggestion к тексту блока (apply-and-close) — прерогатива автора: ревьюеру API отвечает 403, кнопка в UI не показывается.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход выполнен как `reviewer` / `password` (назначен на `chp_under_review`).

### Test Steps
1. Открыть `/reviewer/review/chp_under_review`, найти тред `thr_open_2` (бейдж «правка», suggestion от @lena_review).
   **Expected:** На карточке доступна только кнопка «Отметить решённым»; кнопки «Применить и закрыть» НЕТ (она рендерится только для POV автора).
2. Из консоли браузера выполнить: `fetch("/api/review/threads/thr_open_2/apply", {method:"POST"}).then(r=>r.json().then(j=>[r.status,j]))`.
   **Expected:** **403**, тело `{error:"Применять правки может только автор."}`.
3. Обновить страницу и проверить блок `blk_pr_quote_1` и тред.
   **Expected:** Текст блока НЕ изменился (suggestion не применён); `thr_open_2` остался open (бейджа «решено» нет).

### Test Data
- Тред `thr_open_2` с suggestion (from/to) на блоке `blk_pr_quote_1` главы `chp_under_review`.

### Post-conditions
- `threads` и `chapter_revisions.blocks` не изменены.

### Notes
- Позитивная половина (автор нажимает «Применить и закрыть» → блок меняется, тред resolved) — TC-AUTHOR / сквозной REV-CHAPTER.
- Также author-only: «Опубликовать», «Отправить v{N}», «Сменить ведущего» — этих кнопок в панели действий ревьюера нет.

---

## TC-REVIEWER-18: Негатив — у ревьюера нет авторских поверхностей (/author → 307, нет кнопок создания блогов)

**Priority:** P1
**Type:** Security / Negative

### Objective
Проверить ролевые границы страниц: ревьюер не попадает в кабинет автора (307-редирект) и нигде не видит элементов создания блогов/глав.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход выполнен как `reviewer` / `password`.

### Test Steps
1. Перейти по прямому URL `http://localhost:3001/author`.
   **Expected:** Серверный 307-редирект (см. вкладку Network) — итоговый URL `/` (не та роль); кабинет автора не отрисован.
2. Перейти по `http://localhost:3001/author/portfolio`.
   **Expected:** Аналогичный редирект на `/`; портфолио-редактор недоступен.
3. Открыть `/reviewer` и главную `/`; осмотреть шапку и меню аватара («Меню пользователя»).
   **Expected:** Нигде нет кнопок/ссылок «Создать блог», «Новый блог», «Написать главу»; в меню — «Кабинет ревьюера» и «Выйти», пункта «Кабинет автора» нет.
4. Перейти по `http://localhost:3001/admin/dashboard`.
   **Expected:** Редирект прочь (админка недоступна пользовательской сессии).

### Test Data
- Пользователь `reviewer` / `password`.

### Post-conditions
- Данные БД не изменены.

### Notes
- Матрица ролей §2: «Вести блоги/главы: Ревьюер ❌», «Портфолио: Ревьюер ❌» — гейтинг серверный (`requireAuthorPage`/`requireAdminPage` в layout route-групп), UI-скрытие вторично.
- Гостевой вариант (без сессии → 307 на /login) — TC-GUEST.
