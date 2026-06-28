// Публичный профиль /u/[slug]. Автор → видимые блоги + портфолио «Об авторе» (если видимо).
// Ревьюер → «что отрецензировал» (reviewer_history ∩ публично читаемые главы). Читатель/админ → нет профиля.
// Заблокированный пользователь — скрыт. passwordHash наружу не попадает (выбираем явные колонки).

import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapters, portfolios, reviewerHistory, users } from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import { getReadableChapters, getVisibleBlogs } from "./feed";
import type { BlogCardView } from "./types";
import type { Block, LinkItem, Role } from "@/types";

export interface ProfileUser {
  id: string;
  handle: string;
  slug: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  role: Role;
  links: LinkItem[];
  competencies: string[];
  reviewerRating: number | null;
  reviewerRatingsN: number | null;
}

export interface ReviewedChapterView {
  blogSlug: string;
  chapterSlug: string;
  blogTitle: string;
  chapterTitle: string;
}

export type ProfileView =
  | { kind: "author"; user: ProfileUser; blogs: BlogCardView[]; portfolio: Block[] | null }
  | { kind: "reviewer"; user: ProfileUser; reviewed: ReviewedChapterView[] };

export const getProfileBySlug = cache(async (slug: string): Promise<ProfileView | null> => {
  const row = (
    await db
      .select({
        id: users.id,
        handle: users.handle,
        slug: users.slug,
        displayName: users.displayName,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        role: users.role,
        links: users.links,
        competencies: users.competencies,
        reviewerRating: users.reviewerRating,
        reviewerRatingsN: users.reviewerRatingsN,
        isBlocked: users.isBlocked,
      })
      .from(users)
      .where(eq(users.slug, slug))
      .limit(1)
  )[0];

  // Скрыт: нет пользователя / заблокирован / у роли нет публичного профиля (reader/admin).
  if (!row || row.isBlocked) return null;
  if (row.role !== "author" && row.role !== "reviewer") return null;

  const user: ProfileUser = {
    id: row.id,
    handle: row.handle,
    slug: row.slug,
    displayName: row.displayName,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    role: row.role,
    links: parseJson<LinkItem[]>(row.links, []),
    competencies: parseJson<string[]>(row.competencies, []),
    reviewerRating: row.reviewerRating,
    reviewerRatingsN: row.reviewerRatingsN,
  };

  if (row.role === "author") {
    const allBlogs = await getVisibleBlogs();
    const authored = allBlogs.filter((b) => b.author.id === user.id);
    const pf = (
      await db
        .select({ blocks: portfolios.blocks })
        .from(portfolios)
        .where(and(eq(portfolios.authorId, user.id), eq(portfolios.isVisible, true)))
        .limit(1)
    )[0];
    return {
      kind: "author",
      user,
      blogs: authored,
      portfolio: pf ? parseJson<Block[]>(pf.blocks, []) : null,
    };
  }

  // reviewer: главы из reviewer_history, ограниченные публично читаемыми (видимый автор + published).
  const readableIds = new Set((await getReadableChapters()).map((r) => r.chapterId));
  const rows = await db
    .select({
      chapterId: reviewerHistory.chapterId,
      blogSlug: blogs.slug,
      blogTitle: blogs.title,
      chapterSlug: chapters.slug,
      chapterTitle: chapters.title,
    })
    .from(reviewerHistory)
    .innerJoin(chapters, eq(reviewerHistory.chapterId, chapters.id))
    .innerJoin(blogs, eq(chapters.blogId, blogs.id))
    .where(eq(reviewerHistory.handle, user.handle));

  const seen = new Set<string>();
  const reviewed: ReviewedChapterView[] = [];
  for (const r of rows) {
    if (!readableIds.has(r.chapterId) || seen.has(r.chapterId)) continue;
    seen.add(r.chapterId);
    reviewed.push({
      blogSlug: r.blogSlug,
      chapterSlug: r.chapterSlug,
      blogTitle: r.blogTitle,
      chapterTitle: r.chapterTitle,
    });
  }

  return { kind: "reviewer", user, reviewed };
});
