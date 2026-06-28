// Контент для ридера. getReadableBlog — ЯКОРЬ регресс-ловушки: контент полностью выводится из
// (blogSlug[, chapterSlug]); разные блоги → разный контент; generateMetadata зовёт ту же функцию.
// Видимость: автор не заблокирован + только published-ревизии (последняя по number на главу).

import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterRevisions, chapters, users } from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import type { Block, Complexity } from "@/types";
import type { ReadableBlog, ReadableChapter } from "./types";

/** Видимый блог + автор + published-главы (по order) с контентом. null — скрыт/нет публикаций. */
export const getReadableBlog = cache(async (slug: string): Promise<ReadableBlog | null> => {
  const blogRow = (
    await db
      .select({
        id: blogs.id,
        slug: blogs.slug,
        title: blogs.title,
        coverUrl: blogs.coverUrl,
        tags: blogs.tags,
        complexity: blogs.complexity,
        summary: blogs.summary,
        publishedAt: blogs.publishedAt,
        bookmarkCount: blogs.bookmarkCount,
        authorId: users.id,
        authorHandle: users.handle,
        authorSlug: users.slug,
        authorName: users.displayName,
        authorAvatar: users.avatarUrl,
      })
      .from(blogs)
      .innerJoin(users, eq(blogs.authorId, users.id))
      .where(and(eq(blogs.slug, slug), eq(users.isBlocked, false)))
      .limit(1)
  )[0];

  if (!blogRow) return null;

  const revRows = await db
    .select({
      chapterId: chapters.id,
      chapterSlug: chapters.slug,
      chapterTitle: chapters.title,
      chapterOrder: chapters.order,
      skills: chapters.skills,
      primaryHandle: chapters.primaryHandle,
      revNumber: chapterRevisions.number,
      revPublishedAt: chapterRevisions.publishedAt,
      revSummary: chapterRevisions.summary,
      blocks: chapterRevisions.blocks,
    })
    .from(chapters)
    .innerJoin(chapterRevisions, eq(chapterRevisions.chapterId, chapters.id))
    .where(and(eq(chapters.blogId, blogRow.id), eq(chapterRevisions.status, "published")));

  // По каждой главе — ревизия с наибольшим number.
  const latest = new Map<string, (typeof revRows)[number]>();
  for (const r of revRows) {
    const prev = latest.get(r.chapterId);
    if (!prev || r.revNumber > prev.revNumber) latest.set(r.chapterId, r);
  }
  if (latest.size === 0) return null; // нет публичного контента

  const chaptersView: ReadableChapter[] = [...latest.values()]
    .sort((a, b) => a.chapterOrder - b.chapterOrder)
    .map((r) => ({
      id: r.chapterId,
      slug: r.chapterSlug,
      title: r.chapterTitle,
      order: r.chapterOrder,
      skills: parseJson<string[]>(r.skills, []),
      primaryHandle: r.primaryHandle,
      revisionNumber: r.revNumber,
      publishedAt: r.revPublishedAt,
      summary: r.revSummary,
      blocks: parseJson<Block[]>(r.blocks, []),
    }));

  return {
    id: blogRow.id,
    slug: blogRow.slug,
    title: blogRow.title,
    coverUrl: blogRow.coverUrl,
    tags: parseJson<string[]>(blogRow.tags, []),
    complexity: blogRow.complexity as Complexity,
    summary: blogRow.summary,
    publishedAt: blogRow.publishedAt,
    bookmarkCount: blogRow.bookmarkCount,
    author: {
      id: blogRow.authorId,
      handle: blogRow.authorHandle,
      slug: blogRow.authorSlug,
      displayName: blogRow.authorName,
      avatarUrl: blogRow.authorAvatar,
    },
    chapters: chaptersView,
  };
});
