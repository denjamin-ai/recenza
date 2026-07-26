// Главная (ui-feedback-4 П2, прототип public/feed.jsx): без поиска, карточки БЛОГОВ.
// ui-feedback-8/9/10 (решение владельца): ЕДИНАЯ лента с чип-рядом «Подписки/Все/Проверенные»
// (nav «Фильтр ленты» — НЕ «Разделы ленты», на то имя негативные e2e-ассерты). h1 един —
// «Лента» на подписках, в каталоге И у гостя: состояние показывают чипы, а не заголовок;
// arrow-ссылок («Все блоги →» и т.п.) на лентовых поверхностях больше нет — чипы есть и на
// витрине гостя (без активного). Режимных заголовков витрины («Выбор редакции»/«Проверенные
// блоги») на главной больше нет — подборка идёт одним списком (uif-10).
//
// ⚠️ Фаза 15 сменила смысл главной ГОСТЯ: это ВИТРИНА, а не каталог. На неё попадают только блоги
// с независимым бейджем («Проверено на Recenza»); уровень `invited` — прозрачность, а не пропуск
// (З-19/З-24). Пока проверенных меньше порога, подборку ведёт редакция («Выбор редакции»,
// `blogs.featured_at`) — страховка R-2. Если нет ни проверенных, ни закреплённых — пустое
// состояние (путь в каталог — чип «Все»): отката на «показать всё подряд» НЕТ (решение владельца).
// Каталог никуда не делся — `/?view=all` с сортировкой и пагинацией (З-25).
//
// ⚠️ Фаза 13: ролевой изоляции автора БОЛЬШЕ НЕТ. `restrictAuthorId` снят (З-07) — автор читает
// чужие блоги наравне со всеми, каталог у всех общий. Свои блоги автора живут в кабинете /author.

import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getFollowedAuthorIds, getVisibleBlogs } from "@/lib/queries/feed";
import { getCatalog, getShowcase, type ShowcaseView } from "@/lib/queries/showcase";
import { PromoCarouselSlot } from "@/components/reader/promo-carousel-slot";
import { BlogIndexCard } from "@/components/reader/blog-index-card";
import { CatalogPagination } from "@/components/reader/catalog-pagination";
import { CatalogSortNav } from "@/components/reader/catalog-sort-nav";
import { FeedFilterNav } from "@/components/reader/feed-filter-nav";
import { siteUrl } from "@/lib/seo";
import { plural } from "@/lib/plural";
import {
  catalogQuery,
  parseCatalogParams,
  paginate,
  type CatalogFilter,
  type CatalogSort,
} from "@/lib/showcase";
import type { BlogCardView } from "@/lib/queries/types";
import type { PublicUser } from "@/types";

export const dynamic = "force-dynamic";

/**
 * ⚠️ Ф15.1 (backlog SEO): metadata стала динамической. Раньше она была статической и все
 * страницы каталога (`?view=all&sort=…&page=N`) канонизировались на `/` — то есть на ДРУГУЮ
 * страницу с другим содержимым. Теперь canonical самореферентный: витрина указывает на `/`,
 * каталог — на свой URL с параметрами, а `noindex` на страницах пагинации не ставим (ссылки
 * на блоги с них должны индексироваться).
 */
export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const sp = await searchParams;
  const catalog = sp.view === "all";
  const { sort, filter, page } = parseCatalogParams(sp);

  // ⚠️ Фильтр обязан попасть в canonical: `filter=verified` — другое содержимое, канонизация
  // на полный каталог была бы повтором бага Ф15.1. Порядок параметров — единый `catalogQuery`.
  const qs = catalogQuery({ catalog, sort, filter, page });

  // ui-feedback-7: у отфильтрованного каталога СВОИ title/description — содержимое другое,
  // одинаковые метаданные читались бы как дубликат. Сортировка/пагинация набор не меняют —
  // им хватает общего title (прецедент Ф15.1).
  const verifiedCatalog = catalog && filter === "verified";

  return {
    // absolute: шаблон "%s | Recenza" задублировал бы бренд на главной
    title: {
      absolute: verifiedCatalog
        ? "Все блоги — проверенные | Recenza"
        : catalog
          ? "Все блоги | Recenza"
          : "Recenza — девблоги с редакционным ревью",
    },
    description: verifiedCatalog
      ? "Каталог девблогов Recenza с бейджем ревью — независимым или приглашённого эксперта."
      : catalog
        ? "Полный каталог опубликованных девблогов Recenza — с сортировкой и постраничной навигацией."
        : "Девблоги, прошедшие редакционное ревью: подборка проверенных блогов, каталог и подписки.",
    alternates: { canonical: qs ? `${siteUrl()}/?${qs}` : siteUrl() },
  };
}

type Search = Promise<{ view?: string; sort?: string; filter?: string; page?: string }>;


export default async function HomePage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const user = await getCurrentUser();

  if (sp.view === "all") {
    const { sort, filter, page } = parseCatalogParams(sp);
    const catalog = await getCatalog(sort, page, filter);
    return <Catalog catalog={catalog} sort={sort} filter={filter} viewerLoggedIn={user != null} />;
  }

  if (user) return <ReaderHome user={user} />;

  const showcase = await getShowcase();
  return <Showcase showcase={showcase} page={parseCatalogParams(sp).page} />;
}

/** Каталог «Все блоги» — всё опубликованное; escape hatch с витрины (прототип ArticleIndexScreen). */
function Catalog({
  catalog,
  sort,
  filter,
  viewerLoggedIn,
}: {
  catalog: Awaited<ReturnType<typeof getCatalog>>;
  sort: CatalogSort;
  filter: CatalogFilter;
  /** ui-feedback-8: вошедшему в чип-ряду показывается и «Подписки» — обратный путь в личную ленту. */
  viewerLoggedIn: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      {/* ui-feedback-9: h1 един со страницей подписок — состояние показывают чипы, не заголовок. */}
      <h1 className="mb-3">Лента</h1>
      <p className="mb-6 text-[var(--muted-foreground)]">
        {catalog.total} {plural(catalog.total, "публикация", "публикации", "публикаций")}
      </p>

      <PromoCarouselSlot />

      {/* Фильтр — ВНЕ пустой ветки: на пустой выдаче «Проверенных» чип «Все» — путь сброса. */}
      <FeedFilterNav active={filter} sort={sort} showSubs={viewerLoggedIn} />

      {catalog.total === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] py-16 text-center">
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            {filter === "verified" ? "Проверенных блогов пока нет." : "Пока нет опубликованных блогов."}
          </p>
        </div>
      ) : (
        <>
          <CatalogSortNav active={sort} filter={filter} />
          <BlogGrid blogs={catalog.items} />
          <CatalogPagination page={catalog.page} pageCount={catalog.pageCount} sort={sort} filter={filter} />
        </>
      )}
    </div>
  );
}

/**
 * Главная гостя (ui-feedback-10, решение владельца): тот же экран «Лента» с чипами, что у
 * вошедшего, но список — ВИТРИННАЯ подборка Ф15 одним полотном: закреплённые редакцией первыми,
 * затем независимо проверенные (дедуп уже в `getShowcase()`). Правила отбора НЕ менялись —
 * с главной ушли только заголовки витрины: «Выбор редакции» остался концептом админки
 * (/admin/featured), «Проверенные блоги» — чипом фильтра; режимный h1 удалён.
 */
function Showcase({ showcase, page }: { showcase: ShowcaseView; page: number }) {
  const { featured, blogs } = showcase;
  const feed = paginate([...featured, ...blogs], page);

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <h1 className="mb-3">Лента</h1>
      <p className="mb-6 max-w-2xl text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)]">
        Блоги, прошедшие независимое ревью, и выбор редакции.
      </p>

      <PromoCarouselSlot />

      {/* ui-feedback-9: вместо лид-ссылки «Все блоги →» — тот же чип-ряд, что на ленте/каталоге.
          Без активного чипа: витрина — не состояние каталога, aria-current здесь врал бы. */}
      <FeedFilterNav showSubs={false} />

      {feed.total > 0 ? (
        <section className="py-6">
          <BlogGrid blogs={feed.items} />
          <CatalogPagination page={feed.page} pageCount={feed.pageCount} />
        </section>
      ) : (
        <ShowcaseEmpty />
      )}
    </div>
  );
}

/**
 * Пустая витрина — легальное состояние (решение владельца): платформа честно говорит, что
 * проверенных блогов пока нет, и уводит в каталог. Никакого молчаливого отката на «всё подряд».
 */
function ShowcaseEmpty() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] px-6 py-16 text-center">
      <p className="mb-2 font-[family-name:var(--font-display)] text-[length:var(--type-h3)]">
        Здесь появятся проверенные блоги
      </p>
      {/* ui-feedback-9: без собственной кнопки — путь в каталог даёт чип «Все» над пустым состоянием. */}
      <p className="mx-auto max-w-md text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)]">
        На витрину попадают блоги, главы которых прошли независимое ревью. Пока таких нет —
        переключитесь на «Все»: там всё опубликованное.
      </p>
    </div>
  );
}

/**
 * «Ваша лента» вошедшего — ЕДИНАЯ лента (ui-feedback-8, решение владельца): один список под
 * чип-рядом «Подписки / Все / Проверенные», дефолт — «Подписки» (`/` без параметров).
 * Hero-ссылки ui-feedback-7 и секция открытий с витрины УБРАНЫ — «Все» и «Проверенные»
 * достижимы чипами (те же URL каталога, что и раньше).
 */
async function ReaderHome({ user }: { user: PublicUser }) {
  const followedIds = await getFollowedAuthorIds(user.id);
  const followedSet = new Set(followedIds);
  // ⚠️ «Подписки» витринной политикой НЕ фильтруются: подписка — явный выбор читателя, и прятать
  // от него блог автора, на которого он подписан, только потому что у блога нет бейджа, нельзя.
  const followed = (await getVisibleBlogs()).filter((b) => followedSet.has(b.author.id));
  const hasFollows = followed.length > 0;

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <section className="pb-10 pt-4 sm:pt-8">
        <div className="min-w-0">
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            @{user.handle}
          </p>
          <h1 className="mb-3">Лента</h1>
          <p className="max-w-xl text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)]">
            {hasFollows
              ? "Свежие главы из блогов, на которые вы подписаны."
              : "Подпишитесь на блог, чтобы получать новые главы здесь."}
          </p>
        </div>
      </section>

      <hr className="border-[var(--border)]" />

      <div className="pt-8">
        <PromoCarouselSlot />
      </div>

      {/* Без обёртки с pt-*: у карусели свой mb-6 — ритм «карусель → чипы» тот же, что в каталоге. */}
      <FeedFilterNav active="subs" showSubs />

      {hasFollows ? (
        <section className="py-6">
          <BlogGrid blogs={followed} />
        </section>
      ) : (
        <section className="py-16 text-center">
          {/* ui-feedback-9: без arrow-ссылки — путь к блогам даёт чип «Все» над пустым состоянием. */}
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            У вас пока нет подписок — переключитесь на «Все», чтобы найти блоги.
          </p>
        </section>
      )}
    </div>
  );
}

function BlogGrid({ blogs }: { blogs: BlogCardView[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {blogs.map((b) => (
        <BlogIndexCard key={b.id} blog={b} />
      ))}
    </div>
  );
}
