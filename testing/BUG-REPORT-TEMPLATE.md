# BUG-REPORT-TEMPLATE — Шаблон баг-репорта Recenza

Формат — по скиллу `qa-test-planner`. **Severity ≠ Priority:** Severity — техническая тяжесть
дефекта, Priority — очерёдность фикса (может расходиться: косметика на главной = Low/P1).

| Severity | Критерий | Обычно → Priority |
|----------|----------|:----:|
| Critical | Data loss, падение системы, security-уязвимость | P0 |
| High | Фича сломана, workaround нет | P1 |
| Medium | Частичная деградация, workaround есть | P2 |
| Low | Косметика, редкие edge-cases | P3 |

Блокирующий баг по git-flow — ветка `hotfix-<slug>` с приоритетным PR (CLAUDE.md).

---

```markdown
# BUG-NNN: [Конкретное название: что, где, при каких условиях]

**Severity:** Critical | High | Medium | Low
**Priority:** P0 | P1 | P2 | P3
**Type:** Functional | UI | Security | Performance
**Status:** Open | In Progress | Fixed | Closed
**Обнаружен:** TC-ID [ссылка на кейс, напр. testing/test-cases/TC-READER.md#TC-READER-11] · этап (MCP / автотест / ручной)

## Environment
- **Стенд:** http://localhost:3001 · blog.test.db · seed: свежий/протухший (сколько минут после test:reset)
- **Commit:** [git rev-parse --short HEAD] · ветка
- **Браузер:** [Chromium NNN (Playwright) / другой]
- **ОС:** [Windows 11 / ubuntu-latest CI]
- **URL:** [точный путь, где воспроизводится]
- **Пользователь:** [handle из seed / гость / админ]

## Description
[1–3 предложения: что сломано и почему это дефект — ссылка на ожидание из TC/инварианта]

## Steps to Reproduce
1. [Точный шаг с данными: URL, handle, кнопка «...»]
2. [...]
3. [...]

## Expected Behavior
[Из TC-кейса / TESTING.md §4 / бизнес-правила]

## Actual Behavior
[Что происходит на самом деле; HTTP-статусы, тексты ошибок]

## Visual Evidence
- Screenshot: [testing/reports/... или путь]
- Trace/video: [test-results/... при наличии]
- Console: [ошибки из browser_console_messages / page.on('console')]
- Network: [аномальные запросы/статусы]

## Impact
- **User Impact:** [какие роли/сценарии затронуты]
- **Frequency:** Always | Sometimes | Rarely [+ условия]
- **Workaround:** [есть/нет; какой]

## Additional Context
- **Regression:** Yes (работало в фазе N / коммите X) | No (никогда не работало)
- **Related:** [TC-ID, инвариант §4, PLAN.md-фаза, backlog-пункт]
- **Подозрение на причину:** [файл:строка, если известно — не обязательно]
```

---

## Правила заполнения

- **Reproducible steps** — точные, с данными из seed (handle/slug/ID), а не «залогиньтесь и сломайте».
- Один баг = один репорт. Несколько симптомов одной причины — связывать через Related.
- Security-баг (XSS/CSRF/гейтинг/утечка) — всегда Severity Critical, Priority P0, немедленно
  hotfix-ветка; тест остаётся красным до фикса (не skip!).
- Флак (проходит при повторе) — тоже баг: Type Functional, в Description — статистика
  (N провалов на M прогонов, `--repeat-each`).
- Перед заведением — проверить на свежем seed (`npm run test:reset`): протухшие recency-сущности
  (cmt_fresh) и in-memory rate-limit дают ложные провалы.
