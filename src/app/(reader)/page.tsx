// Главная: табы Лента/Каталог/Подписки (?tab=) + фильтр-чипы + зарезервированный слот промо-баннеров.
// Ролевая изоляция автора: viewer-author видит ТОЛЬКО свои блоги (restrictAuthorId).

import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getAllTags, getFeed, getSubscriptionFeed, getVisibleBlogs } from "@/lib/queries/feed";
import { PromoCarouselSlot } from "@/components/reader/promo-carousel-slot";
import { HomeTabs } from "@/components/reader/home-tabs";
import { FilterChips } from "@/components/reader/filter-chips";
import { FeedList } from "@/components/reader/feed-list";
import { CatalogGrid } from "@/components/reader/catalog-grid";
import { SubscriptionFeed } from "@/components/reader/subscription-feed";
import { siteUrl } from "@/lib/seo";
import { COMPLEXITIES } from "@/types";
import type { Complexity } from "@/types";
import type { FeedFilter } from "@/lib/queries/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: siteUrl() },
};

type Search = Promise<{ tab?: string; tag?: string; complexity?: string }>;

export default async function HomePage({ searchParams }: { searchParams: Search }) {
  const { tab, tag, complexity } = await searchParams;
  const activeTab = tab === "catalog" || tab === "subscriptions" ? tab : "feed";

  const user = await getCurrentUser();
  const restrictAuthorId = user?.role === "author" ? user.id : undefined;
  const validComplexity = COMPLEXITIES.includes(complexity as Complexity)
    ? (complexity as Complexity)
    : undefined;
  const filter: FeedFilter = { tag, complexity: validComplexity, restrictAuthorId };

  const tags = await getAllTags(restrictAuthorId);

  let panel: React.ReactNode;
  if (activeTab === "catalog") {
    panel = <CatalogGrid blogs={await getVisibleBlogs(filter)} />;
  } else if (activeTab === "subscriptions") {
    const items = user ? await getSubscriptionFeed(user.id, filter) : [];
    panel = <SubscriptionFeed items={items} isAuthed={!!user} />;
  } else {
    panel = <FeedList items={await getFeed(filter)} />;
  }

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <h1 className="sr-only">Recenza — лента девблогов</h1>
      <PromoCarouselSlot />

      <Suspense fallback={<div className="h-10 border-b border-[var(--border)]" />}>
        <HomeTabs active={activeTab} />
      </Suspense>

      <div className="mt-6 space-y-6">
        <Suspense fallback={null}>
          <FilterChips tags={tags} activeTag={tag} />
        </Suspense>
        {panel}
      </div>
    </div>
  );
}
