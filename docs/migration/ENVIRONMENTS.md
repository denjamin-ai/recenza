# ENVIRONMENTS.md — Стенды и базы данных

Полное устройство **тестового** и **продового** стендов, всех БД и детерминированного флоу
тестового стенда. Реализуется в **Фазе 2** `PLAN.md`. Монолит — один Next.js-репозиторий,
разные стенды отличаются только env + БД + портом.

---

## 1. Три окружения (стенда обязательно два: test и prod)

| Параметр | **Dev** (рабочее) | **Test** (тестовый стенд) | **Prod** (продовый стенд, Фаза 12) |
|----------|-------------------|---------------------------|---------------------------|
| URL | `http://localhost:3000` | `http://localhost:3001` | `https://recenza.ru` |
| БД | `file:blog.db` | `file:blog.test.db` | `file:/srv/recenza/shared/data/blog.prod.db` (VPS) |
| Env-файл | `.env.local` | `.env.test` | `/srv/recenza/shared/env` (systemd EnvironmentFile) |
| Запуск | `npm run dev` | `npm run dev:test` | GitHub Actions `deploy.yml` → systemd `recenza.service` |
| Seed | `npm run seed` | `npm run seed:test` (детерминированный) | НЕТ seed; bootstrap-админ из `ADMIN_PASSWORD_HASH` env |
| Назначение | разработка | **только тесты** (Playwright) | боевой (VPS Ubuntu 24.04, Хельсинки; Caddy + Node standalone) |

> Историческая справка: до Фазы 12 прод планировался как Vercel + Turso. Решение Фазы 12 —
> собственный VPS: локальный SQLite тем же libsql-драйвером (Turso выведен из эксплуатации,
> переключение обратно — одной переменной `TURSO_CONNECTION_URL`), локальные загрузки,
> systemd-cron без ограничений тарифа. Turso-переменные остаются в схеме env как опция.

> ⚠️ **Инвариант изоляции.** Тесты НИКОГДА не ходят на `:3000`/`blog.db` и тем более на прод.
> Тестовый стенд всегда сбрасывается к фиксированному seed перед прогоном — это гарантирует
> воспроизводимость. Dev-БД и прод-БД тесты не трогают.

---

## 2. Переменные окружения

`.env.example` (коммитится; реальные значения — нет):

```bash
# --- общие ---
SESSION_SECRET=            # 32+ символа, обязателен при старте
ADMIN_PASSWORD_HASH=       # bcrypt, '$' экранируется как '\$' (dotenv-expand)
NEXT_PUBLIC_BASE_URL=      # канонический URL (sitemap, RSS, JSON-LD)

# --- БД ---
# Выбор файла локальной БД (механика двух стендов):
#   .env.local → DB_FILE_NAME=blog.db ; .env.test → DB_FILE_NAME=blog.test.db
DB_FILE_NAME=blog.db
# прод: оба обязательны; если заданы — file:-fallback не используется
TURSO_CONNECTION_URL=
TURSO_AUTH_TOKEN=

# --- прод ---
CRON_SECRET=               # Bearer для /api/cron/publish

# --- только .env.test ---
ADMIN_PASSWORD_PLAIN=      # открытый пароль админа для авто-логина в тестах (напр. dhome$32)
```

**Правила.**
- `SESSION_SECRET` без fallback — приложение падает при старте, если не задан (безопасность).
- bcrypt-хэши в `.env.local`/`.env.test` экранируют `$` как `\$` — иначе dotenv-expand считает их переменными.
- `ADMIN_PASSWORD_PLAIN` живёт **только** в `.env.test`, никогда в проде; настоящие креды туда не писать.
  Он обязан соответствовать `ADMIN_PASSWORD_HASH` из того же `.env.test` (хэш генерится из него же).
- ⚠️ **`next dev` НЕ читает `.env.test` автоматически** (Next загружает её только при `NODE_ENV=test`).
  Поэтому все команды тест-стенда идут через **`dotenv-cli`**: `dotenv -e .env.test -- <cmd>`.
  Без этого «тест-стенд» молча работал бы на dev-БД — критическая ошибка изоляции.
- `db/index.ts`: если `TURSO_CONNECTION_URL` пуст → `file:${DB_FILE_NAME ?? "blog.db"}`.
- `drizzle.config.ts` читает то же правило:
  `url: process.env.TURSO_CONNECTION_URL ?? \`file:${process.env.DB_FILE_NAME ?? "blog.db"}\`` —
  так `drizzle-kit migrate` мигрирует именно ту БД, чей env-файл подан через dotenv-cli.

---

## 3. Команды (package.json)

```jsonc
{
  "dev":             "next dev",                                      // :3000, .env.local → blog.db
  "dev:test":        "npm run test:reset && dotenv -e .env.test -- next dev -p 3001",
  "build":           "next build",
  "lint":            "next lint",

  "db:generate":     "drizzle-kit generate",                          // после правки schema.ts
  "db:migrate":      "dotenv -e .env.local -- drizzle-kit migrate",   // создаёт/мигрирует blog.db
  "db:migrate:test": "dotenv -e .env.test  -- drizzle-kit migrate",   // создаёт/мигрирует blog.test.db

  "seed":            "dotenv -e .env.local -- tsx src/lib/db/seed.ts",
  "seed:test":       "dotenv -e .env.test  -- tsx src/lib/db/seed-test.ts", // ДЕТЕРМИНИРОВАННЫЙ

  "test:reset":      "npm run db:migrate:test && npm run seed:test",  // schema + seed = полный сброс
  "test:e2e":        "playwright test",                               // webServer авто-стартует dev:test
  "test:e2e:ui":     "playwright test --ui",
  "test:e2e:report": "playwright show-report testing/reports/playwright-html"
}
```

**Первичная инициализация БД с нуля (чистый клон, после Фазы 1):**

```bash
npm run db:generate    # миграции из schema.ts (коммитятся в репо; повторно — только после правок схемы)
npm run db:migrate && npm run seed   # создаёт blog.db (файл появляется сам — sqlite)
npm run test:reset                   # создаёт blog.test.db + детерминированный seed
```

Оба `.db`-файла создаются самим libsql при первом обращении — отдельной команды «create database»
не существует; «создать БД» = применить миграции. Файлы в `.gitignore`, в репо живут только миграции.

---

## 4. Схема БД (глава-ориентированная модель)

Все таблицы создаются миграциями Drizzle (dialect `turso`). `snake_case`, `id = ulid()`,
timestamps — **Unix seconds**, JSON-поля — строки/`JSONB`, читаются в `try/catch`.

```
users
  id, handle (uniq), role(reader|author|reviewer|admin), password_hash,
  display_name, bio, avatar_url, links(JSON), slug(uniq),
  is_blocked, commenting_blocked, created_at,
  competencies(JSON[]),            -- что ревьюер может рецензировать (этап «подбор»)
  reviewer_rating, reviewer_ratings_n, review_load, review_capacity

blogs
  id, slug(uniq), title, author_id→users, cover_url, tags(JSON[]),
  complexity(simple|medium|complex), summary,
  published_at, last_activity_at, view_count, rating, bookmark_count

chapters
  id, blog_id→blogs(CASCADE), slug, title, "order", primary_handle→users.handle,
  skills(JSON[])               -- ключевые навыки статьи: обяз. для отправки, видны читателю
  UNIQUE(blog_id, slug)

chapter_revisions
  id, chapter_id→chapters(CASCADE), number, status(draft|under-review|changes-requested|published),
  summary, blocks(JSONB), prev_blocks(JSONB),  -- снапшот последней публикации (для инлайн-диффа)
  submitted_at, published_at
  UNIQUE(chapter_id, number)

chapter_reviewers            -- назначения + вердикты на ревизию
  chapter_id→chapters, revision_number, handle→users.handle,
  is_primary, verdict(approve|request-changes), verdict_at, online, typing
  PRIMARY KEY(chapter_id, revision_number, handle)

reviewer_history             -- кредит ревьюеров по версиям (для опубликованной главы)
  chapter_id→chapters, revision_number, handle→users.handle
  PRIMARY KEY(chapter_id, revision_number, handle)

threads                      -- обсуждения, привязанные к блоку
  id, chapter_id→chapters(CASCADE), revision_number, block_id, anchor,
  status(open|resolved), from_handle→users.handle, text,
  suggestion(JSON {from,to} | null), created_at

thread_replies
  id, thread_id→threads(CASCADE), from_handle→users.handle, text, created_at

review_chat                  -- чат сессии ревью (вне тредов)
  id, chapter_id→chapters(CASCADE), revision_number, from_handle→users.handle, text, created_at

review_checklists            -- чек-лист готовности к отправке/ревью
  id, chapter_id→chapters, items(JSON [{text,checked}]), created_at

public_comments              -- читательские комментарии
  id, blog_slug, chapter_slug, revision, author_id→users(SET NULL),
  parent_id→public_comments(≤2 уровня), text,
  anchor(JSON {block_id,quote} | null), edited_at, deleted_at, created_at

comment_votes                -- ±1, uniqueIndex(user_id, comment_id), CASCADE
chapter_votes                -- ±1, uniqueIndex(user_id, chapter_id), CASCADE
bookmarks                    -- uniqueIndex(user_id, blog_id), CASCADE
follows                      -- подписки reader→author, PK(user_handle, blog_id|author_id)

notifications                -- polling; is_admin_recipient + recipient_id=NULL → админу
  id, recipient_id→users|NULL, is_admin_recipient, type, payload(JSON), is_read, created_at

portfolios                   -- «Об авторе», один на автора, публикуется БЕЗ ревью
  id, author_id→users(uniq), blocks(JSONB), is_visible, updated_at

reports                      -- жалобы
  id, reporter_id→users, target_type, target_id, reason, status(open|resolved), created_at

primary_change_requests      -- заявки на смену ведущего ревьюера
  id, chapter_id→chapters, from_handle, to_handle, status, created_at

removed_reviewers            -- лог снятия ревьюера админом
  id, blog_slug, chapter_slug, handle, by_admin, reason, created_at

-- Этап «подбор ревьюеров, согласие, оценка, монетизация» (детали — prototype/README.md §11.9).
-- chapters получает: skills(JSON[]) — ключевые навыки статьи (обяз. для отправки, видны читателю).
review_invitations           -- приглашение ревьюеру; ревью стартует ТОЛЬКО после accept
  id, chapter_id→chapters, revision, to_handle→users.handle, as_lead,
  note, status(pending|accepted|declined|flagged), flag_reason, invited_at, responded_at
reviewer_ratings             -- приватно (ревьюер+админ); в «Топ» идёт только агрегат
  chapter_id→chapters, reviewer_handle→users.handle, by_handle→users.handle (автор),
  stars(1..5), created_at; PK(chapter_id, reviewer_handle, by_handle)
recruit_requests             -- автор→админ «найдите ревьюеров»
  id, chapter_id→chapters, by_handle→users.handle, skills(JSON[]),
  status(pending|approved|rejected), reason, created_at, resolved_at
board_calls                  -- публичная доска «Ищем ревьюеров» (ведёт админ)
  id, area, skills(JSON[]), waiting, note, hot
reviewer_applications        -- apply-to-review с доски (by_handle null = гость)
  id, by_handle→users.handle, name, area, skills(JSON[]), message,
  status(pending|accepted|declined), created_at
promo_banners                -- карусель промо на ленте (админ)
  id, eyebrow, title, cta, tone, icon, action(internal|external|donate),
  target, cover_url, visible, sort
donation_methods             -- модалка «Поддержать» (админ); QR — загрузка, без генерации
  id, name, type(link|qr), url, qr_url, hint, visible, is_primary, sort
  -- + singleton-флаг donations_enabled (settings/kv)
```

**Ключевые ограничения.**
- Engagement-таблицы (`*_votes`, `bookmarks`, `follows`) — `uniqueIndex` + `db.transaction()` для
  race-safe toggle (select-then-insert-or-delete). Нарушение уникальности = баг в toggle-логике.
- `public_comments` к **старой** ревизии помечаются stale и уезжают в спойлер «прошлые версии».
- Автор не голосует за свои главы; пользователь — за свои комментарии (проверки на уровне API).
- `is_blocked=1` скрывает все блоги автора во всех поверхностях; `commenting_blocked=1` блокирует комментарии/голоса.

---

## 5. Полный флоу тестового стенда

Этот флоу выполняется автоматически перед каждым прогоном (см. сабагент `playwright-tester`).

```bash
# 0. Сброс тест-БД к фиксированному seed (затрагивает ТОЛЬКО blog.test.db)
bash .claude/playwright-tester/reset-test-db.sh      # migrate + seed:test

# 1. Поднять/дождаться тест-сервер на 3001
bash .claude/playwright-tester/healthcheck.sh 60 http://localhost:3001
#   exit 1 → подсказать: npm run dev:test

# 2. Залогинить роли (cookies в /tmp/*_cookies.txt)
BASE_URL=http://localhost:3001 bash .claude/playwright-tester/login.sh admin   "$ADMIN_PASSWORD_PLAIN"
BASE_URL=http://localhost:3001 bash .claude/playwright-tester/login.sh reader   password
BASE_URL=http://localhost:3001 bash .claude/playwright-tester/login.sh author   password
BASE_URL=http://localhost:3001 bash .claude/playwright-tester/login.sh reviewer password
#   admin → POST /api/auth ; пользователи → POST /api/auth/user (РАЗНЫЕ эндпоинты!)

# 3. Прогон тестов (Playwright MCP для исследования / @playwright/test для спеков)

# 4. (опц.) Проверка состояния БД без знания SQL
DB_PATH=blog.test.db bash .claude/playwright-tester/db-query.sh chapters
DB_PATH=blog.test.db bash .claude/playwright-tester/db-query.sh user reviewer

# 5. Чистка: проще всего повторный reset
bash .claude/playwright-tester/reset-test-db.sh
```

**Тестовые аккаунты после seed:**

| Роль | Никнейм | Пароль |
|------|---------|--------|
| Читатель | `reader` | `password` |
| Автор | `author` | `password` |
| Ревьюер | `reviewer` | `password` |
| Админ | — | `ADMIN_PASSWORD_PLAIN` из `.env.test` |

**Что обязан содержать детерминированный seed (`seed-test.ts`):**
- по одному пользователю на каждую из 4 ролей (+ 2–3 доп. ревьюера для команды/смены ведущего);
- блог автора с **несколькими главами во всех статусах**: `draft`, `under-review`,
  `changes-requested`, `published`;
- у опубликованной главы — **две ревизии** с `prev_blocks` (чтобы работал инлайн-дифф и кредит по версиям);
- треды: `open` и `resolved`, минимум один с `suggestion` (для apply-and-close);
- сообщения `review_chat` (несколько участников);
- `chapter_reviewers` с назначенным **ведущим** и разными вердиктами; `reviewer_history` на 2 версии;
- публичные комментарии: к текущей и к **старой** ревизии, нить читатель→автор→читатель,
  один в пределах окна правки (≤15 мин) и один за его пределами;
- портфолио «Об авторе» (видимое и скрытое состояния покрыть кейсами);
- одна жалоба (`reports`) и одна заявка на смену ведущего (`primary_change_requests`);
- **engagement-слой:** подписка читателя на автора (`follows`), закладка (`bookmarks`),
  голоса за главу и за комментарий (`chapter_votes`, `comment_votes`) — чтобы счётчики/состояния
  кнопок были ненулевыми и тесты toggle имели «уже включённое» состояние;
- **уведомления (`notifications`):** прочитанное и непрочитанное (бейдж > 0 сразу после seed),
  включая тип «новая глава у подписки» и «ваш ход в ревью»;
- один пользователь с `commenting_blocked=1` и один автор с `is_blocked=1` (скрытый блог) —
  для негативных кейсов гейтинга.

> Детерминизм: фиксированные `id`/`slug`/`createdAt` (или сид-генератор), чтобы повтор `seed:test`
> давал идентичный снимок и тесты не флакали.

---

## 6. Прод-стенд (VPS) и runbook — Фаза 12

Прод — VPS Ubuntu 24.04 (Хельсинки, 1 vCPU / 2 ГБ / 30 ГБ NVMe; рядом в Docker живёт AmneziaWG —
его порты 51820/udp + 51821/tcp в ufw не трогать). Все конфиги — в каталоге **`deploy/`** репозитория.

### 6.1 Layout сервера

```
/srv/recenza/
├── current -> releases/<релиз>     # симлинк на активный релиз
├── releases/<sha>/                 # standalone-артефакты (server.js, .next, node_modules, drizzle, scripts)
├── shared/
│   ├── env                         # рантайм-секреты (chmod 600 recenza:recenza) — НЕ в релизах
│   ├── data/blog.prod.db           # SQLite прода (переживает релизы)
│   └── uploads/                    # /api/uploads пишет сюда; отдаёт Caddy по /uploads/*
├── backups/                        # ночные blog-*.db + uploads-*.tar.gz (ротация 7)
└── bin/backup.sh
```

systemd: `recenza.service` (Node standalone, **строго один инстанс** — in-memory rate-limit),
`recenza-publish.timer` (cron отложенной публикации, каждые 5 мин, Bearer `CRON_SECRET`),
`recenza-backup.timer` (03:30). Reverse-proxy — Caddy (`/etc/caddy/Caddyfile`): авто-TLS, HSTS,
`/uploads/*` с диска, остальное → `127.0.0.1:3000`.

### 6.2 Прод-env (`/srv/recenza/shared/env`)

systemd EnvironmentFile, значения в одинарных кавычках. ⚠️ Экранирование `\$` НЕ нужно
(dotenv-expand-проходов нет — в отличие от `.env.local`/`.env.test`).
Обязательные: `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`, `CRON_SECRET`,
`NEXT_PUBLIC_BASE_URL=https://recenza.ru`, `DB_FILE_NAME=/srv/recenza/shared/data/blog.prod.db`,
`UPLOADS_DIR=/srv/recenza/shared/uploads`, `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=127.0.0.1`.

### 6.3 Деплой

Автоматически: push в `main` → workflow `deploy.yml` (сборка standalone c
`NEXT_PUBLIC_BASE_URL` в билде → rsync в `releases/<sha>` → `scripts/migrate.mjs` (миграции
`drizzle/` без drizzle-kit) → симлинк `current` → `sudo systemctl restart recenza` → health-check).
Секреты workflow: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (GitHub Secrets).
Провижининг нового сервера — однократно `deploy/provision.sh` (root; параметры
`AMNEZIA_UDP_PORT`, `DEPLOY_PUBKEY`).

### 6.4 Runbook

- **Откат релиза:** `ln -sfn /srv/recenza/releases/<прежний> /srv/recenza/current &&
  sudo systemctl restart recenza`. Миграции only-forward (аддитивные) — откат кода безопасен.
- **Ручной прогон cron:** `. /srv/recenza/shared/env; curl -H "Authorization: Bearer $CRON_SECRET"
  http://127.0.0.1:3000/api/cron/publish` (или `systemctl start recenza-publish.service`).
- **Восстановление из бэкапа:** остановить сервис → скопировать `backups/blog-<ts>.db` в
  `shared/data/blog.prod.db` → распаковать `uploads-<ts>.tar.gz` в `shared/` → старт. Offsite-копии — backlog.
- **Ротация секретов:** правка `shared/env` → `sudo systemctl restart recenza`. Смена
  `ADMIN_PASSWORD_HASH` = смена пароля админа (bcrypt, без экранирования).
- **Логи:** `journalctl -u recenza -f`; Caddy: `journalctl -u caddy -f`.
- **SSH:** только по ключам (PasswordAuthentication no); деплой-пользователь `recenza`
  (sudo — только `systemctl restart recenza`).
- **AmneziaWG на этом же сервере (гоча, исправлено 2026-07-09):** в конфиге wg-easy
  (`/root/.amnezia-wg-easy/wg0.{json,conf}`) серверный `Address` интерфейса `wg0` был по ошибке
  равен публичному IP (`91.184.243.106/24`) вместо `10.8.0.1/24` — для VPN-клиентов адрес
  recenza.ru становился «локальным» адресом туннеля, и сайт через собственный VPN не открывался
  (Connection refused). Серверный Address исправлен на `10.8.0.1`; клиентские конфиги
  перевыпускать не нужно. Бэкапы: `wg0.*.pre-hairpin-fix` рядом.

### 6.5 SSH-доступ: как добавить свой ключ (для админства и сессий Claude Code)

Вход на сервер — **только по ключам** (пароли отключены). Автодеплой это не касается — его ключ
живёт в GitHub Secrets. Но для ручного захода (диагностика, runbook-операции, будущие сессии
Claude Code) на сервере должен лежать **твой** публичный ключ. Разовая процедура:

**Шаг 1. Сгенерируй пару ключей на своём ПК** (Windows, PowerShell или Git Bash):

```bash
ssh-keygen -t ed25519 -C "recenza-admin" -f ~/.ssh/recenza_ed25519
# passphrase — по желанию (Enter = без неё)
```

Появятся два файла: `~/.ssh/recenza_ed25519` (**приватный** — никому и никуда, НЕ в git)
и `~/.ssh/recenza_ed25519.pub` (**публичный** — его и добавляем на сервер).

**Шаг 2. Добавь публичный ключ на сервер** — любым из способов:

- **(а) Через сессию Claude Code, у которой уже есть SSH-доступ** — просто пришли содержимое
  `.pub`-файла в чат и попроси добавить. Claude выполнит:
  ```bash
  echo '<содержимое recenza_ed25519.pub>' >> /root/.ssh/authorized_keys
  ```
- **(б) Через веб-консоль хостера** (VNC/Rescue в панели VPS — работает даже без SSH):
  залогинься root-ом и выполни ту же команду `echo '<...>' >> /root/.ssh/authorized_keys`.
- **(в) С машины, у которой уже есть рабочий ключ**:
  `ssh -i <старый_ключ> root@91.184.243.106 "echo '<...>' >> /root/.ssh/authorized_keys"`.

⚠️ `ssh-copy-id` по паролю НЕ сработает — парольный вход выключен (`PasswordAuthentication no`).

**Шаг 3. Проверь вход:**

```bash
ssh -i ~/.ssh/recenza_ed25519 root@91.184.243.106 "hostname && systemctl is-active recenza"
```

**Шаг 4. Как этим пользуются сессии Claude Code:** в начале сессии, где нужен сервер, скажи
«ключ лежит в `~/.ssh/recenza_ed25519`» — дальше Claude ходит сам:
`ssh -i ~/.ssh/recenza_ed25519 root@91.184.243.106 "<команда>"`. Для деплой-операций без root
есть пользователь `recenza` (тот же ключ можно добавить и ему: `/home/recenza/.ssh/authorized_keys`).

> Приватный ключ не коммитить, не пересылать и не вставлять в чат — в чат идёт ТОЛЬКО `.pub`.
> Потерял приватный ключ → просто повтори процедуру с новым, старую строку из
> `authorized_keys` удали.

**Изоляция стендов (критический инвариант релиза):** разные БД, разные env, разные URL, разные
секреты. Ни один тест не ходит на прод; ни один прод-секрет не лежит в `.env.test`/репозитории.
Dev с Фазы 12 снова на `file:blog.db` (Turso-креды заархивированы комментарием в `.env.local`).
