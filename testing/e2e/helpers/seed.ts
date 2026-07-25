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
  /** Ф14: приведён автором (`introduced_by`) — его одобрение даёт бейдж уровня `invited`. */
  max: { id: "usr_rev_max", handle: "max_review", slug: "max-review", canAuthor: false, isReviewer: true, introducedBy: "author" },
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
 * Ф15 — витрина главной. Проверенных блогов в сиде РОВНО ТРИ (порог `SHOWCASE_MIN_VERIFIED`),
 * поэтому главная по умолчанию работает в режиме «Проверенные блоги»; режим «Выбор редакции»
 * получают, скрыв один из них админом.
 */
export const VERIFIED_BLOGS = {
  /** `BLOG` — первый проверенный (independent). */
  async: BLOG,
  /** Три ОПУБЛИКОВАННЫЕ главы — единственный блог, на котором проверяются переходы и оглавление. */
  guide: {
    id: "blog_guide",
    slug: "review-craft",
    title: "Ремесло ревью",
    chapters: [
      { id: "chp_guide_1", slug: "why-review", title: "Зачем нужно ревью" },
      { id: "chp_guide_2", slug: "how-to-read", title: "Как читать чужой код" },
      { id: "chp_guide_3", slug: "feedback", title: "Как давать обратную связь" },
    ],
  },
  ops: { id: "blog_ops", slug: "ops-notes", title: "Заметки об эксплуатации" },
} as const;

/**
 * Бейдж уровня `invited` — блог, который на главную НЕ попадает (З-19), но полноценен по прямой
 * ссылке и в профиле автора. Ключевой негатив витрины.
 */
export const INVITED_BLOG = {
  id: "blog_invited",
  slug: "guest-review",
  title: "Разбор от приглашённого эксперта",
  chapter: { id: "chp_invited", slug: "expert-take", title: "Взгляд эксперта" },
} as const;

/** «Выбор редакции»: закреплён админом и БЕЗ бейджа — закрепление бейджа не требует. */
export const FEATURED_BLOG = { id: "blog_duo", slug: "duo-notes", title: "Заметки универсала" } as const;

/** Ф13: блог аккаунта с обеими возможностями. ⚠️ Ф14: на его главу подана заявка на ревью
 * (`REVIEW_REQUESTS.open`), поэтому ревизия опубликована и одновременно `review_status='requested'`. */
export const DUO_BLOG = {
  id: "blog_duo",
  slug: "duo-notes",
  title: "Заметки универсала",
  chapter: { id: "chp_duo", slug: "hello", title: "Как я совмещаю" },
} as const;

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
  /** draft + requested в скрытом блоге ghost — мишень негативов ownership и просроченной заявки */
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

/**
 * Ф14: приглашения ревьюерам заменены ЗАЯВКАМИ — ревьюер берёт работу из очереди сам.
 * Сроки подобраны под три свипа `/api/cron/review-sla`.
 */
export const REVIEW_REQUESTS = {
  /**
   * open, срок не вышел — мишень claim-флоу. Живёт на ОПУБЛИКОВАННОЙ главе `DUO_BLOG.chapter`
   * (флагманский случай Ф14: ревью после публикации). ⚠️ `CHAPTERS.draft` намеренно оставлен без
   * заявки: живая заявка перевела бы его в `requested`, а это блокирует редактор — на нём стоят
   * все editor-спеки.
   */
  open: "req_open",
  /** open, срок ВЫШЕЛ — мишень эскалации; на главе заблокированного автора (в очереди не видна) */
  stale: "req_stale",
  /** claimed ревьюером `USERS.reviewer` на `CHAPTERS.underReview`, срок вышел, признаков работы нет */
  silent: "req_silent",
  /** исполненная (история; в очереди не показывается) */
  done: "req_done",
} as const;

/**
 * ⚠️ ИНВАРИАНТ сида Ф14: у каждой ЖИВОЙ заявки (`open`/`claimed`) ревизия обязана нести
 * `review_status` = `requested`/`in-review`. Состояние «открытая заявка + none» в системе
 * недостижимо, и claim оставил бы главу с назначенным ревьюером и статусом «ревью не запрашивали».
 */

/** Ф14: инвайт-ссылки эксперта (канал 2). Токены детерминированы только в сиде. */
export const EXPERT_INVITES = {
  active: { id: "einv_active", token: "e2e-expert-token" },
  expired: { id: "einv_expired", token: "e2e-expert-expired" },
} as const;

/** Ф15: жалобы в сиде — по одной на каждый тип цели (комментарий/блог/ревью). */
export const REPORTS = {
  comment: "rpt_1",
  blog: "rpt_blog",
  /** приватная жалоба автора на ревьюера `lena_review` (замена рейтингу) */
  review: "rpt_review",
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
/** @deprecated Ф15 — используйте `REPORTS.comment` (жалоб в сиде стало три, по типу цели). */
export const REPORT_ID = REPORTS.comment;
