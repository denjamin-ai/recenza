// Панели профиля (Ф13.5, RSC): «О себе» · «Блоги» · «Ревью». Собирает серверные узлы и отдаёт их
// клиентской оболочке табов. Заменяет прежние AuthorProfile/ReviewerProfile — после схлопывания
// union'а профиль один, а секции показываются по наличию контента и возможностей.

import Link from "next/link";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { BlogCard } from "@/components/reader/blog-card";
import { IconPin } from "@/components/icons";
import { ProfileTabs } from "./profile-tabs";
import type { Block } from "@/types";
import type { BlogCardView } from "@/lib/queries/types";
import type { ReviewedChapterView } from "@/lib/queries/profile";

export function ProfileSections({
  bio,
  competencies,
  blogs,
  portfolio,
  portfolioVisible,
  isOwner,
  pinnedBlogId,
  reviewed,
  showReviewTab,
}: {
  bio: string | null;
  competencies: string[];
  blogs: BlogCardView[];
  portfolio: Block[] | null;
  portfolioVisible: boolean;
  isOwner: boolean;
  pinnedBlogId: string | null;
  reviewed: ReviewedChapterView[];
  showReviewTab: boolean;
}) {
  const hasPortfolio = !!portfolio && portfolio.length > 0;
  // Компетенции показываем только у ревьюера (таб «Ревью» = тот же признак).
  const showCompetencies = showReviewTab && competencies.length > 0;

  // «О себе»: био (переехало сюда из шапки) + компетенции + портфолио «Об авторе».
  const about = (
    <section aria-label="О себе">
      {bio ? (
        <p className="mb-6 max-w-xl leading-relaxed text-[var(--foreground)] [text-wrap:pretty]">
          {bio}
        </p>
      ) : (
        !hasPortfolio &&
        !showCompetencies &&
        !isOwner && <p className="text-[var(--muted-foreground)]">Пользователь пока ничего о себе не написал.</p>
      )}

      {showCompetencies && (
        <div className="mb-6">
          <h3 className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Рецензирует
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {competencies.map((c) => (
              <li
                key={c}
                className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 py-1 text-[length:var(--type-small)] text-[var(--muted-foreground)]"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

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
        isOwner && (
          <p className="text-[var(--muted-foreground)]">
            Расскажите о себе — публикуется сразу, без ревью.
          </p>
        )
      )}
    </section>
  );

  const pinned = pinnedBlogId ? blogs.find((b) => b.id === pinnedBlogId) : undefined;
  const rest = pinned ? blogs.filter((b) => b.id !== pinned.id) : blogs;

  const blogsPanel = (
    <section aria-label="Блоги автора">
      {/* sr-only h2 держит иерархию h1→h2→h3 (карточки рендерят h3). */}
      <h2 className="sr-only">Блоги автора</h2>
      {blogs.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">Пока нет опубликованных блогов.</p>
      ) : (
        <>
          {pinned && (
            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                <IconPin className="h-3.5 w-3.5 text-[var(--accent)]" />
                {isOwner ? "Закреплённый блог" : "Рекомендует автор"}
              </h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <BlogCard blog={pinned} />
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <>
              {pinned && (
                <h3 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Остальные блоги
                </h3>
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

  // «Ревью» — публичная активность ревьюера (решение владельца, реверс прототипа).
  // ⚠️ Ф13: рейтинг ★ из профиля убран (З-41) — окончательный снос рейтинга в Ф14.
  const reviewPanel = (
    <section aria-label="Отрецензированные главы">
      <h2 className="sr-only">Отрецензированные главы</h2>
      {reviewed.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">Пока нет отрецензированных глав.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reviewed.map((r) => (
            <li key={`${r.blogSlug}/${r.chapterSlug}`}>
              <Link
                href={`/blog/${r.blogSlug}/${r.chapterSlug}`}
                className="block rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] p-3 transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span className="block font-medium text-[var(--foreground)]">{r.chapterTitle}</span>
                <span className="block text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                  {r.blogTitle}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <ProfileTabs
      about={about}
      blogs={blogsPanel}
      blogsCount={blogs.length}
      review={reviewPanel}
      reviewCount={reviewed.length}
      showReviewTab={showReviewTab}
    />
  );
}
