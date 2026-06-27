// Recenza — глава-ориентированная схема БД (Drizzle, dialect `turso`).
// Источник правды по полям: docs/migration/ENVIRONMENTS.md §4 + docs/prototype/README.md §8, §11.9.
// Конвенции (CLAUDE.md / .claude/skills/drizzle-schema):
//   snake_case колонки · PK = text id со значением ulid() · timestamps = Unix seconds (integer)
//   JSON-поля хранятся как text и читаются ТОЛЬКО через parseJson() в try/catch (см. ./json.ts)
//   booleans = integer({ mode: "boolean" }) · enum = text({ enum }) (валидация значений — на API-слое)
//   engagement-таблицы: uniqueIndex + db.transaction() для race-safe toggle.
// Файл намеренно self-contained (импортирует только drizzle-orm + ulid), чтобы drizzle-kit
// бандлил его без резолва path-alias. Общие типы и union'ы — в src/types/index.ts (re-export отсюда).

import {
  type AnySQLiteColumn,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { ulid } from "ulid";

// --- Перечисления (единый источник; src/types/index.ts выводит из них union-типы) ---
export const ROLES = ["reader", "author", "reviewer", "admin"] as const;
export const REVISION_STATUSES = [
  "draft",
  "under-review",
  "changes-requested",
  "published",
] as const;
export const VERDICTS = ["approve", "request-changes"] as const;
export const THREAD_STATUSES = ["open", "resolved"] as const;
export const REPORT_STATUSES = ["open", "resolved"] as const;
export const COMPLEXITIES = ["simple", "medium", "complex"] as const;
export const INVITATION_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "flagged",
] as const;
export const RECRUIT_STATUSES = ["pending", "approved", "rejected"] as const;
export const APPLICATION_STATUSES = ["pending", "accepted", "declined"] as const;
export const BANNER_ACTIONS = ["internal", "external", "donate"] as const;
export const DONATION_TYPES = ["link", "qr"] as const;

const id = () => text("id").primaryKey().$defaultFn(() => ulid());

// ───────────────────────────── ядро: пользователи и настройки ─────────────────────────────

export const users = sqliteTable("users", {
  id: id(),
  handle: text("handle").notNull().unique(), // иммутабелен (см. PLAN §decisions); на него ссылаются ревью-таблицы
  role: text("role", { enum: ROLES }).notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  links: text("links"), // JSON LinkItem[] → parseJson
  slug: text("slug").notNull().unique(),
  isBlocked: integer("is_blocked", { mode: "boolean" }).notNull().default(false),
  commentingBlocked: integer("commenting_blocked", { mode: "boolean" })
    .notNull()
    .default(false),
  // этап «подбор ревьюеров»
  competencies: text("competencies"), // JSON string[] → parseJson
  reviewerRating: real("reviewer_rating"),
  reviewerRatingsN: integer("reviewer_ratings_n"),
  reviewLoad: integer("review_load").notNull().default(0),
  reviewCapacity: integer("review_capacity").notNull().default(3),
  createdAt: integer("created_at").notNull(),
});

// Singleton-флаги вида donations_enabled (§11.9 «settings/kv»).
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});

// ───────────────────────────── блоги · главы · ревизии ─────────────────────────────

export const blogs = sqliteTable("blogs", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  coverUrl: text("cover_url"),
  tags: text("tags"), // JSON string[] → parseJson
  complexity: text("complexity", { enum: COMPLEXITIES }).notNull(),
  summary: text("summary"),
  publishedAt: integer("published_at"),
  lastActivityAt: integer("last_activity_at"),
  viewCount: integer("view_count").notNull().default(0),
  rating: real("rating").notNull().default(0),
  bookmarkCount: integer("bookmark_count").notNull().default(0),
});

export const chapters = sqliteTable(
  "chapters",
  {
    id: id(),
    blogId: text("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    order: integer("order").notNull(),
    primaryHandle: text("primary_handle").references(() => users.handle), // ведущий ревьюер (может быть не назначен)
    skills: text("skills"), // JSON string[] — ключевые навыки статьи (обяз. для отправки, видны читателю)
  },
  (t) => [unique("chapters_blog_slug_uq").on(t.blogId, t.slug)],
);

export const chapterRevisions = sqliteTable(
  "chapter_revisions",
  {
    id: id(),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    status: text("status", { enum: REVISION_STATUSES }).notNull().default("draft"),
    summary: text("summary"),
    blocks: text("blocks"), // JSON Block[] (текущий контент) → parseJson
    prevBlocks: text("prev_blocks"), // JSON Block[] (снапшот последней публикации, для инлайн-диффа)
    submittedAt: integer("submitted_at"),
    publishedAt: integer("published_at"),
  },
  (t) => [unique("chapter_revisions_chapter_number_uq").on(t.chapterId, t.number)],
);

// ───────────────────────────── ревью-флоу ─────────────────────────────

// Назначения + вердикты на ревизию (вердикт per-revision — следуем ENVIRONMENTS §4, не §8).
export const chapterReviewers = sqliteTable(
  "chapter_reviewers",
  {
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    handle: text("handle")
      .notNull()
      .references(() => users.handle),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    verdict: text("verdict", { enum: VERDICTS }),
    verdictAt: integer("verdict_at"),
    online: integer("online", { mode: "boolean" }).notNull().default(false),
    typing: integer("typing", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.chapterId, t.revisionNumber, t.handle] })],
);

// Кредит ревьюеров по версиям (для опубликованной главы).
export const reviewerHistory = sqliteTable(
  "reviewer_history",
  {
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    handle: text("handle")
      .notNull()
      .references(() => users.handle),
  },
  (t) => [primaryKey({ columns: [t.chapterId, t.revisionNumber, t.handle] })],
);

export const threads = sqliteTable("threads", {
  id: id(),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  revisionNumber: integer("revision_number").notNull(),
  blockId: text("block_id").notNull(),
  anchor: text("anchor"), // цитата-якорь (строка)
  status: text("status", { enum: THREAD_STATUSES }).notNull().default("open"),
  fromHandle: text("from_handle")
    .notNull()
    .references(() => users.handle),
  text: text("text").notNull(),
  suggestion: text("suggestion"), // JSON { from, to } | null → parseJson (apply-and-close)
  createdAt: integer("created_at").notNull(),
});

export const threadReplies = sqliteTable("thread_replies", {
  id: id(),
  threadId: text("thread_id")
    .notNull()
    .references(() => threads.id, { onDelete: "cascade" }),
  fromHandle: text("from_handle")
    .notNull()
    .references(() => users.handle),
  text: text("text").notNull(),
  createdAt: integer("created_at").notNull(),
});

// Чат сессии ревью — вне тредов.
export const reviewChat = sqliteTable("review_chat", {
  id: id(),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  revisionNumber: integer("revision_number").notNull(),
  fromHandle: text("from_handle")
    .notNull()
    .references(() => users.handle),
  text: text("text").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const reviewChecklists = sqliteTable("review_checklists", {
  id: id(),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  items: text("items"), // JSON [{ text, checked }] → parseJson
  createdAt: integer("created_at").notNull(),
});

// ───────────────────────────── взаимодействие · модерация ─────────────────────────────

export const publicComments = sqliteTable("public_comments", {
  id: id(),
  blogSlug: text("blog_slug").notNull(),
  chapterSlug: text("chapter_slug").notNull(),
  revision: integer("revision").notNull(),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  parentId: text("parent_id").references((): AnySQLiteColumn => publicComments.id, {
    onDelete: "cascade",
  }), // вложенность ≤2 — гейтится на API
  text: text("text").notNull(),
  anchor: text("anchor"), // JSON CommentAnchor { blockId, quote } | null → parseJson (ключи JSON — camelCase; тип в src/types — единый источник)
  editedAt: integer("edited_at"),
  deletedAt: integer("deleted_at"), // soft delete
  createdAt: integer("created_at").notNull(),
});

export const commentVotes = sqliteTable(
  "comment_votes",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commentId: text("comment_id")
      .notNull()
      .references(() => publicComments.id, { onDelete: "cascade" }),
    value: integer("value").notNull(), // +1 / -1
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("comment_votes_user_comment_uq").on(t.userId, t.commentId)],
);

export const chapterVotes = sqliteTable(
  "chapter_votes",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    value: integer("value").notNull(), // +1 / -1
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("chapter_votes_user_chapter_uq").on(t.userId, t.chapterId)],
);

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blogId: text("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("bookmarks_user_blog_uq").on(t.userId, t.blogId)],
);

// Подписки читатель → автор (PLAN §decisions: автор-центрично, не по blog_id).
export const follows = sqliteTable(
  "follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.authorId] })],
);

// recipient_id = NULL + is_admin_recipient → уведомление админу.
export const notifications = sqliteTable("notifications", {
  id: id(),
  recipientId: text("recipient_id").references(() => users.id, { onDelete: "cascade" }),
  isAdminRecipient: integer("is_admin_recipient", { mode: "boolean" })
    .notNull()
    .default(false),
  type: text("type").notNull(),
  payload: text("payload"), // JSON → parseJson
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

// «Об авторе» — один на автора, публикуется БЕЗ ревью.
export const portfolios = sqliteTable("portfolios", {
  id: id(),
  authorId: text("author_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  blocks: text("blocks"), // JSON Block[] → parseJson
  isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at").notNull(),
});

export const reports = sqliteTable("reports", {
  id: id(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: REPORT_STATUSES }).notNull().default("open"),
  createdAt: integer("created_at").notNull(),
});

export const primaryChangeRequests = sqliteTable("primary_change_requests", {
  id: id(),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  fromHandle: text("from_handle")
    .notNull()
    .references(() => users.handle),
  toHandle: text("to_handle")
    .notNull()
    .references(() => users.handle),
  status: text("status").notNull(), // не в §2.4-списке enum'ов → plain text
  createdAt: integer("created_at").notNull(),
});

export const removedReviewers = sqliteTable("removed_reviewers", {
  id: id(),
  blogSlug: text("blog_slug").notNull(),
  chapterSlug: text("chapter_slug").notNull(),
  handle: text("handle")
    .notNull()
    .references(() => users.handle),
  byAdmin: text("by_admin").notNull(), // идентификатор админа (README §2 removedReviewers[].by), не флаг
  reason: text("reason"),
  createdAt: integer("created_at").notNull(),
});

// ───────────────────────────── подбор · согласие · оценка · монетизация (§11.9) ─────────────────────────────

// Приглашение ревьюеру; ревью стартует ТОЛЬКО после accept.
export const reviewInvitations = sqliteTable("review_invitations", {
  id: id(),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  toHandle: text("to_handle")
    .notNull()
    .references(() => users.handle),
  asLead: integer("as_lead", { mode: "boolean" }).notNull().default(false),
  note: text("note"),
  status: text("status", { enum: INVITATION_STATUSES }).notNull().default("pending"),
  flagReason: text("flag_reason"), // при status='flagged' (навыки не совпадают)
  invitedAt: integer("invited_at").notNull(),
  respondedAt: integer("responded_at"),
});

// Приватно (ревьюер + админ); в «Топ» идёт только агрегат.
export const reviewerRatings = sqliteTable(
  "reviewer_ratings",
  {
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    reviewerHandle: text("reviewer_handle")
      .notNull()
      .references(() => users.handle),
    byHandle: text("by_handle")
      .notNull()
      .references(() => users.handle), // автор
    stars: integer("stars").notNull(), // 1..5 (валидация диапазона — на API)
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.chapterId, t.reviewerHandle, t.byHandle] })],
);

// Автор → админ «найдите ревьюеров» (запасной путь; блог нельзя опубликовать без ревью).
export const recruitRequests = sqliteTable("recruit_requests", {
  id: id(),
  chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "cascade" }), // nullable (§11.9)
  byHandle: text("by_handle")
    .notNull()
    .references(() => users.handle),
  skills: text("skills"), // JSON string[] → parseJson
  status: text("status", { enum: RECRUIT_STATUSES }).notNull().default("pending"),
  reason: text("reason"), // причина reject
  createdAt: integer("created_at").notNull(),
  resolvedAt: integer("resolved_at"),
});

// Публичная доска «Ищем ревьюеров» (ведёт админ).
export const boardCalls = sqliteTable("board_calls", {
  id: id(),
  area: text("area").notNull(),
  skills: text("skills"), // JSON string[] → parseJson
  waiting: integer("waiting").notNull().default(0),
  note: text("note"),
  hot: integer("hot", { mode: "boolean" }).notNull().default(false),
});

// Apply-to-review с доски (by_handle = null → гость).
export const reviewerApplications = sqliteTable("reviewer_applications", {
  id: id(),
  byHandle: text("by_handle").references(() => users.handle),
  name: text("name"),
  area: text("area"),
  skills: text("skills"), // JSON string[] → parseJson
  message: text("message"),
  status: text("status", { enum: APPLICATION_STATUSES }).notNull().default("pending"),
  createdAt: integer("created_at").notNull(),
});

// Карусель промо на ленте (админ).
export const promoBanners = sqliteTable("promo_banners", {
  id: id(),
  eyebrow: text("eyebrow"),
  title: text("title"),
  cta: text("cta"),
  tone: text("tone"),
  icon: text("icon"),
  action: text("action", { enum: BANNER_ACTIONS }),
  target: text("target"), // url / route
  coverUrl: text("cover_url"),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

// Модалка «Поддержать» (админ); QR — загрузка, без генерации.
export const donationMethods = sqliteTable("donation_methods", {
  id: id(),
  name: text("name").notNull(),
  type: text("type", { enum: DONATION_TYPES }).notNull(),
  url: text("url"), // для type='link'
  qrUrl: text("qr_url"), // загруженное изображение QR (для type='qr')
  hint: text("hint"),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  sort: integer("sort").notNull().default(0),
});
