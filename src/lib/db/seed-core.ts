// Детерминированный seed Recenza — единый построитель для dev (blog.db) и test (blog.test.db).
// Раннеры: ./seed.ts (env .env.local) и ./seed-test.ts (env .env.test) — оба вызывают seedAll(db).
//
// Детерминизм (см. PLAN.md Фаза 3 §Журнал):
//   • id / handle / slug / связи / counts — ФИКСИРОВАНЫ (тесты опираются на стабильные идентификаторы).
//   • Пароль reader/author/reviewer — захардкоженный bcrypt-хэш 'password' (PWD_HASH): и детерминизм,
//     и нет стоимости bcrypt на каждый seed. Админ — env-based (POST /api/auth), строки users не имеет.
//   • Timestamps — от единственного NOW (Math.floor(Date.now()/1000)); recency-зависимые кейсы
//     (комментарий в окне правки ≤15 мин, «свежие» уведомления) валидны относительно времени прогона.
//
// Конвенции (CLAUDE.md / .claude/skills/drizzle-schema): только Drizzle (никакого raw SQL),
// Unix seconds, ulid-совместимые строковые id (здесь фиксированные), booleans — JS true/false
// (drizzle мапит в 0/1), JSON-поля кодируются через stringifyJson().
//
// Импорты: схема и json — relative (без @/-alias, чтобы tsx резолвил без tsconfig-paths);
// типы — `import type` (стираются esbuild'ом, рантайм-резолва alias не требуют).

import {
  appSettings,
  blogs,
  boardCalls,
  bookmarks,
  chapterRevisions,
  chapterReviewers,
  chapters,
  chapterVotes,
  commentVotes,
  donationMethods,
  follows,
  notifications,
  portfolios,
  primaryChangeRequests,
  promoBanners,
  publicComments,
  recruitRequests,
  removedReviewers,
  reports,
  reviewChat,
  reviewChecklists,
  reviewerApplications,
  reviewerHistory,
  reviewerRatings,
  reviewInvitations,
  threadReplies,
  threads,
  users,
} from "./schema";
import { stringifyJson } from "./json";
import type { Db } from "./index";
import type { Block } from "../../types";

// ───────────────────────────── время (фиксируется один раз) ─────────────────────────────
const NOW = Math.floor(Date.now() / 1000);
const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ago = (seconds: number) => NOW - seconds;

// bcrypt('password', 10) — общий пароль для reader/author/reviewer. Проверено compareSync === true.
const PWD_HASH = "$2b$10$bv01DQbqre9h.cs.SZZGeO6iCkHnpNdn2ZNeWGbOfsVycBjbKA0ra";

// ───────────────────────────── блоки контента (JSON Block[]) ─────────────────────────────
// Блок-id фиксированы, чтобы треды/якоря ссылались на них стабильно (threads.blockId, anchor.blockId).

const eventLoopBlocksV1: Block[] = [
  { id: "blk_el_h2_1", type: "h2", text: "Что такое цикл событий" },
  { id: "blk_el_p_1", type: "p", text: "Первая версия главы: общее введение в event loop." },
  { id: "blk_el_code_1", type: "code", lang: "js", text: "console.log('старая версия');" },
];

const eventLoopBlocksV2: Block[] = [
  { id: "blk_el_h2_1", type: "h2", text: "Что такое цикл событий" },
  {
    id: "blk_el_p_1",
    type: "p",
    text: "Цикл событий — механизм, позволяющий однопоточному JavaScript выполнять неблокирующие операции.",
  },
  { id: "blk_el_h3_1", type: "h3", text: "Очереди микро- и макрозадач" },
  {
    id: "blk_el_list_1",
    type: "list",
    variant: "bullet",
    items: ["Микрозадачи: промисы, queueMicrotask", "Макрозадачи: setTimeout, события"],
  },
  { id: "blk_el_code_1", type: "code", lang: "js", text: "Promise.resolve().then(() => console.log('микротаска'));" },
  {
    id: "blk_el_callout_1",
    type: "callout",
    variant: "warning",
    text: "Микрозадачи всегда опустошаются до следующей макрозадачи.",
  },
  {
    id: "blk_el_mermaid_1",
    type: "mermaid",
    text: "graph TD; CallStack-->Microtasks; Microtasks-->Macrotasks; Macrotasks-->CallStack",
  },
  { id: "blk_el_img_1", type: "image", src: "/uploads/articles/event-loop.png", alt: "Схема цикла событий" },
];

const promisesBlocks: Block[] = [
  { id: "blk_pr_h2_1", type: "h2", text: "Промисы изнутри" },
  { id: "blk_pr_p_1", type: "p", text: "Промис — объект, представляющий результат асинхронной операции." },
  { id: "blk_pr_quote_1", type: "quote", text: "Промис либо разрешается, либо отклоняется — ровно один раз." },
  {
    id: "blk_pr_table_1",
    type: "table",
    rows: [
      ["Состояние", "Описание"],
      ["pending", "ожидание"],
      ["fulfilled", "успешно"],
      ["rejected", "ошибка"],
    ],
  },
  { id: "blk_pr_p_2", type: "p", text: "Этот абзац ещё сыроват и требует правок." },
];

const asyncAwaitBlocks: Block[] = [
  { id: "blk_aa_h2_1", type: "h2", text: "Async/await на практике" },
  { id: "blk_aa_p_1", type: "p", text: "async/await — синтаксический сахар над промисами." },
  {
    id: "blk_aa_code_1",
    type: "code",
    lang: "ts",
    text: "async function load() {\n  const res = await fetch('/api');\n  return res.json();\n}",
  },
  { id: "blk_aa_embed_1", type: "embed", url: "https://www.youtube.com/watch?v=example" },
];

const generatorsBlocks: Block[] = [
  { id: "blk_gn_h2_1", type: "h2", text: "Генераторы и итераторы" },
  { id: "blk_gn_p_1", type: "p", text: "Черновик: набросок про функции-генераторы." },
];

const ghostBlocks: Block[] = [
  { id: "blk_gh_p_1", type: "p", text: "Содержимое скрытого блога заблокированного автора." },
];

const portfolioBlocks: Block[] = [
  { id: "blk_pf_h2_1", type: "h2", text: "Об авторе" },
  { id: "blk_pf_p_1", type: "p", text: "Пишу про асинхронность и внутренности JavaScript-движков." },
];

// ───────────────────────────── основной построитель ─────────────────────────────

/**
 * Полностью пересоздаёт детерминированный набор данных в переданной БД:
 * сначала чистит все таблицы (child→parent), затем вставляет фиксированный снимок (parent→child).
 * Идемпотентно: повторный вызов даёт тот же снимок (id/handle/slug/counts; timestamps — от NOW).
 */
export async function seedAll(db: Db): Promise<void> {
  // ── 1. ОЧИСТКА (порядок child→parent; FK включены в db/index.ts) ──
  await db.delete(commentVotes);
  await db.delete(chapterVotes);
  await db.delete(bookmarks);
  await db.delete(follows);
  await db.delete(threadReplies);
  await db.delete(threads);
  await db.delete(reviewChat);
  await db.delete(reviewChecklists);
  await db.delete(chapterReviewers);
  await db.delete(reviewerHistory);
  await db.delete(reviewInvitations);
  await db.delete(reviewerRatings);
  await db.delete(recruitRequests);
  await db.delete(primaryChangeRequests);
  await db.delete(removedReviewers);
  await db.delete(reports);
  await db.delete(notifications);
  await db.delete(reviewerApplications);
  await db.delete(portfolios);
  await db.delete(publicComments);
  await db.delete(chapterRevisions);
  await db.delete(chapters);
  await db.delete(blogs);
  await db.delete(users);
  await db.delete(boardCalls);
  await db.delete(promoBanners);
  await db.delete(donationMethods);
  await db.delete(appSettings);

  // ── 2. ПОЛЬЗОВАТЕЛИ (4 роли + доп. ревьюеры free/busy/full + заблокированные) ──
  await db.insert(users).values([
    {
      id: "usr_reader",
      handle: "reader",
      role: "reader",
      passwordHash: PWD_HASH,
      displayName: "Рина Читатель",
      slug: "reader",
      bio: "Читаю про фронтенд по вечерам.",
      avatarUrl: "/uploads/avatars/reader.png",
      links: stringifyJson([{ label: "Сайт", url: "https://example.com/rina" }]),
      createdAt: ago(120 * DAY),
    },
    {
      id: "usr_author",
      handle: "author",
      role: "author",
      passwordHash: PWD_HASH,
      displayName: "Антон Автор",
      slug: "author",
      bio: "Пишу про внутренности JavaScript.",
      avatarUrl: "/uploads/avatars/author.png",
      links: stringifyJson([{ label: "GitHub", url: "https://github.com/anton" }]),
      createdAt: ago(110 * DAY),
    },
    {
      id: "usr_reviewer",
      handle: "reviewer",
      role: "reviewer",
      passwordHash: PWD_HASH,
      displayName: "Раиса Ревьюер",
      slug: "reviewer",
      bio: "Рецензирую статьи по фронтенду и архитектуре.",
      competencies: stringifyJson(["TypeScript", "React", "Архитектура", "Event Loop"]),
      reviewerRating: 4.6,
      reviewerRatingsN: 12,
      reviewLoad: 1, // 1/3 → busy
      reviewCapacity: 3,
      createdAt: ago(100 * DAY),
    },
    {
      id: "usr_rev_lena",
      handle: "lena_review",
      role: "reviewer",
      passwordHash: PWD_HASH,
      displayName: "Лена Базы",
      slug: "lena-review",
      competencies: stringifyJson(["Базы данных", "SQL", "Производительность"]),
      reviewerRating: 4.9,
      reviewerRatingsN: 30,
      reviewLoad: 3, // 3/3 → full
      reviewCapacity: 3,
      createdAt: ago(95 * DAY),
    },
    {
      id: "usr_rev_max",
      handle: "max_review",
      role: "reviewer",
      passwordHash: PWD_HASH,
      displayName: "Макс Девопс",
      slug: "max-review",
      competencies: stringifyJson(["DevOps", "Docker", "CI/CD"]),
      reviewerRating: 4.2,
      reviewerRatingsN: 5,
      reviewLoad: 0, // 0/4 → free
      reviewCapacity: 4,
      createdAt: ago(90 * DAY),
    },
    {
      id: "usr_rev_sergey",
      handle: "sergey_review",
      role: "reviewer",
      passwordHash: PWD_HASH,
      displayName: "Сергей Секьюрити",
      slug: "sergey-review",
      competencies: stringifyJson(["Безопасность", "Криптография"]),
      reviewerRating: 3.8,
      reviewerRatingsN: 3,
      reviewLoad: 2, // 2/3 → busy
      reviewCapacity: 3,
      createdAt: ago(85 * DAY),
    },
    {
      id: "usr_troll",
      handle: "troll",
      role: "reader",
      passwordHash: PWD_HASH,
      displayName: "Тролль Заблокированный",
      slug: "troll",
      commentingBlocked: true, // негативный кейс: не может комментировать
      createdAt: ago(40 * DAY),
    },
    {
      id: "usr_ghost",
      handle: "ghost",
      role: "author",
      passwordHash: PWD_HASH,
      displayName: "Гость Призрак",
      slug: "ghost",
      isBlocked: true, // негативный кейс: блог автора скрыт везде
      createdAt: ago(30 * DAY),
    },
  ]);

  // ── 3. БЛОГИ (видимый блог автора + скрытый блог заблокированного автора) ──
  await db.insert(blogs).values([
    {
      id: "blog_async",
      slug: "async-deep-dive",
      title: "Глубоко в асинхронность JavaScript",
      authorId: "usr_author",
      coverUrl: "/uploads/covers/async.png",
      tags: stringifyJson(["JavaScript", "Async", "Event Loop"]),
      complexity: "medium",
      summary: "Серия глав о том, как на самом деле работает асинхронность в JS.",
      publishedAt: ago(60 * DAY),
      lastActivityAt: ago(2 * DAY),
      viewCount: 1280,
      rating: 4.7,
      bookmarkCount: 1,
    },
    {
      id: "blog_ghost",
      slug: "hidden-blog",
      title: "Скрытый блог",
      authorId: "usr_ghost",
      tags: stringifyJson(["Черновик"]),
      complexity: "simple",
      summary: "Не должен показываться в ленте/каталоге (автор заблокирован).",
      publishedAt: ago(25 * DAY),
      lastActivityAt: ago(20 * DAY),
      viewCount: 3,
      rating: 0,
      bookmarkCount: 0,
    },
  ]);

  // ── 4. ГЛАВЫ (все статусы ревизий + skills у каждой) ──
  await db.insert(chapters).values([
    {
      id: "chp_published",
      blogId: "blog_async",
      slug: "event-loop",
      title: "Цикл событий",
      order: 1,
      primaryHandle: "reviewer",
      skills: stringifyJson(["Event Loop", "Микротаски", "Промисы"]),
    },
    {
      id: "chp_under_review",
      blogId: "blog_async",
      slug: "promises",
      title: "Промисы изнутри",
      order: 2,
      primaryHandle: "reviewer",
      skills: stringifyJson(["Промисы", "Then/Catch"]),
    },
    {
      id: "chp_changes",
      blogId: "blog_async",
      slug: "async-await",
      title: "Async/await на практике",
      order: 3,
      primaryHandle: "lena_review",
      skills: stringifyJson(["Async/Await", "Обработка ошибок"]),
    },
    {
      id: "chp_draft",
      blogId: "blog_async",
      slug: "generators",
      title: "Генераторы и итераторы",
      order: 4,
      primaryHandle: null,
      skills: stringifyJson(["Генераторы", "Итераторы"]),
    },
    {
      id: "chp_ghost",
      blogId: "blog_ghost",
      slug: "intro",
      title: "Вступление",
      order: 1,
      skills: stringifyJson(["Прочее"]),
    },
  ]);

  // ── 5. РЕВИЗИИ (опубликованная глава с 2 ревизиями + prev_blocks; остальные статусы) ──
  await db.insert(chapterRevisions).values([
    {
      id: "rev_pub_1",
      chapterId: "chp_published",
      number: 1,
      status: "published",
      summary: "Первая опубликованная версия.",
      blocks: stringifyJson(eventLoopBlocksV1),
      submittedAt: ago(70 * DAY),
      publishedAt: ago(65 * DAY),
    },
    {
      id: "rev_pub_2",
      chapterId: "chp_published",
      number: 2,
      status: "published",
      summary: "Расширенная версия с диаграммами и примерами.",
      blocks: stringifyJson(eventLoopBlocksV2),
      prevBlocks: stringifyJson(eventLoopBlocksV1), // снапшот для инлайн-диффа
      submittedAt: ago(20 * DAY),
      publishedAt: ago(15 * DAY),
    },
    {
      id: "rev_ur_1",
      chapterId: "chp_under_review",
      number: 1,
      status: "under-review",
      summary: "Отправлено на ревью, ожидает вердиктов.",
      blocks: stringifyJson(promisesBlocks),
      submittedAt: ago(5 * DAY),
    },
    {
      id: "rev_cr_1",
      chapterId: "chp_changes",
      number: 1,
      status: "changes-requested",
      summary: "Запрошены правки ведущим ревьюером.",
      blocks: stringifyJson(asyncAwaitBlocks),
      submittedAt: ago(10 * DAY),
    },
    {
      id: "rev_draft_1",
      chapterId: "chp_draft",
      number: 1,
      status: "draft",
      summary: "Черновик, ещё не отправлен.",
      blocks: stringifyJson(generatorsBlocks),
    },
    {
      id: "rev_ghost_1",
      chapterId: "chp_ghost",
      number: 1,
      status: "draft",
      blocks: stringifyJson(ghostBlocks),
    },
  ]);

  // ── 6. РЕВЬЮЕРЫ НА РЕВИЗИЮ (ведущий + вердикты) ──
  await db.insert(chapterReviewers).values([
    // опубликованная глава, версия 1 — все approve
    { chapterId: "chp_published", revisionNumber: 1, handle: "reviewer", isPrimary: true, verdict: "approve", verdictAt: ago(66 * DAY) },
    { chapterId: "chp_published", revisionNumber: 1, handle: "lena_review", verdict: "approve", verdictAt: ago(66 * DAY) },
    // опубликованная глава, версия 2 — все approve (публикабельно)
    { chapterId: "chp_published", revisionNumber: 2, handle: "reviewer", isPrimary: true, verdict: "approve", verdictAt: ago(16 * DAY) },
    { chapterId: "chp_published", revisionNumber: 2, handle: "max_review", verdict: "approve", verdictAt: ago(16 * DAY) },
    // под ревью — смешанные вердикты, presence online
    { chapterId: "chp_under_review", revisionNumber: 1, handle: "reviewer", isPrimary: true, online: true },
    { chapterId: "chp_under_review", revisionNumber: 1, handle: "lena_review", verdict: "request-changes", verdictAt: ago(2 * DAY) },
    { chapterId: "chp_under_review", revisionNumber: 1, handle: "sergey_review" },
    // запрошены правки — ведущий request-changes
    { chapterId: "chp_changes", revisionNumber: 1, handle: "lena_review", isPrimary: true, verdict: "request-changes", verdictAt: ago(8 * DAY) },
    { chapterId: "chp_changes", revisionNumber: 1, handle: "reviewer", verdict: "approve", verdictAt: ago(9 * DAY) },
  ]);

  // ── 7. КРЕДИТ РЕВЬЮЕРОВ ПО ВЕРСИЯМ (для опубликованной главы) ──
  await db.insert(reviewerHistory).values([
    { chapterId: "chp_published", revisionNumber: 1, handle: "reviewer" },
    { chapterId: "chp_published", revisionNumber: 1, handle: "lena_review" },
    { chapterId: "chp_published", revisionNumber: 2, handle: "reviewer" },
    { chapterId: "chp_published", revisionNumber: 2, handle: "max_review" },
  ]);

  // ── 8. ТРЕДЫ (open/resolved + suggestion для apply-and-close) ──
  await db.insert(threads).values([
    {
      id: "thr_open_1",
      chapterId: "chp_under_review",
      revisionNumber: 1,
      blockId: "blk_pr_p_2",
      anchor: "Этот абзац ещё сыроват",
      status: "open",
      fromHandle: "reviewer",
      text: "Этот абзац стоит переписать — слишком расплывчато.",
      createdAt: ago(4 * DAY),
    },
    {
      id: "thr_open_2",
      chapterId: "chp_under_review",
      revisionNumber: 1,
      blockId: "blk_pr_quote_1",
      anchor: "ровно один раз",
      status: "open",
      fromHandle: "lena_review",
      text: "Предлагаю уточнить формулировку.",
      suggestion: stringifyJson({
        from: "Промис либо разрешается, либо отклоняется — ровно один раз.",
        to: "Промис переходит из pending ровно один раз — в fulfilled или rejected.",
      }),
      createdAt: ago(3 * DAY),
    },
    {
      id: "thr_resolved_1",
      chapterId: "chp_changes",
      revisionNumber: 1,
      blockId: "blk_aa_code_1",
      anchor: "fetch('/api')",
      status: "resolved",
      fromHandle: "lena_review",
      text: "Добавьте обработку ошибок в пример.",
      createdAt: ago(9 * DAY),
    },
  ]);

  // ── 9. ОТВЕТЫ В ТРЕДАХ (автор участвует в ревью своей главы) ──
  await db.insert(threadReplies).values([
    { id: "trp_1", threadId: "thr_open_1", fromHandle: "author", text: "Принято, перепишу к следующей версии.", createdAt: ago(4 * DAY - 2 * HOUR) },
    { id: "trp_2", threadId: "thr_open_1", fromHandle: "reviewer", text: "Спасибо!", createdAt: ago(4 * DAY - 1 * HOUR) },
    { id: "trp_3", threadId: "thr_resolved_1", fromHandle: "author", text: "Добавил try/catch.", createdAt: ago(8 * DAY) },
  ]);

  // ── 10. ЧАТ СЕССИИ РЕВЬЮ (вне тредов, несколько участников) ──
  await db.insert(reviewChat).values([
    { id: "rch_1", chapterId: "chp_under_review", revisionNumber: 1, fromHandle: "reviewer", text: "Начинаю смотреть главу.", createdAt: ago(5 * DAY) },
    { id: "rch_2", chapterId: "chp_under_review", revisionNumber: 1, fromHandle: "author", text: "Спасибо! Жду замечаний.", createdAt: ago(5 * DAY - 30 * MIN) },
    { id: "rch_3", chapterId: "chp_under_review", revisionNumber: 1, fromHandle: "lena_review", text: "Подключилась к ревью.", createdAt: ago(4 * DAY) },
  ]);

  // ── 11. ЧЕК-ЛИСТ ГОТОВНОСТИ ──
  await db.insert(reviewChecklists).values([
    {
      id: "rcl_1",
      chapterId: "chp_under_review",
      items: stringifyJson([
        { text: "Проверены примеры кода", checked: true },
        { text: "Нет битых ссылок", checked: false },
        { text: "Заполнены ключевые навыки", checked: true },
      ]),
      createdAt: ago(5 * DAY),
    },
  ]);

  // ── 12. ПУБЛИЧНЫЕ КОММЕНТАРИИ (вложенность ≤2, старая ревизия, окно правки, soft-delete, anchor) ──
  // Порядок: родители перед детьми (parentId самоссылается).
  await db.insert(publicComments).values([
    {
      id: "cmt_root",
      blogSlug: "async-deep-dive",
      chapterSlug: "event-loop",
      revision: 2,
      authorId: "usr_reader",
      text: "Отличное объяснение микротасок!",
      createdAt: ago(2 * DAY),
    },
    {
      id: "cmt_reply_author",
      blogSlug: "async-deep-dive",
      chapterSlug: "event-loop",
      revision: 2,
      authorId: "usr_author",
      parentId: "cmt_root",
      text: "Спасибо! Рад, что зашло.",
      createdAt: ago(2 * DAY - 3 * HOUR),
    },
    {
      id: "cmt_reply_reader",
      blogSlug: "async-deep-dive",
      chapterSlug: "event-loop",
      revision: 2,
      authorId: "usr_reader",
      parentId: "cmt_reply_author", // глубина 2 (root→author→reader) — максимум ≤2; edge case для API-гейта
      text: "Будет ли глава про воркеры?",
      createdAt: ago(2 * DAY - 2 * HOUR),
    },
    {
      id: "cmt_old_revision",
      blogSlug: "async-deep-dive",
      chapterSlug: "event-loop",
      revision: 1, // к ПРОШЛОЙ ревизии — спойлер «прошлые версии»
      authorId: "usr_reader",
      text: "Комментарий к первой версии главы.",
      createdAt: ago(50 * DAY),
    },
    {
      id: "cmt_fresh",
      blogSlug: "async-deep-dive",
      chapterSlug: "event-loop",
      revision: 2,
      authorId: "usr_reader",
      text: "Только что заметил опечатку (в окне правки).",
      anchor: stringifyJson({ blockId: "blk_el_p_1", quote: "неблокирующие операции" }),
      // в окне правки ≤15 мин — ⚠️ «протухает» через 15 мин после seed: тест окна правки запускать сразу.
      createdAt: ago(5 * MIN),
    },
    {
      id: "cmt_stale",
      blogSlug: "async-deep-dive",
      chapterSlug: "event-loop",
      revision: 2,
      authorId: "usr_reader",
      text: "Этот комментарий уже нельзя редактировать (вне окна).",
      editedAt: ago(2 * HOUR - 10 * MIN),
      createdAt: ago(2 * HOUR), // вне окна правки
    },
    {
      id: "cmt_deleted",
      blogSlug: "async-deep-dive",
      chapterSlug: "event-loop",
      revision: 2,
      authorId: "usr_reader",
      text: "[удалённый комментарий]",
      deletedAt: ago(1 * DAY), // soft delete
      createdAt: ago(3 * DAY),
    },
  ]);

  // ── 13. ГОЛОСА ЗА КОММЕНТАРИИ (ненулевые; uniqueIndex user+comment) ──
  await db.insert(commentVotes).values([
    { id: "cv_1", userId: "usr_reader", commentId: "cmt_reply_author", value: 1, createdAt: ago(1 * DAY) },
    { id: "cv_2", userId: "usr_author", commentId: "cmt_root", value: 1, createdAt: ago(1 * DAY) },
    { id: "cv_3", userId: "usr_troll", commentId: "cmt_root", value: -1, createdAt: ago(1 * DAY) },
  ]);

  // ── 14. ГОЛОСА ЗА ГЛАВЫ (ненулевые; uniqueIndex user+chapter) ──
  await db.insert(chapterVotes).values([
    { id: "chv_1", userId: "usr_reader", chapterId: "chp_published", value: 1, createdAt: ago(2 * DAY) },
    { id: "chv_2", userId: "usr_troll", chapterId: "chp_published", value: 1, createdAt: ago(2 * DAY) },
  ]);

  // ── 15. ЗАКЛАДКИ (ненулевые; uniqueIndex user+blog) ──
  await db.insert(bookmarks).values([
    { id: "bm_1", userId: "usr_reader", blogId: "blog_async", createdAt: ago(3 * DAY) },
  ]);

  // ── 16. ПОДПИСКИ читатель → автор ──
  await db.insert(follows).values([
    { userId: "usr_reader", authorId: "usr_author", createdAt: ago(10 * DAY) },
  ]);

  // ── 17. УВЕДОМЛЕНИЯ (прочит. + непрочит. → бейдж>0; + admin-broadcast) ──
  await db.insert(notifications).values([
    {
      id: "ntf_new_chapter",
      recipientId: "usr_reader",
      type: "new_chapter",
      payload: stringifyJson({ blogSlug: "async-deep-dive", chapterSlug: "event-loop", title: "Цикл событий" }),
      isRead: false,
      createdAt: ago(15 * DAY),
    },
    {
      id: "ntf_review_turn",
      recipientId: "usr_author",
      type: "review_turn", // «ваш ход в ревью»
      payload: stringifyJson({ chapterId: "chp_under_review", chapterSlug: "promises" }),
      isRead: false,
      createdAt: ago(2 * DAY),
    },
    {
      id: "ntf_read",
      recipientId: "usr_reader",
      type: "comment_reply",
      payload: stringifyJson({ commentId: "cmt_reply_author" }),
      isRead: true,
      createdAt: ago(2 * DAY - 3 * HOUR),
    },
    {
      id: "ntf_admin",
      recipientId: null,
      isAdminRecipient: true, // уведомление админу
      type: "report_filed",
      payload: stringifyJson({ reportId: "rpt_1", targetType: "comment" }),
      isRead: false,
      createdAt: ago(1 * DAY),
    },
  ]);

  // ── 18. ПОРТФОЛИО «Об авторе» (видимое + скрытое) ──
  await db.insert(portfolios).values([
    { id: "pf_author", authorId: "usr_author", blocks: stringifyJson(portfolioBlocks), isVisible: true, updatedAt: ago(12 * DAY) },
    { id: "pf_ghost", authorId: "usr_ghost", blocks: stringifyJson(ghostBlocks), isVisible: false, updatedAt: ago(25 * DAY) },
  ]);

  // ── 19. ЖАЛОБЫ (admin-facing) ──
  await db.insert(reports).values([
    { id: "rpt_1", reporterId: "usr_reader", targetType: "comment", targetId: "cmt_deleted", reason: "Спам в комментариях", status: "open", createdAt: ago(1 * DAY) },
  ]);

  // ── 20. ЗАЯВКА НА СМЕНУ ВЕДУЩЕГО (admin-facing) ──
  await db.insert(primaryChangeRequests).values([
    { id: "pcr_1", chapterId: "chp_under_review", fromHandle: "reviewer", toHandle: "sergey_review", status: "pending", createdAt: ago(1 * DAY) },
  ]);

  // ── 21. СНЯТЫЕ РЕВЬЮЕРЫ (лог админа) ──
  await db.insert(removedReviewers).values([
    { id: "rmv_1", blogSlug: "async-deep-dive", chapterSlug: "promises", handle: "max_review", byAdmin: "admin", reason: "Конфликт интересов", createdAt: ago(6 * DAY) },
  ]);

  // ── 22. ПРИГЛАШЕНИЯ РЕВЬЮЕРАМ (все 4 статуса) ──
  await db.insert(reviewInvitations).values([
    { id: "inv_pending", chapterId: "chp_under_review", revision: 1, toHandle: "sergey_review", asLead: false, note: "Нужен взгляд по безопасности.", status: "pending", invitedAt: ago(3 * DAY) },
    { id: "inv_accepted", chapterId: "chp_under_review", revision: 1, toHandle: "reviewer", asLead: true, status: "accepted", invitedAt: ago(6 * DAY), respondedAt: ago(5 * DAY) },
    { id: "inv_declined", chapterId: "chp_changes", revision: 1, toHandle: "max_review", status: "declined", invitedAt: ago(12 * DAY), respondedAt: ago(11 * DAY) },
    { id: "inv_flagged", chapterId: "chp_changes", revision: 1, toHandle: "sergey_review", status: "flagged", flagReason: "Навыки не совпадают (match < 50%).", invitedAt: ago(12 * DAY), respondedAt: ago(11 * DAY) },
  ]);

  // ── 23. ОЦЕНКИ РЕВЬЮЕРОВ АВТОРОМ (приватно, 1..5) ──
  await db.insert(reviewerRatings).values([
    { chapterId: "chp_published", reviewerHandle: "reviewer", byHandle: "author", stars: 5, createdAt: ago(14 * DAY) },
    { chapterId: "chp_published", reviewerHandle: "max_review", byHandle: "author", stars: 4, createdAt: ago(14 * DAY) },
  ]);

  // ── 24. ЗАПРОСЫ «НАЙДИТЕ РЕВЬЮЕРОВ» (pending/approved/rejected) ──
  await db.insert(recruitRequests).values([
    { id: "rec_pending", chapterId: "chp_draft", byHandle: "author", skills: stringifyJson(["Генераторы", "Итераторы"]), status: "pending", createdAt: ago(2 * DAY) },
    { id: "rec_approved", chapterId: "chp_changes", byHandle: "author", skills: stringifyJson(["Async/Await"]), status: "approved", createdAt: ago(13 * DAY), resolvedAt: ago(12 * DAY) },
    { id: "rec_rejected", chapterId: null, byHandle: "author", skills: stringifyJson(["Прочее"]), status: "rejected", reason: "Недостаточно деталей в запросе.", createdAt: ago(20 * DAY), resolvedAt: ago(19 * DAY) },
  ]);

  // ── 25. ПУБЛИЧНАЯ ДОСКА «Ищем ревьюеров» (ведёт админ) ──
  await db.insert(boardCalls).values([
    { id: "bc_frontend", area: "Frontend", skills: stringifyJson(["React", "TypeScript"]), waiting: 3, note: "Нужны ревьюеры по React.", hot: true },
    { id: "bc_backend", area: "Backend", skills: stringifyJson(["Node.js", "SQL"]), waiting: 1, hot: false },
  ]);

  // ── 26. ЗАЯВКИ apply-to-review (вкл. гостевую byHandle=null) ──
  await db.insert(reviewerApplications).values([
    { id: "app_user", byHandle: "reader", area: "Frontend", skills: stringifyJson(["CSS", "React"]), message: "Хочу рецензировать статьи по фронтенду.", status: "pending", createdAt: ago(4 * DAY) },
    { id: "app_guest", byHandle: null, name: "Иван Гость", area: "DevOps", skills: stringifyJson(["Docker", "Kubernetes"]), message: "Готов помогать с инфраструктурными статьями.", status: "accepted", createdAt: ago(8 * DAY) },
  ]);

  // ── 27. ПРОМО-БАННЕРЫ ЛЕНТЫ (разные action: internal/external/donate) ──
  await db.insert(promoBanners).values([
    { id: "pb_recruit", eyebrow: "Сообщество", title: "Станьте ревьюером Recenza", cta: "Подать заявку", tone: "teal", icon: "users", action: "internal", target: "/reviewer/apply", visible: true, sort: 0 },
    { id: "pb_partner", eyebrow: "Партнёрам", title: "Курс по асинхронности", cta: "Узнать больше", tone: "neutral", icon: "book", action: "external", target: "https://example.com/course", visible: true, sort: 1 },
    { id: "pb_donate", eyebrow: "Поддержка", title: "Поддержите проект", cta: "Поддержать", tone: "amber", icon: "heart", action: "donate", target: "", visible: true, sort: 2 },
  ]);

  // ── 28. СПОСОБЫ ПОЖЕРТВОВАНИЯ (link + qr) + singleton-флаг ──
  await db.insert(donationMethods).values([
    { id: "dm_link", name: "DonationAlerts", type: "link", url: "https://www.donationalerts.com/r/recenza", hint: "Разовая поддержка", visible: true, isPrimary: true, sort: 0 },
    { id: "dm_qr", name: "СБП", type: "qr", qrUrl: "/uploads/donations/sbp-qr.png", hint: "Отсканируйте в приложении банка", visible: true, isPrimary: false, sort: 1 },
  ]);

  await db.insert(appSettings).values([
    { key: "donations_enabled", value: "true" },
  ]);
}
