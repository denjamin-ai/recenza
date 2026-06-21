// P10.1 + R0 — Blog data model with curated demo pool.
//
// Removed: noisy single-chapter "legacy" blogs that had no value for the demo.
// Kept: 3 classic single-chapter articles + 3 multi-chapter blogs:
//   • "Next.js 16 в проде: серия из практики"   — 3 chapters (1 published / 1 under-review / 1 draft)
//   • "Drizzle для SQLite: с нуля до прода"       — 4 chapters (3 published / 1 under-review)
//   • "MDX как движок блога: ремонт под ключ"     — 3 chapters (all 3 published)
//
// Extends window.__blogData with chapter-aware helpers (additive — legacy
// getArticleBySlug etc. still work for surfaces that haven't migrated).

(function () {
  const F = window.FAKE_DATA;
  if (!F || !F.articles) return;

  // (Legacy auto-wrap of FAKE_DATA.articles into single-chapter blogs was
  //  removed — all blogs are now hand-authored below. FAKE_DATA.articles is
  //  still read by the admin user-detail / report-detail screens.)

  // ── Multi-chapter demo 1: Next.js 16 series (existing, kept) ──────────────
  const nextjsBlog = {
    id: "blog-nextjs-series",
    slug: "nextjs-16-series",
    title: "Next.js 16 в проде: практика",
    authorSlug: "alex",
    cover: null,
    tags: ["Next.js", "App Router", "RSC"],
    complexity: "complex",
    summary: "Три эссе из живых проектов: границы между server и client, Server Actions в проде, и что делать с кешем когда он работает против вас.",
    publishedAt: 1746489600,
    lastActivityAt: 1747180800,
    viewCount: 2840,
    rating: 67,
    bookmarkCount: 142,
    chapters: [
      {
        id: "ch-1", slug: "boundaries", title: "Границы между server и client", order: 0,
        blocks: [
          { id: "b1-intro",  type: "p",  text: "Сервер и клиент в App Router — это не разные слои одного приложения, а два разных рантайма. Граница между ними — это контракт о том, что выполняется где и какие данные текут в какую сторону." },
          { id: "b1-h-rule", type: "h2", text: "Правило одного клиента" },
          { id: "b1-p-rule", type: "p",  text: "Самая частая ошибка — поставить «use client» в начало файла с половиной приложения. Извлекайте только интерактивный кусочек: всё остальное должно остаться серверным." },
          { id: "b1-code",   type: "code", lang: "tsx", text: "'use client';\nexport function TitleField({ defaultValue }: Props) {\n  const [value, setValue] = useState(defaultValue);\n  return <input value={value} onChange={…} />;\n}" },
          { id: "b1-h-end",  type: "h2", text: "Итог главы" },
          { id: "b1-end",    type: "p",  text: "Граница — это контракт. Делайте её маленькой и явной, и App Router сам всё расставит." },
        ],
        prevBlocks: [],
        revision: { number: 3, status: "published", summary: "", submittedAt: 1746489600, publishedAt: 1746489600 },
        primaryHandle: "dm.k", reviewerHandles: ["dm.k", "kostya"],
        state: { "dm.k": { verdict: "approve", verdictAt: 1746489600 }, "kostya": { verdict: "approve", verdictAt: 1746489600 } },
        // Earlier revisions were reviewed by a different team — kept so the
        // article can credit everyone who ever worked on the chapter.
        reviewerHistory: [
          { revision: 1, handles: ["ira.m"] },
          { revision: 2, handles: ["ira.m", "dm.k"] },
        ],
        threads: [], chat: [], openThreads: 0, lastActivityAt: 1746489600, hasMyTurn: false, stalledFor: 0,
      },
      {
        id: "ch-2", slug: "server-actions", title: "Server Actions в проде: формы, мутации, ошибки", order: 1,
        blocks: [
          { id: "b2-intro",   type: "p",  text: "С Next.js 16 Server Actions наконец стали stable, и мы переписали половину форм в проде. Делюсь, что работает, а что — нет." },
          { id: "b2-h-form",  type: "h2", text: "Форма как Server Action" },
          { id: "b2-p-form",  type: "p",  text: "Server Action — это функция с директивой «use server», которую можно передать в action атрибут формы. Никакого fetch к /api, никакого useState для inflight-состояния — useFormStatus из react-dom отдаёт его сам.", editedSpans: ["useFormStatus из react-dom отдаёт его сам"] },
          { id: "b2-code",    type: "code", lang: "tsx", status: "edited",
            text: "// app/actions.ts\n'use server';\nexport async function createPost(form: FormData) {\n  const title = form.get('title')?.toString().trim();\n  if (!title) return { error: 'Заголовок обязателен' };\n  await db.posts.insert({ title });\n  revalidatePath('/posts');\n  return { ok: true };\n}",
            prev: "// app/actions.ts\nexport async function createPost(form: FormData) {\n  const title = form.get('title');\n  await db.posts.insert({ title });\n}" },
          { id: "b2-diag",    type: "mermaid", status: "added", text: "graph LR\n  A[Browser form] --> B[Server Action]\n  B --> C[(Database)]\n  B -.->|revalidate| D[Cache layer]\n  D --> A" },
          { id: "b2-h-err",   type: "h2", status: "added", text: "Ошибки и валидация" },
          { id: "b2-p-err-1", type: "p",  status: "added", text: "Server Action не бросает 500 при провале валидации — он возвращает значение. Тип возврата — это часть контракта." },
          { id: "b2-callout", type: "callout", tone: "warning", status: "added", text: "Не используйте throw в Server Action для валидационных ошибок. Это превращается в 500 на клиенте, а пользователь видит белый экран." },
          { id: "b2-p-err-2", type: "p",  status: "added", text: "На клиенте useActionState (бывший useFormState) даёт типизированный объект и автоматический pending-стейт." },
          { id: "b2-h-when",  type: "h2", text: "Когда Server Action — не вариант" },
          { id: "b2-p-when",  type: "p",  text: "Оптимистические обновления, drag-and-drop, мультишаговые мастера — всё ещё клиент." },
        ],
        prevBlocks: [
          { id: "b2-intro",   type: "p",  text: "С Next.js 16 Server Actions наконец стали stable, и мы переписали половину форм в проде. Делюсь, что работает, а что — нет." },
          { id: "b2-h-form",  type: "h2", text: "Форма как Server Action" },
          { id: "b2-p-form",  type: "p",  text: "Server Action — это функция с директивой «use server», которую можно передать в action атрибут формы. Никакого fetch к /api, никакого useState для inflight-состояния." },
          { id: "b2-code",    type: "code", lang: "tsx", text: "// app/actions.ts\nexport async function createPost(form: FormData) {\n  const title = form.get('title');\n  await db.posts.insert({ title });\n}" },
          { id: "b2-h-when",  type: "h2", text: "Когда Server Action — не вариант" },
          { id: "b2-p-when",  type: "p",  text: "Оптимистические обновления, drag-and-drop, мультишаговые мастера — всё ещё клиент." },
        ],
        revision: { number: 2, status: "under-review", summary: "Добавил раздел про ошибки/валидацию и диаграмму потока.", submittedAt: 1747094400, deadline: 1747700000 },
        primaryHandle: "dm.k", reviewerHandles: ["dm.k", "kostya", "ira.m"],
        state: {
          "dm.k":   { verdict: null, verdictAt: null, online: true,  typing: false },
          "kostya": { verdict: "approve", verdictAt: 1747105200, online: false, typing: false },
          "ira.m":  { verdict: null, verdictAt: null, online: false, typing: false },
        },
        threads: [
          { id: "ch2-t1", blockId: "b2-p-form", anchor: "useFormStatus из react-dom отдаёт его сам", status: "open", from: "dm.k", text: "Не во всех браузерах useFormStatus работает с server actions без пакета 'react-dom/client'. Можешь сослаться на доку?", replies: [{ from: "alex", text: "В Next.js 16 это вшито — само работает. Сейчас дам ссылку." }]},
          { id: "ch2-t2", blockId: "b2-code", anchor: "revalidatePath", status: "open", from: "dm.k", text: "Лучше revalidateTag — он точечный. revalidatePath инвалидирует всю страницу.", suggestion: { from: "revalidatePath('/posts');", to: "revalidateTag('posts');" }, replies: []},
          { id: "ch2-t3", blockId: "b2-diag", anchor: "revalidate", status: "open", from: "dm.k", text: "Стрелка B → D должна быть пунктирной. У тебя сплошная.", replies: []},
          { id: "ch2-t4", blockId: "b2-callout", anchor: "белый экран", status: "resolved", from: "dm.k", text: "Слишком драматично. «Ошибку, которую не поймает error boundary» точнее.", replies: [{ from: "alex", text: "Применил и закрыл." }]},
          { id: "ch2-t5", blockId: "b2-p-err-2", anchor: "useActionState", status: "open", from: "ira.m", text: "Под капотом useActionState всё ещё useFormState с новой сигнатурой — стоит упомянуть.", replies: []},
        ],
        chat: [{ id: "msg-1", from: "kostya", at: 1747094800, text: "Одобряю остальное." }],
        openThreads: 4, lastActivityAt: 1747112400, hasMyTurn: true, stalledFor: 0,
      },
      {
        id: "ch-3", slug: "caching", title: "Кеш в App Router: revalidate, tags, и когда отключать", order: 2,
        blocks: [
          { id: "b3-intro", type: "p", text: "Кеш в App Router — это не один кеш, а четыре. Если вы понимаете, какой из них активирован, проблем не будет." },
          { id: "b3-h",     type: "h2", text: "Четыре кеша" },
          { id: "b3-list",  type: "list", subtype: "numbered", items: [
            { id: "i1", text: "Request memoization — внутри одного запроса" },
            { id: "i2", text: "Data Cache — постоянный, для fetch()" },
            { id: "i3", text: "Full Route Cache — для server-rendered страниц" },
            { id: "i4", text: "Router Cache — на клиенте" },
          ]},
          { id: "b3-todo",  type: "p", text: "TODO: пример с revalidateTag, секция про force-dynamic, таблица «когда какой кеш сбрасывается»." },
        ],
        prevBlocks: [],
        revision: { number: 1, status: "draft", summary: "" },
        primaryHandle: null, reviewerHandles: [], state: {},
        threads: [], chat: [], openThreads: 0, lastActivityAt: 1747180000, hasMyTurn: false, stalledFor: 0,
      },
    ],
  };

  // ── Multi-chapter demo 2: Drizzle серия — fully published 4 chapters ─────
  const drizzleBlog = {
    id: "blog-drizzle-series",
    slug: "drizzle-sqlite-series",
    title: "Drizzle для SQLite: с нуля до прода",
    authorSlug: "alex",
    cover: null,
    tags: ["Drizzle", "SQLite", "Migrations"],
    complexity: "medium",
    summary: "Четыре главы практики: схемы, миграции, перформанс и боевые ошибки — как поставить Drizzle в SQLite-проект и не пожалеть.",
    publishedAt: 1745020800,
    lastActivityAt: 1746835200,
    viewCount: 4120,
    rating: 89,
    bookmarkCount: 198,
    chapters: [
      {
        id: "d-1", slug: "schema", title: "Глава 1. Схема и типы — заводим Drizzle", order: 0,
        blocks: [
          { id: "d1-intro", type: "p", text: "Drizzle для SQLite — это инструмент, который даёт типобезопасные запросы без рантайма ORM. Здесь — про то, как мы перевели на него рабочий проект и что узнали в процессе." },
          { id: "d1-h",     type: "h2", text: "Минимальный setup" },
          { id: "d1-p",     type: "p", text: "Установка трёх пакетов и один файл со схемой. Меньше церемоний, чем у любого ORM, и сразу понятно, что куда поедет." },
          { id: "d1-code",  type: "code", lang: "ts", text: "// db/schema.ts\nimport { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';\n\nexport const posts = sqliteTable('posts', {\n  id: integer('id').primaryKey({ autoIncrement: true }),\n  title: text('title').notNull(),\n  body: text('body').notNull(),\n  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),\n});" },
          { id: "d1-h2",    type: "h2", text: "Что получаем «бесплатно»" },
          { id: "d1-list",  type: "list", subtype: "bullet", items: [
            { id: "i1", text: "Типы колонок выводятся в SELECT/INSERT" },
            { id: "i2", text: "Никаких декораторов и метадаты — обычный объект" },
            { id: "i3", text: "Прозрачные SQL-запросы под капотом" },
          ]},
        ],
        prevBlocks: [],
        revision: { number: 2, status: "published", summary: "", publishedAt: 1745020800 },
        primaryHandle: "kostya", reviewerHandles: ["kostya", "ira.m"],
        state: { "kostya": { verdict: "approve", verdictAt: 1745020800 }, "ira.m": { verdict: "approve", verdictAt: 1745020800 } },
        threads: [], chat: [], openThreads: 0, lastActivityAt: 1745020800, hasMyTurn: false, stalledFor: 0,
      },
      {
        id: "d-2", slug: "migrations", title: "Глава 2. Миграции без боли — drizzle-kit и git", order: 1,
        blocks: [
          { id: "d2-intro", type: "p", text: "drizzle-kit генерирует .sql файлы по diff между схемами. Эти файлы — обычный коммит, проходят ревью, мерджатся как код." },
          { id: "d2-code",  type: "code", lang: "sh", text: "$ pnpm drizzle-kit generate\n$ pnpm drizzle-kit migrate\n# .drizzle/0001_add_posts_index.sql теперь в git" },
          { id: "d2-h",     type: "h2", text: "Откат миграции" },
          { id: "d2-p",     type: "p", text: "В SQLite нет CREATE OR REPLACE — приходится дублировать таблицу. drizzle-kit умеет это автоматически, но за деталями стоит подсматривать руками." },
          { id: "d2-callout", type: "callout", tone: "warning", text: "Никогда не редактируйте уже накатившую миграцию вручную. Сделайте новую — она встанет следом по timestamp в имени." },
        ],
        prevBlocks: [],
        revision: { number: 1, status: "published", summary: "", publishedAt: 1745539200 },
        primaryHandle: "kostya", reviewerHandles: ["kostya"],
        state: { "kostya": { verdict: "approve", verdictAt: 1745539200 } },
        threads: [], chat: [], openThreads: 0, lastActivityAt: 1745539200, hasMyTurn: false, stalledFor: 0,
      },
      {
        id: "d-3", slug: "perf", title: "Глава 3. Перформанс — индексы и prepared statements", order: 2,
        blocks: [
          { id: "d3-intro", type: "p", text: "SQLite на ноуте отдаёт миллион rows/sec при выборках по индексам и десятки тысяч — без. Драйвер обычно не виноват." },
          { id: "d3-h",     type: "h2", text: "Где обычно теряется производительность" },
          { id: "d3-list",  type: "list", subtype: "numbered", items: [
            { id: "i1", text: "Запрос без покрывающего индекса (full scan)" },
            { id: "i2", text: "N+1 в map по результату" },
            { id: "i3", text: "JSON-колонки без виртуальных колонок для where" },
          ]},
          { id: "d3-code",  type: "code", lang: "ts", text: "// prepared statement — компилируется один раз\nconst byAuthor = db.select().from(posts).where(eq(posts.authorId, sql.placeholder('a'))).prepare();\nbyAuthor.all({ a: 42 });" },
        ],
        prevBlocks: [],
        revision: { number: 1, status: "published", summary: "", publishedAt: 1746230400 },
        primaryHandle: "kostya", reviewerHandles: ["kostya", "dm.k"],
        state: { "kostya": { verdict: "approve", verdictAt: 1746230400 }, "dm.k": { verdict: "approve", verdictAt: 1746230400 } },
        threads: [], chat: [], openThreads: 0, lastActivityAt: 1746230400, hasMyTurn: false, stalledFor: 0,
      },
      {
        id: "d-4", slug: "battlescars", title: "Глава 4. Боевые ошибки — что мы поломали и как чинили", order: 3,
        blocks: [
          { id: "d4-intro", type: "p", text: "Год в проде, четыре инцидента, два из них — реально из-за Drizzle (а не из-за того, что разработчик не выспался)." },
          { id: "d4-h1",    type: "h2", text: "Инцидент 1: SQLITE_BUSY на чтении из write-транзакции" },
          { id: "d4-p",     type: "p", text: "Длинная транзакция держит EXCLUSIVE лок. Решение — wal-режим и держать транзакции минут на миллисекунды, а не на секунды." },
          { id: "d4-callout", type: "callout", tone: "note", text: "WAL по умолчанию не включён — `PRAGMA journal_mode = WAL;` нужно делать самим при инициализации соединения." },
        ],
        prevBlocks: [],
        revision: { number: 1, status: "under-review", summary: "Финальная глава блога — собрал баги, на которые наступали в проде.", submittedAt: 1746748800, deadline: 1747353600 },
        primaryHandle: "dm.k", reviewerHandles: ["dm.k", "kostya"],
        state: {
          "dm.k":   { verdict: null, verdictAt: null, online: false, typing: false },
          "kostya": { verdict: "approve", verdictAt: 1746835200, online: false, typing: false },
        },
        threads: [
          { id: "d4-t1", blockId: "d4-p", anchor: "EXCLUSIVE лок", status: "open", from: "dm.k", text: "Имеется в виду SHARED→EXCLUSIVE при первом write? Это место запутает читателя — нужен пример конкретной транзакции.", replies: [] },
        ],
        chat: [], openThreads: 1, lastActivityAt: 1746835200, hasMyTurn: true, stalledFor: 0,
      },
    ],
  };

  // ── Multi-chapter demo 3: MDX engine — fully published 3 chapters ────────
  const mdxBlog = {
    id: "blog-mdx-series",
    slug: "mdx-engine-series",
    title: "MDX как движок блога: ремонт под ключ",
    authorSlug: "alex",
    cover: null,
    tags: ["MDX", "Remark", "Rehype"],
    complexity: "simple",
    summary: "Три коротких главы про то, как из MDX и пары плагинов собрать движок блога — без CMS, без Хедлесса, без слёз.",
    publishedAt: 1744156800,
    lastActivityAt: 1744588800,
    viewCount: 1620,
    rating: 41,
    bookmarkCount: 88,
    chapters: [
      {
        id: "m-1", slug: "setup", title: "Глава 1. Базовый setup MDX в Next.js", order: 0,
        blocks: [
          { id: "m1-intro", type: "p", text: "В Next.js MDX из коробки — это просто. Нужно ровно три плагина: next-mdx-remote, remark-gfm, rehype-shiki. Всё остальное добавляется по мере появления реальных требований." },
          { id: "m1-h",     type: "h2", text: "Минимальный setup" },
          { id: "m1-code",  type: "code", lang: "ts", text: "import { compileMDX } from 'next-mdx-remote/rsc';\nimport remarkGfm from 'remark-gfm';\n\nconst { content } = await compileMDX({\n  source: raw,\n  options: { mdxOptions: { remarkPlugins: [remarkGfm] } },\n});" },
        ],
        prevBlocks: [],
        revision: { number: 1, status: "published", summary: "", publishedAt: 1744156800 },
        primaryHandle: "dm.k", reviewerHandles: ["dm.k"],
        state: { "dm.k": { verdict: "approve", verdictAt: 1744156800 } },
        threads: [], chat: [], openThreads: 0, lastActivityAt: 1744156800, hasMyTurn: false, stalledFor: 0,
      },
      {
        id: "m-2", slug: "components", title: "Глава 2. Свои MDX-компоненты — Callout и Code", order: 1,
        blocks: [
          { id: "m2-intro", type: "p", text: "MDX-провайдер принимает мапу компонентов. Подменили <pre> на свой CodeBlock с заголовком и подсветкой — статья сразу стала похожа на «настоящую техническую» без CMS-вкладок." },
          { id: "m2-code",  type: "code", lang: "tsx", text: "export const mdxComponents = {\n  pre: CodeBlock,\n  blockquote: Callout,\n  h2: SectionHeading,\n};" },
          { id: "m2-callout", type: "callout", tone: "info", text: "MDX-компоненты — это просто React-компоненты. Никакого скрытого парсера или DSL. Главное правило — не делать их слишком умными." },
        ],
        prevBlocks: [],
        revision: { number: 1, status: "published", summary: "", publishedAt: 1744329600 },
        primaryHandle: "dm.k", reviewerHandles: ["dm.k"],
        state: { "dm.k": { verdict: "approve", verdictAt: 1744329600 } },
        threads: [], chat: [], openThreads: 0, lastActivityAt: 1744329600, hasMyTurn: false, stalledFor: 0,
      },
      {
        id: "m-3", slug: "performance", title: "Глава 3. Производительность — статика и кеш", order: 2,
        blocks: [
          { id: "m3-intro", type: "p", text: "compileMDX в RSC рендере — это нормально, но при build-time лучше прогнать заранее. У меня все статьи рендерятся в getStaticProps, а потом просто отдаются как JSX." },
          { id: "m3-h",     type: "h2", text: "Где обычно тормозит" },
          { id: "m3-p",     type: "p", text: "Парсинг shiki при первом запросе. Решается prerender'ом + LRU-кешем на скомпилированный AST. Сюда же — таблица performance метрик в проекте на 200 статей." },
        ],
        prevBlocks: [],
        revision: { number: 1, status: "published", summary: "", publishedAt: 1744588800 },
        primaryHandle: "dm.k", reviewerHandles: ["dm.k"],
        state: { "dm.k": { verdict: "approve", verdictAt: 1744588800 } },
        threads: [], chat: [], openThreads: 0, lastActivityAt: 1744588800, hasMyTurn: false, stalledFor: 0,
      },
    ],
  };

  // Hand-authored single-chapter "classic" blogs. Replaces the old auto-wrap
  // of FAKE_DATA.articles which produced empty-chapter shells.
  function singleChapterBlog({ slug, title, authorSlug, tags, summary, publishedAt, viewCount, rating, bookmarkCount, complexity, blocks, primaryHandle, reviewerHandles, reviewerHistory }) {
    const reviewers = reviewerHandles || [primaryHandle].filter(Boolean);
    const state = {};
    reviewers.forEach(h => { state[h] = { verdict: "approve", verdictAt: publishedAt }; });
    return {
      id: "blog-" + slug, slug, title, authorSlug,
      cover: null, tags, complexity: complexity || "medium",
      summary, publishedAt, lastActivityAt: publishedAt,
      viewCount, rating, bookmarkCount,
      chapters: [{
        id: "ch-main", slug: "main", title, order: 0,
        blocks, prevBlocks: [],
        revision: { number: 1, status: "published", summary: "", publishedAt },
        primaryHandle: primaryHandle || reviewers[0] || null,
        reviewerHandles: reviewers,
        state,
        reviewerHistory: reviewerHistory || [],
        threads: [], chat: [], openThreads: 0,
        lastActivityAt: publishedAt, hasMyTurn: false, stalledFor: 0,
      }],
    };
  }

  const sessionsBlog = singleChapterBlog({
    slug: "sessions-cookies-nextjs",
    title: "Сессии на cookies в Next.js без сторонних сервисов",
    authorSlug: "alex",
    tags: ["Next.js", "Auth", "Cookies"],
    summary: "Как поставить сессии на httpOnly-cookie за пару часов: iron-session или ручной HMAC, плюс CSRF и SameSite — без redis, без auth-as-a-service.",
    publishedAt: 1745798400, viewCount: 1980, rating: 53, bookmarkCount: 124, complexity: "medium",
    primaryHandle: "dm.k", reviewerHandles: ["dm.k", "kostya"],
    blocks: [
      { id: "b1", type: "p", text: "В Next.js сессии «как у больших» делаются обычным httpOnly cookie с подписанным payload'ом — без сторонних сервисов и без обвеса. Эта статья — про минимальный, но надёжный сетап." },
      { id: "b2", type: "h2", text: "Два подхода" },
      { id: "b3", type: "p", text: "Первый — iron-session: библиотека шифрует JSON через AES-GCM и кладёт его в cookie. Второй — собственный HMAC: payload в plain-JSON + подпись отдельным секретом. Первый удобнее, второй прозрачнее." },
      { id: "b4", type: "h2", text: "Iron-session за 20 строк" },
      { id: "b5", type: "code", lang: "ts", text: "// session.ts\nimport { getIronSession } from 'iron-session';\nexport async function session() {\n  return getIronSession(await cookies(), {\n    cookieName: 'devblog-session',\n    password: process.env.SESSION_PASS!,\n    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 14 },\n  });\n}" },
      { id: "b6", type: "h2", text: "CSRF и SameSite" },
      { id: "b7", type: "p", text: "SameSite=Lax покрывает 99% случаев: GET-навигации работают, POST с чужого домена — нет. Если нужно SameSite=None (cross-origin виджет) — добавляйте double-submit token и проверяйте в action." },
      { id: "b8", type: "callout", tone: "note", text: "Поворотный момент: сессия — это не «токен», а просто подписанный кусочек данных в HTTP-куке. Всё остальное — детали." },
    ],
  });

  const tailwindBlog = singleChapterBlog({
    slug: "tailwind-v4-tokens",
    title: "Tailwind v4: CSS-переменные как источник истины",
    authorSlug: "alex",
    tags: ["Tailwind", "CSS", "Design Tokens"],
    summary: "С v4 Tailwind стал CSS-first: theme описывается обычными `--*` переменными и `@theme inline`. Я перевёл проект и собрал, что поменялось на практике.",
    publishedAt: 1744588800, viewCount: 2340, rating: 71, bookmarkCount: 156, complexity: "medium",
    primaryHandle: "ira.m", reviewerHandles: ["ira.m"],
    blocks: [
      { id: "b1", type: "p", text: "Tailwind v4 переворачивает архитектуру: теперь дизайн-токены живут в обычном CSS, а Tailwind просто понимает их через @theme inline. Это значит, что одна и та же переменная управляет и Tailwind-классом, и любым ручным `color: var(--accent)`." },
      { id: "b2", type: "h2", text: "@theme inline за 60 секунд" },
      { id: "b3", type: "code", lang: "css", text: "/* globals.css */\n@import 'tailwindcss';\n\n:root {\n  --accent: oklch(60% 0.12 180);\n  --foreground: #111;\n  --background: #fafafa;\n}\n\n@theme inline {\n  --color-accent: var(--accent);\n  --color-foreground: var(--foreground);\n  --color-background: var(--background);\n}" },
      { id: "b4", type: "p", text: "Теперь `bg-accent` и `style={{ background: 'var(--accent)' }}` ведут к одной переменной. Меняете её — обновляется и Tailwind-утилита, и инлайн-стиль, и любой CSS, который её использует." },
      { id: "b5", type: "h2", text: "Тёмная тема" },
      { id: "b6", type: "p", text: "В v3 dark-mode жил в `tailwind.config.js`. В v4 — обычный селектор `:root[data-theme=dark] { ... }` с переопределением переменных. Tailwind-классы наследуют изменение без перекомпиляции." },
      { id: "b7", type: "callout", tone: "info", text: "Главный сдвиг: дизайн-токены теперь — это первоклассный CSS, а не конфигурация препроцессора. Доступ к ним есть везде, включая ванильный CSS и inline-стили." },
    ],
  });

  const playwrightBlog = singleChapterBlog({
    slug: "e2e-playwright-speedrun",
    title: "Playwright speedrun: один flow за 30 секунд, без flakes",
    authorSlug: "alex",
    tags: ["Testing", "Playwright", "E2E"],
    summary: "Минимальный сетап Playwright, который не flaky'ит: один real-browser, fixtures под session, no-mocking сетевых вызовов, и пара патчей на тайминги.",
    publishedAt: 1743984000, viewCount: 1430, rating: 38, bookmarkCount: 67, complexity: "medium",
    primaryHandle: "kostya", reviewerHandles: ["kostya", "dm.k"],
    blocks: [
      { id: "b1", type: "p", text: "Большинство Playwright-конфигов в проде flaky'ят не из-за Playwright, а из-за привычек, перенесённых из Cypress: моки сети, фейковый таймер, искусственные delay. В этой статье — конфиг, который у меня год не давал false-fail'ов." },
      { id: "b2", type: "h2", text: "Конфиг" },
      { id: "b3", type: "code", lang: "ts", text: "// playwright.config.ts\nexport default defineConfig({\n  testDir: './e2e',\n  timeout: 30_000,\n  retries: process.env.CI ? 2 : 0,\n  use: {\n    baseURL: 'http://localhost:3000',\n    trace: 'on-first-retry',\n    screenshot: 'only-on-failure',\n    actionTimeout: 5_000,\n  },\n});" },
      { id: "b4", type: "h2", text: "Fixtures под сессию" },
      { id: "b5", type: "p", text: "Логиниться через UI в каждом тесте — путь к 5x replay'у. Лучше: один тест на login, далее storageState реюзится для всех остальных. Тест прогона — 30 секунд вместо 8 минут." },
      { id: "b6", type: "code", lang: "ts", text: "// auth.setup.ts\nimport { test as setup } from '@playwright/test';\nsetup('login as alex', async ({ page }) => {\n  await page.goto('/login');\n  await page.fill('#username', 'alex');\n  await page.fill('#password', process.env.DEMO_PASS!);\n  await page.click('button[type=submit]');\n  await page.context().storageState({ path: '.auth/alex.json' });\n});" },
      { id: "b7", type: "callout", tone: "warning", text: "Не мокайте свою сеть. Если у вас есть test-db, Playwright тыкается в неё напрямую — meshing на mock'ах в браузере — это +10 источников flakes, ничего не выигрывая." },
    ],
  });

  // ── Multi-chapter demo 4: many reviewers across versions ────────────────
  // Demonstrates a blog whose chapters went through several revisions, each
  // reviewed by a partly-different team. `reviewerHistory` carries the past
  // revisions' reviewers so the credit card's disclosure is well-populated.
  const observabilityBlog = {
    id: "blog-observability-series",
    slug: "observability-series",
    title: "Observability в Node: логи, метрики, трейсы",
    authorSlug: "alex",
    cover: null,
    tags: ["Node.js", "Observability", "OpenTelemetry"],
    complexity: "advanced",
    summary: "Большой блог в четыре главы: от структурных логов до распределённого трейсинга. Прошёл несколько ревизий и много рук ревьюеров.",
    publishedAt: 1746576000,
    lastActivityAt: 1746835200,
    viewCount: 3120,
    rating: 96,
    bookmarkCount: 214,
    chapters: [
      {
        id: "o-1", slug: "structured-logs", title: "Глава 1. Структурные логи вместо console.log", order: 0,
        blocks: [
          { id: "o1-intro", type: "p", text: "console.log в проде — это потеря контекста. Структурный лог (JSON с уровнями и полями) индексируется, фильтруется и коррелируется с трейсом. Начинаем отсюда." },
          { id: "o1-h", type: "h2", text: "pino за пять минут" },
          { id: "o1-code", type: "code", lang: "ts", text: "import pino from 'pino';\nexport const log = pino({\n  level: process.env.LOG_LEVEL ?? 'info',\n  redact: ['req.headers.authorization'],\n});" },
          { id: "o1-callout", type: "callout", tone: "info", text: "Один логгер на процесс, child-логгеры на запрос. Не плодите глобальные синглтоны на каждый модуль." },
        ],
        prevBlocks: [],
        revision: { number: 3, status: "published", summary: "", publishedAt: 1746576000 },
        primaryHandle: "dm.k", reviewerHandles: ["dm.k", "sveta.k"],
        state: { "dm.k": { verdict: "approve", verdictAt: 1746576000 }, "sveta.k": { verdict: "approve", verdictAt: 1746576000 } },
        reviewerHistory: [
          { revision: 1, handles: ["kostya", "ira.m"] },
          { revision: 2, handles: ["kostya", "lena.v"] },
        ],
        threads: [], chat: [], openThreads: 0, lastActivityAt: 1746576000, hasMyTurn: false, stalledFor: 0,
      },
      {
        id: "o-2", slug: "metrics", title: "Глава 2. Метрики: RED, USE и не сойти с ума", order: 1,
        blocks: [
          { id: "o2-intro", type: "p", text: "Метрик можно собрать тысячи и утонуть. Две рамки спасают: RED (Rate, Errors, Duration) для запросов и USE (Utilization, Saturation, Errors) для ресурсов." },
          { id: "o2-h", type: "h2", text: "prom-client" },
          { id: "o2-code", type: "code", lang: "ts", text: "import { Counter, Histogram } from 'prom-client';\nexport const httpDuration = new Histogram({\n  name: 'http_request_duration_seconds',\n  help: 'duration',\n  labelNames: ['method', 'route', 'status'],\n});" },
        ],
        prevBlocks: [],
        revision: { number: 2, status: "published", summary: "", publishedAt: 1746662400 },
        primaryHandle: "lena.v", reviewerHandles: ["lena.v", "pavel.t"],
        state: { "lena.v": { verdict: "approve", verdictAt: 1746662400 }, "pavel.t": { verdict: "approve", verdictAt: 1746662400 } },
        reviewerHistory: [
          { revision: 1, handles: ["dm.k", "kostya"] },
        ],
        threads: [], chat: [], openThreads: 0, lastActivityAt: 1746662400, hasMyTurn: false, stalledFor: 0,
      },
      {
        id: "o-3", slug: "tracing", title: "Глава 3. Распределённый трейсинг с OpenTelemetry", order: 2,
        blocks: [
          { id: "o3-intro", type: "p", text: "Трейс связывает лог и метрику в одну историю запроса через сервисы. OpenTelemetry — стандарт, который не привязывает к вендору." },
          { id: "o3-h", type: "h2", text: "Авто-инструментирование" },
          { id: "o3-code", type: "code", lang: "ts", text: "import { NodeSDK } from '@opentelemetry/sdk-node';\nimport { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';\nnew NodeSDK({ instrumentations: [getNodeAutoInstrumentations()] }).start();" },
          { id: "o3-callout", type: "callout", tone: "warning", text: "Сэмплируйте трейсы. 100%-сбор на нагруженном сервисе — это отдельный инцидент по стоимости и латентности." },
        ],
        prevBlocks: [],
        revision: { number: 4, status: "published", summary: "", publishedAt: 1746748800 },
        primaryHandle: "sveta.k", reviewerHandles: ["sveta.k", "dm.k", "pavel.t"],
        state: { "sveta.k": { verdict: "approve", verdictAt: 1746748800 }, "dm.k": { verdict: "approve", verdictAt: 1746748800 }, "pavel.t": { verdict: "approve", verdictAt: 1746748800 } },
        reviewerHistory: [
          { revision: 1, handles: ["kostya"] },
          { revision: 2, handles: ["kostya", "ira.m"] },
          { revision: 3, handles: ["lena.v", "ira.m"] },
        ],
        threads: [], chat: [], openThreads: 0, lastActivityAt: 1746748800, hasMyTurn: false, stalledFor: 0,
      },
      {
        id: "o-4", slug: "alerting", title: "Глава 4. Алертинг без ложных срабатываний", order: 3,
        blocks: [
          { id: "o4-intro", type: "p", text: "Алерт, который воет каждую ночь, — это не алерт, а фоновый шум. Правило: алертим на симптомы для пользователя, а не на каждую внутреннюю метрику." },
          { id: "o4-h", type: "h2", text: "SLO как основа" },
          { id: "o4-p", type: "p", text: "Считаем error budget, алертим на скорость его сжигания (burn rate), а не на мгновенные всплески. Меньше пейджа, больше сна." },
        ],
        prevBlocks: [],
        revision: { number: 2, status: "published", summary: "", publishedAt: 1746835200 },
        primaryHandle: "pavel.t", reviewerHandles: ["pavel.t", "lena.v"],
        state: { "pavel.t": { verdict: "approve", verdictAt: 1746835200 }, "lena.v": { verdict: "approve", verdictAt: 1746835200 } },
        reviewerHistory: [
          { revision: 1, handles: ["dm.k", "sveta.k"] },
        ],
        threads: [], chat: [], openThreads: 0, lastActivityAt: 1746835200, hasMyTurn: false, stalledFor: 0,
      },
    ],
  };

  F.blogs = [
    sessionsBlog, tailwindBlog, playwrightBlog,
    nextjsBlog, drizzleBlog, mdxBlog, observabilityBlog,
  ];

  // ─── Extend __blogData ─────────────────────────────────────────
  const D = window.__blogData;
  if (!D) return;
  const isChapterPublished = (c) => !!c?.revision && (c.revision.status === "published" || (c.revision.publishedAt && c.revision.status !== "draft"));
  const isChapterInFlight  = (c) => !!c?.revision && (c.revision.status === "under-review" || c.revision.status === "changes-requested");
  const isChapterDraft     = (c) => !!c?.revision && c.revision.status === "draft";
  D.getBlogs = () => F.blogs || [];
  D.getBlogBySlug = (slug) => (F.blogs || []).find(b => b.slug === slug) || null;
  D.getChapter = (blogSlug, chapterSlug) => {
    const b = D.getBlogBySlug(blogSlug);
    return b ? (b.chapters.find(c => c.slug === chapterSlug) || null) : null;
  };
  D.chapterStatus = (c) => {
    if (isChapterPublished(c)) return "published";
    if (isChapterInFlight(c))  return c.revision.status;
    if (isChapterDraft(c))     return "draft";
    return "unknown";
  };
  D.isChapterPublished = isChapterPublished;
  D.isChapterInFlight  = isChapterInFlight;
  D.isChapterDraft     = isChapterDraft;

  D.getInFlightChapters = () => {
    const store = window.__reviewStore?.get?.();
    const removed = new Set(
      (store?.removedReviewers || []).map(r => `${r.blogSlug || ""}#${r.chapterSlug || ""}#${r.handle}`)
    );
    const out = [];
    for (const b of (F.blogs || [])) {
      for (const c of b.chapters) {
        if (!isChapterInFlight(c)) continue;
        const reviewerHandles = (c.reviewerHandles || []).filter(h => !removed.has(`${b.slug}#${c.slug}#${h}`));
        let primaryHandle = c.primaryHandle;
        if (primaryHandle && removed.has(`${b.slug}#${c.slug}#${primaryHandle}`)) {
          primaryHandle = reviewerHandles[0] || null;
        }
        out.push({
          blogSlug: b.slug, blogTitle: b.title,
          chapterSlug: c.slug, chapterTitle: c.title,
          chapterOrder: c.order, totalChapters: b.chapters.length,
          revisionNumber: c.revision?.number || 1, status: c.revision?.status,
          authorHandle: b.authorSlug, primaryHandle, reviewerHandles,
          openThreads: c.openThreads || 0, lastActivityAt: c.lastActivityAt || 0,
          stalledFor: c.stalledFor || 0, hasMyTurn: c.hasMyTurn || false,
        });
      }
    }
    return out;
  };

  D.getAuthorBlogs = (handle) => {
    const mine = (F.blogs || []).filter(b => b.authorSlug === handle);
    return mine.map(b => {
      const buckets = { drafts: [], onReview: [], published: [] };
      for (const c of b.chapters) {
        if (isChapterPublished(c)) buckets.published.push(c);
        else if (isChapterInFlight(c)) buckets.onReview.push(c);
        else if (isChapterDraft(c)) buckets.drafts.push(c);
      }
      const lastActivity = Math.max(b.lastActivityAt || 0, ...b.chapters.map(c => c.lastActivityAt || 0));
      return {
        ...b, buckets,
        chapterCounts: { total: b.chapters.length, drafts: buckets.drafts.length, onReview: buckets.onReview.length, published: buckets.published.length },
        lastActivity,
      };
    }).sort((a, b) => b.lastActivity - a.lastActivity);
  };

  D.effectiveChapterTeam = (chapter, blogSlug) => {
    const store = window.__reviewStore?.get?.();
    const removed = new Set(
      (store?.removedReviewers || []).filter(r => r.blogSlug === blogSlug && r.chapterSlug === chapter.slug).map(r => r.handle)
    );
    const reviewerHandles = (chapter.reviewerHandles || []).filter(h => !removed.has(h));
    let primaryHandle = chapter.primaryHandle;
    if (primaryHandle && removed.has(primaryHandle)) primaryHandle = reviewerHandles[0] || null;
    return { reviewerHandles, primaryHandle, removed };
  };

  // ─── Reviewer credit helpers (Фаза E) ──────────────────────────
  // Everyone who has ever reviewed a chapter, across all its revisions.
  // Current reviewers come from `reviewerHandles` + `state`; past reviewers
  // from the optional `reviewerHistory: [{ revision, handles: [...] }]`.
  // We only attribute the CURRENT version's names as "current", but expose
  // the full unique set so the article can credit everyone involved.
  D.chapterAllReviewers = (chapter) => {
    const current = new Set([
      ...(chapter.reviewerHandles || []),
      ...Object.keys(chapter.state || {}),
    ]);
    const all = new Set(current);
    for (const h of (chapter.reviewerHistory || [])) {
      for (const handle of (h.handles || [])) all.add(handle);
    }
    return { current: [...current], all: [...all] };
  };

  // Published chapters that a given reviewer has ever worked on — powers the
  // reviewer's public profile ("ревьюил …"). No verdicts exposed.
  D.getReviewedChapters = (handle) => {
    const out = [];
    for (const b of (F.blogs || [])) {
      for (const c of (b.chapters || [])) {
        if (!isChapterPublished(c)) continue;
        const { all } = D.chapterAllReviewers(c);
        if (all.includes(handle)) {
          out.push({
            blogSlug: b.slug, blogTitle: b.title,
            chapterSlug: c.slug, chapterTitle: c.title,
            isSeries: (b.chapters || []).length > 1,
            publishedAt: c.revision?.publishedAt || b.publishedAt || 0,
          });
        }
      }
    }
    return out.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  };
})();
