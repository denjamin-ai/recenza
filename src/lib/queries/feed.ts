// Базовый запрос «публично читаемых глав» + производные: лента, каталог, подписки.
// Binding-инварианты (visibility): автор НЕ заблокирован + у главы есть published-ревизия;
// публичный контент главы = ревизия с наибольшим number при status='published'.
// cache() — дедуп в пределах одного запроса (generateMetadata + page).

import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterRevisions, chapters, follows, users } from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import type { AuthorView, BlogCardView, FeedFilter, FeedItemView } from "./types";
import type { Complexity } from "@/types";

interface BaseRow {
  blogId: string;
  blogSlug: string;
  blogTitle: string;
  coverUrl: string | null;
  tags: string | null;
  complexity: Complexity;
  summary: string | null;
  rating: number;
  bookmarkCount: number;
  lastActivityAt: number | null;
  authorId: string;
  authorHandle: string;
  authorSlug: string;
  authorName: string;
  authorAvatar: string | null;
  chapterId: string;
  chapterSlug: string;
  chapterTitle: string;
  chapterOrder: number;
  skills: string | null;
  revNumber: number;
  revPublishedAt: number | null;
  revSummary: string | null;
}

/** Одна строка на главу = её последняя published-ревизия (видимый автор). Отсортировано по publishedAt desc. */
export const getReadableChapters = cache(async (): Promise<BaseRow[]> => {
  const rows = (await db
    .select({
      blogId: blogs.id,
      blogSlug: blogs.slug,
      blogTitle: blogs.title,
      coverUrl: blogs.coverUrl,
      tags: blogs.tags,
      complexity: blogs.complexity,
      summary: blogs.summary,
      rating: blogs.rating,
      bookmarkCount: blogs.bookmarkCount,
      lastActivityAt: blogs.lastActivityAt,
      authorId: users.id,
      authorHandle: users.handle,
      authorSlug: users.slug,
      authorName: users.displayName,
      authorAvatar: users.avatarUrl,
      chapterId: chapters.id,
      chapterSlug: chapters.slug,
      chapterTitle: chapters.title,
      chapterOrder: chapters.order,
      skills: chapters.skills,
      revNumber: chapterRevisions.number,
      revPublishedAt: chapterRevisions.publishedAt,
      revSummary: chapterRevisions.summary,
    })
    .from(chapterRevisions)
    .innerJoin(chapters, eq(chapterRevisions.chapterId, chapters.id))
    .innerJoin(blogs, eq(chapters.blogId, blogs.id))
    .innerJoin(users, eq(blogs.authorId, users.id))
    .where(
      and(
        eq(chapterRevisions.status, "published"),
        eq(users.isBlocked, false),
        eq(blogs.hidden, false), // Фаза 10: блог скрыт админом → вон из ленты/каталога/подписок/sitemap/feed
      ),
    )) as BaseRow[];

  // Оставляем по каждой главе ТОЛЬКО ревизию с наибольшим number (последняя публикация).
  const latest = new Map<string, BaseRow>();
  for (const row of rows) {
    const prev = latest.get(row.chapterId);
    if (!prev || row.revNumber > prev.revNumber) latest.set(row.chapterId, row);
  }

  return [...latest.values()].sort(
    (a, b) => (b.revPublishedAt ?? 0) - (a.revPublishedAt ?? 0),
  );
});

function authorOf(row: BaseRow): AuthorView {
  return {
    id: row.authorId,
    handle: row.authorHandle,
    slug: row.authorSlug,
    displayName: row.authorName,
    avatarUrl: row.authorAvatar,
  };
}

function matchesFilter(row: BaseRow, filter?: FeedFilter): boolean {
  if (!filter) return true;
  if (filter.restrictAuthorId && row.authorId !== filter.restrictAuthorId) return false;
  if (filter.complexity && row.complexity !== filter.complexity) return false;
  if (filter.tag) {
    const tags = parseJson<string[]>(row.tags, []);
    if (!tags.includes(filter.tag)) return false;
  }
  return true;
}

/** Лента: главы (последние публикации) по всем видимым блогам, новые первыми. */
export async function getFeed(filter?: FeedFilter): Promise<FeedItemView[]> {
  const rows = await getReadableChapters();
  return rows.filter((r) => matchesFilter(r, filter)).map((r) => ({
    blogSlug: r.blogSlug,
    blogTitle: r.blogTitle,
    chapterSlug: r.chapterSlug,
    chapterTitle: r.chapterTitle,
    skills: parseJson<string[]>(r.skills, []),
    publishedAt: r.revPublishedAt,
    summary: r.revSummary,
    author: authorOf(r),
  }));
}

/** Каталог: уникальные видимые блоги (≥1 published-глава), по последней активности. */
export async function getVisibleBlogs(filter?: FeedFilter): Promise<BlogCardView[]> {
  const rows = (await getReadableChapters()).filter((r) => matchesFilter(r, filter));
  const byBlog = new Map<string, BlogCardView>();
  for (const r of rows) {
    const existing = byBlog.get(r.blogId);
    if (existing) {
      existing.chapterCount += 1;
      continue;
    }
    byBlog.set(r.blogId, {
      id: r.blogId,
      slug: r.blogSlug,
      title: r.blogTitle,
      coverUrl: r.coverUrl,
      tags: parseJson<string[]>(r.tags, []),
      complexity: r.complexity,
      summary: r.summary,
      rating: r.rating,
      bookmarkCount: r.bookmarkCount,
      lastActivityAt: r.lastActivityAt,
      author: authorOf(r),
      chapterCount: 1,
    });
  }
  return [...byBlog.values()].sort(
    (a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0),
  );
}

/** Подписки: главы блогов авторов, на которых подписан пользователь (автор-центрично). */
export async function getSubscriptionFeed(
  userId: string,
  filter?: FeedFilter,
): Promise<FeedItemView[]> {
  const followed = await db
    .select({ authorId: follows.authorId })
    .from(follows)
    .where(eq(follows.userId, userId));
  const ids = followed.map((f) => f.authorId);
  if (ids.length === 0) return [];

  const rows = await getReadableChapters();
  return rows
    .filter((r) => ids.includes(r.authorId) && matchesFilter(r, filter))
    .map((r) => ({
      blogSlug: r.blogSlug,
      blogTitle: r.blogTitle,
      chapterSlug: r.chapterSlug,
      chapterTitle: r.chapterTitle,
      skills: parseJson<string[]>(r.skills, []),
      publishedAt: r.revPublishedAt,
      summary: r.revSummary,
      author: authorOf(r),
    }));
}

/** Теги видимых блогов для фильтр-чипов (с учётом ролевой изоляции автора). */
export async function getAllTags(restrictAuthorId?: string): Promise<string[]> {
  const rows = await getReadableChapters();
  const set = new Set<string>();
  for (const r of rows) {
    if (restrictAuthorId && r.authorId !== restrictAuthorId) continue;
    for (const t of parseJson<string[]>(r.tags, [])) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ru"));
}
