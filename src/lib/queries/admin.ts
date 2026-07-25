// Read-слой админ-портала (Фаза 10). Только RSC/серверные вызовы — гейтинг (requireAdminPage)
// делает layout, эти функции данные не авторизуют. Мутации — в src/app/api/admin/**.
// JSON-поля читаем через parseJson; наружу passwordHash не отдаём (выбираем явные колонки).

import { and, desc, eq, gte, inArray, isNotNull, isNull, like as like_, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blogs,
  boardCalls,
  chapterReviewers,
  chapterRevisions,
  chapters,
  donationMethods,
  promoBanners,
  publicComments,
  recruitRequests,
  removedReviewers,
  reports,
  reviewRequests,
  reviewerApplications,
  users,
} from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import { DONATIONS_ENABLED_KEY, getAppFlag } from "@/lib/queries/settings";
import { isReviewOpen } from "@/lib/review-status";
import { REPORT_TARGET_LABEL } from "@/lib/reports";
import type {
  ApplicationStatus,
  BannerAction,
  DonationType,
  RecruitStatus,
  ReportStatus,
  ReportTargetType,
  ReviewStatus,
  RevisionStatus,
  VerifiedTier,
} from "@/types";

// ───────────────────────────── Сводка (dashboard) ─────────────────────────────

export type AttentionKind = "report" | "recruit" | "application" | "stale-request";

export interface AttentionItem {
  kind: AttentionKind;
  label: string;
  href: string;
  createdAt: number;
}

export interface AdminDashboard {
  counts: {
    openReports: number;
    reviewQueue: number; // главы с открытой ревью-сессией
    /** Ф14: заявки, которые никто не взял в срок SLA (пришли на смену «Смене ведущего»). */
    staleRequests: number;
    /** Ф15: заявки, ждущие ревьюера прямо сейчас. */
    openRequests: number;
    /** Ф15: живые заявки с истёкшим сроком SLA (ждут вмешательства). */
    overdueRequests: number;
    /** Ф15: бейджи, выданные за последние 30 дней. */
    recentBadges: number;
    /** Ф15: сколько блогов закреплено в «Выборе редакции». */
    featuredBlogs: number;
    pendingRecruit: number;
    pendingApplications: number;
    blockedUsers: number;
    users: number;
    boardCalls: number;
  };
  // «Требует внимания» — синтез из реальных pending-сущностей (точнее, чем поток уведомлений),
  // каждый пункт ведёт на соответствующий экран разбора.
  attention: AttentionItem[];
}

export async function getAdminDashboard(now: number): Promise<AdminDashboard> {
  const [
    blockedUsers,
    allUsers,
    calls,
    reviewSessions,
    openReportRows,
    recruitRows,
    appRows,
    staleRows,
    openRequests,
    overdueRequests,
    recentBadges,
    featuredBlogs,
  ] = await Promise.all([
      db.$count(users, eq(users.isBlocked, true)),
      db.$count(users),
      db.$count(boardCalls),
      // ⚠️ Ф15: раньше здесь звался полный `getAdminReviewQueue()` — скан ВСЕХ ревизий с двумя
      // join'ами ради одного числа на плитке. Точный список по-прежнему строит `/admin/review`.
      db.$count(
        chapterRevisions,
        and(
          inArray(chapterRevisions.reviewStatus, ["requested", "in-review", "changes-requested"]),
          isNull(chapterRevisions.reviewClosedAt),
        ),
      ),
      db
        .select({ id: reports.id, targetType: reports.targetType, createdAt: reports.createdAt })
        .from(reports)
        .where(eq(reports.status, "open")),
      db
        .select({ id: recruitRequests.id, byHandle: recruitRequests.byHandle, createdAt: recruitRequests.createdAt })
        .from(recruitRequests)
        .where(eq(recruitRequests.status, "pending")),
      db
        .select({ id: reviewerApplications.id, area: reviewerApplications.area, createdAt: reviewerApplications.createdAt })
        .from(reviewerApplications)
        .where(eq(reviewerApplications.status, "pending")),
      // Ф14: вместо запросов смены ведущего — заявки, просроченные по SLA либо эскалированные
      // в редакцию. Именно они теперь требуют вмешательства человека.
      db
        .select({ id: reviewRequests.id, createdAt: reviewRequests.createdAt, channel: reviewRequests.channel })
        .from(reviewRequests)
        .where(and(eq(reviewRequests.status, "open"), eq(reviewRequests.channel, "editorial"))),
      // Ф15: плитки «Заявки в очереди», «Просроченные SLA» и «Бейджи за 30 дней».
      db.$count(reviewRequests, eq(reviewRequests.status, "open")),
      db.$count(
        reviewRequests,
        and(inArray(reviewRequests.status, ["open", "claimed"]), lte(reviewRequests.dueAt, now)),
      ),
      db.$count(chapterRevisions, gte(chapterRevisions.verifiedAt, now - 30 * 24 * 60 * 60)),
      db.$count(blogs, isNotNull(blogs.featuredAt)),
    ]);

  const attention: AttentionItem[] = [
    ...openReportRows.map((r) => ({
      kind: "report" as const,
      label: `Жалоба на ${REPORT_TARGET_LABEL[r.targetType]}`,
      href: `/admin/reports/${r.id}`,
      createdAt: r.createdAt,
    })),
    ...recruitRows.map((r) => ({
      kind: "recruit" as const,
      label: `Запрос подбора ревьюеров от @${r.byHandle}`,
      href: "/admin/recruit",
      createdAt: r.createdAt,
    })),
    ...appRows.map((a) => ({
      kind: "application" as const,
      label: `Заявка ревьюера${a.area ? ` · ${a.area}` : ""}`,
      href: "/admin/recruit",
      createdAt: a.createdAt,
    })),
    ...staleRows.map((r) => ({
      kind: "stale-request" as const,
      label: "Заявку на ревью никто не взял — нужен подбор",
      href: "/admin/review",
      createdAt: r.createdAt,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  return {
    counts: {
      openReports: openReportRows.length,
      reviewQueue: reviewSessions,
      staleRequests: staleRows.length,
      openRequests,
      overdueRequests,
      recentBadges,
      featuredBlogs,
      pendingRecruit: recruitRows.length,
      pendingApplications: appRows.length,
      blockedUsers,
      users: allUsers,
      boardCalls: calls,
    },
    attention,
  };
}

// ───────────────────────────── Пользователи ─────────────────────────────

export interface AdminUserRow {
  id: string;
  handle: string;
  slug: string;
  displayName: string;
  /** Возможности аккаунта (Ф13) — выдаёт админ; `users.role` больше не читается. */
  canAuthor: boolean;
  isReviewer: boolean;
  isBlocked: boolean;
  commentingBlocked: boolean;
  reviewLoad: number;
  reviewCapacity: number;
  createdAt: number;
  /** Ф15: кто привёл аккаунт (Ф14) — от этого зависит УРОВЕНЬ бейджа, поэтому видно в списке. */
  introducedBy: string | null;
}

/** Ф15 (З-58): раньше был только `?q=`, и тот фильтровался в JS поверх выборки всех пользователей. */
export interface AdminUserFilter {
  q?: string;
  /** `none` — аккаунт без возможностей (чистый читатель). */
  cap?: "author" | "reviewer" | "none";
  status?: "active" | "blocked" | "muted";
  sort?: "new" | "name" | "load";
}

export async function getAdminUsers(filter: AdminUserFilter = {}): Promise<AdminUserRow[]> {
  const where: SQL[] = [];

  const q = filter.q?.trim().toLowerCase();
  if (q) {
    // handle хранится в нижнем регистре, displayName — как ввели: сравниваем через lower().
    const like = `%${q}%`;
    where.push(or(like_(users.handle, like), like_(sql`lower(${users.displayName})`, like))!);
  }
  if (filter.cap === "author") where.push(eq(users.canAuthor, true));
  if (filter.cap === "reviewer") where.push(eq(users.isReviewer, true));
  if (filter.cap === "none") where.push(and(eq(users.canAuthor, false), eq(users.isReviewer, false))!);
  if (filter.status === "blocked") where.push(eq(users.isBlocked, true));
  if (filter.status === "active") where.push(eq(users.isBlocked, false));
  if (filter.status === "muted") where.push(eq(users.commentingBlocked, true));

  const order =
    filter.sort === "name"
      ? [users.displayName]
      : filter.sort === "load"
        ? [desc(users.reviewLoad), users.displayName]
        : [desc(users.createdAt)];

  return db
    .select({
      id: users.id,
      handle: users.handle,
      slug: users.slug,
      displayName: users.displayName,
      canAuthor: users.canAuthor,
      isReviewer: users.isReviewer,
      isBlocked: users.isBlocked,
      commentingBlocked: users.commentingBlocked,
      reviewLoad: users.reviewLoad,
      reviewCapacity: users.reviewCapacity,
      createdAt: users.createdAt,
      introducedBy: users.introducedBy,
    })
    .from(users)
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(...order);
}

/** Кандидаты для ручного назначения на заявку (Ф15). Компетенции нужны, чтобы показать совпадение. */
export async function getAssignableReviewers(): Promise<
  { handle: string; displayName: string; load: number; capacity: number; competencies: string[] }[]
> {
  const rows = await db
    .select({
      handle: users.handle,
      displayName: users.displayName,
      load: users.reviewLoad,
      capacity: users.reviewCapacity,
      competencies: users.competencies,
    })
    .from(users)
    .where(and(eq(users.isReviewer, true), eq(users.isBlocked, false)));
  return rows.map((r) => ({ ...r, competencies: parseJson<string[]>(r.competencies, []) }));
}

export interface AdminUserDetail extends AdminUserRow {
  bio: string | null;
  competencies: string[];
  blogs: { id: string; slug: string; title: string; hidden: boolean; publishedAt: number | null }[];
}

export async function getAdminUserDetail(handle: string): Promise<AdminUserDetail | null> {
  const row = (
    await db
      .select({
        id: users.id,
        handle: users.handle,
        slug: users.slug,
        displayName: users.displayName,
        canAuthor: users.canAuthor,
        isReviewer: users.isReviewer,
        isBlocked: users.isBlocked,
        commentingBlocked: users.commentingBlocked,
        reviewLoad: users.reviewLoad,
        reviewCapacity: users.reviewCapacity,
        competencies: users.competencies,
        bio: users.bio,
        createdAt: users.createdAt,
        introducedBy: users.introducedBy,
      })
      .from(users)
      .where(eq(users.handle, handle))
      .limit(1)
  )[0];
  if (!row) return null;

  const authoredBlogs =
    row.canAuthor
      ? await db
          .select({ id: blogs.id, slug: blogs.slug, title: blogs.title, hidden: blogs.hidden, publishedAt: blogs.publishedAt })
          .from(blogs)
          .where(eq(blogs.authorId, row.id))
          .orderBy(desc(blogs.lastActivityAt))
      : [];

  return {
    ...row,
    competencies: parseJson<string[]>(row.competencies, []),
    blogs: authoredBlogs,
  };
}

// ───────────────────────────── Жалобы ─────────────────────────────

export interface AdminReportRow {
  id: string;
  /** Ф15 (З-61): типизирована. Раньше — свободная строка, которая печаталась в UI «как есть». */
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  note: string | null;
  /** Ф15: «о ком» — только у жалоб на ревью (приватная жалоба на участника сессии). */
  aboutHandle: string | null;
  status: ReportStatus;
  createdAt: number;
  resolvedAt: number | null;
  reporterHandle: string | null;
  reporterName: string | null;
}

const REPORT_ROW_COLUMNS = {
  id: reports.id,
  targetType: reports.targetType,
  targetId: reports.targetId,
  reason: reports.reason,
  note: reports.note,
  aboutHandle: reports.aboutHandle,
  status: reports.status,
  createdAt: reports.createdAt,
  resolvedAt: reports.resolvedAt,
  reporterHandle: users.handle,
  reporterName: users.displayName,
} as const;

export async function getAdminReports(status?: ReportStatus): Promise<AdminReportRow[]> {
  const rows = await db
    .select(REPORT_ROW_COLUMNS)
    .from(reports)
    .leftJoin(users, eq(users.id, reports.reporterId))
    .where(status ? eq(reports.status, status) : undefined)
    .orderBy(desc(reports.createdAt));
  return rows;
}

/**
 * Контекст цели жалобы. Ф15: раньше карточка умела показывать только комментарий, а для любой
 * другой цели детальная страница оставалась вообще без контекста (З-61).
 */
export type AdminReportTarget =
  | {
      kind: "comment";
      id: string;
      text: string;
      deletedAt: number | null;
      blogSlug: string;
      chapterSlug: string;
      revision: number;
      authorName: string | null;
    }
  | { kind: "blog"; id: string; slug: string; title: string; authorName: string; hidden: boolean }
  | {
      kind: "review";
      chapterId: string;
      chapterTitle: string;
      blogSlug: string;
      chapterSlug: string;
      authorName: string;
      aboutName: string | null;
    }
  /** Цель удалена или тип неизвестен — жалобу всё равно нужно уметь закрыть. */
  | { kind: "unknown" };

export interface AdminReportDetail extends AdminReportRow {
  target: AdminReportTarget;
}

export async function getAdminReportDetail(id: string): Promise<AdminReportDetail | null> {
  const base = (
    await db
      .select(REPORT_ROW_COLUMNS)
      .from(reports)
      .leftJoin(users, eq(users.id, reports.reporterId))
      .where(eq(reports.id, id))
      .limit(1)
  )[0];
  if (!base) return null;

  return { ...base, target: await resolveReportTarget(base.targetType, base.targetId, base.aboutHandle) };
}

async function resolveReportTarget(
  targetType: ReportTargetType,
  targetId: string,
  aboutHandle: string | null,
): Promise<AdminReportTarget> {
  if (targetType === "comment") {
    const c = (
      await db
        .select({
          id: publicComments.id,
          text: publicComments.text,
          deletedAt: publicComments.deletedAt,
          blogSlug: publicComments.blogSlug,
          chapterSlug: publicComments.chapterSlug,
          revision: publicComments.revision,
          authorName: users.displayName,
        })
        .from(publicComments)
        .leftJoin(users, eq(users.id, publicComments.authorId))
        .where(eq(publicComments.id, targetId))
        .limit(1)
    )[0];
    return c ? { kind: "comment", ...c } : { kind: "unknown" };
  }

  if (targetType === "blog") {
    const b = (
      await db
        .select({
          id: blogs.id,
          slug: blogs.slug,
          title: blogs.title,
          hidden: blogs.hidden,
          authorName: users.displayName,
        })
        .from(blogs)
        .innerJoin(users, eq(users.id, blogs.authorId))
        .where(eq(blogs.id, targetId))
        .limit(1)
    )[0];
    return b ? { kind: "blog", ...b } : { kind: "unknown" };
  }

  const ch = (
    await db
      .select({
        chapterId: chapters.id,
        chapterTitle: chapters.title,
        chapterSlug: chapters.slug,
        blogSlug: blogs.slug,
        authorName: users.displayName,
      })
      .from(chapters)
      .innerJoin(blogs, eq(chapters.blogId, blogs.id))
      .innerJoin(users, eq(users.id, blogs.authorId))
      .where(eq(chapters.id, targetId))
      .limit(1)
  )[0];
  if (!ch) return { kind: "unknown" };

  const about = aboutHandle
    ? (await db.select({ name: users.displayName }).from(users).where(eq(users.handle, aboutHandle)).limit(1))[0]
    : undefined;

  return { kind: "review", ...ch, aboutName: about?.name ?? aboutHandle };
}

// ───────────────────────────── Очередь ревью (Ф14: без «ведущего») ─────────────────────────────

export interface AdminReviewReviewer {
  handle: string;
  displayName: string;
  approved: boolean;
}

export interface AdminReviewItem {
  chapterId: string;
  blogSlug: string;
  chapterSlug: string;
  blogTitle: string;
  chapterTitle: string;
  authorName: string;
  revisionNumber: number;
  status: RevisionStatus;
  reviewStatus: ReviewStatus;
  reviewerCount: number;
  approvedCount: number;
  reviewers: AdminReviewReviewer[];
}

export async function getAdminReviewQueue(): Promise<AdminReviewItem[]> {
  // ⚠️ Фаза 13: прежний порядок «отфильтровать по статусу → взять max(number)» больше не годится.
  // Раньше активной могла быть лишь ПОСЛЕДНЯЯ ревизия (публикация её замещала), теперь черновик
  // ложится ПОВЕРХ опубликованной — фильтр-до-max показал бы старую ревизию как активную.
  // Поэтому: сначала max(number) на главу, потом проверка открытости ревью у неё.
  const allRevs = await db
    .select({
      chapterId: chapterRevisions.chapterId,
      number: chapterRevisions.number,
      status: chapterRevisions.status,
      reviewStatus: chapterRevisions.reviewStatus,
      reviewClosedAt: chapterRevisions.reviewClosedAt,
    })
    .from(chapterRevisions);
  const latest = new Map<
    string,
    { number: number; status: RevisionStatus; reviewStatus: ReviewStatus; reviewClosedAt: number | null }
  >();
  for (const r of allRevs) {
    const prev = latest.get(r.chapterId);
    if (!prev || r.number > prev.number) {
      latest.set(r.chapterId, {
        number: r.number,
        status: r.status,
        reviewStatus: r.reviewStatus,
        reviewClosedAt: r.reviewClosedAt,
      });
    }
  }
  for (const [cid, lr] of latest) {
    if (!isReviewOpen(lr.reviewStatus, lr.reviewClosedAt)) latest.delete(cid);
  }
  const activeIds = [...latest.keys()];
  if (activeIds.length === 0) return [];

  const heads = await db
    .select({
      chapterId: chapters.id,
      chapterSlug: chapters.slug,
      chapterTitle: chapters.title,
      blogSlug: blogs.slug,
      blogTitle: blogs.title,
      authorName: users.displayName,
    })
    .from(chapters)
    .innerJoin(blogs, eq(blogs.id, chapters.blogId))
    .innerJoin(users, eq(users.id, blogs.authorId))
    .where(inArray(chapters.id, activeIds));

  const reviewerRows = await db
    .select({
      chapterId: chapterReviewers.chapterId,
      revisionNumber: chapterReviewers.revisionNumber,
      handle: chapterReviewers.handle,
      verdict: chapterReviewers.verdict,
      displayName: users.displayName,
    })
    .from(chapterReviewers)
    .innerJoin(users, eq(users.handle, chapterReviewers.handle))
    .where(inArray(chapterReviewers.chapterId, activeIds));

  return heads
    .map((h) => {
      const lr = latest.get(h.chapterId)!;
      const rs = reviewerRows.filter((r) => r.chapterId === h.chapterId && r.revisionNumber === lr.number);
      return {
        chapterId: h.chapterId,
        blogSlug: h.blogSlug,
        chapterSlug: h.chapterSlug,
        blogTitle: h.blogTitle,
        chapterTitle: h.chapterTitle,
        authorName: h.authorName,
        revisionNumber: lr.number,
        status: lr.status,
        reviewStatus: lr.reviewStatus,
        reviewerCount: rs.length,
        approvedCount: rs.filter((r) => r.verdict === "approve").length,
        reviewers: rs
          .map((r) => ({ handle: r.handle, displayName: r.displayName, approved: r.verdict === "approve" }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName, "ru")),
      };
    })
    .sort((a, b) => a.blogTitle.localeCompare(b.blogTitle, "ru"));
}

// ───────────────────────────── Recruit + доска + заявки ─────────────────────────────

export interface AdminRecruitRow {
  id: string;
  chapterId: string | null;
  chapterTitle: string | null;
  blogSlug: string | null;
  chapterSlug: string | null;
  byHandle: string;
  byName: string | null;
  skills: string[];
  status: RecruitStatus;
  reason: string | null;
  createdAt: number;
  resolvedAt: number | null;
}

export interface AdminBoardCall {
  id: string;
  area: string;
  skills: string[];
  waiting: number;
  note: string | null;
  hot: boolean;
}

export interface AdminApplicationRow {
  id: string;
  byHandle: string | null;
  name: string | null;
  applicantName: string | null; // displayName зарегистрированного пользователя
  /** null — заявка от гостя (без аккаунта). Ф13: возможность вместо роли. */
  applicantIsReviewer: boolean | null;
  area: string | null;
  skills: string[];
  message: string | null;
  status: ApplicationStatus;
  createdAt: number;
  /** Ф14: handle автора, приславшего инвайт-ссылку. null — обычный отклик с доски. */
  invitedBy: string | null;
}

export interface AdminRecruitData {
  requests: AdminRecruitRow[];
  applications: AdminApplicationRow[];
}

/** Направления доски «Ищем ревьюеров» — экран «Доска ревьюеров» (ui-feedback-6 П5). */
export async function getAdminBoardCalls(): Promise<AdminBoardCall[]> {
  const callRows = await db.select().from(boardCalls);
  return callRows
    .map((c) => ({ id: c.id, area: c.area, skills: parseJson<string[]>(c.skills, []), waiting: c.waiting, note: c.note, hot: c.hot }))
    .sort((a, b) => Number(b.hot) - Number(a.hot) || a.area.localeCompare(b.area, "ru"));
}

export async function getAdminRecruit(): Promise<AdminRecruitData> {
  const recRows = await db
    .select({
      id: recruitRequests.id,
      chapterId: recruitRequests.chapterId,
      byHandle: recruitRequests.byHandle,
      byName: users.displayName,
      skills: recruitRequests.skills,
      status: recruitRequests.status,
      reason: recruitRequests.reason,
      createdAt: recruitRequests.createdAt,
      resolvedAt: recruitRequests.resolvedAt,
      chapterTitle: chapters.title,
      chapterSlug: chapters.slug,
      blogSlug: blogs.slug,
    })
    .from(recruitRequests)
    .leftJoin(users, eq(users.handle, recruitRequests.byHandle))
    .leftJoin(chapters, eq(chapters.id, recruitRequests.chapterId))
    .leftJoin(blogs, eq(blogs.id, chapters.blogId))
    .orderBy(desc(recruitRequests.createdAt));

  const requests: AdminRecruitRow[] = recRows.map((r) => ({
    id: r.id,
    chapterId: r.chapterId,
    chapterTitle: r.chapterTitle,
    blogSlug: r.blogSlug,
    chapterSlug: r.chapterSlug,
    byHandle: r.byHandle,
    byName: r.byName,
    skills: parseJson<string[]>(r.skills, []),
    status: r.status,
    reason: r.reason,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
  }));

  const appRows = await db
    .select({
      id: reviewerApplications.id,
      byHandle: reviewerApplications.byHandle,
      name: reviewerApplications.name,
      applicantName: users.displayName,
      applicantIsReviewer: users.isReviewer,
      area: reviewerApplications.area,
      skills: reviewerApplications.skills,
      message: reviewerApplications.message,
      status: reviewerApplications.status,
      createdAt: reviewerApplications.createdAt,
      invitedBy: reviewerApplications.invitedBy,
    })
    .from(reviewerApplications)
    .leftJoin(users, eq(users.handle, reviewerApplications.byHandle))
    .orderBy(desc(reviewerApplications.createdAt));

  const applications: AdminApplicationRow[] = appRows.map((a) => ({
    id: a.id,
    byHandle: a.byHandle,
    name: a.name,
    applicantName: a.applicantName,
    applicantIsReviewer: a.applicantIsReviewer,
    area: a.area,
    skills: parseJson<string[]>(a.skills, []),
    message: a.message,
    status: a.status,
    createdAt: a.createdAt,
    invitedBy: a.invitedBy,
  }));

  return { requests, applications };
}

// ───────────────────────────── Снятые ревьюеры (история) ─────────────────────────────

export async function getRemovedReviewers(): Promise<
  { id: string; blogSlug: string; chapterSlug: string; handle: string; byAdmin: string; reason: string | null; createdAt: number }[]
> {
  return db.select().from(removedReviewers).orderBy(desc(removedReviewers.createdAt));
}

// ───────────────────────────── Выбор редакции (Ф15) ─────────────────────────────

export interface AdminFeaturedRow {
  id: string;
  slug: string;
  title: string;
  authorName: string;
  authorSlug: string;
  publishedAt: number | null;
  verifiedAt: number | null;
  verifiedTier: VerifiedTier | null;
  featuredAt: number | null;
  hidden: boolean;
}

/**
 * Блоги для экрана «Выбор редакции»: закреплённые сверху, затем проверенные, затем остальные.
 * Скрытые (`hidden`) остаются в списке — админ должен видеть, что закреплённый блог скрыт.
 */
export async function getAdminFeatured(): Promise<AdminFeaturedRow[]> {
  const rows = await db
    .select({
      id: blogs.id,
      slug: blogs.slug,
      title: blogs.title,
      authorName: users.displayName,
      authorSlug: users.slug,
      publishedAt: blogs.publishedAt,
      verifiedAt: blogs.verifiedAt,
      verifiedTier: blogs.verifiedTier,
      featuredAt: blogs.featuredAt,
      hidden: blogs.hidden,
    })
    .from(blogs)
    .innerJoin(users, eq(blogs.authorId, users.id));

  const rank = (r: AdminFeaturedRow): number =>
    r.featuredAt != null ? 2 : r.verifiedTier === "independent" ? 1 : 0;

  return rows.sort(
    (a, b) =>
      rank(b) - rank(a) ||
      (b.featuredAt ?? 0) - (a.featuredAt ?? 0) ||
      (b.verifiedAt ?? 0) - (a.verifiedAt ?? 0) ||
      (b.publishedAt ?? 0) - (a.publishedAt ?? 0),
  );
}

// ───────────────────────────── Монетизация (read) ─────────────────────────────

export interface AdminBannerRow {
  id: string;
  eyebrow: string | null;
  title: string | null;
  cta: string | null;
  tone: string | null;
  icon: string | null;
  action: BannerAction | null;
  target: string | null;
  coverUrl: string | null;
  visible: boolean;
  sort: number;
}

export async function getAdminBanners(): Promise<AdminBannerRow[]> {
  const rows = await db.select().from(promoBanners);
  return rows
    .map((b) => ({
      id: b.id,
      eyebrow: b.eyebrow,
      title: b.title,
      cta: b.cta,
      tone: b.tone,
      icon: b.icon,
      action: b.action,
      target: b.target,
      coverUrl: b.coverUrl,
      visible: b.visible,
      sort: b.sort,
    }))
    .sort((a, b) => a.sort - b.sort);
}

export interface AdminDonationData {
  enabled: boolean;
  methods: {
    id: string;
    name: string;
    type: DonationType;
    url: string | null;
    qrUrl: string | null;
    hint: string | null;
    visible: boolean;
    isPrimary: boolean;
    sort: number;
  }[];
}

export async function getAdminDonation(): Promise<AdminDonationData> {
  const [flag, rows] = await Promise.all([
    getAppFlag(DONATIONS_ENABLED_KEY),
    db.select().from(donationMethods),
  ]);
  return {
    enabled: flag,
    methods: rows
      .map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        url: m.url,
        qrUrl: m.qrUrl,
        hint: m.hint,
        visible: m.visible,
        isPrimary: m.isPrimary,
        sort: m.sort,
      }))
      .sort((a, b) => a.sort - b.sort),
  };
}
