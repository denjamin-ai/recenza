// sitemap.xml: главная + видимые блоги + published-главы + публичные профили. Прод-URL из NEXT_PUBLIC_BASE_URL.

import type { MetadataRoute } from "next";
import { getSitemapData } from "@/lib/queries/sitemap";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const data = await getSitemapData();
  const toDate = (s: number | null) => (s ? new Date(s * 1000) : undefined);

  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    ...data.blogs.map((b) => ({
      url: `${base}/blog/${b.slug}`,
      lastModified: toDate(b.lastMod),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...data.chapters.map((c) => ({
      url: `${base}/blog/${c.blogSlug}/${c.chapterSlug}`,
      lastModified: toDate(c.lastMod),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...data.profiles.map((p) => ({
      url: `${base}/u/${p.slug}`,
      lastModified: toDate(p.lastMod),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
