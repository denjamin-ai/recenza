# REGRESSION-SUITE — Полный регресс Recenza (Фаза 11.1)

**Состав: все P0 (51) + все P1 (51) обязательны; P2 (14) — выборочно, по времени.** P3-кейсов в
трассировке нет. Источник соответствий «кейс ↔ spec ↔ приоритет» — traceability-матрица
`testing/TEST-PLAN.md` §9.

**Легенда приоритетов:** P0 — security/data-loss/критический инвариант/основной путь публикации ·
P1 — основная фича роли сломана без workaround · P2 — частичная деградация с workaround · P3 — косметика.

**Когда гоняется:** полный регресс — перед релизом/деплоем и ночью в CI (`npm run test:e2e`);
smoke-подмножество — на каждый PR (`npm run test:smoke`). Ручной прогон — по TC-докам в порядке блоков ниже.

## Предусловия

- Тест-стенд **:3001** (`npm run dev:test`), БД `blog.test.db`. **Никогда не :3000.**
- Свежий `npm run test:reset` перед стартом и в отмеченных точках ↻ (сброс мутаций предыдущего блока).
- Rate-limit живёт в памяти процесса и НЕ сбрасывается reseed'ом → security-кейсы с 429 гоняются
  **последними** (Блок C), логин-негативы — с уникальным `X-Forwarded-For`.
- Recency-кейсы (окно правки 15 мин) — сразу после ↻, не позднее.

## Порядок исполнения

**Правило:** сначала read-only, затем мутирующие ролевые, затем security (429 — в самом конце
блока), затем сквозные флоу (каждое семейство — от чистого seed). Провал любого P0 → стоп, вердикт
NO-GO, баг-репорт по `testing/BUG-REPORT-TEMPLATE.md`.

### Блок 0 — Smoke-гейт (~15 мин) ↻ после

Прогон `testing/smoke/SMOKE-SUITE.md` (SMK-01…15) целиком. Провал любого smoke = стоп регрессу.

### Блок A — Read-only (гость + чтение под ролями), ~45 мин

| ID | P | Кейс |
|----|---|------|
| TC-GUEST-01 | P1 | Лента и каталог гостю, карусель баннеров |
| TC-GUEST-02 | P0 | Data-driven рендер блога/главы, title/OG (регресс-ловушка article) |
| TC-GUEST-03 | P1 | Чипы ревьюеров + «Прошлые версии» за раскрытием |
| TC-GUEST-04 | P0 | GET /author без сессии → 307 |
| TC-GUEST-05 | P0 | GET /reviewer без сессии → 307 |
| TC-GUEST-06 | P0 | GET /admin/dashboard без сессии → 307 |
| TC-GUEST-09 | P1 | Комментарии read-only: дерево ≤2, tombstone, спойлер |
| TC-GUEST-11 | P0 | Скрытый блог: нет в выдаче, прямой URL → 404 |
| TC-GUEST-13 | P2 | /feed.xml, /sitemap.xml, /robots.txt не светят скрытое |
| TC-GUEST-14 | P2 | Публичный профиль /u/author |
| TC-AUTHOR-23 | P1 | Чужие блоги отфильтрованы из ленты автора |
| TC-REVIEWER-13 | P2 | Публичный профиль ревьюера «Отрецензировал» |
| TC-REVIEWER-14 | P0 | Приватность оценок: наружу только агрегат |
| TC-ADMIN-03 | P1 | Полноэкранный портал, навигация, дашборд |

### Блок B — Мутирующие ролевые, ~2 ч ↻ перед стартом

**B1 Читатель** (recency-кейсы TC-READER-12 — первыми после ↻):

| ID | P | Кейс |
|----|---|------|
| TC-READER-12 | P1 | Правка свежего комментария в окне 15 мин |
| TC-READER-01 | P0 | Логин через UI → главная |
| TC-READER-02 | P1 | Неверный пароль → role=alert (уникальный XFF) |
| TC-READER-03 | P0 | Заблокированный ghost не входит |
| TC-READER-04 | P1 | Logout через меню |
| TC-READER-05 | P1 | Голос за главу — toggle |
| TC-READER-06 | P1 | Закладка — toggle + /bookmarks |
| TC-READER-07 | P1 | Подписка + лента «Подписки» |
| TC-READER-08 | P1 | Уведомления + «Прочитать всё» |
| TC-READER-09 | P1 | Root-комментарий с anchor |
| TC-READER-10 | P1 | Ответ (глубина 1) + уведомление |
| TC-READER-11 | P1 | Ответ на глубину 2 → 409 |
| TC-READER-13 | P1 | Правка старше 15 мин → 403 |
| TC-READER-14 | P0 | Tombstone при живых потомках |
| TC-READER-15 | P2 | Голос за комментарий — toggle |
| TC-READER-16 | P2 | Спойлер «к версии v1» |
| TC-READER-17 | P0 | commentingBlocked (troll) → 403 |
| TC-READER-18 | P0 | POST /api/author/blogs → 403 |
| TC-READER-19 | P0 | Protected-страницы чужих ролей → 307 |
| TC-READER-20 | P0 | Verdict-роут читателю → 403 |
| TC-GUEST-07 | P0 | Intent-replay голоса после логина |
| TC-GUEST-08 | P1 | Intent-replay закладки/подписки |
| TC-GUEST-10 | P1 | Гость: комментарий → /login, API отклоняет |
| TC-GUEST-12 | P1 | Гостевая заявка с /board |

**B2 Автор** ↻ перед стартом:

| ID | P | Кейс |
|----|---|------|
| TC-AUTHOR-01 | P1 | Кабинет: блоги + агрегаты статусов |
| TC-AUTHOR-02 | P1 | Деталь блога: статусы + фильтры |
| TC-AUTHOR-03 | P1 | Создание блога (create-then-edit) |
| TC-AUTHOR-04 | P1 | Создание главы |
| TC-AUTHOR-05 | P1 | Слэш-меню + сохранение |
| TC-AUTHOR-06 | P2 | Markdown-шорткаты |
| TC-AUTHOR-07 | P2 | ChapterSettingsPopover |
| TC-AUTHOR-08 | P0 | Skills обязательны для submit |
| TC-AUTHOR-09 | P0 | Submit создаёт pending-приглашения, не активных ревьюеров |
| TC-AUTHOR-10 | P0 | Редактирование under-review → 409 |
| TC-AUTHOR-11 | P0 | Редактирование published → 409 |
| TC-AUTHOR-12 | P2 | Reorder глав |
| TC-AUTHOR-13 | P2 | Pin блога |
| TC-AUTHOR-14 | P1 | Портфолио минуя ревью |
| TC-AUTHOR-15 | P2 | Портфолио show/hide + пустое состояние |
| TC-AUTHOR-16 | P0 | Публикация только при всех approve — *smoke-only: выполняется в Блоке 0 (SMK-11), здесь не повторяется* |
| TC-AUTHOR-17 | P1 | Оценка ревьюеров 1–5★, приватно |
| TC-AUTHOR-18 | P1 | Recruit-запрос админу |
| TC-AUTHOR-19 | P2 | Статусы recruit-запросов |
| TC-AUTHOR-20 | P1 | Автор комментирует свой блог |
| TC-AUTHOR-21 | P0 | PATCH чужой главы → 403/404 |
| TC-AUTHOR-22 | P0 | Комментарий в чужом блоге → 403 |
| TC-AUTHOR-24 | P0 | Reviewer-API автору → 403 |
| TC-AUTHOR-25 | P1 | /admin и /reviewer автору → 307 |

**B3 Ревьюер** ↻ перед стартом:

| ID | P | Кейс |
|----|---|------|
| TC-REVIEWER-01 | P0 | Логин → /reviewer |
| TC-REVIEWER-02 | P1 | Инбокс: главы + счётчики |
| TC-REVIEWER-03 | P0 | Accept приглашения стартует ревью |
| TC-REVIEWER-04 | P1 | Decline: назначение не создано, автор уведомлён |
| TC-REVIEWER-05 | P1 | Flag «навыки не совпадают» только при match < 50% |
| TC-REVIEWER-06 | P1 | Треды thr_open_1/2 с диффом |
| TC-REVIEWER-07 | P1 | Новый тред через выделение |
| TC-REVIEWER-08 | P1 | Ответ + resolve |
| TC-REVIEWER-09 | P1 | Suggestion (from/to) |
| TC-REVIEWER-10 | P0 | Вердикт «Одобрить» |
| TC-REVIEWER-11 | P0 | «Нужны правки» → changes-requested |
| TC-REVIEWER-12 | P1 | Чат сессии отдельно от тредов |
| TC-REVIEWER-15 | P0 | Ревьюер не комментирует → 403 |
| TC-REVIEWER-16 | P0 | Вердикт без назначения → 403 |
| TC-REVIEWER-17 | P0 | Apply-and-close ревьюеру → 403 |
| TC-REVIEWER-18 | P1 | Нет авторских поверхностей → 307 |

**B4 Админ** ↻ перед стартом:

| ID | P | Кейс |
|----|---|------|
| TC-ADMIN-01 | P0 | Вход /admin/login + выход |
| TC-ADMIN-04 | P1 | Users: список, поиск, карточка |
| TC-ADMIN-05 | P0 | Тумблер комментирования troll |
| TC-ADMIN-06 | P0 | Soft-бан/разбан ghost |
| TC-ADMIN-07 | P0 | Hard-delete с ревью-историей невозможен |
| TC-ADMIN-08 | P1 | Разбор жалобы rpt_1 |
| TC-ADMIN-09 | P0 | Force-approve в обход «все approve» |
| TC-ADMIN-10 | P1 | Смена ведущего (pcr_1) |
| TC-ADMIN-11 | P1 | Снятие ревьюера: reviewLoad −1 |
| TC-ADMIN-12 | P1 | Recruit approve → на доску |
| TC-ADMIN-13 | P2 | Recruit reject: причина обязательна |
| TC-ADMIN-14 | P0 | Заявка accept: выдача роли reviewer + компетенции |
| TC-ADMIN-15 | P2 | Заявка reject |
| TC-ADMIN-16 | P1 | Баннеры CRUD ↔ карусель |
| TC-ADMIN-18 | P1 | Donation-методы + тумблер ↔ модалка «Поддержать» |
| TC-ADMIN-19 | P2 | Board-calls: создание/«срочно»/удаление |
| TC-ADMIN-20 | P0 | Админ не создаёт блоги: POST /api/author/** отклоняется |
| TC-ADMIN-21 | P0 | /admin/* без прав → 307 |
| TC-ADMIN-22 | P0 | /api/admin/* не-админом → 401/403 |

### Блок C — Security, ~20 мин (rate-limit — в самом конце)

| ID | P | Кейс |
|----|---|------|
| SEC-CSRF-01 | P0 | Мутация с чужим/без Origin → 403 (инвариант; см. SMK-14) |
| SEC-XSS-01 | P0 | `<script>`/`onerror` в блоках санитизированы (инвариант; см. SMK-15) |
| SEC-HTTPONLY-01 | P0 | `blog_session` недоступна из document.cookie |
| SEC-TS-01 | P1 | Timestamps в API — Unix seconds, не ms |
| TC-ADMIN-17 | P1 | Валидация target баннера: javascript:/кривой URL → 400 |
| TC-READER-21 | P0 | Rate-limit действий: 2-й быстрый голос → 429 |
| TC-ADMIN-02 | P0 | Rate-limit логина: 6-я неудача → 429 (уникальный XFF) |

### Блок D — Сквозные флоу (@critical), ~1.5 ч; ↻ перед КАЖДЫМ семейством

| Семейство ↻ | Кейсы (все в `testing/test-cases/TC-FLOWS.md`) |
|-------------|--------------------------------------------------|
| review-chapter | REV-CHAPTER (P0), REV-PRIMARY (P0) |
| publish | PUB-DRAFT (P0), PUB-CHAPTER-V2 (P0), PUB-ARTICLE (P0), PUB-PORTFOLIO (P0), REV-VERSIONS (P0) |
| comment-thread | COM-THREAD (P1), COM-STALE (P1), COM-EDIT-WINDOW (P1), COM-GATING (P0) |
| session-chat | REV-SESSION-CHAT (P0) |
| review-whole-blog | REV-WHOLE-BLOG (P0) |
| reviewer-matching | MATCH-INVITE (P0), MATCH-RECRUIT (P1), MATCH-BOARD (P1) |

## Длительность

- **Ручной полный прогон:** ~5–6 ч (Блоки 0+A+B+C+D с ресидами).
- **Автоматизированный (`npm run test:e2e`, Фаза 11.3):** ~35–50 мин (workers:1, sequential).
- **Smoke (`npm run test:smoke`):** ~15 мин.

## Вердикт (TESTING.md §7, выносит сабагент `playwright-tester`)

| Вердикт | Условие |
|---------|---------|
| ✅ GO | все P0 прошли; ≥90% P1 прошли; нет открытых критических багов |
| ❌ NO-GO | любой P0 провален; security-уязвимость; data loss |
| ⚠️ CONDITIONAL | P1-провалы с задокументированным workaround; P0 чисты |

Каждый провал — баг-репорт по `testing/BUG-REPORT-TEMPLATE.md` со ссылкой на TC-ID и evidence
(screenshot/trace из `testing/reports/`).
