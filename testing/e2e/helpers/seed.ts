/**
 * Детерминированные сущности seed-теста (src/lib/db/seed-core.ts) — единственный
 * источник «магических строк» для спеков. При изменении seed правь здесь и только здесь.
 */

export const BASE_URL = "http://localhost:3001";

/** Пароль всех seed-пользователей. Админ — не в seed: env ADMIN_PASSWORD_PLAIN (.env.test). */
export const PASSWORD = "password";

export const USERS = {
  reader: { id: "usr_reader", handle: "reader", slug: "reader", role: "reader" },
  author: { id: "usr_author", handle: "author", slug: "author", role: "author" },
  reviewer: { id: "usr_reviewer", handle: "reviewer", slug: "reviewer", role: "reviewer" },
  lena: { id: "usr_rev_lena", handle: "lena_review", slug: "lena-review", role: "reviewer" },
  max: { id: "usr_rev_max", handle: "max_review", slug: "max-review", role: "reviewer" },
  sergey: { id: "usr_rev_sergey", handle: "sergey_review", slug: "sergey-review", role: "reviewer" },
  /** Читатель с commentingBlocked=true */
  troll: { id: "usr_troll", handle: "troll", slug: "troll", role: "reader" },
  /** Заблокированный автор (isBlocked=true), его блог скрыт */
  ghost: { id: "usr_ghost", handle: "ghost", slug: "ghost", role: "author" },
} as const;

export const BLOG = {
  id: "blog_async",
  slug: "async-deep-dive",
  title: "Глубоко в асинхронность JavaScript",
} as const;

export const HIDDEN_BLOG = { id: "blog_ghost", slug: "hidden-blog", title: "Скрытый блог" } as const;

export const CHAPTERS = {
  /** published, ревизии v1+v2 (prevBlocks), primary: reviewer */
  published: { id: "chp_published", slug: "event-loop", title: "Цикл событий" },
  /** under-review, назначены reviewer (primary) + lena_review */
  underReview: { id: "chp_under_review", slug: "promises", title: "Промисы изнутри" },
  /** changes-requested, primary: lena_review */
  changesRequested: { id: "chp_changes", slug: "async-await", title: "Async/await на практике" },
  /** draft, ревьюеров нет — отправная точка сквозных флоу */
  draft: { id: "chp_draft", slug: "generators", title: "Генераторы и итераторы" },
  /** draft в скрытом блоге ghost — мишень негативов ownership */
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
