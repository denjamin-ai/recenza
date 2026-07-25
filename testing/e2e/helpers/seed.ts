/**
 * Детерминированные сущности seed-теста (src/lib/db/seed-core.ts) — единственный
 * источник «магических строк» для спеков. При изменении seed правь здесь и только здесь.
 */

export const BASE_URL = "http://localhost:3001";

/** Пароль всех seed-пользователей. Админ — не в seed: env ADMIN_PASSWORD_PLAIN (.env.test). */
export const PASSWORD = "password";

/**
 * Фаза 13: роли заменены ВОЗМОЖНОСТЯМИ (`canAuthor`/`isReviewer`); обе false = читатель
 * (базовый уровень, есть у всех). Поле `role` в seed осталось legacy-shim'ом и в спеках
 * НЕ используется — гейты его не читают.
 */
export const USERS = {
  reader: { id: "usr_reader", handle: "reader", slug: "reader", canAuthor: false, isReviewer: false },
  author: { id: "usr_author", handle: "author", slug: "author", canAuthor: true, isReviewer: false },
  reviewer: { id: "usr_reviewer", handle: "reviewer", slug: "reviewer", canAuthor: false, isReviewer: true },
  lena: { id: "usr_rev_lena", handle: "lena_review", slug: "lena-review", canAuthor: false, isReviewer: true },
  max: { id: "usr_rev_max", handle: "max_review", slug: "max-review", canAuthor: false, isReviewer: true },
  sergey: { id: "usr_rev_sergey", handle: "sergey_review", slug: "sergey-review", canAuthor: false, isReviewer: true },
  /** Читатель с commentingBlocked=true */
  troll: { id: "usr_troll", handle: "troll", slug: "troll", canAuthor: false, isReviewer: false },
  /** Заблокированный автор (isBlocked=true), его блог скрыт */
  ghost: { id: "usr_ghost", handle: "ghost", slug: "ghost", canAuthor: true, isReviewer: false },
  /** Ф13: ОБЕ возможности сразу — доказательство единого аккаунта. Блогов и ревью не имеет. */
  duo: { id: "usr_duo", handle: "duo", slug: "duo", canAuthor: true, isReviewer: true },
} as const;

export const BLOG = {
  id: "blog_async",
  slug: "async-deep-dive",
  title: "Глубоко в асинхронность JavaScript",
} as const;

export const HIDDEN_BLOG = { id: "blog_ghost", slug: "hidden-blog", title: "Скрытый блог" } as const;

/**
 * Ф13 — состояние главы описывается ДВУМЯ осями: status (draft|published) + reviewStatus
 * (none|requested|in-review|changes-requested|reviewed).
 */
export const CHAPTERS = {
  /** published + reviewed, ревизии v1+v2 (prevBlocks), primary: reviewer */
  published: { id: "chp_published", slug: "event-loop", title: "Цикл событий" },
  /** draft + in-review, назначены reviewer (primary) + lena_review */
  underReview: { id: "chp_under_review", slug: "promises", title: "Промисы изнутри" },
  /** draft + changes-requested, primary: lena_review */
  changesRequested: { id: "chp_changes", slug: "async-await", title: "Async/await на практике" },
  /** draft + none, ревьюеров нет — отправная точка сквозных флоу и свободной публикации */
  draft: { id: "chp_draft", slug: "generators", title: "Генераторы и итераторы" },
  /** draft + none в скрытом блоге ghost — мишень негативов ownership */
  ghost: { id: "chp_ghost", slug: "intro", title: "Вступление" },
} as const;

export const THREADS = {
  open1: "thr_open_1",
  /** содержит suggestion — цель apply-and-close */
  open2: "thr_open_2",
  resolved: "thr_resolved_1",
} as const;

export const COMMENTS = {
  root: "cmt_root",
  replyAuthor: "cmt_reply_author",
  /** глубина 2 — максимум, ответ на него → 409 */
  replyReader: "cmt_reply_reader",
  /** к ревизии v1 — спойлер «прошлые версии» */
  oldRevision: "cmt_old_revision",
  /** создан «только что» — протухает через 15 минут после seed! */
  fresh: "cmt_fresh",
  /** создан 2 часа назад — правка → 403 */
  stale: "cmt_stale",
  /** soft-delete tombstone */
  deleted: "cmt_deleted",
} as const;

export const INVITATIONS = {
  /** sergey_review → chp_under_review */
  pending: "inv_pending",
  declined: "inv_declined",
  flagged: "inv_flagged",
} as const;

export const RECRUITS = { pending: "rec_pending", approved: "rec_approved", rejected: "rec_rejected" } as const;
export const BOARD_CALLS = { frontend: "bc_frontend", backend: "bc_backend" } as const;
export const APPLICATIONS = { user: "app_user", guest: "app_guest" } as const;
export const BANNERS = { recruit: "pb_recruit", partner: "pb_partner", donate: "pb_donate" } as const;
/** Тексты seed-баннеров карусели (ui-feedback-4 П7: recruit-слайд = тексты прототипа). */
export const BANNER_TEXTS = {
  recruit: { eyebrow: "Ищем ревьюеров", title: "Рецензируйте статьи по своим навыкам", cta: "Стать ревьюером" },
  donate: { title: "Поддержите проект", cta: "Поддержать" },
} as const;
export const DONATION_METHODS = { link: "dm_link", qr: "dm_qr" } as const;
export const REPORT_ID = "rpt_1";
export const PRIMARY_CHANGE_ID = "pcr_1";
