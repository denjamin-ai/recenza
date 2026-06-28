// Композиция ридера (RSC). Режимы: single (одна глава, h1=заголовок главы) и whole (весь блог,
// h1=название блога, заголовки глав = h2). Контент рендерит общий BlockRenderer (идентичен ревью).
// Правый рельс (SeriesNav) — на lg+; на узких экранах главы/ToC доступны через <details> сверху.

import Link from "next/link";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { extractHeadings } from "@/components/blocks/headings";
import { ReadingProgress } from "@/components/reader/reading-progress";
import { SeriesNav, type ChapterLink } from "@/components/reader/series-nav";
import { ReaderModeToggle } from "@/components/reader/reader-mode-toggle";
import { SkillChips } from "@/components/reader/skill-chips";
import { EngagementBar } from "@/components/reader/engagement-bar";
import { ChapterReviewerCredit } from "@/components/reader/chapter-reviewer-credit";
import { CommentsSlot } from "@/components/reader/comments-slot";
import type { ReadableBlog, ReaderSection } from "@/lib/queries/types";

function ChapterBody({
  blog,
  section,
  mode,
  isAuthed,
  canFollow,
}: {
  blog: ReadableBlog;
  section: ReaderSection;
  mode: "single" | "whole";
  isAuthed: boolean;
  canFollow: boolean;
}) {
  const { chapter, engagement, credit, canVote } = section;
  const prefix = mode === "whole" ? chapter.slug : undefined;
  const titleId = `chapter-${chapter.slug}`;

  return (
    <article className="mb-16">
      {mode === "single" ? (
        <h1 id={titleId} className="scroll-mt-24 text-[length:var(--type-h1)]">
          {chapter.title}
        </h1>
      ) : (
        <h2 id={titleId} className="scroll-mt-24 border-t border-[var(--border)] pt-8 text-[length:var(--type-h2)]">
          {chapter.title}
        </h2>
      )}

      {chapter.skills.length > 0 && (
        <div className="mt-4">
          <SkillChips skills={chapter.skills} />
        </div>
      )}

      <div className="mt-6">
        <BlockRenderer blocks={chapter.blocks} prefix={prefix} />
      </div>

      <EngagementBar
        chapterId={chapter.id}
        blogId={blog.id}
        authorId={blog.author.id}
        isAuthed={isAuthed}
        canVote={canVote}
        canFollow={canFollow}
        initial={{
          score: engagement.score,
          myVote: engagement.myVote,
          isBookmarked: engagement.isBookmarked,
          bookmarkCount: blog.bookmarkCount,
          isFollowing: engagement.isFollowing,
        }}
      />

      <ChapterReviewerCredit credit={credit} />

      {mode === "single" && <CommentsSlot revision={chapter.revisionNumber} />}
    </article>
  );
}

export function BlogReaderView({
  blog,
  mode,
  activeSlug,
  sections,
  isAuthed,
  canFollow,
  singleHref,
  wholeHref,
}: {
  blog: ReadableBlog;
  mode: "single" | "whole";
  activeSlug: string;
  sections: ReaderSection[];
  isAuthed: boolean;
  canFollow: boolean;
  singleHref: string;
  wholeHref: string;
}) {
  const multiChapter = blog.chapters.length > 1;

  // Ссылки глав для SeriesNav: single → страницы глав; whole → якоря секций.
  const chapterLinks: ChapterLink[] = blog.chapters.map((c) => ({
    slug: c.slug,
    title: c.title,
    href: mode === "whole" ? `#chapter-${c.slug}` : `/blog/${blog.slug}/${c.slug}`,
    active: mode === "single" && c.slug === activeSlug,
  }));

  // ToC: single → заголовки активной главы; whole → заголовки всех глав (с префиксом slug).
  const headings =
    mode === "whole"
      ? sections.flatMap((s) => extractHeadings(s.chapter.blocks, s.chapter.slug))
      : extractHeadings(sections[0]?.chapter.blocks ?? [], undefined);

  return (
    <>
      <ReadingProgress />
      <div className="mx-auto w-full max-w-[var(--max-article)] px-6 py-10">
        {/* Хлебные крошки + переключатель режима */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Хлебные крошки" className="flex flex-wrap items-center gap-1.5 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            <Link href="/" className="hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]">
              Лента
            </Link>
            <span aria-hidden="true">/</span>
            <Link href={`/u/${blog.author.slug}`} className="hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]">
              {blog.author.displayName}
            </Link>
            <span aria-hidden="true">/</span>
            <Link href={`/blog/${blog.slug}`} className="text-[var(--foreground)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]">
              {blog.title}
            </Link>
          </nav>
          {multiChapter && <ReaderModeToggle singleHref={singleHref} wholeHref={wholeHref} mode={mode} />}
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="min-w-0">
            {/* Мобильная навигация по главам/ToC */}
            {(multiChapter || headings.length > 0) && (
              <details className="mb-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2 lg:hidden">
                <summary className="cursor-pointer text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                  Навигация по блогу
                </summary>
                <div className="mt-3">
                  <SeriesNav chapterLinks={chapterLinks} headings={headings} />
                </div>
              </details>
            )}

            {mode === "whole" && (
              <header className="mb-8">
                <h1 className="text-[length:var(--type-h1)]">{blog.title}</h1>
                {blog.summary && <p className="mt-3 text-[var(--muted-foreground)]">{blog.summary}</p>}
              </header>
            )}

            {sections.map((s) => (
              <ChapterBody
                key={s.chapter.id}
                blog={blog}
                section={s}
                mode={mode}
                isAuthed={isAuthed}
                canFollow={canFollow}
              />
            ))}
          </div>

          {/* Правый рельс — на lg+ */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <SeriesNav chapterLinks={chapterLinks} headings={headings} />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
