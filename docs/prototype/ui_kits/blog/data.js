// Fake data used by every screen in the UI kit.
window.FAKE_DATA = {
  profile: {
    name: "Александр Иванов",
    handle: "alex",
    bio: "Персональный блог разработчика — статьи о программировании, системах и инструментах, которыми пользуюсь каждый день.",
    avatarUrl: null,
  },
  articles: [
    {
      id: "a1",
      slug: "next-16-boundary-patterns",
      title: "Next.js 16 App Router: паттерны границ",
      excerpt:
        "Как разбивать server и client components, не ломая кэш и не теряя интерактивность. Практические правила из production-проектов.",
      tags: "next.js,rsc,app-router,typescript",
      publishedAt: 1747008000, // 12 мая 2025
      coverImageUrl: "#cover-1",
      difficulty: "medium",
      readingTime: 8,
      viewCount: 1420,
      rating: 24,
      bookmarked: false,
      bookmarkCount: 18,
      authorName: "Александр Иванов",
      authorSlug: "alex",
      content: null,
      // ── Active review fields ──
      revision: {
        number: 4,
        basedOnPublished: 3,
        submittedAt: 1747094400,
        deadlineAt:  1747526400,
        status: "under-review",
        summary: "Добавил раздел про Mermaid-границы между server/client в схемах. Уточнил пример с force-dynamic — спасибо @dm.k за разбор.",
      },
      prevBlocks: [
        { id: "b-intro",   type: "p",  text: "Server Components по умолчанию — это не стиль, а контракт. Код, который касается БД, секретов и серверных API, не должен уехать в бандл клиента." },
        { id: "h-why",     type: "h2", slug: "why",     text: "Почему границы вообще нужны" },
        { id: "p-why-1",   type: "p",  text: "Между сервером и клиентом проходит граница, и от того, где вы её прочертите, зависит размер бандла и поведение кэша." },
        { id: "h-rule",    type: "h2", slug: "rule",    text: "Правило одного клиента" },
        { id: "p-rule-1",  type: "p",  text: "Самая частая ошибка — поставить use client в начало файла с половиной приложения. На клиент уезжает три экрана разметки, которые могли остаться на сервере." },
        { id: "p-rule-2",  type: "p",  text: "Извлеките только интерактивный кусочек в отдельный клиентский компонент. Остальное — серверное." },
        { id: "code-form", type: "code", lang: "tsx", text: "'use client';\nexport function TitleField({ defaultValue }: Props) {\n  const [value, setValue] = useState(defaultValue);\n  return <input value={value} onChange={e => setValue(e.target.value)} />;\n}" },
        { id: "h-cache",   type: "h2", slug: "cache",   text: "Когда кеш срабатывает против вас" },
        { id: "p-cache-1", type: "p",  text: "App Router агрессивно кеширует. force-dynamic вырубает кеш на всю страницу — это nuclear option." },
      ],
      blocks: [
        { id: "b-intro",   type: "p",  text: "Server Components по умолчанию — это не стиль, а контракт. Код, который касается БД, секретов и серверных API, не должен уехать в бандл клиента, а всё, что реагирует на ввод пользователя — обязано загружаться на клиенте." },
        { id: "h-why",     type: "h2", slug: "why",     text: "Зачем нужны границы между server и client" },
        { id: "p-why-1",   type: "p",  text: "Между сервером и клиентом проходит граница, и от того, где вы её прочертите, зависит размер бандла, предсказуемость кэша и стоимость каждого экрана." },
        { id: "diagram-1", type: "mermaid", caption: "Где проходит граница: server → client", text: "graph LR\n  A[page.tsx server] --> B[ArticleHeader server]\n  A --> C[TitleField client]\n  B --> D[Tags server]\n  C -.use client.-> E[(bundle)]" },
        { id: "h-rule",    type: "h2", slug: "rule",    text: "Правило одного клиента" },
        { id: "p-rule-1",  type: "p",  text: "Самая частая ошибка — поставить use client в начало файла с половиной приложения, потому что там где-то внутри нужен useState. В итоге на клиент уезжает три экрана разметки, которые могли остаться на сервере." },
        { id: "p-rule-2",  type: "p",  text: "Извлеките только интерактивный кусочек в отдельный клиентский компонент. Остальное — серверное: безопаснее и дешевле." },
        { id: "code-form", type: "code", lang: "tsx", text: "// good — выделили только интерактивную часть\n'use client';\nexport function TitleField({ defaultValue }: Props) {\n  const [value, setValue] = useState(defaultValue);\n  return <input value={value} onChange={e => setValue(e.target.value)} />;\n}" },
        { id: "h-cache",   type: "h2", slug: "cache",   text: "Когда кеш срабатывает против вас" },
        { id: "p-cache-1", type: "p",  text: "App Router агрессивно кеширует. force-dynamic вырубает кеш на всю страницу — это nuclear option, и тянуться к нему стоит только когда альтернативы исчерпаны." },
        { id: "p-cache-2", type: "p",  text: "Чаще правильный инструмент — revalidateTag после мутации: точечно, дешево, не ломает остальные экраны." },
      ],
      primaryHandle: "dm.k",
      reviewerHandles: ["dm.k", "kostya", "ira.m"],
      state: {
        "dm.k":   { verdict: "request-changes", verdictAt: 1747112400, online: true,  typing: false },
        "kostya": { verdict: null,               verdictAt: null,       online: true,  typing: true  },
        "ira.m":  { verdict: null,               verdictAt: null,       online: false, typing: false },
      },
      threads: [
        { id: "t-1", kind: "edit", blockId: "p-cache-1", range: [54, 86], quote: "force-dynamic вырубает кеш на всю страницу", author: "dm.k", createdAt: 1747105200, status: "open", severity: "must", before: "force-dynamic вырубает кеш на всю страницу", after: "force-dynamic отключает кеш на уровне всего сегмента", reason: "«Вырубает кеш» звучит разговорно, давайте формальнее. И уточним «всю страницу» → «сегмент» — терминологически точнее.", replies: [ { id: "t-1-r1", author: "alex", at: 1747108800, text: "Согласен по сегменту. Про «вырубает» оставлю — это часть голоса блога, не хочу терять." }, { id: "t-1-r2", author: "dm.k", at: 1747109400, text: "ОК, тогда давайте только вторую часть исправим — с «сегментом»." } ] },
        { id: "t-2", kind: "note", blockId: "diagram-1", range: null, quote: null, author: "kostya", createdAt: 1747094400, status: "open", severity: "suggestion", body: "На диаграмме не хватает узла «Server Action» — без него непонятно, как форма пересекает границу обратно. Можно добавить пунктирную стрелку TitleField → action?", replies: [ { id: "t-2-r1", author: "alex", at: 1747098000, text: "Хорошая мысль. Добавлю в следующей итерации." } ] },
        { id: "t-3", kind: "edit", blockId: "h-why", range: [0, 47], quote: "Зачем нужны границы между server и client", author: "ira.m", createdAt: 1747112400, status: "open", severity: "suggestion", before: "Зачем нужны границы между server и client", after: "Зачем вообще нужны границы между server и client", reason: "Прежний заголовок был с «вообще» — он лучше передавал интонацию «разберёмся с нуля». Жалко терять.", replies: [] },
        { id: "t-4", kind: "note", blockId: "code-form", range: null, quote: "good — выделили только интерактивную часть", author: "dm.k", createdAt: 1747091400, status: "open", severity: "praise", body: "Очень удачно, что добавили комментарий «good» прямо в код. Без него предыдущая версия читалась как просто пример, а не контрпример.", replies: [] },
        { id: "t-5", kind: "edit", blockId: "b-intro", range: [0, 0], quote: "", author: "kostya", createdAt: 1747018800, status: "accepted", acceptedAt: 1747022400, severity: "suggestion", before: "Server Components по умолчанию — это не стиль, а контракт.", after: "Server Components по умолчанию — это не стилевое предпочтение, а контракт.", reason: "«Стиль» слишком многозначно — может быть и про CSS.", replies: [] },
      ],
      chat: [
        { id: "m-1", author: "alex",   at: 1747094400, text: "Команда, поднял ревизию 4. Главное изменение — добавил Mermaid-схему между разделами «Зачем» и «Правило одного клиента»." },
        { id: "m-2", author: "dm.k",   at: 1747096200, text: "Принял. Пробегусь сегодня, оставлю замечания по разделу про кеш." },
        { id: "m-3", author: "kostya", at: 1747098000, text: "Я вечером, заодно проверю диаграмму." },
        { id: "m-4", author: "alex",   at: 1747105200, text: "Спасибо! Если там Mermaid не парсится — скажите, я дам fallback." },
        { id: "m-5", author: "ira.m",  at: 1747112400, text: "Я только текст просмотрю, в диаграммы не лезу." },
      ],
      openThreads: 4,
      lastActivityAt: 1747112400,
      hasMyTurn: false,
    },
    {
      id: "a2",
      slug: "drizzle-migrations-sqlite",
      title: "Миграции Drizzle для SQLite без боли",
      excerpt:
        "Рабочая схема: генерируем, применяем и откатываем миграции локально и в продакшене, без --allow-data-loss в 3 часа ночи.",
      tags: "drizzle,sqlite,migrations",
      publishedAt: 1746316800, // 4 мая 2025
      coverImageUrl: "#cover-2",
      difficulty: "simple",
      readingTime: 6,
      viewCount: 842,
      rating: 12,
      bookmarked: true,
      bookmarkCount: 31,
      authorName: "Александр Иванов",
      authorSlug: "alex",
      content: null,
      revision: {
        number: 2, basedOnPublished: 1,
        submittedAt: 1746489600, deadlineAt: 1747094400,
        status: "changes-requested",
        summary: "Поправил по замечаниям ревью v1 — добавил пример отката с указанием конкретных миграций.",
      },
      primaryHandle: "kostya",
      reviewerHandles: ["kostya", "ira.m"],
      state: {
        "kostya": { verdict: "request-changes", verdictAt: 1746575000, online: false, typing: false },
        "ira.m":  { verdict: null,              verdictAt: null,        online: false, typing: false },
      },
      openThreads: 6,
      lastActivityAt: 1746489600,
      stalledFor: 192,
      hasMyTurn: true,
    },
    {
      id: "a3",
      slug: "sessions-cookies-nextjs",
      title: "Сессии на cookies в Next.js без сторонних сервисов",
      excerpt:
        "iron-session + route handlers. Разбираем, зачем это стоит делать руками и где можно выстрелить себе в ногу.",
      tags: "next.js,auth,security",
      publishedAt: 1745020800, // 19 апр 2025
      coverImageUrl: "#cover-3",
      difficulty: "hard",
      readingTime: 14,
      viewCount: 2108,
      rating: 47,
      bookmarked: false,
      bookmarkCount: 54,
      authorName: "Александр Иванов",
      authorSlug: "alex",
      content: null,
    },
    {
      id: "a4",
      slug: "mdx-with-plugins",
      title: "MDX как движок блога: rehype, remark и свои компоненты",
      excerpt:
        "Пайплайн обработки markdown: якоря у заголовков, подсветка синтаксиса, вставка диаграмм. Всё прозрачно, всё на диске.",
      tags: "mdx,remark,rehype,markdown",
      publishedAt: 1743638400, // 3 апр 2025
      coverImageUrl: "#cover-4",
      difficulty: "medium",
      readingTime: 11,
      viewCount: 624,
      rating: 9,
      bookmarked: false,
      bookmarkCount: 12,
      authorName: "Александр Иванов",
      authorSlug: "alex",
      content: null,
    },
    {
      id: "a5",
      slug: "tailwind-v4-tokens",
      title: "Tailwind v4: CSS-переменные как источник истины",
      excerpt:
        "@theme vs :root, light/dark через data-атрибуты, и как перестать бояться custom-properties.",
      tags: "tailwind,css,design-system",
      publishedAt: 1742256000, // 18 мар 2025
      coverImageUrl: "#cover-5",
      difficulty: "simple",
      readingTime: 7,
      viewCount: 1033,
      rating: 19,
      bookmarked: false,
      bookmarkCount: 22,
      authorName: "Александр Иванов",
      authorSlug: "alex",
      content: null,
    },
    {
      id: "a6",
      slug: "e2e-playwright-speedrun",
      title: "Playwright speedrun: один flow, 30 секунд, без flakes",
      excerpt:
        "Когда e2e-тесты перестают бесить. Трейсы, фикстуры, параллелизм — минимум конфигурации, максимум отдачи.",
      tags: "playwright,testing,e2e",
      publishedAt: 1740873600, // 2 мар 2025
      coverImageUrl: "#cover-6",
      difficulty: "medium",
      readingTime: 9,
      viewCount: 511,
      rating: 7,
      bookmarked: false,
      bookmarkCount: 8,
      authorName: "Александр Иванов",
      authorSlug: "alex",
      content: null,
    },
    {
      id: "a7",
      slug: "tailwind-v4-tokens-draft",
      title: "Дизайн-токены через @theme: что менять при апгрейде",
      excerpt: "",
      tags: "",
      publishedAt: null,
      coverImageUrl: null,
      difficulty: null,
      readingTime: 0,
      viewCount: 0,
      rating: 0,
      bookmarked: false,
      bookmarkCount: 0,
      authorName: "Александр Иванов",
      authorSlug: "alex",
      content: null,
      revision: {
        number: 1, basedOnPublished: null,
        submittedAt: null, deadlineAt: null,
        status: "draft",
        summary: "",
      },
      blocks: [{ id: "b-1", type: "p", text: "" }],
      primaryHandle: null,
      reviewerHandles: [],
      state: {},
      openThreads: 0,
      lastActivityAt: 1747008000,
      hasMyTurn: false,
    },
    {
      id: "a8",
      slug: "edge-runtime-cold-starts",
      title: "Холодные старты Edge runtime: измеряем без мифов",
      excerpt: "",
      tags: "edge,runtime,performance",
      publishedAt: null,
      coverImageUrl: null,
      difficulty: "hard",
      readingTime: 12,
      viewCount: 0,
      rating: 0,
      bookmarked: false,
      bookmarkCount: 0,
      authorName: "Константин Лебедев",
      authorSlug: "kostya",
      content: null,
      revision: {
        number: 1, basedOnPublished: null,
        submittedAt: 1746230400, deadlineAt: 1746835200,
        status: "under-review",
        summary: "Первая ревизия. Бенчмарки на 3 регионах + сравнение с node runtime.",
      },
      primaryHandle: "ira.m",
      reviewerHandles: ["ira.m", "dm.k"],
      state: {
        "ira.m": { verdict: null, verdictAt: null, online: false, typing: false },
        "dm.k":  { verdict: null, verdictAt: null, online: false, typing: false },
      },
      openThreads: 11,
      lastActivityAt: 1746230400,
      stalledFor: 264,
      hasMyTurn: false,
    },
  ],
  // Mock community of commenters / readers / authors / reviewers / admin.
  // Each user gets a profile page in the kit. Roles drive the action panel.
  users: {
    alex: {
      handle: "alex", name: "Александр Иванов", role: "author",
      bio: "Персональный блог разработчика. Автор всех статей здесь.",
      links: { github: "https://github.com/alex", telegram: "https://t.me/alex", website: "https://alex.dev" },
      status: "active", joinedAt: 1704067200, lastSeenAt: 1747180800, // 1 янв 2024 / 14 мая
    },
    nika: {
      handle: "nika", name: "Ника Петрова", role: "reader",
      bio: "Frontend, design systems. Читаю всё подряд про RSC.",
      status: "active", joinedAt: 1717200000, lastSeenAt: 1747094400,
    },
    "dm.k": {
      handle: "dm.k", name: "Дмитрий К.", role: "reviewer",
      bio: "Старший инженер. Ревьюер технических статей.",
      status: "active", joinedAt: 1709251200, lastSeenAt: 1747180800,
    },
    bayer: {
      handle: "bayer", name: "Олег Б.", role: "reader",
      bio: "Backend, Postgres, скучные надёжные системы.",
      status: "active", joinedAt: 1714521600, lastSeenAt: 1747105200,
    },
    moderator: {
      handle: "moderator", name: "Модератор", role: "admin",
      bio: "Служебный аккаунт.",
      status: "active", joinedAt: 1700000000, lastSeenAt: 1747180800,
    },
    // Extra users — populate the admin user list with realistic variety.
    "ira.m": {
      handle: "ira.m", name: "Ирина М.", role: "author",
      bio: "Пишет о фронтенд-инфраструктуре, бандлерах и dev-tools.",
      links: { github: "https://github.com/iram", website: "https://iram.dev" },
      status: "active", joinedAt: 1715212800, lastSeenAt: 1747094400,
    },
    "kostya": {
      handle: "kostya", name: "Константин Лебедев", role: "reviewer",
      bio: "Tech lead. Ревьюер по бэкенду и базам.",
      status: "active", joinedAt: 1706745600, lastSeenAt: 1747018800,
    },
    "lena.v": {
      handle: "lena.v", name: "Елена Власова", role: "reviewer",
      bio: "Фронтенд-архитектор. Ревью по доступности и перформансу.",
      status: "active", joinedAt: 1708300800, lastSeenAt: 1747100000,
    },
    "pavel.t": {
      handle: "pavel.t", name: "Павел Титов", role: "reviewer",
      bio: "DevOps и инфраструктура. Ревью по сборке и CI.",
      status: "active", joinedAt: 1710892800, lastSeenAt: 1746900000,
    },
    "sveta.k": {
      handle: "sveta.k", name: "Светлана Ким", role: "reviewer",
      bio: "Тех-редактор. Структура и ясность изложения.",
      status: "active", joinedAt: 1712707200, lastSeenAt: 1747050000,
    },
    "spam_bot_42": {
      handle: "spam_bot_42", name: "spam_bot_42", role: "reader",
      bio: "—",
      status: "blocked", joinedAt: 1746662400, lastSeenAt: 1746748800,
      blockedAt: 1746835200, blockedReason: "Массовая рассылка ссылок в комментариях",
    },
    "anonymous_94": {
      handle: "anonymous_94", name: "anonymous_94", role: "reader",
      bio: "",
      status: "active", joinedAt: 1746489600, lastSeenAt: 1747008000,
    },
    "marina.r": {
      handle: "marina.r", name: "Марина Р.", role: "reader",
      bio: "Дизайнер, читаю про дизайн-системы.",
      status: "active", joinedAt: 1721260800, lastSeenAt: 1747008000,
    },
    "old_account": {
      handle: "old_account", name: "Сергей Старов", role: "reader",
      bio: "Аккаунт оставлен.",
      status: "deactivated", joinedAt: 1672531200, lastSeenAt: 1714521600,
    },
  },
  // Threaded comments. Each comment is tied to a specific blog + chapter +
  // the revision it was written against. A comment whose `revision` is older
  // than the chapter's current published revision is shown collapsed under a
  // "прошлые версии" spoiler with a «к версии vN» badge.
  // `anchor.blockId` points at a block id in the chapter (rendered as
  // id="block-<id>"); clicking "к фрагменту" scrolls to it. `editedAt`
  // (when set) renders a «изменено» marker; authors may edit within 15 min.
  comments: [
    // ── nextjs-16-series · глава «boundaries» · актуальная ревизия v3 ──
    {
      id: "c1",
      blogSlug: "nextjs-16-series", chapterSlug: "boundaries", revision: 3,
      authorHandle: "nika",
      createdAt: 1747094400, editedAt: null,
      anchor: {
        blockId: "b1-p-rule",
        quote: "Извлекайте только интерактивный кусочек: всё остальное должно остаться серверным",
      },
      body: "Очень в точку. Пол-команды до сих пор клеит «use client» на целые страницы, потому что «работает». Оно правда работает — пока не упрётся в bundle size.",
      replies: [
        {
          id: "c1-r1",
          authorHandle: "alex",
          createdAt: 1747098000, editedAt: 1747098600,
          body: "Да, и на dev-сервере это почти не воспроизводится — поэтому я завёл отдельный пункт в pre-merge чек-листе.",
        },
      ],
    },
    {
      id: "c2",
      blogSlug: "nextjs-16-series", chapterSlug: "boundaries", revision: 3,
      authorHandle: "bayer",
      createdAt: 1747105200, editedAt: null,
      anchor: null,
      body: "А что насчёт streaming + suspense boundary внутри клиентских компонентов? В тексте этот кейс обойдён, а у нас как раз туда упёрлись на проде.",
      replies: [],
    },
    // ── Комментарии к ПРОШЛЫМ версиям главы (v2, v1 < текущей v3) ──
    {
      id: "c-old-1",
      blogSlug: "nextjs-16-series", chapterSlug: "boundaries", revision: 2,
      authorHandle: "marina.r",
      createdAt: 1746500000, editedAt: null,
      anchor: {
        blockId: "b1-p-rule",
        quote: "Извлекайте только интерактивный кусочек",
      },
      body: "В этой редакции абзац был длиннее, но смысл тот же — хорошо что ужали. Заберу формулировку в onboarding.",
      replies: [],
    },
    {
      id: "c-old-2",
      blogSlug: "nextjs-16-series", chapterSlug: "boundaries", revision: 1,
      authorHandle: "bayer",
      createdAt: 1746400000, editedAt: null,
      anchor: null,
      body: "Первая версия главы тоже была полезная, рад что блог растёт.",
      replies: [],
    },
    // ── Другой блог — доказывает фильтрацию комментариев по blogSlug ──
    {
      id: "c-sess-1",
      blogSlug: "sessions-cookies-nextjs", chapterSlug: "main", revision: 1,
      authorHandle: "marina.r",
      createdAt: 1746320000, editedAt: null,
      anchor: null,
      body: "Ручной HMAC вместо iron-session — ровно то, что искала. Минус одна зависимость, и SameSite разобран по полочкам. Спасибо!",
      replies: [],
    },
  ],
  // Moderation queue — comment reports filed by readers. Each row points to
  // an existing comment in `comments` (by id) or carries an embedded body
  // for items that have already been deleted from the public thread.
  moderationReports: [
    {
      id: "rep-1",
      kind: "comment",
      reportedAt: 1747180800, // 14 мая
      reporterHandle: "nika",
      targetCommentId: null,
      targetAuthorHandle: "spam_bot_42",
      targetArticleSlug: "nextjs-16-series",
      targetBody: "Купи курс по Next.js за 990₽ → https://example.shop/promo. Скидка только сегодня!",
      reason: "spam",
      reasonText: "Спам/реклама",
      status: "pending", // pending · resolved · dismissed
      reportsCount: 4,
    },
    {
      id: "rep-2",
      kind: "comment",
      reportedAt: 1747105200,
      reporterHandle: "bayer",
      targetCommentId: null,
      targetAuthorHandle: "anonymous_94",
      targetArticleSlug: "sessions-cookies-nextjs",
      targetBody: "Автор не понимает, о чём пишет. Это вообще для джунов уровень. Удалите статью.",
      reason: "abuse",
      reasonText: "Оскорбления / токсичность",
      status: "pending",
      reportsCount: 2,
    },
    {
      id: "rep-3",
      kind: "comment",
      reportedAt: 1747018800,
      reporterHandle: "marina.r",
      targetCommentId: null,
      targetAuthorHandle: "anonymous_94",
      targetArticleSlug: "tailwind-v4-tokens",
      targetBody: "Вот мой мини-курс по Tailwind, забирайте бесплатно: t.me/some_channel_here",
      reason: "spam",
      reasonText: "Спам/реклама",
      status: "pending",
      reportsCount: 1,
    },
    {
      id: "rep-4",
      kind: "comment",
      reportedAt: 1746921600,
      reporterHandle: "nika",
      targetCommentId: "c2",
      targetAuthorHandle: "bayer",
      targetArticleSlug: "nextjs-16-series",
      targetBody: "А что насчёт streaming + suspense boundary внутри клиентских компонентов? В тексте этот кейс обойдён, а у нас как раз туда упёрлись на проде.",
      reason: "offtopic",
      reasonText: "Не по теме",
      status: "dismissed",
      reportsCount: 1,
      resolvedAt: 1746939600,
      resolvedBy: "moderator",
      resolution: "Замечание по делу. Не оффтоп.",
    },
    {
      id: "rep-5",
      kind: "comment",
      reportedAt: 1746748800,
      reporterHandle: "marina.r",
      targetCommentId: null,
      targetAuthorHandle: "spam_bot_42",
      targetArticleSlug: "drizzle-sqlite-series",
      targetBody: "Best SQL course → cheap-courses.online. 80% off!!!",
      reason: "spam",
      reasonText: "Спам/реклама",
      status: "resolved",
      reportsCount: 6,
      resolvedAt: 1746835200,
      resolvedBy: "moderator",
      resolution: "Удалено. Автор заблокирован.",
    },
    {
      id: "rep-6",
      kind: "blog",
      reportedAt: 1747200000,
      reporterHandle: "bayer",
      targetCommentId: null,
      targetAuthorHandle: "ira.m",
      targetArticleSlug: "tailwind-v4-tokens",
      targetBody: "Tailwind v4: CSS-переменные как источник истины",
      reason: "spam",
      reasonText: "Спам / реклама",
      status: "pending",
      reportsCount: 1,
    },
  ],
  // Audit log — last admin actions. Drives the "Последние действия" list
  // on the admin dashboard.
  auditLog: [
    { id: "log-1", at: 1747180800, actor: "moderator", action: "user.block",        target: "@spam_bot_42",  note: "Массовая рассылка ссылок" },
    { id: "log-2", at: 1747105200, actor: "moderator", action: "comment.delete",    target: "@spam_bot_42 → drizzle-migrations-sqlite", note: "Spam" },
    { id: "log-3", at: 1747018800, actor: "moderator", action: "user.role.change",  target: "@kostya", note: "reader → reviewer" },
    { id: "log-4", at: 1746921600, actor: "moderator", action: "report.dismiss",    target: "rep-4", note: "Замечание по делу" },
    { id: "log-5", at: 1746835200, actor: "moderator", action: "article.unpublish", target: "obsolete-rsc-tips", note: "Устарело, автор уведомлён" },
    { id: "log-6", at: 1746748800, actor: "moderator", action: "user.role.change",  target: "@ira.m", note: "reader → author" },
  ],
  // Aggregate platform metrics for the admin dashboard. These are static
  // snapshots; the kit doesn't recompute them on the fly.
  platformMetrics: {
    activeUsers7d: 1284,
    newSignups7d: 47,
    publishedArticles: 24,
    inReview: 3,
    pendingReports: 3,
    blockedUsers: 1,
    // Sparkline-friendly: 14 daily values, oldest first.
    signupsTrend: [3, 5, 4, 6, 7, 5, 8, 6, 9, 7, 8, 11, 9, 12],
    viewsTrend:   [820, 940, 1010, 880, 1120, 1340, 1280, 1190, 1410, 1520, 1480, 1610, 1750, 1820],
  },
};

// ─────────────────────────────────────────────────────────────────
// Profile edits (Фаза F) — users can edit their own profile (name / bio /
// links). Edits are merged into FAKE_DATA.users in place (so every surface
// that reads users[handle] picks them up) and persisted to localStorage so
// they survive reload. Broadcasts so open screens re-render.
// ─────────────────────────────────────────────────────────────────
(function () {
  var KEY = "devblog-profile-edits-v1";
  try {
    var ov = JSON.parse(localStorage.getItem(KEY) || "{}");
    for (var h in ov) {
      if (!window.FAKE_DATA.users[h]) continue;
      var patch = ov[h] || {};
      if (patch.links) { window.FAKE_DATA.users[h].links = Object.assign({}, window.FAKE_DATA.users[h].links, patch.links); }
      for (var k in patch) { if (k !== "links") window.FAKE_DATA.users[h][k] = patch[k]; }
    }
  } catch (e) {}
  window.__profiles = {
    get: function (handle) { return window.FAKE_DATA.users[handle] || null; },
    save: function (handle, patch) {
      var u = window.FAKE_DATA.users[handle];
      if (!u) return;
      if (patch.links) { u.links = Object.assign({}, u.links, patch.links); }
      for (var k in patch) { if (k !== "links") u[k] = patch[k]; }
      try {
        var all = JSON.parse(localStorage.getItem(KEY) || "{}");
        all[handle] = all[handle] || {};
        if (patch.links) { all[handle].links = Object.assign({}, all[handle].links, patch.links); }
        for (var k2 in patch) { if (k2 !== "links") all[handle][k2] = patch[k2]; }
        localStorage.setItem(KEY, JSON.stringify(all));
      } catch (e) {}
      window.dispatchEvent(new CustomEvent("devblog:profile-changed", { detail: { handle: handle } }));
    },
  };
})();

// ─────────────────────────────────────────────────────────────────
// Reports store (Фаза F) — single source of truth for moderation reports,
// shared between the public side (readers/authors file reports on comments
// and blogs) and the admin portal (reads + resolves). Pub/sub like
// __reviewStore so both surfaces stay in sync within a session.
// Reason catalogue is exported for the report dialog.
// ─────────────────────────────────────────────────────────────────
window.REPORT_REASONS = [
  { id: "spam",     text: "Спам / реклама" },
  { id: "abuse",    text: "Оскорбления / токсичность" },
  { id: "offtopic", text: "Не по теме" },
  { id: "other",    text: "Другое" },
];
window.__reports = (function () {
  var seed = (window.FAKE_DATA.moderationReports || []).map(function (r) {
    return Object.assign({ kind: "comment" }, r);
  });
  var state = { items: seed };
  var subs = new Set();
  function emit() { subs.forEach(function (fn) { fn(state); }); }
  return {
    get: function () { return state; },
    subscribe: function (fn) { subs.add(fn); return function () { subs.delete(fn); }; },
    add: function (report) {
      var reason = (window.REPORT_REASONS.find(function (x) { return x.id === report.reason; }) || {});
      var full = Object.assign({
        id: "rep-" + Date.now(),
        status: "pending",
        reportedAt: Math.floor(Date.now() / 1000),
        reportsCount: 1,
        reasonText: reason.text || report.reason,
      }, report);
      state.items = [full].concat(state.items);
      emit();
      return full;
    },
    resolve: function (id, patch) {
      state.items = state.items.map(function (r) { return r.id === id ? Object.assign({}, r, patch) : r; });
      emit();
    },
  };
})();

// ─────────────────────────────────────────────────────────────────
// Pinned blog (Фаза F) — each author may pin ONE blog as their portfolio /
// flagship. Surfaced above "Мои блоги" in the author portal and at the top
// of the author's public profile. Persisted to localStorage; pub/sub so open
// screens re-render.
// ─────────────────────────────────────────────────────────────────
window.__pins = (function () {
  var KEY = "devblog-pins-v1";
  var map = {};
  try { map = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { map = {}; }
  // Seed a sensible default portfolio pin for the demo author.
  if (map.alex === undefined) map.alex = "observability-series";
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) {} }
  return {
    get: function (handle) { return map[handle] || null; },
    set: function (handle, slug) {
      if (map[handle] === slug) { delete map[handle]; } // toggle off
      else { map[handle] = slug; }
      persist();
      window.dispatchEvent(new CustomEvent("devblog:pins-changed", { detail: { handle: handle } }));
    },
    isPinned: function (handle, slug) { return map[handle] === slug; },
  };
})();

// ─────────────────────────────────────────────────────────────────
// "Об авторе" (portfolio) — an optional, single per-author extended bio,
// authored as a block document and published WITHOUT review. Persisted to
// localStorage; pub/sub so open screens re-render.
//   shape: { [handle]: { title, blocks:[...], visible:bool, updatedAt } }
// ─────────────────────────────────────────────────────────────────
window.__portfolio = (function () {
  var KEY = "devblog-portfolio-v1";
  var map = {};
  try { map = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { map = {}; }

  // Seed a sample portfolio for the demo author so the feature is visible.
  if (map.alex === undefined) {
    map.alex = {
      title: "Инженер, который любит порядок в коде",
      visible: true,
      updatedAt: 1748000000,
      blocks: [
        { id: "pf-1", type: "p", text: "Инженер-фронтендер и тимлид. Восемь лет в вебе: от вёрстки лендингов до дизайн-систем, которыми пользуются десятки команд. Отвечаю за перформанс, наблюдаемость сервисов и культуру код-ревью." },
        { id: "pf-h1", type: "h2", text: "Чем занимаюсь" },
        { id: "pf-2", type: "p", text: "Веду небольшую команду фронтенда. Строю дизайн-систему, держу перформанс-бюджеты и учу людей читать чужой код без боли. Верю, что хороший код-ревью — это разговор, а не приговор." },
        { id: "pf-h2", type: "h2", text: "О чём пишу здесь" },
        { id: "pf-3", type: "p", text: "Практика без воды: реальные баги из прода, паттерны границ в Next.js, наблюдаемость в Node и инструменты, которыми пользуюсь каждый день. Если статья помогла — это лучшая награда." },
        { id: "pf-q", type: "quote", text: "Пишу то, что сам хотел бы прочитать пять лет назад." },
      ],
    };
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) {} }
  function emit(handle) { window.dispatchEvent(new CustomEvent("devblog:portfolio-changed", { detail: { handle: handle } })); }
  return {
    get: function (handle) { return map[handle] || null; },
    exists: function (handle) { return !!map[handle]; },
    isVisible: function (handle) { return !!(map[handle] && map[handle].visible); },
    save: function (handle, data) {
      map[handle] = Object.assign({ visible: true }, map[handle], data, { updatedAt: Math.floor(Date.now() / 1000) });
      persist(); emit(handle);
    },
    setVisible: function (handle, vis) {
      if (!map[handle]) return;
      map[handle].visible = !!vis; persist(); emit(handle);
    },
    remove: function (handle) { delete map[handle]; persist(); emit(handle); },
  };
})();