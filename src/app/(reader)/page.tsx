// Главная (ui-feedback-4 П2, прототип public/feed.jsx): БЕЗ табов/поиска/фильтров, карточки БЛОГОВ.
// Ролевой сплит (решение владельца): reader → «Ваша лента» (hero + секции «Подписки»/«Свежее»);
// гость/автор/ревьюер (и reader по ?view=all) → каталог «Все блоги».
// Ролевая изоляция автора: viewer-author видит ТОЛЬКО свои блоги (restrictAuthorId).

import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getFollowedAuthorIds, getVisibleBlogs } from "@/lib/queries/feed";
import { PromoCarouselSlot } from "@/components/reader/promo-carousel-slot";
import { BlogIndexCard } from "@/components/reader/blog-index-card";
import { siteUrl } from "@/lib/seo";
import { plural } from "@/lib/plural";
import type { BlogCardView } from "@/lib/queries/types";
import type { PublicUser } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // absolute: шаблон "%s | Recenza" задублировал бы бренд на главной
  title: { absolute: "Recenza — девблоги с редакционным ревью" },
  description:
    "Многоглавные девблоги, прошедшие редакционное ревью: каталог блогов, подписки и подбор ревьюеров.",
  alternates: { canonical: siteUrl() },
};

type Search = Promise<{ view?: string }>;

export default async function HomePage({ searchParams }: { searchParams: Search }) {
  const { view } = await searchParams;
  const user = await getCurrentUser();
  const restrictAuthorId = user?.role === "author" ? user.id : undefined;
  const blogs = await getVisibleBlogs(restrictAuthorId ? { restrictAuthorId } : undefined);

  if (user?.role === "reader" && view !== "all") {
    return <ReaderHome user={user} blogs={blogs} />;
  }
  return <Catalog blogs={blogs} />;
}

/** Каталог «Все блоги» — гость/автор/ревьюер и reader по «Все блоги →» (прототип ArticleIndexScreen). */
function Catalog({ blogs }: { blogs: BlogCardView[] }) {
  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <h1 className="mb-3">Все блоги</h1>
      <p className="mb-6 text-[var(--muted-foreground)]">
        {blogs.length} {plural(blogs.length, "публикация", "публикации", "публикаций")}
      </p>

      <PromoCarouselSlot />

      {blogs.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] py-16 text-center">
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">Пока нет опубликованных блогов.</p>
        </div>
      ) : (
        <BlogGrid blogs={blogs} />
      )}
    </div>
  );
}

/** «Ваша лента» читателя (прототип HomeScreen/ReaderFeed): hero + «Подписки» + «Свежее». */
async function ReaderHome({ user, blogs }: { user: PublicUser; blogs: BlogCardView[] }) {
  const followedIds = new Set(await getFollowedAuthorIds(user.id));
  const followed = blogs.filter((b) => followedIds.has(b.author.id));
  const others = blogs.filter((b) => !followedIds.has(b.author.id));
  const hasFollows = followedIds.size > 0;

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

      {others.length > 0 && (
        <section className={`py-6 ${followed.length > 0 ? "border-t border-[var(--border)]" : ""}`}>
          <h2 className="mb-4 text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {hasFollows ? "Ещё интересное" : "Свежее"}
          </h2>
          <BlogGrid blogs={others.slice(0, 4)} />
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
