# TC-READER — Тест-кейсы роли «Читатель» (handle `reader`)

**Кейсов: 21** (позитивных: 12, негативных: 9)
**Легенда приоритетов:** P0 — security / data-loss / критический инвариант (TESTING.md §4) / основной путь · P1 — основная фича роли сломана без workaround · P2 — частичная деградация с workaround · P3 — косметика.

Окружение: тест-стенд **http://localhost:3001**, БД `blog.test.db`. Перед прогоном — `npm run test:reset`
(детерминированный seed). Никогда не выполнять на `:3000`. Все API-мутации требуют заголовка
`Origin: http://localhost:3001` (CSRF same-origin; из DevTools-консоли браузера он ставится автоматически).

Покрытие: логин/логаут, engagement (голос/закладка/подписка), уведомления, публичные комментарии
(anchor/тред ≤2/окно правки/soft-delete/голоса/спойлер прошлых версий), гейтинг `commentingBlocked`,
негативы матрицы ролей (TESTING.md §2), rate-limit голосов (TESTING.md §4).

---

## TC-READER-01: Логин читателя через UI и редирект на главную

**Priority:** P0
**Type:** Functional (основной путь)

### Objective
Проверить, что читатель входит по никнейму/паролю через форму `/login` и попадает на главную `/` с авторизованной шапкой.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Активной сессии нет (cookie `blog_session` отсутствует / очищены cookies).

### Test Steps
1. Открыть `http://localhost:3001/login`.
   **Expected:** Страница логина с полями «Никнейм» и «Пароль» и кнопкой «Войти».
2. Ввести в поле «Никнейм» значение `reader`, в поле «Пароль» — `password`.
   **Expected:** Поля принимают ввод; пароль маскируется.
3. Нажать кнопку «Войти».
   **Expected:** Редирект на `/` (roleHome читателя). В шапке вместо «Войти» — колокол уведомлений и кнопка-аватар с `aria-label="Меню пользователя"`.
4. Открыть «Меню пользователя».
   **Expected:** В меню отображается `@reader`; пункты «Закладки» и «Выйти»; пункта «Мой профиль» у читателя **нет** (профиль только у автора/ревьюера).

### Test Data
- Пользователь: `reader` / `password` (seed, роль reader).

### Post-conditions
- Cookie `blog_session` установлена (httpOnly, 7 дней); сессия используется в последующих кейсах.

### Notes
- Смежные: TC-READER-02 (неверный пароль), TC-READER-03 (заблокированный), TC-READER-04 (выход).

---

## TC-READER-02: Неверный пароль → ошибка `role="alert"`, входа нет

**Priority:** P1
**Type:** Negative / Functional

### Objective
Проверить, что при неверном пароле форма показывает доступную ошибку и сессия не создаётся.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Сессии нет.

### Test Steps
1. Открыть `/login`, ввести «Никнейм» `reader`, «Пароль» `wrong-password`, нажать «Войти».
   **Expected:** Редиректа нет (остаёмся на `/login`). Под формой появляется текст ошибки «Неверный никнейм или пароль.» в элементе с `role="alert"`.
2. Проверить cookies браузера.
   **Expected:** Cookie `blog_session` с пользовательской сессией не установлена; в шапке по-прежнему «Войти».

### Test Data
- `reader` / `wrong-password`.

### Post-conditions
- Нет; счётчик rate-limit логина инкрементирован (учитывать в TC на 429 — см. Notes).

### Notes
- 5 неудач за 15 минут → 429 и текст «Слишком много попыток. Попробуйте через 15 минут.» — не выполнять этот кейс более 4 раз подряд без сброса (rate-limit по `x-forwarded-for`).

---

## TC-READER-03: Заблокированный пользователь `ghost` не входит (причина не раскрывается)

**Priority:** P0
**Type:** Security / Negative

### Objective
Проверить, что заблокированный пользователь (`isBlocked=true`) не может войти даже с верным паролем и что ответ не раскрывает факт блокировки (anti-enumeration).

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Сессии нет. В seed `ghost` — автор с `isBlocked=true`.

### Test Steps
1. Открыть `/login`, ввести «Никнейм» `ghost`, «Пароль» `password` (верный), нажать «Войти».
   **Expected:** Вход отклонён. Показана **та же** generic-ошибка «Неверный никнейм или пароль.» (`role="alert"`) — без упоминания блокировки.
2. Проверить cookies.
   **Expected:** Пользовательская сессия не создана; шапка гостевая («Войти»).
3. (API) Выполнить `POST /api/auth/user` c телом `{"handle":"ghost","password":"password"}` и заголовком `Origin: http://localhost:3001`.
   **Expected:** Статус ошибки авторизации (401), тело не отличает «нет такого пользователя» от «заблокирован».

### Test Data
- `ghost` / `password` (seed: `isBlocked=true`, владелец скрытого `blog_ghost` / slug `hidden-blog`).

### Post-conditions
- Нет.

### Notes
- Инвариант: блокировка — серверная истина; self-heal гасит и уже живую сессию заблокированного.

---

## TC-READER-04: Выход через «Меню пользователя» → «Выйти»

**Priority:** P1
**Type:** Functional

### Objective
Проверить завершение сессии читателя и возврат гостевой шапки.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Выполнен вход как `reader` / `password` (TC-READER-01).

### Test Steps
1. В шапке нажать кнопку-аватар `aria-label="Меню пользователя"`.
   **Expected:** Открывается меню (`role="menu"`) с `@reader` и пунктом «Выйти».
2. Нажать «Выйти».
   **Expected:** Выполняется `DELETE /api/auth/user`, полный переход на `/`; в шапке снова «Войти», колокол и аватар исчезли.
3. Открыть `/bookmarks`.
   **Expected:** Доступ как гость — страница закладок недоступна как приватная (редирект на `/login` либо гостевое пустое состояние с призывом войти), данных читателя нет.

### Test Data
- Сессия `reader`.

### Post-conditions
- Cookie `blog_session` уничтожена. Для следующих кейсов — повторный вход.

---

## TC-READER-05: Голос за блог — toggle (снять и вернуть голос)

**Priority:** P1
**Type:** Functional

### Objective
Проверить toggle-семантику БЛОГОВОГО голоса ±1 (ui-feedback-5: голоса относятся к блогу, не к главе):
повторный клик по активному значению снимает голос; счётчик и `aria-pressed` синхронны.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader` / `password`.
- Seed-состояние: у `reader` уже стоит голос +1 за `blog_async` (`bv_1`); суммарный счёт блога = 1.

### Test Steps
1. Открыть ридер `http://localhost:3001/blog/async-deep-dive/event-loop` и проскроллить к панели `aria-label="Реакции"` в конце главы.
   **Expected:** Кнопка ▲ (`aria-label="Полезно"`) в активном состоянии (`aria-pressed="true"`, акцентная рамка); счётчик = 1.
2. Нажать ▲ («Полезно»).
   **Expected:** Голос снят: `aria-pressed="false"`, счётчик = 0 (оптимистично, затем подтверждается ответом `POST /api/blogs/blog_async/vote`).
3. Подождать ≥1 секунду (rate-limit действий 1/сек) и снова нажать ▲.
   **Expected:** Голос возвращён: `aria-pressed="true"`, счётчик = 1.
4. Обновить страницу (F5).
   **Expected:** Состояние сохранилось: ▲ активна, счётчик = 1 — в БД ровно одна строка голоса (uniqueIndex user+blog).
5. Открыть режим «Весь блог» (`?mode=whole`).
   **Expected:** Бар «Реакции» ОДИН — наверху под шапкой блога (после каждой главы баров нет); состояние то же (голос блоговый).

### Test Data
- Блог: `blog_async` (slug `async-deep-dive`).

### Post-conditions
- Состояние голосов идентично seed (toggle выполнен чётное число раз).

### Notes
- Смена ▲→▼ (значение −1) — тот же эндпоинт; негатив на скорость кликов — TC-READER-21.

---

## TC-READER-06: Закладка блога — toggle и список `/bookmarks`

**Priority:** P1
**Type:** Functional

### Objective
Проверить добавление/удаление блога из закладок и отражение в списке `/bookmarks`.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader`. Seed: закладка `bm_1` на `blog_async` уже существует.

### Test Steps
1. Открыть `/bookmarks`.
   **Expected:** В списке закладок присутствует блог «async-deep-dive» (карточка блога `blog_async`).
2. Открыть ридер `/blog/async-deep-dive/event-loop`, найти в панели «Реакции» кнопку закладки.
   **Expected:** Кнопка в активном состоянии: `aria-label="Убрать из закладок"`, иконка ★, счётчик = 1.
3. Нажать кнопку закладки.
   **Expected:** `POST /api/bookmarks` → закладка снята: `aria-label="В закладки"`, иконка ☆, счётчик = 0.
4. Открыть `/bookmarks`.
   **Expected:** Список пуст — показано пустое состояние без карточки `blog_async`.
5. Вернуться в ридер, нажать кнопку закладки ещё раз (пауза ≥1 сек от шага 3).
   **Expected:** Закладка возвращена (★, счётчик = 1); в `/bookmarks` блог снова отображается.

### Test Data
- Блог: `blog_async` (slug `async-deep-dive`); закладка seed `bm_1`.

### Post-conditions
- Состояние закладок идентично seed.

---

## TC-READER-07: Подписка на автора и лента «Подписки»

**Priority:** P1
**Type:** Functional

### Objective
Проверить toggle подписки на автора и фильтрацию ленты подписок на главной.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader`. Seed: `reader` уже подписан на `author`.

### Test Steps
1. Открыть `/` — главная читателя «Ваша лента» (ui-feedback-4 П2, табов больше нет).
   **Expected:** В секции «Подписки» видна карточка блога `async-deep-dive` (автор `author`).
2. Открыть ридер `/blog/async-deep-dive/event-loop`; в панели «Реакции» найти кнопку подписки.
   **Expected:** Кнопка в состоянии «Вы подписаны» (`aria-pressed="true"`).
3. Нажать «Вы подписаны».
   **Expected:** `POST /api/follows` → подписка снята, кнопка меняется на «Подписаться на автора».
4. Открыть `/`.
   **Expected:** Секции «Подписки» нет (подписок ноль — пустое состояние «У вас пока нет подписок»); блог виден в «Свежее».
5. Вернуться в ридер и нажать «Подписаться на автора» (пауза ≥1 сек от шага 3).
   **Expected:** Кнопка снова «Вы подписаны»; на главной секция «Подписки» с блогом вернулась.

### Test Data
- Автор: `author` (владелец `blog_async`); подписка seed `usr_reader → usr_author`.

### Post-conditions
- Состояние подписок идентично seed.

### Notes
- Связанный акцент PUB-ARTICLE (новая глава у подписчиков) — проверяется в TC-AUTHOR.

---

## TC-READER-08: Уведомления — просмотр и «Прочитать всё»

**Priority:** P1
**Type:** Functional

### Objective
Проверить колокол уведомлений: бейдж непрочитанных, список, отметку прочитанным и переход по уведомлению.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader`. Seed: у `reader` два уведомления — `ntf_new_chapter` (тип `new_chapter`, **непрочитанное**) и `ntf_read` (тип `comment_reply`, прочитанное).

### Test Steps
1. Посмотреть на колокол в шапке.
   **Expected:** Кнопка с `aria-label="Уведомления: 1 непрочитанных"`, виден бейдж.
2. Нажать колокол.
   **Expected:** Открывается меню `aria-label="Уведомления"`; в списке 2 записи: непрочитанная (о новой главе «Цикл событий», с точкой-маркером) и прочитанная (об ответе на комментарий, приглушённая).
3. Нажать «Прочитать всё».
   **Expected:** `POST /api/notifications/read` → бейдж исчезает, `aria-label` колокола = «Уведомления», маркеры непрочитанности сняты.
4. Кликнуть по уведомлению о новой главе.
   **Expected:** Переход в ридер соответствующей главы (`/blog/async-deep-dive/event-loop`).
5. Обновить страницу.
   **Expected:** Бейдж не вернулся — состояние прочитанности персистентно.

### Test Data
- Уведомления seed: `ntf_new_chapter` (isRead=false), `ntf_read` (isRead=true, payload `commentId: cmt_reply_author`).

### Post-conditions
- Все уведомления `reader` прочитаны (отличие от seed — учесть в зависимых кейсах или пересидить).

---

## TC-READER-09: Root-комментарий с привязкой к фрагменту (anchor)

**Priority:** P1
**Type:** Functional
**Accent:** COM-THREAD

### Objective
Проверить создание top-level комментария с якорем на блок: выделение фрагмента → composer с цитатой → комментарий с рабочей ссылкой «к фрагменту».

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader`. Открыт ридер `/blog/async-deep-dive/event-loop`.

### Test Steps
1. Выделить мышью фрагмент текста внутри абзаца главы.
   **Expected:** Рядом с выделением появляется кнопка `aria-label="Прокомментировать выделенный фрагмент"`.
2. Нажать кнопку.
   **Expected:** Фокус/скролл к composer в секции «Комментарии»; в composer отображается чип с цитатой выделенного фрагмента и кнопкой `aria-label="Убрать привязку к фрагменту"`.
3. Ввести текст «Вопрос по этому фрагменту: почему так?» и нажать «Отправить».
   **Expected:** `POST /api/comments` → 200; новый комментарий появляется в списке с цитатой-якорем, автором `reader` и относительным временем «только что».
4. Кликнуть по цитате нового комментария (`aria-label="Перейти к фрагменту в тексте"`).
   **Expected:** Плавный скролл к исходному блоку (`[data-block-id]`), блок в зоне видимости.
5. Обновить страницу.
   **Expected:** Комментарий сохранён и отображается в списке комментариев текущей ревизии (v2).

### Test Data
- Тело запроса (формируется UI): `blogSlug: async-deep-dive`, `chapterSlug: event-loop`, `anchor: { blockId, quote }`; ревизия штампуется сервером (v2), не клиентом.

### Post-conditions
- В БД добавлен top-level комментарий читателя (глубина 0). Автору блога создано уведомление `comment_new`.

### Notes
- Якорь допускается только у top-level; у ответов игнорируется сервером.

---

## TC-READER-10: Ответ на комментарий (глубина 1) и уведомление адресату

**Priority:** P1
**Type:** Functional
**Accent:** COM-THREAD

### Objective
Проверить создание вложенного ответа (глубина 1) через кнопку «Ответить» и доставку уведомления автору родительского комментария.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader`. Открыт ридер `/blog/async-deep-dive/event-loop`, секция «Комментарии».
- Seed-тред: `cmt_root` (reader, глубина 0) → `cmt_reply_author` (author, глубина 1) → `cmt_reply_reader` (reader, глубина 2).

### Test Steps
1. У комментария `cmt_reply_author` (ответ автора, глубина 1) нажать «Ответить».
   **Expected:** Раскрывается composer ответа с placeholder «Ваш ответ…» и кнопкой «Ответить».
2. Ввести «Спасибо, уточню ещё один момент» и отправить.
   **Expected:** `POST /api/comments` (`parentId: cmt_reply_author`) → 200; ответ появляется во вложенности под родителем (глубина 2).
3. Войти в другой сессии (или после relogin) как `author` / `password` и открыть колокол уведомлений.
   **Expected:** У `author` есть непрочитанное уведомление об ответе на его комментарий (`comment_reply`); клик ведёт к якорю `#comment-<id>` нового ответа.

### Test Data
- Родитель: `cmt_reply_author` (глубина 1 — ответ на него допустим, итоговая глубина 2 = максимум).

### Post-conditions
- Новый комментарий глубины 2 у `cmt_reply_author`; уведомление `comment_reply` для `usr_author`.

### Notes
- Self-reply уведомления не создаёт (recipient == автор ответа пропускается).

---

## TC-READER-11: Ответ на комментарий глубины 2 запрещён (UI-запрет + API 409)

**Priority:** P1
**Type:** Negative / Functional

### Objective
Проверить binding-инвариант вложенности ≤2: на узел глубины 2 ответить нельзя ни через UI, ни напрямую через API.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader`. Открыт ридер `/blog/async-deep-dive/event-loop`.
- Seed: `cmt_reply_reader` — глубина 2 (максимум): `cmt_root` → `cmt_reply_author` → `cmt_reply_reader`.

### Test Steps
1. Найти в треде комментарий `cmt_reply_reader` (глубина 2).
   **Expected:** Кнопки «Ответить» у него **нет** (UI-флаг `canReply=false`).
2. (API, обход UI) Из DevTools-консоли выполнить:
   `fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blogSlug: "async-deep-dive", chapterSlug: "event-loop", parentId: "cmt_reply_reader", text: "слишком глубоко" }) })`.
   **Expected:** Статус **409**, тело `{ "error": "Слишком глубокая вложенность." }`.
3. Обновить страницу.
   **Expected:** Новых комментариев в треде не появилось.

### Test Data
- `parentId: cmt_reply_reader`; глубина считается от 0, ответ разрешён только при глубине родителя ≤1.

### Post-conditions
- БД не изменилась.

### Notes
- Проверка глубины серверная (`src/app/api/comments/route.ts`); UI-флаг вторичен.

---

## TC-READER-12: Правка своего свежего комментария в окне 15 минут

**Priority:** P1
**Type:** Functional
**Accent:** COM-EDIT-WINDOW

### Objective
Проверить, что свой комментарий младше 15 минут редактируется через кнопку «Изменить».

### Preconditions
- Тест-стенд :3001, **seed выполнен непосредственно перед кейсом** (`npm run test:reset`) — ⚠️ `cmt_fresh` создаётся «только что» и протухает через 15 минут; кейс выполнять первым в сессии.
- Вход как `reader`. Открыт ридер `/blog/async-deep-dive/event-loop`, секция «Комментарии».

### Test Steps
1. Найти свой комментарий `cmt_fresh` (автор reader, создан только что).
   **Expected:** У комментария видна кнопка «Изменить» (окно правки активно).
2. Нажать «Изменить», дописать текст « (обновлено)», нажать «Сохранить».
   **Expected:** `PATCH /api/comments/cmt_fresh` → 200; текст обновился, у комментария появилась пометка о редактировании (`editedAt`).
3. Нажать «Изменить» повторно и нажать «Отмена».
   **Expected:** Режим редактирования закрыт, текст не изменился (остался « (обновлено)»).
4. Обновить страницу.
   **Expected:** Отредактированный текст персистентен.

### Test Data
- Комментарий: `cmt_fresh` (authorId `usr_reader`, createdAt ≈ время seed).

### Post-conditions
- `cmt_fresh` изменён относительно seed (при повторных прогонах — `npm run test:reset`).

### Notes
- Пустой текст при сохранении → 400 «Пустой комментарий.».

---

## TC-READER-13: Правка комментария старше 15 минут → 403, кнопки «Изменить» нет

**Priority:** P1
**Type:** Negative / Functional
**Accent:** COM-EDIT-WINDOW

### Objective
Проверить серверное закрытие окна правки: комментарий двухчасовой давности недоступен для редактирования ни в UI, ни через API.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader`. Открыт ридер `/blog/async-deep-dive/event-loop`.
- Seed: `cmt_stale` — комментарий `reader`, создан 2 часа назад.

### Test Steps
1. Найти свой комментарий `cmt_stale`.
   **Expected:** Кнопки «Изменить» **нет** (окно 15 минут истекло); кнопка «Удалить» при этом доступна.
2. (API, обход UI) Из DevTools-консоли выполнить:
   `fetch("/api/comments/cmt_stale", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "поздняя правка" }) })`.
   **Expected:** Статус **403**, тело `{ "error": "Окно редактирования истекло." }`.
3. Обновить страницу.
   **Expected:** Текст `cmt_stale` не изменился.

### Test Data
- Комментарий: `cmt_stale` (createdAt = −2 часа; `EDIT_WINDOW_S` = 15 минут — серверная истина).

### Post-conditions
- БД не изменилась.

---

## TC-READER-14: Удаление своего комментария с живыми потомками → tombstone, ответы сохранены

**Priority:** P0
**Type:** Functional (data-loss guard)

### Objective
Проверить soft-delete: удаление корневого комментария с живыми ответами оставляет tombstone «Комментарий удалён», а ответы (в т.ч. чужие) не пропадают.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader`. Открыт ридер `/blog/async-deep-dive/event-loop`.
- Seed: `cmt_root` (автор reader) имеет живых потомков `cmt_reply_author` (автор author) и `cmt_reply_reader`.

### Test Steps
1. У своего комментария `cmt_root` нажать «Удалить».
   **Expected:** Появляется подтверждение `confirm` «Удалить комментарий?».
2. Подтвердить удаление.
   **Expected:** `DELETE /api/comments/cmt_root` → 200. На месте комментария — tombstone «Комментарий удалён» (текст и имя автора скрыты).
3. Проверить вложенные ответы под tombstone.
   **Expected:** `cmt_reply_author` и `cmt_reply_reader` **на месте**, их текст и авторы читаемы — physical delete с CASCADE не произошёл.
4. Обновить страницу.
   **Expected:** Tombstone и живые ответы персистентны; в спойлер «прошлых версий» тред не переехал.

### Test Data
- Комментарий: `cmt_root` (top-level, текущая ревизия v2).

### Post-conditions
- `cmt_root.deletedAt` установлен; потомки не изменены. Для повторного прогона — `npm run test:reset`.

### Notes
- Повторный DELETE идемпотентен (200 `{ ok: true }`). Удалить чужой (`cmt_reply_author`) нельзя → 403 (ownership).

---

## TC-READER-15: Голос за комментарий — toggle

**Priority:** P2
**Type:** Functional

### Objective
Проверить toggle голоса за комментарий (▲/▼) и персистентность после перезагрузки.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader`. Открыт ридер `/blog/async-deep-dive/event-loop`.
- Seed: у `reader` уже стоит +1 (`cv_1`) на `cmt_reply_author`.

### Test Steps
1. Найти у комментария `cmt_reply_author` блок `aria-label="Оценка комментария"`.
   **Expected:** Кнопка `aria-label="Полезный комментарий"` в активном состоянии (`aria-pressed="true"`).
2. Нажать «Полезный комментарий».
   **Expected:** `POST /api/comments/cmt_reply_author/vote` → голос снят, счётчик уменьшился на 1, `aria-pressed="false"`.
3. Подождать ≥1 сек, нажать `aria-label="Бесполезный комментарий"` (▼).
   **Expected:** Установлен голос −1: ▼ активна, счётчик уменьшился ещё на 1.
4. Подождать ≥1 сек, нажать ▼ повторно, затем через ≥1 сек — ▲.
   **Expected:** ▼ снят, затем возвращён +1 — итоговое состояние как в seed.
5. Обновить страницу.
   **Expected:** Состояние голоса сохранено (ресинк через key-remount, не эффект) — ▲ активна.

### Test Data
- Комментарий: `cmt_reply_author`; голос seed `cv_1` (+1 от reader).

### Post-conditions
- Состояние голосов идентично seed.

---

## TC-READER-16: Спойлер «Комментарии к прошлым версиям» и бейдж «к версии v1»

**Priority:** P2
**Type:** Functional / UI
**Accent:** COM-STALE

### Objective
Проверить, что комментарий к устаревшей ревизии не показывается в основном списке, а живёт в спойлере с бейджем версии.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader` (или гость — чтение доступно всем).
- Seed: `cmt_old_revision` привязан к ревизии v1 главы `chp_published`; текущая ревизия — v2.

### Test Steps
1. Открыть `/blog/async-deep-dive/event-loop`, секцию «Комментарии».
   **Expected:** В основном списке (текущая ревизия v2) комментария `cmt_old_revision` **нет**.
2. Найти под списком свёрнутый `<details>` со summary «Комментарии к прошлым версиям (1)».
   **Expected:** Спойлер присутствует и по умолчанию свёрнут.
3. Раскрыть спойлер.
   **Expected:** Внутри — `cmt_old_revision` с бейджем «к версии v1».

### Test Data
- Комментарий: `cmt_old_revision` (revision = 1); глава `chp_published` (ревизии v1+v2).

### Post-conditions
- Нет (read-only).

---

## TC-READER-17: `commentingBlocked` (troll) → 403 на создание комментария

**Priority:** P0
**Type:** Security / Negative
**Accent:** COM-GATING
**Invariant:** Гейтинг ролей (TESTING.md §4)

### Objective
Проверить, что пользователь с `commentingBlocked=true` не может создать комментарий — серверный гейт, не только UI.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `troll` / `password` (роль reader, `commentingBlocked=true`).

### Test Steps
1. Открыть `/blog/async-deep-dive/event-loop`, секцию «Комментарии»; попытаться отправить комментарий через UI (если composer доступен) с текстом «спам».
   **Expected:** Комментарий не создан; UI показывает ошибку (`role="alert"`) о запрете комментирования.
2. (API, обход UI) Из DevTools-консоли выполнить:
   `fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blogSlug: "async-deep-dive", chapterSlug: "event-loop", text: "спам" }) })`.
   **Expected:** Статус **403** (commentGate: `commentingBlocked` → запрет), комментарий не создан.
3. Обновить страницу под `reader` или гостём.
   **Expected:** Нового комментария в треде нет.

### Test Data
- Пользователь: `troll` / `password` (seed: `commentingBlocked=true`).

### Post-conditions
- БД не изменилась. Выйти из сессии `troll`.

### Notes
- Тот же `commentGate` покрывает «ревьюер никогда не комментирует» (TC-REVIEWER) и «автор — только свой блог» (TC-AUTHOR).

---

## TC-READER-18: Матрица ролей — читатель не создаёт блоги: `POST /api/author/blogs` → 403

**Priority:** P0
**Type:** Security / Negative
**Invariant:** Гейтинг ролей (TESTING.md §4); матрица §2 «Вести блоги/главы — ❌ для читателя»

### Objective
Проверить, что author-API отклоняет читателя серверно (роль из БД, не из cookie/UI).

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader` (валидная сессия в браузере).

### Test Steps
1. Из DevTools-консоли (same-origin, cookie сессии подставляются автоматически) выполнить:
   `fetch("/api/author/blogs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Блог читателя", description: "не должно создаться" }) })`.
   **Expected:** Статус **403** (`requireAuthor` → forbidden для роли reader); JSON с полем `error`.
2. Там же выполнить попытку отправки главы на ревью:
   `fetch("/api/author/chapters/chp_draft/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })`.
   **Expected:** Статус **403** — submit-роут недоступен читателю (матрица §2 «Отправлять на ревью — ❌»); приглашения не созданы.
3. Открыть `/?view=all` (каталог «Все блоги», ui-feedback-4 П2).
   **Expected:** Нового блога в каталоге нет; в БД блог не создан; глава `generators` осталась черновиком.

### Test Data
- Сессия `reader`; произвольное валидное тело создания блога.

### Post-conditions
- БД не изменилась.

### Notes
- Без заголовка `Origin` запрос упал бы раньше с 403 CSRF — для чистоты проверки роли выполнять из браузера (Origin same-origin).

---

## TC-READER-19: Protected-страницы чужих ролей для читателя → 307 редирект

**Priority:** P0
**Type:** Security / Negative
**Invariant:** Редирект-гейтинг protected-сегментов (TESTING.md §4)

### Objective
Проверить, что залогиненный читатель не видит порталы автора/ревьюера/админа — серверный redirect, не клиентская заглушка.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader`.

### Test Steps
1. Перейти на `http://localhost:3001/author`.
   **Expected:** Серверный редирект (307) на `/` — кабинет автора не отрисован (роль ≠ author → `/`); содержимое кабинета не мелькает.
2. Перейти на `http://localhost:3001/reviewer`.
   **Expected:** Редирект (307) на `/` — инбокс ревьюера недоступен.
3. Перейти на `http://localhost:3001/admin`.
   **Expected:** Редирект (307) на `/` — залогиненный не-админ отправляется на главную (гость без сессии отправлялся бы на `/admin/login`).
4. Перейти на `http://localhost:3001/author/portfolio`.
   **Expected:** Редирект (307) — вложенный авторский сегмент закрыт наравне с корнем `/author` (матрица §2 «Портфолио — ❌ для читателя»).
5. (Контроль без сессии) Выйти («Меню пользователя» → «Выйти») и открыть `/author`.
   **Expected:** Редирект на `/login` (гость).

### Test Data
- Сессия `reader`; URL: `/author`, `/reviewer`, `/admin`, `/author/portfolio`.

### Post-conditions
- Нет.

### Notes
- Статус 307 проверяется по network-запросу документа (Playwright: `response.status()` до follow-redirect).

---

## TC-READER-20: Матрица ролей — читатель не рецензирует: verdict-роут → 403

**Priority:** P0
**Type:** Security / Negative
**Invariant:** Гейтинг ролей (TESTING.md §4); матрица §2 «Рецензировать — ❌ для читателя»

### Objective
Проверить, что review-API (вердикт) отклоняет читателя: вердикты доступны только назначенным ревьюерам.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader`.
- Seed: `chp_under_review` — глава в статусе under-review (primary — `reviewer`).

### Test Steps
1. Из DevTools-консоли выполнить:
   `fetch("/api/review/chp_under_review/verdict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verdict: "approve" }) })`.
   **Expected:** Статус **403** — читатель не ревьюер (`requireReviewer`/`resolveReviewAccess`); вердикт не записан.
2. (Смежная поверхность) Выполнить `GET /reviewer/review/chp_under_review` навигацией браузера.
   **Expected:** Редирект на `/` (страница ревью недоступна читателю).

### Test Data
- Глава: `chp_under_review` (slug `promises`); тело `{ "verdict": "approve" }`.

### Post-conditions
- Вердикты/статус ревью главы не изменились.

### Notes
- Аналогичные негативы для назначений/чужих ревьюеров — в TC-REVIEWER.

---

## TC-READER-21: Rate-limit действий — 2 быстрых голоса подряд → 429

**Priority:** P0
**Type:** Security / Negative
**Invariant:** Rate-limit голосов 1/сек (TESTING.md §4)

### Objective
Проверить серверный rate-limit действий: второй POST голоса в пределах секунды отклоняется с 429 и `Retry-After`.

### Preconditions
- Тест-стенд :3001, seed выполнен (`npm run test:reset`).
- Вход как `reader`. Не выполнять других действий за секунду до кейса (общий счётчик `vote:<userId>`).

### Test Steps
1. Из DevTools-консоли выполнить два запроса без паузы:
   `const r1 = await fetch("/api/chapters/chp_published/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: 1 }) }); const r2 = await fetch("/api/chapters/chp_published/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: 1 }) }); [r1.status, r2.status]`.
   **Expected:** Первый запрос — **200**; второй — **429** с заголовком `Retry-After` и телом `{ "error": "Слишком часто. Подождите секунду." }`.
2. Подождать ≥1 секунду и повторить одиночный POST `{ value: 1 }`.
   **Expected:** Статус 200 — лимит скользящий, действие снова доступно.
3. Проверить состояние голоса в UI (обновить ридер `/blog/async-deep-dive/event-loop`).
   **Expected:** Состояние консистентно: применились только успешные (200) toggle-запросы, счётчик соответствует их чётности; дублей голоса нет (uniqueIndex).

### Test Data
- Глава: `chp_published`; тело `{ "value": 1 }`.

### Post-conditions
- После шага 2 выполнено нечётное число успешных toggle → вернуть состояние seed ещё одним POST `{ value: 1 }` (пауза ≥1 сек) или `npm run test:reset`.

### Notes
- UI сам по себе душит клики (`busy`-флаг) — лимит проверяется только на уровне API. Rate-limit логина (5/15 мин → 429) — отдельный кейс в TC-GUEST/SMOKE.
