// Закладки пользователя → карточки блогов (фильтр видимости автора сохраняется).

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, bookmarks, users } from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import type { BlogCardView } from "./types";
import type { Complexity } from "@/types";

export async function getBookmarkedBlogs(userId: string): Promise<BlogCardView[]> {
  const rows = await db
    .select({
      id: blogs.id,
      slug: blogs.slug,
      title: blogs.title,
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
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .innerJoin(blogs, eq(bookmarks.blogId, blogs.id))
    .innerJoin(users, eq(blogs.authorId, users.id))
    .where(and(eq(bookmarks.userId, userId), eq(users.isBlocked, false)))
    .orderBy(desc(bookmarks.createdAt));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    coverUrl: r.coverUrl,
    tags: parseJson<string[]>(r.tags, []),
    complexity: r.complexity as Complexity,
    summary: r.summary,
    rating: r.rating,
    bookmarkCount: r.bookmarkCount,
    lastActivityAt: r.lastActivityAt,
    author: {
      id: r.authorId,
      handle: r.authorHandle,
      slug: r.authorSlug,
      displayName: r.authorName,
      avatarUrl: r.authorAvatar,
    },
    chapterCount: 0, // на экране закладок счётчик глав не показываем
  }));
}
