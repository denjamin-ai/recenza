// Авторские запросы (Фаза 6) — читают ЧЕРНОВИКИ и все статусы ревизий, в отличие от ридер-запросов
// (chapters.ts/feed.ts), которые отдают только published. ВСЕГДА owner-scoped: каждая функция принимает
// userId и фильтрует/проверяет владение; чужое → null (ролевой binding, CLAUDE.md §гейтинг).
//
// Статус главы = статус её последней ревизии (max number). Блог «опубликован» = blogs.publishedAt != null.
// Колонки chapters/blogs/chapter_revisions есть статуса нет — выводим из ревизий (см. PLAN §traps).

import { cache } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blogs,
  chapterReviewers,
  chapterRevisions,
  chapters,
  portfolios,
  users,
} from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import type { Block, Complexity, RevisionStatus, Verdict } from "@/types";

// ───────────────────────────── view-типы (сериализуемые) ─────────────────────────────

export interface AuthorReviewerChip {
  handle: string;
  displayName: string;
  isPrimary: boolean;
  verdict: Verdict | null;
}

export interface AuthorChapterRow {
  id: string;
  slug: string;
  title: string;
  order: number;
  latestRevisionNumber: number;
  status: RevisionStatus;
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
  /** Статусы глав по порядку — для мини-точек прогресса и счётчиков. */
  chapterStatuses: { order: number; status: RevisionStatus }[];
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
    primaryHandle: string | null;
  };
  revision: {
    id: string;
    number: number;
    status: RevisionStatus;
    summary: string | null;
    blocks: Block[];
  };
}

export interface AuthorPortfolio {
  blocks: Block[];
  isVisible: boolean;
  updatedAt: number | null;
}

export interface ReviewerOption {
  handle: string;
  displayName: string;
  competencies: string[];
  rating: number | null;
  availability: "free" | "busy" | "full";
}

// ───────────────────────────── helpers ─────────────────────────────

type LatestRev = { revNumber: number; status: RevisionStatus };

/** По строкам (chapterId, number, status) оставляет ревизию с наибольшим number на главу. */
function latestRevByChapter(
  rows: { chapterId: string; revNumber: number; status: RevisionStatus }[],
): Map<string, LatestRev> {
  const latest = new Map<string, LatestRev>();
  for (const r of rows) {
    const prev = latest.get(r.chapterId);
    if (!prev || r.revNumber > prev.revNumber) {
      latest.set(r.chapterId, { revNumber: r.revNumber, status: r.status });
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
    })
    .from(chapters)
    .innerJoin(chapterRevisions, eq(chapterRevisions.chapterId, chapters.id))
    .where(inArray(chapters.blogId, blogIds));

  // chapterId → {order, blogId, latest status}
  const latest = latestRevByChapter(chRows);
  const byBlog = new Map<string, { order: number; status: RevisionStatus }[]>();
  const seen = new Set<string>();
  for (const r of chRows) {
    if (seen.has(r.chapterId)) continue;
    seen.add(r.chapterId);
    const lr = latest.get(r.chapterId);
    if (!lr) continue;
    const arr = byBlog.get(r.blogId) ?? [];
    arr.push({ order: r.order, status: lr.status });
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
              isPrimary: chapterReviewers.isPrimary,
              verdict: chapterReviewers.verdict,
              displayName: users.displayName,
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
        displayName: r.displayName,
        isPrimary: r.isPrimary,
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
          reviewers: (reviewersByChapter.get(id) ?? []).sort(
            (a, b) => Number(b.isPrimary) - Number(a.isPrimary),
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
          primaryHandle: chapters.primaryHandle,
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
        primaryHandle: row.primaryHandle,
      },
      revision: {
        id: rev.id,
        number: rev.number,
        status: rev.status as RevisionStatus,
        summary: rev.summary,
        blocks: parseJson<Block[]>(rev.blocks, []),
      },
    };
  },
);

/**
 * Список ревьюеров для базовой формы SubmitSheet (Фаза 6; матчинг/скоринг — Фаза 9).
 * Только role=reviewer, не заблокированные. Доступность выводится из review_load/review_capacity.
 */
export const getAvailableReviewers = cache(async (): Promise<ReviewerOption[]> => {
  const rows = await db
    .select({
      handle: users.handle,
      displayName: users.displayName,
      competencies: users.competencies,
      rating: users.reviewerRating,
      load: users.reviewLoad,
      capacity: users.reviewCapacity,
    })
    .from(users)
    .where(and(eq(users.role, "reviewer"), eq(users.isBlocked, false)));

  return rows.map((r) => {
    const availability: ReviewerOption["availability"] =
      r.load >= r.capacity ? "full" : r.load === 0 ? "free" : "busy";
    return {
      handle: r.handle,
      displayName: r.displayName,
      competencies: parseJson<string[]>(r.competencies, []),
      rating: r.rating,
      availability,
    };
  });
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
