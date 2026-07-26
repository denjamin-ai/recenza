// Витрина главной (Фаза 15): что видит гость и вошедший на «/» и в каталоге «/?view=all».
//
// ⚠️ Слой намеренно отдельный от `feed.ts`. Фильтр «только проверенные» НЕЛЬЗЯ класть в
// `getReadableChapters` — это общий предок ПЯТИ поверхностей (главная, профиль автора, закладки,
// `sitemap.xml`, `feed.xml`), и по решению владельца sitemap обязан отдавать ВСЁ опубликованное,
// а профиль автора — показывать непроверенные блоги с пометкой. Витринная политика (порог,
// «Выбор редакции», сортировка) — отдельная ответственность, а не построчный фильтр видимости.
//
// Отбор и сортировка идут в памяти поверх уже материализованного `getVisibleBlogs()` — как и
// дедуп с сортировкой в `feed.ts`. При росте числа блогов это переносится на SQL вместе с
// индексом `blogs.featured_at` (зафиксировано в backlog фазы).

import { getVisibleBlogs } from "./feed";
import type { BlogCardView } from "./types";
import {
  SHOWCASE_MIN_VERIFIED,
  byFeaturedFreshness,
  byVerifiedFreshness,
  catalogComparator,
  isFeatured,
  isReviewVerified,
  isShowcaseVerified,
  paginate,
  type CatalogFilter,
  type CatalogSort,
  type Paged,
  type ShowcaseMode,
} from "@/lib/showcase";

export interface ShowcaseView {
  /** `verified` — витрину ведёт бейдж; `editorial` — витрину ведёт редакция (проверенных < порога). */
  mode: ShowcaseMode;
  /** Закреплённые редакцией — отдельной секцией сверху (пусто, если закреплений нет). */
  featured: BlogCardView[];
  /** Основная выдача витрины (уже отсортирована; пагинация — на вызывающем). */
  blogs: BlogCardView[];
  /** Сколько блогов имеют независимый бейдж (для порога и для админ-экрана). */
  verifiedCount: number;
}

/**
 * Витрина главной. Пустой результат (`featured` и `blogs` пусты) — легальное состояние:
 * по решению владельца страница показывает пустое состояние со ссылкой на каталог, а НЕ
 * откатывается на «показать всё подряд».
 */
export async function getShowcase(opts: { excludeAuthorIds?: string[] } = {}): Promise<ShowcaseView> {
  const all = await getVisibleBlogs();
  const exclude = new Set(opts.excludeAuthorIds ?? []);
  const pool = exclude.size === 0 ? all : all.filter((b) => !exclude.has(b.author.id));

  const verified = pool.filter(isShowcaseVerified).sort(byVerifiedFreshness);
  const featured = pool.filter(isFeatured).sort(byFeaturedFreshness);

  // Порог считается по ВСЕЙ платформе, а не по отфильтрованному пулу: иначе у читателя,
  // подписанного на всех проверенных авторов, витрина молча меняла бы режим.
  const platformVerified = all.filter(isShowcaseVerified).length;
  const mode: ShowcaseMode = platformVerified >= SHOWCASE_MIN_VERIFIED ? "verified" : "editorial";

  if (mode === "verified") {
    const featuredIds = new Set(featured.map((b) => b.id));
    return {
      mode,
      featured,
      // Закреплённые уже показаны отдельной секцией — в основной выдаче их не дублируем.
      blogs: verified.filter((b) => !featuredIds.has(b.id)),
      verifiedCount: platformVerified,
    };
  }

  // Режим редакции: закреплённые первыми, следом — уже проверенные, чтобы 1–2 блога с бейджем
  // не пропали с витрины, пока порог не набран.
  const seen = new Set(featured.map((b) => b.id));
  return {
    mode,
    featured,
    blogs: verified.filter((b) => !seen.has(b.id)),
    verifiedCount: platformVerified,
  };
}

/**
 * Каталог «/?view=all» — ВСЁ опубликованное с сортировкой и пагинацией (З-25).
 * ui-feedback-7: фильтр «Проверенные» = любой бейдж ревью (`isReviewVerified`, оба tier) —
 * это НЕ витринная политика, у той свой предикат (`isShowcaseVerified`, только independent).
 */
export async function getCatalog(
  sort: CatalogSort,
  page: number,
  filter: CatalogFilter = "all",
): Promise<Paged<BlogCardView>> {
  const all = await getVisibleBlogs();
  const pool = filter === "verified" ? all.filter(isReviewVerified) : [...all];
  return paginate(pool.sort(catalogComparator(sort)), page);
}
