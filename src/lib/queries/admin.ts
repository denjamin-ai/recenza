// Read-слой админ-портала (Фаза 10). Только RSC/серверные вызовы — гейтинг (requireAdminPage)
// делает layout, эти функции данные не авторизуют. Мутации — в src/app/api/admin/**.
// JSON-поля читаем через parseJson; наружу passwordHash не отдаём (выбираем явные колонки).

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blogs,
  boardCalls,
  chapterReviewers,
  chapterRevisions,
  chapters,
  donationMethods,
  primaryChangeRequests,
  promoBanners,
  publicComments,
  recruitRequests,
  removedReviewers,
  reports,
  reviewerApplications,
  users,
} from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import { DONATIONS_ENABLED_KEY, getAppFlag } from "@/lib/queries/settings";
import type {
  ApplicationStatus,
  BannerAction,
  DonationType,
  RecruitStatus,
  ReportStatus,
  RevisionStatus,
  Role,
} from "@/types";

// ───────────────────────────── Сводка (dashboard) ─────────────────────────────

export type AttentionKind = "report" | "recruit" | "application" | "primary";

export interface AttentionItem {
  kind: AttentionKind;
  label: string;
  href: string;
  createdAt: number;
}

export interface AdminDashboard {
  counts: {
    openReports: number;
    reviewQueue: number; // главы в активном ревью (under-review|changes-requested)
    pendingPrimaryChanges: number;
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

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const [blockedUsers, allUsers, calls, reviewItems, openReportRows, recruitRows, appRows, pcrRows] =
    await Promise.all([
      db.$count(users, eq(users.isBlocked, true)),
      db.$count(users),
      db.$count(boardCalls),
      getAdminReviewQueue(),
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
      db
        .select({ id: primaryChangeRequests.id, createdAt: primaryChangeRequests.createdAt })
        .from(primaryChangeRequests)
        .where(eq(primaryChangeRequests.status, "pending")),
    ]);

  const attention: AttentionItem[] = [
    ...openReportRows.map((r) => ({
      kind: "report" as const,
      label: `Жалоба на ${r.targetType === "comment" ? "комментарий" : r.targetType}`,
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
    ...pcrRows.map((p) => ({
      kind: "primary" as const,
      label: "Запрос смены ведущего ревьюера",
      href: "/admin/review",
      createdAt: p.createdAt,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  return {
    counts: {
      openReports: openReportRows.length,
      reviewQueue: reviewItems.length,
      pendingPrimaryChanges: pcrRows.length,
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
  role: Role;
  isBlocked: boolean;
  commentingBlocked: boolean;
  reviewLoad: number;
  reviewCapacity: number;
  reviewerRating: number | null;
  createdAt: number;
}

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  return db
    .select({
      id: users.id,
      handle: users.handle,
      slug: users.slug,
      displayName: users.displayName,
      role: users.role,
      isBlocked: users.isBlocked,
      commentingBlocked: users.commentingBlocked,
      reviewLoad: users.reviewLoad,
      reviewCapacity: users.reviewCapacity,
      reviewerRating: users.reviewerRating,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
}

export interface AdminUserDetail extends AdminUserRow {
  bio: string | null;
  competencies: string[];
  reviewerRatingsN: number | null;
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
        role: users.role,
        isBlocked: users.isBlocked,
        commentingBlocked: users.commentingBlocked,
        reviewLoad: users.reviewLoad,
        reviewCapacity: users.reviewCapacity,
        reviewerRating: users.reviewerRating,
        reviewerRatingsN: users.reviewerRatingsN,
        competencies: users.competencies,
        bio: users.bio,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.handle, handle))
      .limit(1)
  )[0];
  if (!row) return null;

  const authoredBlogs =
    row.role === "author"
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
  targetType: string;
  targetId: string;
  reason: string;
  status: ReportStatus;
  createdAt: number;
  reporterHandle: string | null;
  reporterName: string | null;
}

export async function getAdminReports(status?: ReportStatus): Promise<AdminReportRow[]> {
  const rows = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      status: reports.status,
      createdAt: reports.createdAt,
      reporterHandle: users.handle,
      reporterName: users.displayName,
    })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.reporterId))
    .where(status ? eq(reports.status, status) : undefined)
    .orderBy(desc(reports.createdAt));
  return rows;
}

export interface AdminReportDetail extends AdminReportRow {
  // Для targetType='comment' — контекст: текст, статус удаления, координаты главы.
  comment: {
    id: string;
    text: string;
    deletedAt: number | null;
    blogSlug: string;
    chapterSlug: string;
    revision: number;
    authorName: string | null;
  } | null;
}

export async function getAdminReportDetail(id: string): Promise<AdminReportDetail | null> {
  const base = (
    await db
      .select({
        id: reports.id,
        targetType: reports.targetType,
        targetId: reports.targetId,
        reason: reports.reason,
        status: reports.status,
        createdAt: reports.createdAt,
        reporterHandle: users.handle,
        reporterName: users.displayName,
      })
      .from(reports)
      .leftJoin(users, eq(users.id, reports.reporterId))
      .where(eq(reports.id, id))
      .limit(1)
  )[0];
  if (!base) return null;

  let comment: AdminReportDetail["comment"] = null;
  if (base.targetType === "comment") {
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
        .where(eq(publicComments.id, base.targetId))
        .limit(1)
    )[0];
    comment = c ?? null;
  }
  return { ...base, comment };
}

// ───────────────────────────── Очередь ревью + смена ведущего ─────────────────────────────

export interface AdminReviewReviewer {
  handle: string;
  displayName: string;
  isPrimary: boolean;
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
  reviewerCount: number;
  approvedCount: number;
  reviewers: AdminReviewReviewer[];
  primaryHandle: string | null;
  pendingPrimaryChange: { id: string; fromHandle: string; toHandle: string } | null;
}

const ACTIVE_REVIEW = ["under-review", "changes-requested"] as const;

export async function getAdminReviewQueue(): Promise<AdminReviewItem[]> {
  // Берём только активные ревизии (под ревью). Инвариант доменки: активной может быть лишь ПОСЛЕДНЯЯ
  // ревизия главы (редактор не даёт править under-review/changes-requested; publish её замещает) —
  // поэтому фильтр по статусу = её последняя ревизия. max(number) оставляем как защиту.
  const activeRevs = await db
    .select({
      chapterId: chapterRevisions.chapterId,
      number: chapterRevisions.number,
      status: chapterRevisions.status,
    })
    .from(chapterRevisions)
    .where(inArray(chapterRevisions.status, [...ACTIVE_REVIEW]));
  const latest = new Map<string, { number: number; status: RevisionStatus }>();
  for (const r of activeRevs) {
    const prev = latest.get(r.chapterId);
    if (!prev || r.number > prev.number) latest.set(r.chapterId, { number: r.number, status: r.status });
  }
  const activeIds = [...latest.keys()];
  if (activeIds.length === 0) return [];

  const heads = await db
    .select({
      chapterId: chapters.id,
      chapterSlug: chapters.slug,
      chapterTitle: chapters.title,
      primaryHandle: chapters.primaryHandle,
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
      isPrimary: chapterReviewers.isPrimary,
      verdict: chapterReviewers.verdict,
      displayName: users.displayName,
    })
    .from(chapterReviewers)
    .innerJoin(users, eq(users.handle, chapterReviewers.handle))
    .where(inArray(chapterReviewers.chapterId, activeIds));

  const pcrRows = await db
    .select({
      id: primaryChangeRequests.id,
      chapterId: primaryChangeRequests.chapterId,
      fromHandle: primaryChangeRequests.fromHandle,
      toHandle: primaryChangeRequests.toHandle,
    })
    .from(primaryChangeRequests)
    .where(and(inArray(primaryChangeRequests.chapterId, activeIds), eq(primaryChangeRequests.status, "pending")));
  const pcrByChapter = new Map(pcrRows.map((p) => [p.chapterId, p]));

  return heads
    .map((h) => {
      const lr = latest.get(h.chapterId)!;
      const rs = reviewerRows.filter((r) => r.chapterId === h.chapterId && r.revisionNumber === lr.number);
      const pcr = pcrByChapter.get(h.chapterId);
      return {
        chapterId: h.chapterId,
        blogSlug: h.blogSlug,
        chapterSlug: h.chapterSlug,
        blogTitle: h.blogTitle,
        chapterTitle: h.chapterTitle,
        authorName: h.authorName,
        revisionNumber: lr.number,
        status: lr.status,
        reviewerCount: rs.length,
        approvedCount: rs.filter((r) => r.verdict === "approve").length,
        reviewers: rs
          .map((r) => ({ handle: r.handle, displayName: r.displayName, isPrimary: r.isPrimary, approved: r.verdict === "approve" }))
          .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
        primaryHandle: h.primaryHandle,
        pendingPrimaryChange: pcr ? { id: pcr.id, fromHandle: pcr.fromHandle, toHandle: pcr.toHandle } : null,
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
  applicantRole: Role | null;
  area: string | null;
  skills: string[];
  message: string | null;
  status: ApplicationStatus;
  createdAt: number;
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
      applicantRole: users.role,
      area: reviewerApplications.area,
      skills: reviewerApplications.skills,
      message: reviewerApplications.message,
      status: reviewerApplications.status,
      createdAt: reviewerApplications.createdAt,
    })
    .from(reviewerApplications)
    .leftJoin(users, eq(users.handle, reviewerApplications.byHandle))
    .orderBy(desc(reviewerApplications.createdAt));

  const applications: AdminApplicationRow[] = appRows.map((a) => ({
    id: a.id,
    byHandle: a.byHandle,
    name: a.name,
    applicantName: a.applicantName,
    applicantRole: a.applicantRole,
    area: a.area,
    skills: parseJson<string[]>(a.skills, []),
    message: a.message,
    status: a.status,
    createdAt: a.createdAt,
  }));

  return { requests, applications };
}

// ───────────────────────────── Снятые ревьюеры (история) ─────────────────────────────

export async function getRemovedReviewers(): Promise<
  { id: string; blogSlug: string; chapterSlug: string; handle: string; byAdmin: string; reason: string | null; createdAt: number }[]
> {
  return db.select().from(removedReviewers).orderBy(desc(removedReviewers.createdAt));
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
