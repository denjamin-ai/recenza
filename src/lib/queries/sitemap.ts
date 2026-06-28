// Данные для sitemap: видимые блоги, published-главы, публичные профили (авторы + ревьюеры).
// Скрытые авторы исключены (getReadableChapters уже фильтрует). Ревьюеры — из reviewer_history
// читаемых глав. Все URL — только публично доступные поверхности.

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviewerHistory, users } from "@/lib/db/schema";
import { getReadableChapters } from "./feed";

export interface SitemapData {
  blogs: { slug: string; lastMod: number | null }[];
  chapters: { blogSlug: string; chapterSlug: string; lastMod: number | null }[];
  profiles: { slug: string; lastMod: number | null }[];
}

export async function getSitemapData(): Promise<SitemapData> {
  const rows = await getReadableChapters();

  const blogMap = new Map<string, number | null>();
  const chapters: SitemapData["chapters"] = [];
  const profileSlugs = new Map<string, number | null>();

  for (const r of rows) {
    if (!blogMap.has(r.blogSlug)) blogMap.set(r.blogSlug, r.lastActivityAt);
    chapters.push({ blogSlug: r.blogSlug, chapterSlug: r.chapterSlug, lastMod: r.revPublishedAt });
    if (!profileSlugs.has(r.authorSlug)) profileSlugs.set(r.authorSlug, r.lastActivityAt);
  }

  // Профили ревьюеров публичных глав.
  const chapterIds = [...new Set(rows.map((r) => r.chapterId))];
  if (chapterIds.length > 0) {
    const rev = await db
      .select({ slug: users.slug, role: users.role, isBlocked: users.isBlocked })
      .from(reviewerHistory)
      .innerJoin(users, eq(reviewerHistory.handle, users.handle))
      .where(inArray(reviewerHistory.chapterId, chapterIds));
    for (const x of rev) {
      if (x.role === "reviewer" && !x.isBlocked && !profileSlugs.has(x.slug)) {
        profileSlugs.set(x.slug, null);
      }
    }
  }

  return {
    blogs: [...blogMap].map(([slug, lastMod]) => ({ slug, lastMod })),
    chapters,
    profiles: [...profileSlugs].map(([slug, lastMod]) => ({ slug, lastMod })),
  };
}
