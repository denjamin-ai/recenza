// Профиль автора: табы «Об авторе» (портфолио, read-only) · «Блоги». Владелец видит портфолио
// даже скрытым (с баннером) + вход в редактор; читатель — только видимое портфолио.
// Закреплённый блог (users.pinnedBlogId) — отдельной секцией над остальными (прототип ProfileScreen).

import Link from "next/link";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { BlogCard } from "@/components/reader/blog-card";
import { IconPin } from "@/components/icons";
import { ProfileTabs } from "./profile-tabs";
import type { Block } from "@/types";
import type { BlogCardView } from "@/lib/queries/types";

export function AuthorProfile({
  blogs,
  portfolio,
  portfolioVisible,
  isOwner,
  pinnedBlogId,
}: {
  blogs: BlogCardView[];
  portfolio: Block[] | null;
  portfolioVisible: boolean;
  isOwner: boolean;
  pinnedBlogId: string | null;
}) {
  const hasPortfolio = !!portfolio && portfolio.length > 0;
  const hasAbout = isOwner || hasPortfolio;

  const about = (
    <section aria-label="Об авторе">
      {isOwner && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            {hasPortfolio
              ? portfolioVisible
                ? "Опубликовано · видно всем"
                : "Скрыто от читателей — видите только вы"
              : "Раздел «Об авторе» ещё не создан"}
          </p>
          <Link
            href="/author/portfolio"
            className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--accent)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {hasPortfolio ? "Редактировать" : "Создать «Об авторе»"}
          </Link>
        </div>
      )}
      {hasPortfolio ? (
        <BlockRenderer blocks={portfolio!} prefix="portfolio" />
      ) : (
        <p className="text-[var(--muted-foreground)]">
          {isOwner ? "Расскажите о себе — публикуется сразу, без ревью." : "Автор пока не заполнил раздел."}
        </p>
      )}
    </section>
  );

  const pinned = pinnedBlogId ? blogs.find((b) => b.id === pinnedBlogId) : undefined;
  const rest = pinned ? blogs.filter((b) => b.id !== pinned.id) : blogs;

  const blogsPanel = (
    <section aria-label="Блоги автора">
      {blogs.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">Пока нет опубликованных блогов.</p>
      ) : (
        <>
          {pinned && (
            <div className="mb-6">
              <p className="mb-3 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                <IconPin className="h-3.5 w-3.5 text-[var(--accent)]" />
                {isOwner ? "Закреплённый блог" : "Рекомендует автор"}
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <BlogCard blog={pinned} />
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <>
              {pinned && (
                <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Остальные блоги
                </p>
              )}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {rest.map((b) => (
                  <BlogCard key={b.id} blog={b} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );

  return <ProfileTabs hasAbout={hasAbout} about={about} blogs={blogsPanel} blogsCount={blogs.length} />;
}
