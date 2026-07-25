// Данные для sitemap: видимые блоги, published-главы, публичные профили (авторы + ревьюеры).
// Скрытые авторы исключены (getReadableChapters уже фильтрует). Ревьюеры — из reviewer_history
// читаемых глав. Все URL — только публично доступные поверхности.
//
// ⚠️ Ф14: архивный режим главы (`?v=N`, чтение проверенной версии) в sitemap НЕ попадает —
// это дубликат контента текущей главы; страница сама ставит `robots: noindex` и canonical
// на версию без `?v=`. Здесь перечисляются только канонические URL глав.

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviewerHistory, users } from "@/lib/db/schema";
import { getReadableChapters } from "./feed";

export interface SitemapData {
  blogs: { slug: string; lastMod: number | null }[];
  chapters: { blogSlug: string; chapterSlug: string; lastMod: number | null }[];
  profiles: { slug: string; lastMod: number | null }[];
}

/**
 * ⚠️ Ф15 (решение владельца, binding): sitemap отдаёт ВСЁ опубликованное — фильтр «только
 * проверенное» сюда НЕ добавлять. Он живёт в `feed.xml` (`FeedFilter.verifiedOnly`) и на витрине
 * главной (`queries/showcase.ts`). Блог без бейджа полностью работоспособен и живёт по прямой
 * ссылке — это канал самопродвижения автора, и он обязан индексироваться.
 */
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
  // ⚠️ Фаза 13 (З-45): фильтра по роли здесь БЫТЬ НЕ ДОЛЖНО — наличие строки в reviewer_history и
  // означает, что человек рецензировал. Прежняя проверка `role === "reviewer"` выкидывала из sitemap
  // ревьюера, ставшего автором (при единой ролевой модели это был бы штатный случай).
  //
  // ⚠️ Ф13.5 (З-47): в sitemap попадают ТОЛЬКО непустые профили. Профиль теперь есть у любого
  // аккаунта, но у аккаунта без публикаций и ревью индексировать нечего (страница ставит noindex) —
  // поэтому список строится строго из авторов читаемых глав и из reviewer_history, а не из `users`.
  const chapterIds = [...new Set(rows.map((r) => r.chapterId))];
  if (chapterIds.length > 0) {
    const rev = await db
      .select({ slug: users.slug, isBlocked: users.isBlocked })
      .from(reviewerHistory)
      .innerJoin(users, eq(reviewerHistory.handle, users.handle))
      .where(inArray(reviewerHistory.chapterId, chapterIds));
    for (const x of rev) {
      if (!x.isBlocked && !profileSlugs.has(x.slug)) profileSlugs.set(x.slug, null);
    }
  }

  return {
    blogs: [...blogMap].map(([slug, lastMod]) => ({ slug, lastMod })),
    chapters,
    profiles: [...profileSlugs].map(([slug, lastMod]) => ({ slug, lastMod })),
  };
}
