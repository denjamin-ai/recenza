// RSS 2.0 свежих published-глав (ручная сборка с экранированием, без новой зависимости). Публичная лента.
//
// ⚠️ Ф15 (решение владельца): в RSS уходит ТОЛЬКО проверенное, в `sitemap.xml` — ВСЁ опубликованное.
// Правила расходятся намеренно: лента — редакционная витрина, карта сайта — полнота индексации.
// Отбор идёт по бейджу САМОЙ ревизии (`chapter_revisions.verified_at`), а не по историческому
// агрегату `blogs.verified_*`: иначе в ленту попадали бы непроверенные главы проверенного блога.

import { getFeed } from "@/lib/queries/feed";
import { absoluteUrl, siteUrl, truncate } from "@/lib/seo";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(): Promise<Response> {
  const base = siteUrl();
  const items = (await getFeed({ verifiedOnly: true })).slice(0, 20);

  const xmlItems = items
    .map((i) => {
      const link = absoluteUrl(`/blog/${i.blogSlug}/${i.chapterSlug}`);
      const pubDate = i.publishedAt ? new Date(i.publishedAt * 1000).toUTCString() : "";
      const description = truncate(i.summary || i.blogTitle, 300);
      return [
        "<item>",
        `<title>${esc(i.chapterTitle)}</title>`,
        `<link>${esc(link)}</link>`,
        `<guid isPermaLink="true">${esc(link)}</guid>`,
        pubDate ? `<pubDate>${pubDate}</pubDate>` : "",
        `<dc:creator>${esc(i.author.displayName)}</dc:creator>`,
        `<description>${esc(description)}</description>`,
        "</item>",
      ].join("");
    })
    .join("");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">` +
    `<channel>` +
    `<title>Recenza — лента девблогов</title>` +
    `<link>${esc(base)}</link>` +
    `<description>Многоглавные девблоги с редакционным ревью.</description>` +
    `<language>ru</language>` +
    xmlItems +
    `</channel></rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
