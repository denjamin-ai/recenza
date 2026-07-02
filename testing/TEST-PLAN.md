# TEST-PLAN — Главный тест-план Recenza (Фаза 11.1)

Тест-план платформы **Recenza** — Next.js 16 монолит: многоглавный девблог с редакционным
review-flow и 4 ролями (гость/читатель/автор/ревьюер/админ; гость — пятое неавторизованное
состояние). Покрывает функционал фаз 4–10 на тест-стенде.

**Кейсов в трассировке: 116** (P0 — 51 · P1 — 51 · P2 — 14 · P3 — 0; негативных — 42;
smoke — 16 TC-кейсов в 13 SMK-шагах + 2 инварианта (SMK-14/15), всего 15 SMK — состав канонизирован
в `testing/smoke/SMOKE-SUITE.md`; остальные — regression; сквозных FLOWS — 16, все `@critical`)

**Легенда приоритетов:** P0 — security/data-loss/критический инвариант/основной путь публикации · P1 — основная фича роли сломана без workaround · P2 — частичная деградация с workaround · P3 — косметика.

---

## 1. Executive Summary

- **Что тестируем:** монолит Recenza после фаз 4–10 миграции — auth/роли/гейтинг, читательский
  слой (лента/ридер/engagement/уведомления/SEO), авторский слой (кабинет/редактор Variant B/портфолио),
  редакционный review-flow (ReviewPage: треды/вердикты/apply-and-close/чат/публикация), публичные
  комментарии (тред ≤2/якоря/окно правки/голоса), подбор ревьюеров (матчинг/приглашения/оценка/recruit),
  админку/модерацию/монетизацию (баннеры/пожертвования/доска).
- **Цели:** (1) подтвердить критические инварианты TESTING.md §4 (гейтинг ролей, редиректы,
  rate-limit, XSS, 403 на чужой контент); (2) закрыть матрицу ролей §2 — каждая ❌ отдельным
  негативным кейсом; (3) прогнать все акцентные сквозные сценарии §3 (REV-*/PUB-*/COM-*/MATCH-*);
  (4) дать вход для TS-автотестов Фазы 11.2–11.3 (traceability-матрица → spec-файлы).
- **Ключевые риски:** протухающие recency-сущности seed (`cmt_fresh`), in-memory rate-limit,
  поллинг 30с в ReviewScreen, first-compile задержки dev-режима — см. §7.
- **Этапность (Фаза 11):** 11.1 — тест-документация (этот план + TC-доки) → 11.2 — исследование
  флоу через Playwright MCP, фиксация локаторов → 11.3 — TS-спеки `@playwright/test` +
  `playwright.config.ts` → CI (smoke на PR, полный регресс ночью). Вердикт GO/NO-GO —
  сабагент `playwright-tester` (TESTING.md §7).

---

## 2. Scope

### In Scope

- **Весь функционал фаз 4–10 на тест-стенде :3001:**
  - Auth и роли: логин/логаут пользователей и админа, блокировки, session-cookie, гейтинг
    protected-сегментов (`/author`, `/reviewer`, `/admin/*`), intent-replay гостя.
  - Читательский слой: лента/каталог/подписки, ридер (data-driven `BlogReaderScreen`,
    регресс-ловушка article), голоса/закладки/подписки (toggle), уведомления, SEO
    (`/feed.xml`, `/sitemap.xml`, `/robots.txt`, title/OG).
  - Авторский слой: кабинет, деталь блога, редактор Variant B (слэш-меню, markdown-шорткаты,
    `ChapterSettingsPopover`, `SubmitSheet`), портфолио, оценка ревьюеров, recruit-запросы.
  - Review-flow: приглашения (accept/decline/flag), треды/suggestion/«Применить и закрыть»,
    вердикты «Одобрить»/«Нужны правки», чат сессии, смена ведущего, «Отправить v{N}»,
    гейт публикации «все approve», force-approve админом, кредит по версиям.
  - Публичные комментарии: дерево ≤2, якоря-фрагменты, окно правки 15 мин, soft-delete/tombstone,
    спойлер «прошлые версии», голоса, гейтинг (`commentGate`).
  - Админка: полноэкранный портал, пользователи/баны/тумблер комментирования, жалобы,
    review-очередь, recruit/заявки/доска, баннеры, пожертвования.
  - Монетизация/промо: карусель баннеров, DonateModal, публичная доска `/board` + заявки.
- **Типы тестирования:** Functional, Security (гейтинг/CSRF/rate-limit/XSS/httpOnly),
  Regression (регресс-ловушки + smoke-набор).
- **Сценарии:** матрица ролей (позитив + каждый негатив), акцентные сквозные флоу
  TESTING.md §3, границы (глубина 2, окно 15 мин, match 50%, rate-limit 5/15мин и 1/сек).

### Out of Scope

- **A11y/perf/визуальные UI-инварианты** (dark/light без hardcoded-цветов, mobile-nav 375px,
  skip-to-content, focus-visible, reduced-motion, staggered animation) — **Фаза 12**.
- **Реальная загрузка изображений** (эндпоинта upload нет; валидируется только префикс
  `/uploads/`), **рендер Mermaid/KaTeX** — **Фаза 12**.
- **Прод-окружение** (Vercel + Turso), нагрузочное тестирование, кросс-браузерность
  (базовый прогон — Chromium).

---

## 3. Test Strategy

**Двухуровневая стратегия (оба уровня обязательны, TESTING.md):**

1. **Playwright MCP** (`mcp__playwright__*`) — живое исследование флоу в браузере на :3001:
   snapshot → ref-локаторы, fill_form/click, evaluate, console/network. Результат — стабильные
   локаторы (роль/текст/`data-testid`), реальные тайминги, граничные случаи. Сложные экраны
   (ReviewPage: bauble↔thread sync, apply-and-close, presence) сначала проходятся руками через MCP.
2. **TS-автотесты `@playwright/test`** — закоммиченные спеки `testing/e2e/**` (POM + ролевые
   фикстуры `asReader/asAuthor/asReviewer/asAdmin` поверх auth-state из `global-setup`),
   гоняются в CI. Multi-user флоу (REV-SESSION-CHAT, COM-THREAD) — несколько `browserContext`
   в одном тесте. Console-error monitoring, критические спеки — `--repeat-each=5`.

**Типы тестов:**

| Тип | Фокус | Примеры |
|-----|-------|---------|
| Functional | Бизнес-логика ролей и флоу | Логин, вердикты, публикация, комментарии |
| Security | Гейтинг/CSRF/rate-limit/XSS/httpOnly | 403 ревьюеру на POST /api/comments, 429 на 6-й логин |
| Regression | Регресс-ловушки и smoke-набор | Data-driven рендер article, title/OG по контенту |

**Подходы:**

- **Позитив + негатив:** каждая ❌ матрицы ролей (TESTING.md §2) — отдельный негативный кейс
  (403 / 307-редирект / скрытие из выдачи). Негативы проверяются **на сервере** (API-статус),
  UI-запрет — вторичная проверка.
- **Границы (boundary):** глубина комментария 2 (ответ на глубину 2 → 409), окно правки 15 мин
  (внутри — 200, снаружи — 403), flag «навыки не совпадают» только при match < 50%,
  rate-limit логина 5 неудач/15 мин (6-я → 429) и действий 1/сек (2-й голос → 429),
  редактирование under-review/published → 409.
- **Кросс-экранный sync:** статусы главы/вердикты проверяются одновременно в инбоксе ревьюера,
  кабинете автора и ридере (поллинг 30с — см. риски §7).
- **Теги:** `@smoke` (15 SMK-шагов, каждый прогон), `@critical` (FLOWS + P0), `@regression`
  (полный набор). Фильтр `--grep` (`npm run test:smoke` / `test:critical`).

---

## 4. Test Environment

| Параметр | Значение |
|----------|----------|
| Стенд | **только `http://localhost:3001`** (`npm run dev:test`) |
| БД | `blog.test.db` (libsql file), env — `.env.test` через `dotenv -e .env.test --` |
| Seed | детерминированный, через **`npm run test:reset`** (`db:migrate:test` + `seed:test`) — БД пересоздаётся с нуля |
| Параллелизм | `workers: 1`, `fullyParallel: false` — единый общий стенд, спеки строго sequential |
| Админ-доступ | `POST /api/auth` паролем из `ADMIN_PASSWORD_PLAIN` (`.env.test`), страница `/admin/login`; админ не в seed |
| Пользователи seed | `reader`, `author`, `reviewer`, `lena_review`, `max_review`, `sergey_review`, `troll` (commentingBlocked), `ghost` (isBlocked) — пароль у всех `password` |
| Браузер | Chromium (Playwright); MCP-исследование — тот же стенд |

> ⚠️ **НИКОГДА не :3000** — dev-стенд `.env.local` указывает на **Turso с прод-данными**;
> `npm run seed` / миграции / любые мутации на :3000 портят прод. Всё тестирование — только
> :3001 / `blog.test.db`.

**Предусловие каждого кейса:** тест-стенд :3001, seed выполнен (`npm run test:reset`), стенд
запущен (`npm run dev:test`). Recency-чувствительные кейсы (`cmt_fresh`) — сразу после reseed (§7).

---

## 5. Entry / Exit Criteria

### Entry Criteria

- [ ] `npm run build` зелёный (необходимое условие, TESTING.md §7).
- [ ] `npm run test:reset` отработал без ошибок; `blog.test.db` пересоздана.
- [ ] Стенд `npm run dev:test` отвечает на `http://localhost:3001/` (200).
- [ ] `.env.test` заполнен: `SESSION_SECRET`, `ADMIN_PASSWORD_HASH` (двойное экранирование `\\$`),
      `ADMIN_PASSWORD_PLAIN`, `DB_FILE_NAME=blog.test.db`.
- [ ] Тест-документация готова: TC-GUEST/READER/AUTHOR/REVIEWER/ADMIN/FLOWS + этот план.
- [ ] Для уровня 2: `playwright.config.ts` + `testing/e2e/**` созданы (Фаза 11.3).

### Exit Criteria

- [ ] Все **P0** кейсы выполнены и прошли (любой проваленный P0 = NO-GO).
- [ ] ≥ **90% P1** прошли; провалы P1 — только с задокументированным workaround.
- [ ] Все критические инварианты §8 подтверждены в smoke.
- [ ] Нет открытых критических багов (security-уязвимость / data loss = NO-GO).
- [ ] Smoke-набор (15 SMK-шагов) зелёный на свежем `test:reset`.
- [ ] Вердикт `playwright-tester`: ✅ GO (или ⚠️ CONDITIONAL с планом фиксов; P0 чисты).

---

## 6. Test Deliverables

| Артефакт | Путь | Статус |
|----------|------|--------|
| Главный тест-план | `testing/TEST-PLAN.md` | этот документ |
| Тест-кейсы по ролям | `testing/test-cases/TC-{GUEST,READER,AUTHOR,REVIEWER,ADMIN}.md` | готовы |
| Сквозные флоу | `testing/test-cases/TC-FLOWS.md` | готовы |
| Smoke-набор | `testing/smoke/SMOKE-SUITE.md` (16 кейсов, ~15 мин) | Фаза 11.1 |
| Регресс-набор | `testing/regression/REGRESSION-SUITE.md` | Фаза 11.1 |
| TS-спеки + конфиг | `testing/e2e/**`, `playwright.config.ts` | Фаза 11.3 |
| Отчёты прогонов | `testing/reports/playwright-html/` | по прогонам |
| Баг-репорты | по шаблону `qa-test-planner` (BUG-ID, severity, шаги, evidence) | по факту |

---

## 7. Risk Assessment

| Риск | Вероятность | Влияние | Митигация |
|------|:-----------:|:-------:|-----------|
| **Протухание recency-сущностей seed**: `cmt_fresh` создан «только что» — окно правки 15 мин истекает через ~15 мин после `test:reset`; кейсы TC-READER-12 / COM-EDIT-WINDOW начинают ложно падать (403 вместо 200) | H | M | Recency-кейсы гонять **первыми после reseed**; в автотестах — `test:reset` перед spec-семейством комментариев; при ручном прогоне дольше 15 мин — повторный reseed; в спеке ассертить возраст `cmt_fresh` перед правкой |
| **In-memory rate-limit не сбрасывается reseed'ом**: счётчики (`src/lib/rate-limit.ts`) живут в памяти процесса `next dev`, `test:reset` их не трогает — 429 «протекает» в соседние кейсы | H | M | Rate-limit кейсы (TC-ADMIN-02, TC-READER-21) гонять **последними** в `security.spec.ts`; изоляция логина — уникальные `X-Forwarded-For` на кейс; полный сброс — только рестарт `dev:test` |
| **Поллинг 30с в ReviewScreen**: кросс-экранный sync (вердикты/статусы) на втором экране проявляется с задержкой до 30с — флаки в REV-*/кросс-экранных проверках | M | M | В тестах не ждать поллинг: перезагрузка страницы / повторная навигация вместо `waitForTimeout(30000)`; `expect` с расширенным таймаутом; MCP-проходом зафиксировать реальные тайминги |
| **First-compile задержки `next dev`**: первый запрос к каждому роуту компилируется секунды — ложные таймауты в начале прогона | M | L | Прогрев ключевых роутов после старта стенда (обойти `/`, `/blog/...`, `/author`, `/reviewer`, `/admin/login`); авто-ожидания Playwright вместо жёстких таймаутов; увеличенный timeout первого теста |
| **Отсутствие `/uploads/*` файлов**: реальной загрузки нет до Фазы 12 — обложки/QR-изображения могут отдавать 404, роняя console/network-мониторинг | H | L | Проверять наличие `<img>`-узла и `alt`, а не загрузку пикселей; в console-error monitoring — allowlist на 404 по `/uploads/`; не ассертить `naturalWidth` |

---

## 8. Критические инварианты (TESTING.md §4) — проверка в каждом smoke

| Инвариант | Как проверяется | Покрытие (кейсы / spec) |
|-----------|-----------------|--------------------------|
| Редирект без сессии | GET `/admin`, `/author`, `/reviewer` без cookie → 307 на логин | TC-GUEST-04/05/06, TC-ADMIN-21 → `guest.spec.ts`, `admin.spec.ts` |
| 403 на чужой контент | автор PATCH чужой главы (`chp_ghost`) → 403/404; вердикт неназначенного ревьюера → 403 | TC-AUTHOR-21, TC-REVIEWER-16 → `author.spec.ts`, `reviewer.spec.ts` |
| Rate-limit логина | 6-я неудачная попытка → 429 (изоляция через разные `X-Forwarded-For`) | TC-ADMIN-02 → `security.spec.ts` |
| Rate-limit голосов | 2 быстрых POST vote подряд → 429 на втором | TC-READER-21 → `security.spec.ts` |
| XSS в блоках/MDX | блок с `<script>alert(1)</script>` / `onerror=` → санитизирован, alert не срабатывает; `javascript:`-target баннера → 400 | invariant-чек в `security.spec.ts` (без отдельного TC-ID) + TC-ADMIN-17 |
| Timestamps — Unix seconds | в API-ответах `createdAt`/`updatedAt` < 10^11 (секунды, не ms) | попутный ассерт в фикстурах/`security.spec.ts` |
| Гейтинг ролей | ревьюер POST /api/comments → 403; автор в чужом блоге → 403; читатель verdict/блог → 403; админ POST /api/author/** → 401/403 | TC-READER-17/18/20, TC-AUTHOR-22/24, TC-REVIEWER-15, TC-ADMIN-20, COM-GATING → ролевые спеки + `flows/comment-thread.spec.ts` |
| CSRF same-origin *(binding, дополнение к §4)* | мутирующий запрос с чужим `Origin` → 403; cookie `blog_session` — `httpOnly` (недоступна из `document.cookie`) | invariant-чеки в `security.spec.ts` (без отдельного TC-ID) |

> Инварианты без собственного TC-ID (XSS в блоках, CSRF, httpOnly, timestamps) закрепляются
> прямыми проверками в `security.spec.ts` — это осознанный гэп TC-документации, закрываемый
> на уровне спеков.

---

## 9. Traceability-матрица

Suite: **smoke** — входит и в smoke (16 кейсов, ~15 мин), и в полный регресс; **regression** —
только полный регресс; все FLOWS несут тег `@critical`. Spec-файлы — целевые для Фазы 11.3
(`testing/e2e/**`); security-кейсы (CSRF/rate-limit/XSS/httpOnly) сведены в `security.spec.ts`.

### 9.1 Гость — `testing/test-cases/TC-GUEST.md` (14)

| TC-ID | Приоритет | Suite | Акцентный сценарий | Spec-файл |
|-------|:---------:|:-----:|:------------------:|-----------|
| TC-GUEST-01 | P1 | smoke | PUB-ARTICLE | `guest.spec.ts` |
| TC-GUEST-02 | P0 | smoke | — | `guest.spec.ts` |
| TC-GUEST-03 | P1 | regression | REV-VERSIONS | `guest.spec.ts` |
| TC-GUEST-04 | P0 | smoke | — | `guest.spec.ts` |
| TC-GUEST-05 | P0 | smoke | — | `guest.spec.ts` |
| TC-GUEST-06 | P0 | smoke | — | `guest.spec.ts` |
| TC-GUEST-07 | P0 | regression | — | `guest.spec.ts` |
| TC-GUEST-08 | P1 | regression | — | `guest.spec.ts` |
| TC-GUEST-09 | P1 | regression | COM-STALE | `guest.spec.ts` |
| TC-GUEST-10 | P1 | regression | — | `guest.spec.ts` |
| TC-GUEST-11 | P0 | regression | — | `guest.spec.ts` |
| TC-GUEST-12 | P1 | regression | — | `guest.spec.ts` |
| TC-GUEST-13 | P2 | regression | — | `guest.spec.ts` |
| TC-GUEST-14 | P2 | regression | — | `guest.spec.ts` |

### 9.2 Читатель — `testing/test-cases/TC-READER.md` (21)

| TC-ID | Приоритет | Suite | Акцентный сценарий | Spec-файл |
|-------|:---------:|:-----:|:------------------:|-----------|
| TC-READER-01 | P0 | smoke | — | `reader.spec.ts` |
| TC-READER-02 | P1 | regression | — | `reader.spec.ts` |
| TC-READER-03 | P0 | regression | — | `reader.spec.ts` |
| TC-READER-04 | P1 | regression | — | `reader.spec.ts` |
| TC-READER-05 | P1 | smoke | — | `reader.spec.ts` |
| TC-READER-06 | P1 | smoke | — | `reader.spec.ts` |
| TC-READER-07 | P1 | regression | — | `reader.spec.ts` |
| TC-READER-08 | P1 | regression | — | `reader.spec.ts` |
| TC-READER-09 | P1 | smoke | COM-THREAD | `reader.spec.ts` |
| TC-READER-10 | P1 | regression | COM-THREAD | `reader.spec.ts` |
| TC-READER-11 | P1 | regression | — | `reader.spec.ts` |
| TC-READER-12 | P1 | regression | COM-EDIT-WINDOW | `reader.spec.ts` |
| TC-READER-13 | P1 | regression | COM-EDIT-WINDOW | `reader.spec.ts` |
| TC-READER-14 | P0 | regression | — | `reader.spec.ts` |
| TC-READER-15 | P2 | regression | — | `reader.spec.ts` |
| TC-READER-16 | P2 | regression | COM-STALE | `reader.spec.ts` |
| TC-READER-17 | P0 | regression | COM-GATING | `reader.spec.ts` |
| TC-READER-18 | P0 | regression | — | `reader.spec.ts` |
| TC-READER-19 | P0 | regression | — | `reader.spec.ts` |
| TC-READER-20 | P0 | regression | — | `reader.spec.ts` |
| TC-READER-21 | P0 | regression | — | `security.spec.ts` |

### 9.3 Автор — `testing/test-cases/TC-AUTHOR.md` (25)

| TC-ID | Приоритет | Suite | Акцентный сценарий | Spec-файл |
|-------|:---------:|:-----:|:------------------:|-----------|
| TC-AUTHOR-01 | P1 | smoke | — | `author.spec.ts` |
| TC-AUTHOR-02 | P1 | regression | REV-WHOLE-BLOG | `author.spec.ts` |
| TC-AUTHOR-03 | P1 | regression | — | `author.spec.ts` |
| TC-AUTHOR-04 | P1 | regression | — | `author.spec.ts` |
| TC-AUTHOR-05 | P1 | regression | — | `author.spec.ts` |
| TC-AUTHOR-06 | P2 | regression | — | `author.spec.ts` |
| TC-AUTHOR-07 | P2 | regression | — | `author.spec.ts` |
| TC-AUTHOR-08 | P0 | regression | — | `author.spec.ts` |
| TC-AUTHOR-09 | P0 | smoke | MATCH-INVITE | `author.spec.ts` |
| TC-AUTHOR-10 | P0 | regression | — | `author.spec.ts` |
| TC-AUTHOR-11 | P0 | regression | — | `author.spec.ts` |
| TC-AUTHOR-12 | P2 | regression | — | `author.spec.ts` |
| TC-AUTHOR-13 | P2 | regression | — | `author.spec.ts` |
| TC-AUTHOR-14 | P1 | regression | PUB-PORTFOLIO | `author.spec.ts` |
| TC-AUTHOR-15 | P2 | regression | PUB-PORTFOLIO | `author.spec.ts` |
| TC-AUTHOR-16 | P0 | smoke | PUB-DRAFT | `author.spec.ts` |
| TC-AUTHOR-17 | P1 | regression | MATCH-INVITE | `author.spec.ts` |
| TC-AUTHOR-18 | P1 | regression | MATCH-RECRUIT | `author.spec.ts` |
| TC-AUTHOR-19 | P2 | regression | MATCH-RECRUIT | `author.spec.ts` |
| TC-AUTHOR-20 | P1 | regression | COM-THREAD | `author.spec.ts` |
| TC-AUTHOR-21 | P0 | regression | — | `author.spec.ts` |
| TC-AUTHOR-22 | P0 | regression | COM-GATING | `author.spec.ts` |
| TC-AUTHOR-23 | P1 | regression | — | `author.spec.ts` |
| TC-AUTHOR-24 | P0 | regression | — | `author.spec.ts` |
| TC-AUTHOR-25 | P1 | regression | — | `author.spec.ts` |

### 9.4 Ревьюер — `testing/test-cases/TC-REVIEWER.md` (18)

| TC-ID | Приоритет | Suite | Акцентный сценарий | Spec-файл |
|-------|:---------:|:-----:|:------------------:|-----------|
| TC-REVIEWER-01 | P0 | smoke | — | `reviewer.spec.ts` |
| TC-REVIEWER-02 | P1 | regression | — | `reviewer.spec.ts` |
| TC-REVIEWER-03 | P0 | regression | — | `reviewer.spec.ts` |
| TC-REVIEWER-04 | P1 | regression | — | `reviewer.spec.ts` |
| TC-REVIEWER-05 | P1 | regression | — | `reviewer.spec.ts` |
| TC-REVIEWER-06 | P1 | regression | — | `reviewer.spec.ts` |
| TC-REVIEWER-07 | P1 | regression | — | `reviewer.spec.ts` |
| TC-REVIEWER-08 | P1 | regression | — | `reviewer.spec.ts` |
| TC-REVIEWER-09 | P1 | regression | REV-CHAPTER | `reviewer.spec.ts` |
| TC-REVIEWER-10 | P0 | smoke | REV-CHAPTER | `reviewer.spec.ts` |
| TC-REVIEWER-11 | P0 | regression | — | `reviewer.spec.ts` |
| TC-REVIEWER-12 | P1 | regression | REV-SESSION-CHAT | `reviewer.spec.ts` |
| TC-REVIEWER-13 | P2 | regression | — | `reviewer.spec.ts` |
| TC-REVIEWER-14 | P0 | regression | — | `reviewer.spec.ts` |
| TC-REVIEWER-15 | P0 | smoke | COM-GATING | `reviewer.spec.ts` |
| TC-REVIEWER-16 | P0 | regression | — | `reviewer.spec.ts` |
| TC-REVIEWER-17 | P0 | regression | REV-CHAPTER | `reviewer.spec.ts` |
| TC-REVIEWER-18 | P1 | regression | — | `reviewer.spec.ts` |

### 9.5 Админ — `testing/test-cases/TC-ADMIN.md` (22)

| TC-ID | Приоритет | Suite | Акцентный сценарий | Spec-файл |
|-------|:---------:|:-----:|:------------------:|-----------|
| TC-ADMIN-01 | P0 | smoke | — | `admin.spec.ts` |
| TC-ADMIN-02 | P0 | regression | — | `security.spec.ts` |
| TC-ADMIN-03 | P1 | regression | — | `admin.spec.ts` |
| TC-ADMIN-04 | P1 | regression | — | `admin.spec.ts` |
| TC-ADMIN-05 | P0 | regression | COM-GATING | `admin.spec.ts` |
| TC-ADMIN-06 | P0 | regression | — | `admin.spec.ts` |
| TC-ADMIN-07 | P0 | regression | — | `admin.spec.ts` |
| TC-ADMIN-08 | P1 | regression | — | `admin.spec.ts` |
| TC-ADMIN-09 | P0 | regression | — | `admin.spec.ts` |
| TC-ADMIN-10 | P1 | regression | REV-PRIMARY | `admin.spec.ts` |
| TC-ADMIN-11 | P1 | regression | — | `admin.spec.ts` |
| TC-ADMIN-12 | P1 | regression | — | `admin.spec.ts` |
| TC-ADMIN-13 | P2 | regression | — | `admin.spec.ts` |
| TC-ADMIN-14 | P0 | regression | — | `admin.spec.ts` |
| TC-ADMIN-15 | P2 | regression | — | `admin.spec.ts` |
| TC-ADMIN-16 | P1 | regression | — | `admin.spec.ts` |
| TC-ADMIN-17 | P1 | regression | — | `security.spec.ts` |
| TC-ADMIN-18 | P1 | regression | — | `admin.spec.ts` |
| TC-ADMIN-19 | P2 | regression | — | `admin.spec.ts` |
| TC-ADMIN-20 | P0 | regression | — | `admin.spec.ts` |
| TC-ADMIN-21 | P0 | regression | — | `admin.spec.ts` |
| TC-ADMIN-22 | P0 | regression | — | `admin.spec.ts` |

### 9.6 Сквозные флоу — `testing/test-cases/TC-FLOWS.md` (16, все `@critical`)

| TC-ID | Приоритет | Suite | Акцентный сценарий | Spec-файл |
|-------|:---------:|:-----:|:------------------:|-----------|
| REV-CHAPTER | P0 | regression (@critical) | REV-CHAPTER | `flows/review-chapter.spec.ts` |
| REV-WHOLE-BLOG | P0 | regression (@critical) | REV-WHOLE-BLOG | `flows/review-whole-blog.spec.ts` |
| REV-SESSION-CHAT | P0 | regression (@critical) | REV-SESSION-CHAT | `flows/session-chat.spec.ts` |
| REV-PRIMARY | P0 | regression (@critical) | REV-PRIMARY | `flows/review-chapter.spec.ts` |
| REV-VERSIONS | P0 | regression (@critical) | REV-VERSIONS | `flows/publish.spec.ts` |
| PUB-DRAFT | P0 | regression (@critical) | PUB-DRAFT | `flows/publish.spec.ts` |
| PUB-CHAPTER-V2 | P0 | regression (@critical) | PUB-CHAPTER-V2 | `flows/publish.spec.ts` |
| PUB-ARTICLE | P0 | regression (@critical) | PUB-ARTICLE | `flows/publish.spec.ts` |
| PUB-PORTFOLIO | P0 | regression (@critical) | PUB-PORTFOLIO | `flows/publish.spec.ts` |
| COM-THREAD | P1 | regression (@critical) | COM-THREAD | `flows/comment-thread.spec.ts` |
| COM-STALE | P1 | regression (@critical) | COM-STALE | `flows/comment-thread.spec.ts` |
| COM-EDIT-WINDOW | P1 | regression (@critical) | COM-EDIT-WINDOW | `flows/comment-thread.spec.ts` |
| COM-GATING | P0 | regression (@critical) | COM-GATING | `flows/comment-thread.spec.ts` |
| MATCH-INVITE | P0 | regression (@critical) | MATCH-INVITE | `flows/reviewer-matching.spec.ts` |
| MATCH-RECRUIT | P1 | regression (@critical) | MATCH-RECRUIT | `flows/reviewer-matching.spec.ts` |
| MATCH-BOARD | P1 | regression (@critical) | MATCH-BOARD | `flows/reviewer-matching.spec.ts` |

### 9.7 Сводка распределения по spec-файлам

| Spec-файл | Кейсов | Состав |
|-----------|:------:|--------|
| `guest.spec.ts` | 14 | TC-GUEST-01…14 |
| `reader.spec.ts` | 20 | TC-READER-01…20 (кроме 21) |
| `author.spec.ts` | 25 | TC-AUTHOR-01…25 |
| `reviewer.spec.ts` | 18 | TC-REVIEWER-01…18 |
| `admin.spec.ts` | 20 | TC-ADMIN (кроме 02, 17) |
| `security.spec.ts` | 3 (+invariant-чеки) | TC-READER-21, TC-ADMIN-02, TC-ADMIN-17 + CSRF/XSS/httpOnly/timestamps без TC-ID (§8) |
| `flows/review-chapter.spec.ts` | 2 | REV-CHAPTER, REV-PRIMARY |
| `flows/review-whole-blog.spec.ts` | 1 | REV-WHOLE-BLOG |
| `flows/session-chat.spec.ts` | 1 | REV-SESSION-CHAT (multi-context) |
| `flows/publish.spec.ts` | 5 | PUB-DRAFT, PUB-CHAPTER-V2, PUB-ARTICLE, PUB-PORTFOLIO, REV-VERSIONS |
| `flows/comment-thread.spec.ts` | 4 | COM-THREAD, COM-STALE, COM-EDIT-WINDOW, COM-GATING (multi-context) |
| `flows/reviewer-matching.spec.ts` | 3 | MATCH-INVITE, MATCH-RECRUIT, MATCH-BOARD |

**Smoke-набор (15 SMK-шагов, канон — `testing/smoke/SMOKE-SUITE.md`):** TC-GUEST-01/02/04/05/06 ·
TC-READER-01/05/06/09 · TC-AUTHOR-01/09/16 · TC-REVIEWER-01/10/15 · TC-ADMIN-01 + инварианты
CSRF (SMK-14) и XSS (SMK-15) без TC-ID.
