// Главная (ui-feedback-4 П2, прототип public/feed.jsx): БЕЗ табов/поиска/фильтров, карточки БЛОГОВ.
//
// ⚠️ Фаза 15 сменила смысл главной: это ВИТРИНА, а не каталог. На неё попадают только блоги с
// независимым бейджем («Проверено на Recenza»); уровень `invited` — прозрачность, а не пропуск
// (З-19/З-24). Пока проверенных меньше порога, подборку ведёт редакция («Выбор редакции»,
// `blogs.featured_at`) — страховка R-2. Если нет ни проверенных, ни закреплённых, показываем
// пустое состояние со ссылкой на каталог: отката на «показать всё подряд» НЕТ (решение владельца).
// Каталог «Все блоги» никуда не делся — он живёт на `/?view=all` с сортировкой и пагинацией (З-25).
//
// ⚠️ Фаза 13: ролевой изоляции автора БОЛЬШЕ НЕТ. `restrictAuthorId` снят (З-07) — автор читает
// чужие блоги наравне со всеми, поэтому и заголовок каталога всегда «Все блоги». Свои блоги автора
// живут в его кабинете /author.

import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getFollowedAuthorIds, getVisibleBlogs } from "@/lib/queries/feed";
import { getCatalog, getShowcase, type ShowcaseView } from "@/lib/queries/showcase";
import { PromoCarouselSlot } from "@/components/reader/promo-carousel-slot";
import { BlogIndexCard } from "@/components/reader/blog-index-card";
import { CatalogPagination } from "@/components/reader/catalog-pagination";
import { CatalogSortNav } from "@/components/reader/catalog-sort-nav";
import { siteUrl } from "@/lib/seo";
import { plural } from "@/lib/plural";
import { SHOWCASE_PAGE_SIZE, parseCatalogParams, paginate, type CatalogSort } from "@/lib/showcase";
import type { BlogCardView } from "@/lib/queries/types";
import type { PublicUser } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // absolute: шаблон "%s | Recenza" задублировал бы бренд на главной
  title: { absolute: "Recenza — девблоги с редакционным ревью" },
  description:
    "Девблоги, прошедшие редакционное ревью: подборка проверенных блогов, каталог и подписки.",
  alternates: { canonical: siteUrl() },
};

type Search = Promise<{ view?: string; sort?: string; page?: string }>;

export default async function HomePage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const user = await getCurrentUser();

  if (sp.view === "all") {
    const { sort, page } = parseCatalogParams(sp);
    const catalog = await getCatalog(sort, page);
    return <Catalog catalog={catalog} sort={sort} />;
  }

  if (user) return <ReaderHome user={user} />;

  const showcase = await getShowcase();
  return <Showcase showcase={showcase} page={parseCatalogParams(sp).page} />;
}

/** Каталог «Все блоги» — всё опубликованное; escape hatch с витрины (прототип ArticleIndexScreen). */
function Catalog({
  catalog,
  sort,
}: {
  catalog: Awaited<ReturnType<typeof getCatalog>>;
  sort: CatalogSort;
}) {
  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <h1 className="mb-3">Все блоги</h1>
      <p className="mb-6 text-[var(--muted-foreground)]">
        {catalog.total} {plural(catalog.total, "публикация", "публикации", "публикаций")}
      </p>

      <PromoCarouselSlot />

      {catalog.total === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] py-16 text-center">
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">Пока нет опубликованных блогов.</p>
        </div>
      ) : (
        <>
          <CatalogSortNav active={sort} />
          <BlogGrid blogs={catalog.items} />
          <CatalogPagination page={catalog.page} pageCount={catalog.pageCount} sort={sort} />
        </>
      )}
    </div>
  );
}

/** Витрина гостя: проверенные блоги либо подборка редакции, пока порог не набран. */
function Showcase({ showcase, page }: { showcase: ShowcaseView; page: number }) {
  const { mode, featured, blogs } = showcase;
  const editorialLed = mode === "editorial" && featured.length > 0;
  const rest = paginate(blogs, page);

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <h1 className="mb-3">{editorialLed ? "Выбор редакции" : "Проверенные блоги"}</h1>
      <p className="mb-6 max-w-2xl text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)]">
        {editorialLed
          ? "Блогов, прошедших независимое ревью, пока немного — подборку ведёт редакция."
          : "Блоги, главы которых прошли независимое ревью на Recenza."}{" "}
        <Link
          href="/?view=all"
          className="rounded-[var(--radius-sm)] font-medium text-[var(--accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Все блоги →
        </Link>
      </p>

      <PromoCarouselSlot />

      {featured.length > 0 && (
        <section className="py-6">
          {!editorialLed && (
            <h2 className="mb-4 text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Выбор редакции
            </h2>
          )}
          <BlogGrid blogs={featured} />
        </section>
      )}

      {rest.total > 0 && (
        <section className={`py-6 ${featured.length > 0 ? "border-t border-[var(--border)]" : ""}`}>
          {featured.length > 0 && (
            <h2 className="mb-4 text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Проверенные блоги
            </h2>
          )}
          <BlogGrid blogs={rest.items} />
          <CatalogPagination page={rest.page} pageCount={rest.pageCount} />
        </section>
      )}

      {featured.length === 0 && rest.total === 0 && <ShowcaseEmpty />}
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
      <p className="mx-auto mb-5 max-w-md text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)]">
        На витрину попадают блоги, главы которых прошли независимое ревью. Пока таких нет — загляните
        в каталог: там всё опубликованное.
      </p>
      <Link
        href="/?view=all"
        className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-[var(--border)] px-4 font-medium text-[var(--accent)] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        Все блоги →
      </Link>
    </div>
  );
}

/** «Ваша лента» читателя (прототип HomeScreen/ReaderFeed): hero + «Подписки» + витрина. */
async function ReaderHome({ user }: { user: PublicUser }) {
  const followedIds = await getFollowedAuthorIds(user.id);
  const followedSet = new Set(followedIds);
  // ⚠️ «Подписки» витринной политикой НЕ фильтруются: подписка — явный выбор читателя, и прятать
  // от него блог автора, на которого он подписан, только потому что у блога нет бейджа, нельзя.
  const followed = (await getVisibleBlogs()).filter((b) => followedSet.has(b.author.id));
  const showcase = await getShowcase({ excludeAuthorIds: followedIds });
  const hasFollows = followedIds.length > 0;
  // Витрина в ленте — без пагинации: у читателя есть «Все блоги →», а бесконечная выдача
  // на личной странице ему не нужна (жёсткий срез `others.slice(0, 4)` из ui-feedback-4 снят, З-25).
  const discover = [...showcase.featured, ...showcase.blogs].slice(0, SHOWCASE_PAGE_SIZE);

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <section className="pb-10 pt-4 sm:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              @{user.handle}
            </p>
            <h1 className="mb-3">Ваша лента</h1>
            <p className="max-w-xl text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)]">
              {hasFollows
                ? "Свежие главы из блогов, на которые вы подписаны."
                : "Подпишитесь на блог, чтобы получать новые главы здесь."}
            </p>
          </div>
          <Link
            href="/?view=all"
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-[var(--radius-sm)] text-[0.82rem] text-[var(--muted-foreground)] transition-colors hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Все блоги →
          </Link>
        </div>
      </section>

      <hr className="border-[var(--border)]" />

      <div className="pt-8">
        <PromoCarouselSlot />
      </div>

      {followed.length > 0 && (
        <section className="py-6">
          <h2 className="mb-4 text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Подписки</h2>
          <BlogGrid blogs={followed} />
        </section>
      )}

      {!hasFollows && (
        <section className="py-10 text-center">
          <p className="mb-4 text-[length:var(--type-small)] text-[var(--muted-foreground)]">У вас пока нет подписок.</p>
          <Link
            href="/?view=all"
            className="rounded-[var(--radius-sm)] font-medium text-[var(--accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Найти блоги в каталоге →
          </Link>
        </section>
      )}

      {discover.length > 0 && (
        <section className={`py-6 ${followed.length > 0 ? "border-t border-[var(--border)]" : ""}`}>
          <h2 className="mb-4 text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {showcase.mode === "editorial" ? "Выбор редакции" : "Проверенные блоги"}
          </h2>
          <BlogGrid blogs={discover} />
        </section>
      )}

      {discover.length === 0 && hasFollows && (
        <p className="border-t border-[var(--border)] py-6 text-center text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Проверенных блогов за пределами ваших подписок пока нет.
        </p>
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
