// SEO-хелперы: единый источник абсолютного origin (NEXT_PUBLIC_BASE_URL) для canonical/OG/RSS/sitemap/JSON-LD.
// Используется в generateMetadata страниц, sitemap.ts, robots.ts, feed.xml, <JsonLd>.

const FALLBACK_ORIGIN = "http://localhost:3000";

/** Абсолютный origin сайта без завершающего слэша. Источник — NEXT_PUBLIC_BASE_URL (см. .env.example). */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  const base = raw || FALLBACK_ORIGIN;
  return base.replace(/\/+$/, "");
}

/** Абсолютный URL для пути (`/blog/...`). Путь нормализуется к ведущему слэшу. */
export function absoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${p}`;
}

/**
 * Plain-text для description/OG: схлопывает пробелы и обрезает по границе слова до ~max символов.
 * Вход уже должен быть plain-text (см. extractPlainText для блоков) — функция только нормализует длину.
 */
export function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}
