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

/**
 * ⚠️ Фаза 13.5: union `author|reviewer` схлопнут в ОДИН профиль (З-37). Аккаунт может держать обе
 * возможности сразу, и профиль обязан показывать обе стороны. Секции пустуют, а не отсутствуют:
 * `blogs`/`reviewed` могут быть пустыми массивами — решение о показе таба принимает страница.
 */
export interface ProfileView {
  user: ProfileUser;
  blogs: BlogCardView[];
  portfolio: Block[] | null;
  pinnedBlogId: string | null;
  stats: ProfileStats;
  reviewed: ReviewedChapterView[];
  /** Профиль «пустой» (нет ни публикаций, ни ревью) → `noindex` и вне sitemap (З-47). */
  isEmpty: boolean;
}

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
        createdAt: users.createdAt,
        pinnedBlogId: users.pinnedBlogId,
        isBlocked: users.isBlocked,
      })
      .from(users)
      .where(eq(users.slug, slug))
      .limit(1)
  )[0];

  // Скрыт: нет пользователя / заблокирован.
  // ⚠️ Ф13.5 (З-36): профиль есть у ЛЮБОГО аккаунта — гейта по роли/возможностям больше нет.
  // Скрывается только заблокированный. «Пустой» профиль (без публикаций и ревью) отдаётся,
  // но помечается isEmpty → страница ставит noindex, sitemap его не берёт (З-47).
  if (!row || row.isBlocked) return null;

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
    createdAt: row.createdAt,
  };

  // Обе стороны профиля считаются ВСЕГДА — аккаунт может держать обе возможности сразу,
  // и «блоги» с «ревью» больше не взаимоисключающи.
  const [allBlogs, reviewed] = await Promise.all([
    getVisibleBlogs(),
    getReviewedChapters(user.handle),
  ]);
  const authored = allBlogs.filter((b) => b.author.id === user.id);

  // Портфолио «Об авторе» — тоже авторский контент, поэтому при снятом `can_author` оно
  // скрывается вместе с блогами (иначе у скрытого автора осталась бы публичная витрина).
  // Био и ссылки — личные данные профиля, они остаются.
  const pf = !row.canAuthor
    ? undefined
    : (
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
    reviewed,
    isEmpty: authored.length === 0 && reviewed.length === 0,
  };
});

/**
 * Публично читаемые главы, отрецензированные этим handle (З-44 — вынесено из getProfileBySlug).
 * Переиспользуется профилем и «Рабочим местом». Ограничение «публично читаемые» обязательно:
 * кредит за скрытую/неопубликованную главу наружу не показываем.
 */
export const getReviewedChapters = cache(
  async (handle: string): Promise<ReviewedChapterView[]> => {
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
      .where(eq(reviewerHistory.handle, handle));

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
    return reviewed;
  },
);
