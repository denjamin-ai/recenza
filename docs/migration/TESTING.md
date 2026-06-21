# TESTING.md — Тест-кейсы, сценарии и Playwright

Реализуется в **Фазах 10–11** `PLAN.md`. Тестирование двухуровневое и оба уровня обязательны:

1. **Playwright MCP** (`mcp__playwright__*`) — живое исследование и верификация флоу в браузере
   (snapshot, click/type/fill_form, evaluate, screenshot, console/network). Источник реальных
   локаторов и таймингов, ручная проверка сложных флоу (ReviewPage).
2. **TypeScript-автотесты** (`@playwright/test`) — закоммиченные спеки, гоняются в CI на тест-стенде.

Скиллы: `qa-test-planner` (планирование/кейсы), `playwright-best-practices` (локаторы, POM, фикстуры,
auth, CI). Сабагент `playwright-tester` выносит вердикт GO/NO-GO.

---

## 1. Структура тестовой документации

```
testing/
├── TEST-PLAN.md                 # scope, стратегия, окружение (тест-стенд!), entry/exit, риски
├── test-cases/
│   ├── TC-GUEST.md              # гость: чтение, редиректы, intent-replay
│   ├── TC-READER.md             # читатель: голоса, закладки, подписки, комментарии
│   ├── TC-AUTHOR.md             # автор: блоги, редактор, отправка на ревью, портфолио
│   ├── TC-REVIEWER.md           # ревьюер: треды, вердикты, правки, чат
│   └── TC-ADMIN.md              # админ: роли, баны, публикация, жалобы, смена ведущего
├── smoke/SMOKE-SUITE.md         # ~15 кейсов, ~15 мин
├── regression/REGRESSION-SUITE.md
└── reports/playwright-html/     # отчёты прогонов
```

Формат кейса (из `qa-test-planner`): `ID · Приоритет(P0–P3) · Тип · Предусловия · Шаги+Ожидания ·
Тест-данные(из seed) · Постусловия · Edge-cases`.

---

## 2. Матрица ролей (позитив + негатив) — обязательна

| Действие | Гость | Читатель | Автор | Ревьюер | Админ |
|----------|:----:|:-------:|:----:|:------:|:----:|
| Читать опубликованные блоги | ✅ | ✅ | ✅ (свои) | ✅ | ✅ |
| Голос/закладка/подписка | →login | ✅ | ✅ | ✅ | — |
| Комментировать | →login | ✅ везде | ✅ только свои | ❌ 403 | модерация |
| Вести блоги/главы | ❌ | ❌ | ✅ | ❌ | ❌ |
| Отправлять на ревью | ❌ | ❌ | ✅ | ❌ | ❌ |
| Рецензировать (тред/вердикт/правка) | ❌ | ❌ | ❌ | ✅ | — |
| Портфолио «Об авторе» | ❌ | ❌ | ✅ | ❌ | ❌ |
| Публиковать главу | ❌ | ❌ | ✅ (при approve) | ❌ | ✅ (force) |
| Роли/баны/жалобы/смена ведущего | ❌ | ❌ | ❌ | ❌ | ✅ |

Каждая ❌ — отдельный **негативный** кейс (403 / редирект / скрытие из выдачи).

---

## 3. Акцентные сквозные сценарии (обязательны)

### 3.1 Ревью

- **REV-CHAPTER — ревью одной главы.** Автор отправляет v1 на ревью → ревьюер открывает тред с
  `suggestion` на блоке → автор «Применить и закрыть» (блок меняется, тред `resolved`) → ревьюер
  ставит `approve` → автор публикует. **Проверка:** статус главы синхронно меняется в инбоксе ревьюера,
  кабинете автора и ридере; bauble↔thread sync работает; вердикты считаются.
- **REV-WHOLE-BLOG — ревью всего блога.** Блог с несколькими главами в разных статусах
  (`draft`/`under-review`/`changes-requested`/`published`). Переключение глав через strip (`tablist`),
  режим «Весь блог». **Проверка:** статусы глав независимы; навигация не теряет контекст; прогресс корректен.
- **REV-SESSION-CHAT — чат сессии.** Несколько ревьюеров + автор обсуждают в чате сессии (вне тредов).
  **Проверка:** сообщения видны всем участникам сессии; presence/typing; чат не смешивается с тредами.
- **REV-PRIMARY — смена ведущего.** Автор/админ меняет ведущего ревьюера. **Проверка:** изменение
  распространяется кросс-экранно (инбокс/кабинет/детали блога).
- **REV-VERSIONS — кредит по версиям.** Публикация v2 после v1. **Проверка:** опубликованная глава
  показывает текущих ревьюеров чипами и прошлых (v1) за раскрытием.

### 3.2 Публикации

- **PUB-DRAFT — публикация черновика главы** (через полный review-flow до `published`).
- **PUB-CHAPTER-V2 — публикация новой версии** главы с обновлением `reviewer_history` и кредита.
- **PUB-ARTICLE — появление в каталоге/ленте**: опубликованная глава видна в ленте/каталоге,
  у подписчиков — в `/reader`, уведомление о новой главе.
- **PUB-PROFILE / PUB-PORTFOLIO — публикация без ревью**: портфолио «Об авторе» публикуется минуя
  review-flow; видимость show/hide; пустое состояние «Портфолио ещё не создано».

### 3.3 Комментирование (читатель ↔ автор ↔ читатель)

- **COM-THREAD — диалог.** Читатель оставляет вопрос с привязкой к блоку → автор отвечает (как участник
  своего блога) → читатель уточняет. **Проверка:** уведомления летят в обе стороны; вложенность ≤2;
  клик по цитате скроллит к блоку.
- **COM-STALE — старая версия.** Комментарий к прошлой ревизии уезжает в спойлер «прошлые версии»
  с бейджем «к версии vN».
- **COM-EDIT-WINDOW — окно правки.** Правка доступна ≤15 мин; на 16-й минуте → 403.
- **COM-GATING — гейтинг.** Ревьюер → 403 на POST; автор → 403 на чужой блог; `commenting_blocked` → 403.

---

## 4. Критические инварианты (проверять в каждом smoke)

| Инвариант | Как проверить |
|-----------|---------------|
| Редирект без сессии | GET `/admin`,`/author`,`/reviewer` без cookie → 307 |
| 403 на чужой контент | автор A `PUT` главы автора B → 403 |
| Rate-limit логина | 6-я неудача → 429 (разные `X-Forwarded-For` для изоляции) |
| Rate-limit голосов | 2 быстрых POST vote → 429 на втором |
| XSS в блоках/MDX | блок с `<script>alert(1)</script>` → санитизирован, alert не срабатывает |
| Timestamps | значения — Unix seconds, не ms |
| Гейтинг ролей | ревьюер не комментирует; автор не комментирует чужое; админ не создаёт блоги |

UI/UX-инварианты (после фазы 12): dark/light без hardcoded-цветов, mobile-nav на 375px,
skip-to-content, focus-visible, scroll-progress, empty states, staggered animation, reduced-motion.

---

## 5. Уровень 1 — Playwright MCP (исследование/верификация)

Перед написанием спеков пройти ключевые флоу руками через MCP на тест-стенде (3001):

```
mcp__playwright__browser_navigate { url: "http://localhost:3001/login" }
mcp__playwright__browser_snapshot {}                       # дерево + ref-ы элементов
mcp__playwright__browser_fill_form { fields: [...] }       # по ref из snapshot, не selector
mcp__playwright__browser_click { ref: "e42" }
mcp__playwright__browser_evaluate { function: "() => location.pathname" }
mcp__playwright__browser_console_messages {}               # при провале
mcp__playwright__browser_take_screenshot { type: "png" }
```

Результат MCP-прохода: зафиксированные стабильные локаторы (роль/текст/`data-testid`), реальные
тайминги ожиданий, граничные случаи — это вход для TS-спеков. Сложный ReviewPage (bauble↔thread sync,
apply-and-close, presence) сначала проверяется через MCP, затем закрепляется спеком.

---

## 6. Уровень 2 — TypeScript-автотесты (@playwright/test)

```
testing/e2e/
├── playwright.config.ts        # baseURL :3001, workers:1, fullyParallel:false, reuseExistingServer
├── global-setup.ts             # авто-генерация auth-state на роль
├── .auth/{admin,author,reader,reviewer}.json
├── pages/                      # Page Object Model
│   ├── reader.page.ts  editor.page.ts  review.page.ts  comments.page.ts  admin.page.ts
├── fixtures.ts                 # ролевые фикстуры (asReader/asAuthor/asReviewer/asAdmin)
├── guest.spec.ts  reader.spec.ts  author.spec.ts  reviewer.spec.ts  admin.spec.ts
└── flows/
    ├── review-chapter.spec.ts        # REV-CHAPTER
    ├── review-whole-blog.spec.ts     # REV-WHOLE-BLOG
    ├── session-chat.spec.ts          # REV-SESSION-CHAT (multi-user)
    ├── publish.spec.ts               # PUB-*
    └── comment-thread.spec.ts        # COM-THREAD (multi-user reader↔author)
```

**Конфиг (ключевое).** `baseURL: http://localhost:3001`; `workers: 1`, `fullyParallel: false`
(единый общий тест-стенд); `reuseExistingServer: true` (авто-старт `dev:test`); reporter →
`testing/reports/playwright-html`. Теги `@smoke` / `@critical` / `@regression` (фильтр `--grep`).

**Паттерны (из `playwright-best-practices`).**
- Локаторы по роли/тексту/`data-testid`, не по CSS-классам. Авто-ожидания вместо `waitForTimeout`.
- POM для каждого экрана; ролевые фикстуры поверх auth-state из `global-setup`.
- Multi-user (REV-SESSION-CHAT, COM-THREAD) — несколько `browserContext` в одном тесте.
- Console-error monitoring: падать на ошибках в консоли. Изоляция через `reset-test-db.sh` перед прогоном.
- Критические спеки гонять `--repeat-each=5` на стабильность.

**Пример скелета спека:**

```ts
import { test, expect } from "./fixtures";

test.describe("REV-CHAPTER @critical", () => {
  test("автор отправляет → ревьюер правит → approve → публикация", async ({ asAuthor, asReviewer }) => {
    // 1. автор отправляет главу-черновик на ревью
    const editor = await asAuthor.openDraftChapter("blog-1", "chapter-2");
    await editor.submitForReview({ reviewers: ["reviewer"], primary: "reviewer" });

    // 2. ревьюер открывает тред с suggestion и автор применяет
    const review = await asReviewer.openReview("blog-1", "chapter-2");
    await review.openThreadOnBlock("b-3");
    await review.addSuggestion("опечатка", "исправлено");

    // 3. автор применяет и закрывает, ревьюер апрувит
    await asAuthor.applyAndClose("blog-1", "chapter-2");
    await asReviewer.approve();

    // 4. автор публикует, статус виден в ридере
    await asAuthor.publish("blog-1", "chapter-2");
    await expect(asReviewer.statusPill).toHaveText(/опубликовано/i);
  });
});
```

---

## 7. CI и вердикт

- **PR:** поднять тест-стенд → seed → прогнать `@smoke` + затронутые `@critical`.
- **Ночной:** полный регресс (`REGRESSION-SUITE.md`).
- Сабагент `playwright-tester` форматирует прогон и выносит вердикт:

| Вердикт | Условие |
|---------|---------|
| ✅ GO | все P0 прошли; ≥90% P1 прошли; нет открытых критических багов |
| ❌ NO-GO | любой P0 провален; security-уязвимость; data loss |
| ⚠️ CONDITIONAL | P1-провалы с задокументированным workaround; P0 чисты |

> `npm run build` — необходимое, но **недостаточное** условие. Сборка + прохождение smoke на
> тестовом стенде = минимальная планка готовности фазы/деплоя.
