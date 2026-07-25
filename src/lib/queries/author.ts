// Авторские запросы (Фаза 6) — читают ЧЕРНОВИКИ и все статусы ревизий, в отличие от ридер-запросов
// (chapters.ts/feed.ts), которые отдают только published. ВСЕГДА owner-scoped: каждая функция принимает
// userId и фильтрует/проверяет владение; чужое → null (ролевой binding, CLAUDE.md §гейтинг).
//
// Статус главы = состояние её последней ревизии (max number) по ДВУМ осям (Фаза 13):
// `status` (draft|published) и `review_status` (none|requested|in-review|changes-requested|reviewed).
// Блог «опубликован» = blogs.publishedAt != null.
// Колонок статуса у chapters/blogs нет — выводим из ревизий (см. PLAN §traps).

import { cache } from "react";
import { and, countDistinct, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blogs,
  chapterReviewers,
  chapterRevisions,
  chapters,
  portfolios,
  recruitRequests,
  reviewerHistory,
  users,
} from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import type {
  Block,
  Complexity,
  RecruitStatus,
  ReviewStatus,
  RevisionStatus,
  VerifiedTier,
  Verdict,
} from "@/types";

// ───────────────────────────── owner-scoped резолвер главы ─────────────────────────────

/** Глава автора вместе с её последней ревизией — общий вход для author-мутаций (PATCH, publish). */
export interface AuthorChapterTarget {
  chapterId: string;
  chapterSlug: string;
  chapterTitle: string;
  blogId: string;
  blogSlug: string;
  authorId: string;
  /** Ф14: нужен `closeReviewSession` для расчёта уровня бейджа (кто кого привёл). */
  authorHandle: string;
  /** Ф14: чек-лист готовности заявки требует тегов блога. */
  blogTags: string | null;
  revision: {
    id: string;
    number: number;
    status: RevisionStatus;
    reviewStatus: ReviewStatus;
    /** Ф14: токен закрытия ревью-сессии (null — сессия открыта). */
    reviewClosedAt: number | null;
    /** Ф14: у ревизии уже есть бейдж — повторная заявка на неё бессмысленна. */
    verifiedTier: VerifiedTier | null;
    blocks: string | null;
    summary: string | null;
  };
}

/**
 * Владение + последняя ревизия одним резолвером (единый путь для author-мутаций над главой).
 * Чужая/несуществующая глава → null (вызывающий отдаёт 404, не 403 — не раскрываем существование).
 */
export async function resolveAuthorChapter(
  chapterId: string,
  userId: string,
): Promise<AuthorChapterTarget | null> {
  const row = (
    await db
      .select({
        chapterSlug: chapters.slug,
        chapterTitle: chapters.title,
        blogId: blogs.id,
        blogSlug: blogs.slug,
        blogTags: blogs.tags,
        authorId: blogs.authorId,
        authorHandle: users.handle,
      })
      .from(chapters)
      .innerJoin(blogs, eq(blogs.id, chapters.blogId))
      .innerJoin(users, eq(users.id, blogs.authorId))
      .where(eq(chapters.id, chapterId))
      .limit(1)
  )[0];
  if (!row || row.authorId !== userId) return null;

  const rev = (
    await db
      .select({
        id: chapterRevisions.id,
        number: chapterRevisions.number,
        status: chapterRevisions.status,
        reviewStatus: chapterRevisions.reviewStatus,
        reviewClosedAt: chapterRevisions.reviewClosedAt,
        verifiedTier: chapterRevisions.verifiedTier,
        blocks: chapterRevisions.blocks,
        summary: chapterRevisions.summary,
      })
      .from(chapterRevisions)
      .where(eq(chapterRevisions.chapterId, chapterId))
      .orderBy(desc(chapterRevisions.number))
      .limit(1)
  )[0];
  if (!rev) return null;

  return { chapterId, ...row, revision: rev };
}

// ───────────────────────────── view-типы (сериализуемые) ─────────────────────────────

export interface AuthorReviewerChip {
  handle: string;
  /** Ф13.8 (З-50): нужен, чтобы чип в кабинете автора вёл на профиль ревьюера. */
  slug: string;
  displayName: string;
  verdict: Verdict | null;
}

export interface AuthorChapterRow {
  id: string;
  slug: string;
  title: string;
  order: number;
  latestRevisionNumber: number;
  status: RevisionStatus;
  reviewStatus: ReviewStatus;
  /** Ф14: токен закрытия ревью-сессии (null — открыта). Нужен `isReviewOpen`, ось публикации из него ушла. */
  reviewClosedAt: number | null;
  reviewers: AuthorReviewerChip[];
}

/** Карточка блога в кабинете автора (черновики + опубликованные). */
export interface AuthorBlogCard {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  tags: string[];
  complexity: Complexity;
  isPublished: boolean;
  lastActivityAt: number | null;
  chapterCount: number;
  publishedCount: number;
  /** Состояния глав по порядку (обе оси) — для мини-точек прогресса и счётчиков. */
  chapterStatuses: { order: number; status: RevisionStatus; reviewStatus: ReviewStatus }[];
}

export interface AuthorCabinet {
  blogs: AuthorBlogCard[];
  pinnedBlogId: string | null;
}

/** Деталь блога автора: метаданные блога + все главы (любой статус) по order. */
export interface AuthorBlogDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  tags: string[];
  complexity: Complexity;
  coverUrl: string | null;
  isPinned: boolean;
  chapters: AuthorChapterRow[];
}

/** Всё, что нужно редактору одной главы (блог-метаданные + глава + редактируемая ревизия). */
export interface EditorChapter {
  blog: {
    id: string;
    slug: string;
    title: string;
    tags: string[];
    complexity: Complexity;
    coverUrl: string | null;
    summary: string | null;
  };
  chapter: {
    id: string;
    slug: string;
    title: string;
    order: number;
    skills: string[];
  };
  revision: {
    id: string;
    number: number;
    status: RevisionStatus;
    reviewStatus: ReviewStatus;
    summary: string | null;
    blocks: Block[];
  };
}

export interface AuthorPortfolio {
  blocks: Block[];
  isVisible: boolean;
  updatedAt: number | null;
}

// ───────────────────────────── helpers ─────────────────────────────

type LatestRev = {
  revNumber: number;
  status: RevisionStatus;
  reviewStatus: ReviewStatus;
  /** Ф14: закрытие ревью-сессии — явный токен, а не производная от публикации. */
  reviewClosedAt: number | null;
};

/** По строкам (chapterId, number, обе оси) оставляет ревизию с наибольшим number на главу. */
function latestRevByChapter(rows: ({ chapterId: string } & LatestRev)[]): Map<string, LatestRev> {
  const latest = new Map<string, LatestRev>();
  for (const r of rows) {
    const prev = latest.get(r.chapterId);
    if (!prev || r.revNumber > prev.revNumber) {
      latest.set(r.chapterId, {
        revNumber: r.revNumber,
        status: r.status,
        reviewStatus: r.reviewStatus,
        reviewClosedAt: r.reviewClosedAt,
      });
    }
  }
  return latest;
}

// ───────────────────────────── запросы ─────────────────────────────

/** Кабинет автора: все его блоги (черновики+published) + закреплённый блог. */
export const getAuthorCabinet = cache(async (userId: string): Promise<AuthorCabinet> => {
  const userRow = (
    await db.select({ pinnedBlogId: users.pinnedBlogId }).from(users).where(eq(users.id, userId)).limit(1)
  )[0];
  const pinnedBlogId = userRow?.pinnedBlogId ?? null;

  const blogRows = await db
    .select({
      id: blogs.id,
      slug: blogs.slug,
      title: blogs.title,
      summary: blogs.summary,
      coverUrl: blogs.coverUrl,
      tags: blogs.tags,
      complexity: blogs.complexity,
      publishedAt: blogs.publishedAt,
      lastActivityAt: blogs.lastActivityAt,
    })
    .from(blogs)
    .where(eq(blogs.authorId, userId));

  if (blogRows.length === 0) return { blogs: [], pinnedBlogId };

  const blogIds = blogRows.map((b) => b.id);
  const chRows = await db
    .select({
      chapterId: chapters.id,
      blogId: chapters.blogId,
      order: chapters.order,
      revNumber: chapterRevisions.number,
      status: chapterRevisions.status,
      reviewStatus: chapterRevisions.reviewStatus,
      reviewClosedAt: chapterRevisions.reviewClosedAt,
    })
    .from(chapters)
    .innerJoin(chapterRevisions, eq(chapterRevisions.chapterId, chapters.id))
    .where(inArray(chapters.blogId, blogIds));

  // chapterId → {order, blogId, состояние последней ревизии по обеим осям}
  const latest = latestRevByChapter(chRows);
  const byBlog = new Map<
    string,
    { order: number; status: RevisionStatus; reviewStatus: ReviewStatus }[]
  >();
  const seen = new Set<string>();
  for (const r of chRows) {
    if (seen.has(r.chapterId)) continue;
    seen.add(r.chapterId);
    const lr = latest.get(r.chapterId);
    if (!lr) continue;
    const arr = byBlog.get(r.blogId) ?? [];
    arr.push({ order: r.order, status: lr.status, reviewStatus: lr.reviewStatus });
    byBlog.set(r.blogId, arr);
  }

  const cards: AuthorBlogCard[] = blogRows.map((b) => {
    const chs = (byBlog.get(b.id) ?? []).sort((a, c) => a.order - c.order);
    const publishedCount = chs.filter((c) => c.status === "published").length;
    return {
      id: b.id,
      slug: b.slug,
      title: b.title,
      summary: b.summary,
      coverUrl: b.coverUrl,
      tags: parseJson<string[]>(b.tags, []),
      complexity: b.complexity as Complexity,
      isPublished: b.publishedAt != null,
      lastActivityAt: b.lastActivityAt,
      chapterCount: chs.length,
      publishedCount,
      chapterStatuses: chs,
    };
  });

  // Закреплённый блог — вперёд; остальные по lastActivityAt desc.
  cards.sort((a, b) => {
    if (a.id === pinnedBlogId) return -1;
    if (b.id === pinnedBlogId) return 1;
    return (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0);
  });

  return { blogs: cards, pinnedBlogId };
});

/** Деталь блога автора по slug. null — блог не найден ИЛИ не принадлежит userId (404 у вызывающего). */
export const getBlogDetailForAuthor = cache(
  async (userId: string, blogSlug: string): Promise<AuthorBlogDetail | null> => {
    const blogRow = (
      await db
        .select({
          id: blogs.id,
          slug: blogs.slug,
          title: blogs.title,
          summary: blogs.summary,
          tags: blogs.tags,
          complexity: blogs.complexity,
          coverUrl: blogs.coverUrl,
          authorId: blogs.authorId,
        })
        .from(blogs)
        .where(eq(blogs.slug, blogSlug))
        .limit(1)
    )[0];

    if (!blogRow || blogRow.authorId !== userId) return null;

    const userRow = (
      await db.select({ pinnedBlogId: users.pinnedBlogId }).from(users).where(eq(users.id, userId)).limit(1)
    )[0];

    const chRows = await db
      .select({
        chapterId: chapters.id,
        chapterSlug: chapters.slug,
        chapterTitle: chapters.title,
        order: chapters.order,
        revNumber: chapterRevisions.number,
        status: chapterRevisions.status,
        reviewStatus: chapterRevisions.reviewStatus,
        reviewClosedAt: chapterRevisions.reviewClosedAt,
      })
      .from(chapters)
      .innerJoin(chapterRevisions, eq(chapterRevisions.chapterId, chapters.id))
      .where(eq(chapters.blogId, blogRow.id));

    const latest = latestRevByChapter(chRows);

    // Уникальные главы (по chapterId), метаданные берём из первой встреченной строки.
    const chapterMeta = new Map<
      string,
      { slug: string; title: string; order: number }
    >();
    for (const r of chRows) {
      if (!chapterMeta.has(r.chapterId)) {
        chapterMeta.set(r.chapterId, { slug: r.chapterSlug, title: r.chapterTitle, order: r.order });
      }
    }

    // Ревьюеры последней ревизии каждой главы (назначения Фазы 6 = заглушка под согласие Фазы 9).
    const chapterIds = [...chapterMeta.keys()];
    const reviewerRows =
      chapterIds.length === 0
        ? []
        : await db
            .select({
              chapterId: chapterReviewers.chapterId,
              revisionNumber: chapterReviewers.revisionNumber,
              handle: chapterReviewers.handle,
              verdict: chapterReviewers.verdict,
              displayName: users.displayName,
              slug: users.slug,
            })
            .from(chapterReviewers)
            .innerJoin(users, eq(users.handle, chapterReviewers.handle))
            .where(inArray(chapterReviewers.chapterId, chapterIds));

    const reviewersByChapter = new Map<string, AuthorReviewerChip[]>();
    for (const r of reviewerRows) {
      const lr = latest.get(r.chapterId);
      if (!lr || r.revisionNumber !== lr.revNumber) continue; // только последняя ревизия
      const arr = reviewersByChapter.get(r.chapterId) ?? [];
      arr.push({
        handle: r.handle,
        slug: r.slug,
        displayName: r.displayName,
        verdict: (r.verdict as Verdict | null) ?? null,
      });
      reviewersByChapter.set(r.chapterId, arr);
    }

    const chaptersView: AuthorChapterRow[] = [...chapterMeta.entries()]
      .map(([id, meta]) => {
        const lr = latest.get(id);
        return {
          id,
          slug: meta.slug,
          title: meta.title,
          order: meta.order,
          latestRevisionNumber: lr?.revNumber ?? 1,
          status: (lr?.status ?? "draft") as RevisionStatus,
          reviewStatus: (lr?.reviewStatus ?? "none") as ReviewStatus,
          reviewClosedAt: lr?.reviewClosedAt ?? null,
          reviewers: (reviewersByChapter.get(id) ?? []).sort((a, b) =>
            a.displayName.localeCompare(b.displayName, "ru"),
          ),
        };
      })
      .sort((a, b) => a.order - b.order);

    return {
      id: blogRow.id,
      slug: blogRow.slug,
      title: blogRow.title,
      summary: blogRow.summary,
      tags: parseJson<string[]>(blogRow.tags, []),
      complexity: blogRow.complexity as Complexity,
      coverUrl: blogRow.coverUrl,
      isPinned: (userRow?.pinnedBlogId ?? null) === blogRow.id,
      chapters: chaptersView,
    };
  },
);

/** Глава для редактора (последняя ревизия, любой статус). null — не найдено/не владелец. */
export const getChapterForEditor = cache(
  async (userId: string, blogSlug: string, chapterSlug: string): Promise<EditorChapter | null> => {
    const row = (
      await db
        .select({
          blogId: blogs.id,
          blogSlug: blogs.slug,
          blogTitle: blogs.title,
          blogTags: blogs.tags,
          blogComplexity: blogs.complexity,
          blogCover: blogs.coverUrl,
          blogSummary: blogs.summary,
          authorId: blogs.authorId,
          chapterId: chapters.id,
          chapterSlug: chapters.slug,
          chapterTitle: chapters.title,
          chapterOrder: chapters.order,
          skills: chapters.skills,
        })
        .from(blogs)
        .innerJoin(chapters, eq(chapters.blogId, blogs.id))
        .where(and(eq(blogs.slug, blogSlug), eq(chapters.slug, chapterSlug)))
        .limit(1)
    )[0];

    if (!row || row.authorId !== userId) return null;

    const revRows = await db
      .select({
        id: chapterRevisions.id,
        number: chapterRevisions.number,
        status: chapterRevisions.status,
        reviewStatus: chapterRevisions.reviewStatus,
        summary: chapterRevisions.summary,
        blocks: chapterRevisions.blocks,
      })
      .from(chapterRevisions)
      .where(eq(chapterRevisions.chapterId, row.chapterId));

    if (revRows.length === 0) return null;
    const rev = revRows.reduce((a, b) => (b.number > a.number ? b : a));

    return {
      blog: {
        id: row.blogId,
        slug: row.blogSlug,
        title: row.blogTitle,
        tags: parseJson<string[]>(row.blogTags, []),
        complexity: row.blogComplexity as Complexity,
        coverUrl: row.blogCover,
        summary: row.blogSummary,
      },
      chapter: {
        id: row.chapterId,
        slug: row.chapterSlug,
        title: row.chapterTitle,
        order: row.chapterOrder,
        skills: parseJson<string[]>(row.skills, []),
      },
      revision: {
        id: rev.id,
        number: rev.number,
        status: rev.status as RevisionStatus,
        reviewStatus: rev.reviewStatus as ReviewStatus,
        summary: rev.summary,
        blocks: parseJson<Block[]>(rev.blocks, []),
      },
    };
  },
);

// ───────────────────────────── recruit-запросы и оценка ревьюеров (Фаза 9) ─────────────────────────────

export interface RecruitStatusItem {
  id: string;
  chapterId: string | null;
  chapterTitle: string | null;
  skills: string[];
  status: RecruitStatus;
  reason: string | null; // причина reject (виден автору)
  createdAt: number;
}

/** Recruit-запросы автора (статус виден в кабинете). Обработку ведёт админ (Фаза 10). */
export const getRecruitRequests = cache(async (userId: string): Promise<RecruitStatusItem[]> => {
  const me = (await db.select({ handle: users.handle }).from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!me) return [];
  const rows = await db
    .select({
      id: recruitRequests.id,
      chapterId: recruitRequests.chapterId,
      chapterTitle: chapters.title,
      skills: recruitRequests.skills,
      status: recruitRequests.status,
      reason: recruitRequests.reason,
      createdAt: recruitRequests.createdAt,
    })
    .from(recruitRequests)
    .leftJoin(chapters, eq(chapters.id, recruitRequests.chapterId))
    .where(eq(recruitRequests.byHandle, me.handle))
    .orderBy(desc(recruitRequests.createdAt));
  return rows.map((r) => ({
    id: r.id,
    chapterId: r.chapterId,
    chapterTitle: r.chapterTitle ?? null,
    skills: parseJson<string[]>(r.skills, []),
    status: r.status,
    reason: r.reason,
    createdAt: r.createdAt,
  }));
});

/** Портфолио автора (любой видимости — это владелец). null — ещё не создано. */
export const getPortfolioForAuthor = cache(async (userId: string): Promise<AuthorPortfolio | null> => {
  const row = (
    await db
      .select({ blocks: portfolios.blocks, isVisible: portfolios.isVisible, updatedAt: portfolios.updatedAt })
      .from(portfolios)
      .where(eq(portfolios.authorId, userId))
      .limit(1)
  )[0];
  if (!row) return null;
  return {
    blocks: parseJson<Block[]>(row.blocks, []),
    isVisible: row.isVisible,
    updatedAt: row.updatedAt,
  };
});
