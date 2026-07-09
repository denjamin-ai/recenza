# Промты Claude Code — Recenza

> **Миграция завершена** (12 фаз, прод — https://recenza.ru). Актуальные промты для текущей
> жизни проекта — ниже. Фазовые промты миграции сохранены в «Архиве» в конце файла.
> Процесс, на который опираются промты, — `docs/migration/WORKFLOW.md`.

---

## Карта документов (что читает Claude Code и когда)

| Документ | Роль | Когда читать |
|---|---|---|
| `CLAUDE.md` (корень) | Архитектура, жёсткие конвенции, гочи, краткий деплой | Загружается автоматически каждую сессию |
| `docs/migration/WORKFLOW.md` | **Сквозной флоу изменений** (классы S/M/L, тесты, Цикл качества, конвейер, чек-лист) | Перед любым кодом |
| `docs/migration/PLAN.md` | История 12 фаз + **живой журнал «Пост-релизные итерации»** | Хвост журнала — перед любой итерацией; журналы фаз — при archeology |
| `docs/migration/ENVIRONMENTS.md` | Три стенда; §6 — layout VPS, деплой, runbook (откат/бэкапы/логи/гочи сервера) | Работа с прод-сервером, инциденты, env |
| `docs/migration/TESTING.md` | Устройство тест-слоя: матрица ролей, сквозные сценарии, MCP + TS-автотесты | Написание/правка e2e |
| `docs/migration/DESIGN-TOKENS.md` | Дизайн-токены (цвет/типографика/движение) — источник правды | Любые UI-правки |
| `docs/prototype/README.md` + `docs/prototype/ui_kits/**` | UX-эталон (модель, экраны, поведение из кода прототипа) | Новые UI-поверхности, спорные UX-решения |
| `testing/mcp/MCP-FINDINGS.md` | Реальные локаторы/тайминги/флак-паттерны стенда | Отладка e2e |
| `docs/migration/PROMPT.md` (этот файл) | Библиотека промтов | Копипаст при старте сессии |
| `README.md` (корень) | Витрина репозитория: что это, быстрый старт, карта доков | Первое знакомство |

**SSH-доступ к прод-серверу:** ключ владельца добавлен на сервер (root + пользователь `recenza`);
на машине владельца лежит в `~/.ssh/recenza_ed25519`. Использование:
`ssh -i ~/.ssh/recenza_ed25519 root@91.184.243.106 "<команда>"`. Как завести новый ключ — `ENVIRONMENTS.md` §6.5.

Обвязка `.claude/`: rules (security/next/drizzle/mdx/frontend) подключаются автоматически;
сабагенты `code-reviewer`, `security-reviewer`, `design-watcher`, `seo-optimizer`,
`playwright-tester` и скиллы (`next-best-practices`, `security-checklist`, `drizzle-schema`,
`review-flow-domain`, `playwright-best-practices`, `qa-test-planner`) — все созданы и рабочие,
вызываются по зонам согласно WORKFLOW §4.

---

## Промт: итерация изменений (основной)

> Новая фича, фикс, полиш — любой код. Замени `<ЗАДАЧА>`.

```
Ты — ведущий full-stack инженер на проекте Recenza (Next.js 16 монолит, прод https://recenza.ru).
Миграция завершена — работаем по флоу пост-релизных изменений.

Задача: <ЗАДАЧА>

Перед работой:
0. Прочитай @docs/migration/WORKFLOW.md целиком — это обязательный процесс.
1. Прочитай раздел «Пост-релизные итерации» в @docs/migration/PLAN.md (последние записи журнала —
   твой контекст по недавним решениям и backlog).
2. Классифицируй изменение по WORKFLOW §0 (S/M/L) и скажи мне класс + план: какие тесты
   обязательны, какие сабагенты Цикла качества по зоне. При классе L — сначала запись в журнал PLAN.md.
3. Ветка от свежего main: hotfix-<slug> (S/M) или feature-<slug> (L).
   ⚠️ В main напрямую не коммитить — push в main автодеплоит прод.

Дальше по WORKFLOW: разработка (конвенции CLAUDE.md; UI сверяй с docs/prototype и DESIGN-TOKENS) →
тесты (полный `npx playwright test` зелёный; новые кейсы по классу; UI дополнительно проверь через
Playwright MCP на :3001 в обеих темах и на 375px) → Цикл качества по зоне (P0/P1 = 0) →
`gh pr create` → зелёный CI-smoke → `gh pr merge --squash --delete-branch` → дождись
`deploy` = success → проверь именно своё изменение на https://recenza.ru → запись в журнал
PLAN.md (+ обнови CLAUDE.md/ENVIRONMENTS.md, если задел конвенции/сервер).

Дай короткий отчёт: что сделано, чем проверено, что ушло в backlog.
```

## Промт: экстренный фикс прода

> Прод сломан или деградировал. Замени `<СИМПТОМ>`.

```
ПРОД-ИНЦИДЕНТ на Recenza (https://recenza.ru): <СИМПТОМ>

0. Прочитай @docs/migration/ENVIRONMENTS.md §6 (runbook) и раздел «Деплой изменений» в @CLAUDE.md.
1. Диагностика (read-only): curl -I https://recenza.ru ; gh run list --workflow=deploy --limit 3 ;
   по SSH (ключ: ~/.ssh/recenza_ed25519, хост root@91.184.243.106) — systemctl status recenza caddy,
   journalctl -u recenza -n 100, место на диске.
2. Если виноват свежий релиз и мгновенного фикса нет — СНАЧАЛА откат (симлинк на прежний релиз
   в /srv/recenza/releases + sudo systemctl restart recenza), потом фикс.
3. Фикс — hotfix-ветка по WORKFLOW.md с максимальным приоритетом (полный e2e можно сократить
   до затронутых спеков + smoke, если прод лежит).
4. После восстановления: полная запись в журнал PLAN.md — симптом, причина, фикс, профилактика.

⚠️ Секреты (/srv/recenza/shared/env, .env*) не выводить в вывод и не коммитить.
⚠️ ufw-правила AmneziaWG (51820/udp, 51821/tcp) не трогать.
```

## Промт: диагностика прода (без изменений)

> Вопрос «что с сервером/деплоем/данными», без правок.

```
Диагностика прода Recenza (НИЧЕГО не менять без моего подтверждения): <ВОПРОС/СИМПТОМ>

Прочитай @docs/migration/ENVIRONMENTS.md §6. SSH: ключ ~/.ssh/recenza_ed25519, хост
root@91.184.243.106. Проверь по ситуации: HTTP-статусы и заголовки (curl),
состояние workflow (gh run list), сертификат/DNS, по SSH — сервис/таймеры (systemctl list-timers),
логи (journalctl -u recenza|caddy), диск (df -h), бэкапы (/srv/recenza/backups), активный релиз
(ls -la /srv/recenza/current). Верни сводку: что в норме, что нет, рекомендации. Деструктивных
действий и рестартов не делать.
```

## Промт: работа с тестами

> Починка флаков, новые спеки, регресс.

```
Задача по тест-слою Recenza: <ЗАДАЧА>

0. Прочитай @docs/migration/TESTING.md и шапку @testing/e2e/fixtures.ts (console-guard, фикстуры).
1. Конвенции: локаторы по роли/тексту; seed-константы только из testing/e2e/helpers/seed.ts;
   мутирующие спеки — serial + reseed() в beforeAll И afterAll; негативные API — через api()-фикстуру;
   анти-флак — идемпотентный toPass-ретрай и waitForResponse при оптимистичном UI (реестр реальных
   локаторов/таймингов — testing/mcp/MCP-FINDINGS.md).
2. Прогон только на :3001 (никогда :3000/прод). cron.spec требует стенд, поднятый самим Playwright,
   либо CRON_SECRET в .env.test.
3. Финал: полный `npx playwright test` зелёный, 0 skip → PR по WORKFLOW.md.
```

---

## Архив: промты миграции (фазы 0–12 завершены 2026-07-08)

> Историческая справка. Пути `/recenza-prototype/*` в старых текстах соответствуют нынешним
> `docs/prototype/*`; скиллы/сабагенты «создать в фазе N» давно созданы. Не использовать для новой работы.

<details>
<summary>Промт запуска проекта (миграция)</summary>

Роль: ведущий full-stack инженер и архитектор; миграция дизайн-прототипа Recenza из React-прототипов
в production-монолит Next.js 16 строго по 12 фазам `PLAN.md`. Каждая фаза закрывается только по DoD +
зелёному Циклу качества (build/lint → скиллы → сабагенты code/security/design/seo → playwright smoke);
правило блокировки: фаза `blocked` останавливает всё. Источники истины: PLAN.md, README прототипа,
CLAUDE.md, ENVIRONMENTS.md, DESIGN-TOKENS.md, TESTING.md. Ограничения: монолит; два стенда; все БД
миграциями Drizzle; детерминированный seed; двухуровневое тестирование (Playwright MCP + TS-автотесты);
Unix seconds; ulid(); JSON в try/catch; безопасность по умолчанию.

</details>

<details>
<summary>Промт запуска Фазы 0 (bootstrap)</summary>

Каркас Next.js поверх кита через временную `.next-scaffold` (create-next-app не работает в непустой
папке), слияние scripts/devDeps, установка зависимостей + `npx playwright install`, .gitignore,
`.env.local`/`.env.test` из `.env.example` (пароль админа спросить, секреты не коммитить), git init +
первый коммит с подтверждением. Цикл качества Фазы 0: dev/build/lint зелёные, секреты не в индексе.

</details>

<details>
<summary>Промт запуска фазы N (миграция)</summary>

Прочитать CLAUDE.md → Карту фаз PLAN.md (blocked = стоп) → проверить зависимости фазы `done` →
журналы закрытых фаз → блок фазы N целиком + её §README/§ENVIRONMENTS → статус `in progress` + todo →
ветка `phase-N-<slug>` от main. Выполнить по подфазам; перед закрытием — Цикл качества фазы (точный
набор сабагентов/скиллов в её чеклисте). Закрытие: DoD + зелёный цикл → статус `done`, Журнал фазы,
Карта фаз → commit/push/PR → squash-merge → удалить ветку. Отчёт: сделано / backlog / риски следующей фазы.

</details>
