// robots.txt: публичное открыто, приватные/служебные сегменты закрыты, ссылка на sitemap.

import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/author", "/reviewer", "/login", "/bookmarks"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
