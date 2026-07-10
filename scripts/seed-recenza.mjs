// Идемпотentный additive-сид служебного контента. Секции независимы, каждая — no-op при повторе:
//   1) «О Recenza» (ui-feedback-3, П13): автор «Recenza» + приветственный блог из 5 published-глав.
//   2) recruit-баннер карусели (ui-feedback-4, П7): тексты прототипа «Ищем ревьюеров» /
//      «Стать ревьюером» — INSERT первым слайдом, если строки нет (прод сидился не из seed-core);
//      UPDATE только пока title равен старому сидовому (правки админа не трогаем).
// НЕ seedAll: ничего не удаляет, существующие данные не трогает. Паттерн — scripts/migrate.mjs:
// plain JS, prod-зависимости (drizzle-orm + @libsql/client + ulid + bcryptjs; deploy.yml докладывает
// их в артефакт), схема TS не импортируется — минимальные inline-определения нужных таблиц
// (snake_case как в schema.ts). Ревизии вставляются сразу status="published" (как seed-core §5) —
// служебный контент, минуя ревью. Пароль автора — случайный и не сохраняется: задать при
// необходимости может админ (PATCH /api/admin/users/recenza c { password }).
//
// Запуск: локально `./node_modules/.bin/dotenv -e .env.local -- node scripts/seed-recenza.mjs`;
// на проде: cd /srv/recenza/current && set -a; . /srv/recenza/shared/env; set +a; node scripts/seed-recenza.mjs
// (перед первым прогоном — бэкап: cp /srv/recenza/shared/data/blog.prod.db /srv/recenza/backups/...).

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

// ── Минимальные определения таблиц (только вставляемые колонки; notNull-дефолты БД покрывают остальное) ──

const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull(),
  role: text("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  slug: text("slug").notNull(),
  createdAt: integer("created_at").notNull(),
});

const blogs = sqliteTable("blogs", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  authorId: text("author_id").notNull(),
  tags: text("tags"),
  complexity: text("complexity").notNull(),
  summary: text("summary"),
  publishedAt: integer("published_at"),
  lastActivityAt: integer("last_activity_at"),
});

const chapters = sqliteTable("chapters", {
  id: text("id").primaryKey(),
  blogId: text("blog_id").notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  order: integer("order").notNull(),
});

const chapterRevisions = sqliteTable("chapter_revisions", {
  id: text("id").primaryKey(),
  chapterId: text("chapter_id").notNull(),
  number: integer("number").notNull(),
  status: text("status").notNull(),
  summary: text("summary"),
  blocks: text("blocks"),
  publishedAt: integer("published_at"),
});

const promoBanners = sqliteTable("promo_banners", {
  id: text("id").primaryKey(),
  eyebrow: text("eyebrow"),
  title: text("title").notNull(),
  cta: text("cta"),
  tone: text("tone"),
  icon: text("icon"),
  action: text("action"),
  target: text("target"),
  visible: integer("visible", { mode: "boolean" }).notNull(),
  sort: integer("sort").notNull(),
});

// ── Контент: блоки канонической формы validate.ts/normalize.ts (p/h2/quote/list/callout) ──

const b = {
  p: (t) => ({ id: ulid(), type: "p", text: t }),
  h2: (t) => ({ id: ulid(), type: "h2", text: t }),
  quote: (t) => ({ id: ulid(), type: "quote", text: t }),
  list: (items, variant = "bullet") => ({ id: ulid(), type: "list", variant, items }),
  callout: (t, variant = "note") => ({ id: ulid(), type: "callout", variant, text: t }),
};

const CHAPTERS = [
  {
    slug: "dobro-pozhalovat",
    title: "Добро пожаловать в Recenza",
    summary: "Что такое Recenza: многоглавные девблоги с редакционным ревью и четыре роли платформы.",
    blocks: [
      b.p("Привет! Вы читаете первый блог на **Recenza** — платформе многоглавных девблогов, где каждая статья проходит редакционное ревью до публикации."),
      b.callout("Recenza работает в режиме альфы: аккаунты создаёт администратор, а функциональность продолжает расти. Этот блог — живое руководство по платформе."),
      b.h2("Что такое Recenza"),
      b.p("Recenza — это место, где технические статьи публикуются *сериями глав*: блог растёт со временем, как хорошая книга. Прежде чем глава попадёт к читателю, её проверяют ревьюеры — люди с подходящими навыками."),
      b.list([
        "**Читатели** голосуют за главы, комментируют фрагменты и собирают личную полку закладок.",
        "**Авторы** пишут в блочном редакторе и отправляют главы на ревью.",
        "**Ревьюеры** проверяют статьи по своим компетенциям и ставят вердикты.",
        "**Администратор** модерирует платформу и помогает авторам найти ревьюеров.",
      ]),
      b.p("В следующих главах — подробнее о миссии и о том, что умеет каждая роль."),
    ],
  },
  {
    slug: "nasha-missiya",
    title: "Наша миссия",
    summary: "Почему у технической статьи должны быть рецензенты и как ревью делает тексты достойными доверия.",
    blocks: [
      b.p("Технический интернет переполнен текстами, которые никто не проверял. Часть из них устарела, часть — просто ошибается. Читателю приходится самому отделять полезное от вредного."),
      b.quote("Мы верим, что у технической статьи должен быть не только автор, но и рецензенты — как у научной публикации."),
      b.h2("Качество выше скорости"),
      b.p("Recenza сознательно замедляет публикацию: глава выходит только после того, как **все** приглашённые ревьюеры её одобрили. Взамен читатель получает текст, за которым стоит не одно имя, а команда."),
      b.p("Ревьюеры указываются на каждой опубликованной главе — репутация проверяющих работает на доверие к материалу. История версий сохраняется: видно, как статья менялась от ревизии к ревизии."),
    ],
  },
  {
    slug: "chitatelyam",
    title: "Читателям",
    summary: "Голоса, закладки, подписки и комментарии с привязкой к фрагменту — инструменты читателя Recenza.",
    blocks: [
      b.p("Читать Recenza можно без аккаунта. С аккаунтом читателя появляются инструменты участия:"),
      b.list([
        "**Голоса** — поднимайте полезные главы выше; один голос на главу, его можно отозвать.",
        "**Закладки** — личная коллекция блогов, доступна из меню аватара.",
        "**Подписки** — следите за автором: уведомление о новой главе придёт в колокольчик.",
        "**Комментарии** — обсуждение под каждой главой.",
      ]),
      b.p("Комментарии можно привязывать к конкретному фрагменту статьи — ссылка вернёт любого читателя точно к нужному абзацу. Ветки растут до двух уровней, на правку своего комментария даётся 15 минут."),
      b.callout("Комментарии к старым ревизиям не пропадают — они сворачиваются в спойлер «прошлые версии» под главой.", "info"),
    ],
  },
  {
    slug: "avtoram",
    title: "Авторам",
    summary: "Блочный редактор, отправка на ревью с приглашениями и публикация после одобрения всех ревьюеров.",
    blocks: [
      b.p("Авторский кабинет строится вокруг блогов и глав. Внутри — блочный редактор, писать в котором можно не отрывая рук от клавиатуры."),
      b.list([
        "12 типов блоков: текст, заголовки, цитаты, списки, код с подсветкой, callout-врезки, таблицы, изображения, embed, схемы Mermaid и формулы LaTeX.",
        "Markdown-шорткаты в начале строки (`## `, `> `, `- `, ` ``` `) и слэш-меню по «/».",
        "Инлайн-разметка выделением: жирный, курсив, код, ссылки.",
      ]),
      b.h2("Путь главы к читателю"),
      b.p("Готовую главу автор отправляет на ревью: указывает **ключевые навыки статьи** и приглашает ревьюеров, чьи компетенции совпадают. Ревью начинается только после согласия ревьюера — ответ приходит сразу."),
      b.p("Когда все ревьюеры одобрили ревизию, автор публикует главу — сразу или по расписанию. Если подходящих ревьюеров не нашлось, запрос уходит администратору, и направление появляется на публичной доске «Ищем ревьюеров»."),
    ],
  },
  {
    slug: "revyueram",
    title: "Ревьюерам",
    summary: "Приглашения по навыкам, треды замечаний, вердикты и приватная оценка — работа ревьюера на Recenza.",
    blocks: [
      b.p("Ревьюер — отдельная роль со своим кабинетом. Ревьюеры не ведут блоги и не пишут публичные комментарии: их работа — качество чужих статей."),
      b.list([
        "**Приглашения** — авторы зовут вас по совпадению навыков; ревью начинается после вашего согласия.",
        "**Треды замечаний** — комментарии к фрагментам с предложениями правок; автор применяет их одним действием.",
        "**Вердикты** — «одобрить» или «нужны правки» по каждой ревизии.",
        "**Чат сессии** — обсуждение с автором и командой вне тредов.",
      ]),
      b.p("После публикации автор приватно оценивает работу ревьюера. Наружу выходит только агрегат — он влияет на позицию в подборе «Топ»: навыки 50%, рейтинг 30%, объём 20%."),
      b.callout("Хотите стать ревьюером? Загляните на доску «Ищем ревьюеров» — открытые направления ждут заявок."),
    ],
  },
];

// ── Прогон ──

const url = process.env.TURSO_CONNECTION_URL?.trim() || `file:${process.env.DB_FILE_NAME || "blog.db"}`;
const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

const client = createClient({ url, authToken });
await client.execute("PRAGMA foreign_keys = ON;");
const db = drizzle(client);

console.log(`[seed-recenza] БД: ${url.startsWith("file:") ? url : "Turso"}`);

const now = Math.floor(Date.now() / 1000);

// ── Секция 1: блог «О Recenza» (идемпотентно: существует → no-op) ──

async function seedAboutBlog() {
  const existingBlog = (await db.select({ id: blogs.id }).from(blogs).where(eq(blogs.slug, "o-recenza")).limit(1))[0];
  if (existingBlog) {
    console.log("[seed-recenza] блог «О Recenza» уже существует — секция пропущена (no-op).");
    return;
  }

  await db.transaction(async (tx) => {
    let authorId;
    const existingUser = (
      await tx.select({ id: users.id, role: users.role }).from(users).where(eq(users.handle, "recenza")).limit(1)
    )[0];
    if (existingUser) {
      if (existingUser.role !== "author") {
        // binding-инвариант: блог может вести только author — не вешаем контент на чужую роль.
        throw new Error(`пользователь recenza уже существует с ролью "${existingUser.role}" (нужен author) — сид остановлен.`);
      }
      authorId = existingUser.id;
      console.log("[seed-recenza] пользователь recenza уже существует — переиспользуем.");
    } else {
      authorId = ulid();
      await tx.insert(users).values({
        id: authorId,
        handle: "recenza",
        role: "author",
        passwordHash: bcrypt.hashSync(randomBytes(24).toString("base64url"), 10),
        displayName: "Recenza",
        bio: "Официальный блог платформы: как устроена Recenza и зачем мы её делаем.",
        slug: "recenza",
        createdAt: now,
      });
      console.log("[seed-recenza] создан автор recenza (пароль случайный; задаётся админом при необходимости).");
    }

    const blogId = ulid();
    await tx.insert(blogs).values({
      id: blogId,
      slug: "o-recenza",
      title: "О Recenza",
      authorId,
      tags: JSON.stringify(["Recenza", "о платформе", "руководство"]),
      complexity: "simple",
      summary: "Что такое Recenza, зачем статьям редакционное ревью и что умеет каждая роль — от читателя до ревьюера.",
      publishedAt: now,
      lastActivityAt: now,
    });

    for (const [i, ch] of CHAPTERS.entries()) {
      const chapterId = ulid();
      await tx.insert(chapters).values({
        id: chapterId,
        blogId,
        slug: ch.slug,
        title: ch.title,
        order: i + 1,
      });
      await tx.insert(chapterRevisions).values({
        id: ulid(),
        chapterId,
        number: 1,
        status: "published",
        summary: ch.summary,
        blocks: JSON.stringify(ch.blocks),
        publishedAt: now,
      });
    }
  });

  console.log(`[seed-recenza] готово: блог «О Recenza» (/blog/o-recenza), глав: ${CHAPTERS.length}.`);
}

// ── Секция 2: recruit-баннер карусели с текстами прототипа (ui-feedback-4, П7).
//    Идемпотентно и не затирает ручные правки админа:
//    - строки pb_recruit нет (прод сидился не из seed-core) → INSERT первым слайдом (sort = min−1);
//    - строка есть со старым сидовым title → UPDATE текстов;
//    - строка есть и уже изменена → no-op. ──

async function upsertRecruitBanner() {
  const PROTO = { eyebrow: "Ищем ревьюеров", title: "Рецензируйте статьи по своим навыкам", cta: "Стать ревьюером", icon: "pen" };
  const row = (await db.select({ id: promoBanners.id, title: promoBanners.title }).from(promoBanners).where(eq(promoBanners.id, "pb_recruit")).limit(1))[0];
  if (!row) {
    const sorts = (await db.select({ sort: promoBanners.sort }).from(promoBanners)).map((r) => r.sort);
    const sort = sorts.length > 0 ? Math.min(...sorts) - 1 : 0;
    await db.insert(promoBanners).values({
      id: "pb_recruit",
      ...PROTO,
      tone: "teal",
      action: "internal",
      target: "/board",
      visible: true,
      sort,
    });
    console.log(`[seed-recenza] баннер pb_recruit создан первым слайдом (sort=${sort}): «Ищем ревьюеров» / «Стать ревьюером».`);
    return;
  }
  if (row.title === PROTO.title) {
    console.log("[seed-recenza] баннер pb_recruit уже актуален — секция пропущена (no-op).");
    return;
  }
  if (row.title !== "Станьте ревьюером Recenza") {
    console.log("[seed-recenza] баннер pb_recruit уже изменён (вероятно, админом) — секция пропущена (no-op).");
    return;
  }
  await db.update(promoBanners).set(PROTO).where(eq(promoBanners.id, "pb_recruit"));
  console.log("[seed-recenza] баннер pb_recruit обновлён до текстов прототипа («Ищем ревьюеров» / «Стать ревьюером»).");
}

await seedAboutBlog();
await upsertRecruitBanner();

process.exit(0); // libsql держит соединение (гоча seed-скриптов)
