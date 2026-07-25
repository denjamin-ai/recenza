// Правила витрины главной (Фаза 15) — ЧИСТЫЙ модуль без db/auth, поэтому его свободно тянут
// и сервер, и клиент (по образцу `review-sla.ts` / `banners.ts`: форма и запрос из одного источника).
//
// Модель (решения владельца, менять только его решением):
//   • На главную блог пускает ТОЛЬКО бейдж `independent` («Проверено на Recenza»). Уровень
//     `invited` («Проверено приглашённым экспертом») — прозрачность, а не пропуск: такой блог
//     доступен по прямой ссылке и виден в профиле автора, но витрину не получает (З-19).
//   • Пока проверенных меньше `SHOWCASE_MIN_VERIFIED`, витрину наполняет РЕДАКЦИЯ вручную
//     («Выбор редакции», `blogs.featured_at`) — страховка R-2 от пустой главной.
//   • Если нет ни проверенных, ни закреплённых — показываем пустое состояние со ссылкой на
//     каталог. Отката на «показать всё подряд» НЕТ: витрина честно отражает состояние платформы.

import type { BlogCardView } from "@/lib/queries/types";

/** Порог, ниже которого витрину ведёт редакция, а не бейдж. */
export const SHOWCASE_MIN_VERIFIED = 3;

/** Карточек на страницу (сетка максимум в 2 колонки). */
export const SHOWCASE_PAGE_SIZE = 12;

/** Режим витрины: отбирает бейдж или отбирает редакция. */
export type ShowcaseMode = "verified" | "editorial";

/** Сортировка каталога `/?view=all` (З-25: вместо жёсткого среза — сортировка + пагинация). */
export const CATALOG_SORTS = ["new", "verified", "top"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export const CATALOG_SORT_LABEL: Record<CatalogSort, string> = {
  new: "Свежие",
  verified: "Сначала проверенные",
  top: "Популярные",
};

/** Блог попадает на витрину только с независимым ревью. */
export function isShowcaseVerified(blog: BlogCardView): boolean {
  return blog.verifiedAt != null && blog.verifiedTier === "independent";
}

export function isFeatured(blog: BlogCardView): boolean {
  return blog.featuredAt != null;
}

/** Витрина: свежесть бейджа, затем свежесть активности. */
export function byVerifiedFreshness(a: BlogCardView, b: BlogCardView): number {
  return (b.verifiedAt ?? 0) - (a.verifiedAt ?? 0) || (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0);
}

/** «Выбор редакции»: свежесть закрепления. */
export function byFeaturedFreshness(a: BlogCardView, b: BlogCardView): number {
  return (b.featuredAt ?? 0) - (a.featuredAt ?? 0) || (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0);
}

export function catalogComparator(sort: CatalogSort): (a: BlogCardView, b: BlogCardView) => number {
  if (sort === "verified") {
    // Проверенные вперёд (independent > invited > без бейджа), внутри группы — свежесть бейджа.
    return (a, b) => verifiedRank(b) - verifiedRank(a) || byVerifiedFreshness(a, b);
  }
  if (sort === "top") {
    return (a, b) => b.rating - a.rating || b.bookmarkCount - a.bookmarkCount || byActivity(a, b);
  }
  return byActivity;
}

function byActivity(a: BlogCardView, b: BlogCardView): number {
  return (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0);
}

function verifiedRank(blog: BlogCardView): number {
  if (blog.verifiedTier === "independent") return 2;
  if (blog.verifiedTier === "invited") return 1;
  return 0;
}

/**
 * Разбор `?sort=`/`?page=` из URL. Мусор молча становится дефолтом — страница каталога никогда
 * не отвечает 404 из-за параметра сортировки.
 */
export function parseCatalogParams(sp: { sort?: string; page?: string }): {
  sort: CatalogSort;
  page: number;
} {
  const sort = CATALOG_SORTS.find((s) => s === sp.sort) ?? "new";
  const raw = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(raw) && raw >= 1 ? Math.min(raw, 1000) : 1;
  return { sort, page };
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
}

/** Срез страницы. Если запрошенная страница за пределами — отдаём последнюю (не 404). */
export function paginate<T>(items: T[], page: number, pageSize = SHOWCASE_PAGE_SIZE): Paged<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, pageCount, total };
}
