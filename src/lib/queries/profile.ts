// Публичный профиль /u/[slug]. Аккаунт с `canAuthor` → видимые блоги + портфолио «Об авторе»
// (если видимо); `isReviewer` → «что отрецензировал» (reviewer_history ∩ публично читаемые главы).
// Аккаунт без возможностей и админ → профиля пока нет (Ф13.5/PR-B сделает профиль всем + noindex).
// Заблокированный пользователь — скрыт. passwordHash наружу не попадает (выбираем явные колонки).

import { cache } from "react";
import { and, eq, inArray, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapters, portfolios, reviewerHistory, users } from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import { getReadableChapters, getVisibleBlogs } from "./feed";
import type { BlogCardView } from "./types";
import type { Block, LinkItem } from "@/types";

export interface ProfileUser {
  id: string;
  handle: string;
  slug: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  canAuthor: boolean;
  isReviewer: boolean;
  links: LinkItem[];
  competencies: string[];
  reviewerRating: number | null;
  reviewerRatingsN: number | null;
  createdAt: number;
}

/** Агрегаты шапки профиля автора (прототип ProfileScreen: Блогов/Глав/Просмотров/В закладках). */
export interface ProfileStats {
  blogs: number;
  chapters: number;
  views: number;
  bookmarks: number;
}

export interface ReviewedChapterView {
  blogSlug: string;
  chapterSlug: string;
  blogTitle: string;
  chapterTitle: string;
}

export type ProfileView =
  | {
      kind: "author";
      user: ProfileUser;
      blogs: BlogCardView[];
      portfolio: Block[] | null;
      pinnedBlogId: string | null;
      stats: ProfileStats;
    }
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
        canAuthor: users.canAuthor,
        isReviewer: users.isReviewer,
        links: users.links,
        competencies: users.competencies,
        reviewerRating: users.reviewerRating,
        reviewerRatingsN: users.reviewerRatingsN,
        createdAt: users.createdAt,
        pinnedBlogId: users.pinnedBlogId,
        isBlocked: users.isBlocked,
      })
      .from(users)
      .where(eq(users.slug, slug))
      .limit(1)
  )[0];

  // Скрыт: нет пользователя / заблокирован.
  // ⚠️ Ф13 (промежуточный шаг): видимость профиля гейтится ВОЗМОЖНОСТЯМИ, а не legacy-ролью —
  // иначе у аккаунта, которому админ выдал `canAuthor` (а `role` остался `reader`), профиля бы
  // не было никогда, а пункт меню «Мой профиль» вёл бы в 404. Полное перепроектирование
  // «профиль есть у ЛЮБОГО аккаунта, у пустого — noindex» (З-36/З-37) — подфаза 13.5, PR-B.
  if (!row || row.isBlocked) return null;
  if (!row.canAuthor && !row.isReviewer) return null;

  const user: ProfileUser = {
    id: row.id,
    handle: row.handle,
    slug: row.slug,
    displayName: row.displayName,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    canAuthor: row.canAuthor,
    isReviewer: row.isReviewer,
    links: parseJson<LinkItem[]>(row.links, []),
    competencies: parseJson<string[]>(row.competencies, []),
    reviewerRating: row.reviewerRating,
    reviewerRatingsN: row.reviewerRatingsN,
    createdAt: row.createdAt,
  };

  // Аккаунт с обеими возможностями показывается как авторский профиль (полноценные две секции —
  // 13.5/PR-B). Порядок ветвления сохраняет поведение до Ф13 для «чистых» ролей.
  if (row.canAuthor) {
    const allBlogs = await getVisibleBlogs();
    const authored = allBlogs.filter((b) => b.author.id === user.id);
    const pf = (
      await db
        .select({ blocks: portfolios.blocks })
        .from(portfolios)
        .where(and(eq(portfolios.authorId, user.id), eq(portfolios.isVisible, true)))
        .limit(1)
    )[0];

    // Просмотры — агрегат по видимым блогам автора (viewCount не входит в BlogCardView).
    let views = 0;
    if (authored.length > 0) {
      const vc = (
        await db
          .select({ total: sum(blogs.viewCount) })
          .from(blogs)
          .where(inArray(blogs.id, authored.map((b) => b.id)))
      )[0];
      views = Number(vc?.total ?? 0);
    }

    return {
      kind: "author",
      user,
      blogs: authored,
      portfolio: pf ? parseJson<Block[]>(pf.blocks, []) : null,
      pinnedBlogId: row.pinnedBlogId ?? null,
      stats: {
        blogs: authored.length,
        chapters: authored.reduce((n, b) => n + b.chapterCount, 0),
        views,
        bookmarks: authored.reduce((n, b) => n + b.bookmarkCount, 0),
      },
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
