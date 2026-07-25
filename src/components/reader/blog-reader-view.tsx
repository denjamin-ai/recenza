// Композиция ридера (RSC). Режимы: single (одна глава, h1=заголовок главы) и whole (весь блог,
// h1=название блога, заголовки глав = h2). Контент рендерит общий BlockRenderer (идентичен ревью).
// Правый рельс (SeriesNav) — на lg+; на узких экранах главы/ToC доступны через <details> сверху.
// ui-feedback-4 П8 (по прототипу WholeBlogReader): в whole-режиме кредит ревьюеров и комментарии
// НЕ рендерятся после каждой главы — после всех глав идёт ОДНА агрегированная карточка
// «Блог ревьюили» и ОДИН merged-блок комментариев.
// ui-feedback-5 П1/П4 + ui-feedback-6 П1: engagement — БЛОГОВЫЙ и рендерится один раз НАВЕРХУ
// (whole — в шапке блога, single — после заголовка/навыков главы, до контента);
// показывается только гостю (login-intent) и читателю.
// Ф14: бейдж проверки — в ряду с навыками у заголовка главы; проп `archive` включает read-only
// чтение проверенной версии (`?v=N`): шапка-предупреждение, без реакций и комментариев.

import Link from "next/link";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { extractHeadings } from "@/components/blocks/headings";
import { ReadingProgress } from "@/components/reader/reading-progress";
import { SeriesNav, type ChapterLink } from "@/components/reader/series-nav";
import { ReaderModeToggle } from "@/components/reader/reader-mode-toggle";
import { SkillChips } from "@/components/reader/skill-chips";
import { VerifiedBadge, formatVerifiedDate } from "@/components/reader/verified-badge";
import { EngagementBar } from "@/components/reader/engagement-bar";
import { ChapterReviewerCredit } from "@/components/reader/chapter-reviewer-credit";
import { CommentsSlot } from "@/components/reader/comments-slot";
import { BlogCommentsSlot } from "@/components/reader/blog-comments-slot";
import { BlogReviewerCredit } from "@/components/reader/blog-reviewer-credit";
import { FragmentCommentButton } from "@/components/reader/fragment-comment-button";
import { commentGate, type CommentViewer } from "@/lib/queries/comments";
import type { ReaderEngagement } from "@/lib/queries/engagement";
import type { ReadableBlog, ReaderSection } from "@/lib/queries/types";

function ChapterBody({
  blog,
  section,
  mode,
  engagementBar,
  viewer,
  archived,
}: {
  blog: ReadableBlog;
  section: ReaderSection;
  mode: "single" | "whole";
  /** single-режим: бар реакций наверху, до контента (null — зритель без права engagement). */
  engagementBar: React.ReactNode;
  viewer: CommentViewer | null;
  /** Ф14: читается архивная версия (`?v=N`) — комментарии не рендерим (они у текущей ревизии). */
  archived: boolean;
}) {
  const { chapter, credit } = section;
  const prefix = mode === "whole" ? chapter.slug : undefined;
  const titleId = `chapter-${chapter.slug}`;
  // Ф14: приглушённый бейдж ведёт на чтение проверенной версии; в архивном режиме ссылки нет
  // (мы уже в ней). Свежий бейдж ссылкой не оборачивается — он про текущую версию.
  const badgeHref =
    !archived && chapter.verifiedRevision !== null && chapter.verifiedRevision < chapter.revisionNumber
      ? `/blog/${blog.slug}/${chapter.slug}?v=${chapter.verifiedRevision}`
      : undefined;
  const hasMeta = chapter.skills.length > 0 || chapter.verifiedTier !== null;

  return (
    <article className="mb-16" data-chapter-slug={chapter.slug}>
      {mode === "single" ? (
        <h1 id={titleId} className="scroll-mt-24 text-[length:var(--type-h1)]">
          {chapter.title}
        </h1>
      ) : (
        <h2 id={titleId} className="scroll-mt-24 border-t border-[var(--border)] pt-8 text-[length:var(--type-h2)]">
          {chapter.title}
        </h2>
      )}

      {/* Ф14: бейдж проверки — в одном ряду с навыками главы */}
      {hasMeta && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <VerifiedBadge
            tier={chapter.verifiedTier}
            verifiedRevision={chapter.verifiedRevision}
            currentRevision={chapter.revisionNumber}
            verifiedAt={chapter.verifiedAt}
            href={badgeHref}
          />
          <SkillChips skills={chapter.skills} />
        </div>
      )}

      {/* ui-feedback-6 П1: бар реакций (блоговый) — наверху главы, до контента */}
      {mode === "single" && engagementBar}

      <div className="mt-6">
        <BlockRenderer blocks={chapter.blocks} prefix={prefix} />
      </div>

      {/* single: кредит + комментарии у главы; whole: всё после всех глав */}
      {mode === "single" && (
        <>
          <ChapterReviewerCredit
            credit={credit}
            tier={chapter.verifiedRevision === chapter.revisionNumber ? chapter.verifiedTier : null}
            verifiedAt={chapter.verifiedAt}
          />
          {!archived && (
            <CommentsSlot
              blogSlug={blog.slug}
              chapterSlug={chapter.slug}
              chapterId={chapter.id}
              revision={chapter.revisionNumber}
              blogAuthorId={blog.author.id}
              sectionId="comments"
              viewer={viewer}
            />
          )}
        </>
      )}
    </article>
  );
}

/**
 * Ф14: шапка режима «читаю проверенную версию». Read-only — комментарии и реакции в этом режиме
 * не рендерятся: они привязаны к ТЕКУЩЕЙ ревизии, иначе читатель комментирует «прошлое».
 */
function ArchiveNotice({ archive }: { archive: ArchiveView }) {
  const date = formatVerifiedDate(archive.date);
  return (
    <aside
      aria-label="Вы читаете архивную версию главы"
      className="mb-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--muted)] px-4 py-3 text-[length:var(--type-small)] text-[var(--muted-foreground)]"
    >
      <p>
        {/* Русский формат даты уже оканчивается на «г.» — своя точка дала бы «2026 г..». */}
        Вы читаете проверенную версию {archive.version}
        {date ? ` от ${date}` : ""}
        {date ? " Текущая версия — " : ". Текущая версия — "}
        {archive.currentVersion}.
      </p>
      <Link
        href={archive.currentHref}
        className="mt-1.5 inline-flex items-center gap-1 rounded-[var(--radius-sm)] text-[var(--accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        Читать текущую версию <span aria-hidden="true">→</span>
      </Link>
    </aside>
  );
}

/** Ф14: описание архивного режима чтения (`?v=N`); null — обычное чтение текущей версии. */
export interface ArchiveView {
  /** Номер читаемой (проверенной) версии. */
  version: number;
  /** Дата версии — unix seconds (verified_at, иначе published_at). */
  date: number | null;
  /** Номер текущей опубликованной версии. */
  currentVersion: number;
  /** Канонический адрес главы без `?v=`. */
  currentHref: string;
}

export function BlogReaderView({
  blog,
  mode,
  activeSlug,
  sections,
  isAuthed,
  engagement,
  canEngage,
  singleHref,
  wholeHref,
  viewer,
  archive = null,
}: {
  blog: ReadableBlog;
  mode: "single" | "whole";
  activeSlug: string;
  sections: ReaderSection[];
  isAuthed: boolean;
  /** Блоговое engagement-состояние (голос/закладка/подписка) — один бар на страницу. */
  engagement: ReaderEngagement;
  /** true — гость (login-intent) или любой аккаунт; бар не видит только админ (Ф13, З-60). */
  canEngage: boolean;
  singleHref: string;
  wholeHref: string;
  viewer: CommentViewer | null;
  /** Ф14: read-only чтение проверенной версии — без реакций и комментариев. */
  archive?: ArchiveView | null;
}) {
  const archived = archive !== null;
  const multiChapter = blog.chapters.length > 1;
  // Право комментировать одинаково для всех глав блога (один автор) — для плавающей кнопки фрагмента.
  // Плавающая кнопка «комментировать фрагмент»: базовый гейт без конфликта интересов —
  // он поглавный и проверяется в слотах (и, авторитетно, в POST /api/comments).
  // В архивном режиме комментировать нечего: и слоты, и плавающая кнопка выключены.
  const canCommentBlog = !archived && commentGate(viewer).canComment;

  const engagementBar = canEngage && !archived ? (
    <EngagementBar
      blogId={blog.id}
      authorId={blog.author.id}
      isAuthed={isAuthed}
      isOwnBlog={viewer?.id === blog.author.id}
      className="mt-5"
      initial={{
        score: engagement.score,
        myVote: engagement.myVote,
        isBookmarked: engagement.isBookmarked,
        bookmarkCount: blog.bookmarkCount,
        isFollowing: engagement.isFollowing,
      }}
    />
  ) : null;

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
              {/* Ф13: каталог един для всех — крошка всегда «Лента» (реверс uif-6 П6) */}
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
            {/* Ф14: шапка архивного режима — до любого контента */}
            {archive && <ArchiveNotice archive={archive} />}

            {/* Мобильная навигация по главам/ToC */}
            {(multiChapter || headings.length > 0) && (
              <details className="mb-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2 lg:hidden">
                <summary className="cursor-pointer rounded-[var(--radius-sm)] text-[length:var(--type-small)] text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
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
                {/* ui-feedback-5 П1: реакции блога — ОДИН раз наверху (не после каждой главы) */}
                {engagementBar}
              </header>
            )}

            {sections.map((s) => (
              <ChapterBody
                key={s.chapter.id}
                blog={blog}
                section={s}
                mode={mode}
                engagementBar={engagementBar}
                viewer={viewer}
                archived={archived}
              />
            ))}

            {mode === "whole" && (
              <>
                <BlogReviewerCredit sections={sections} />
                {!archived && (
                  <BlogCommentsSlot
                    blogSlug={blog.slug}
                    chapters={sections.map((s) => ({
                      id: s.chapter.id,
                      slug: s.chapter.slug,
                      title: s.chapter.title,
                      revision: s.chapter.revisionNumber,
                    }))}
                    blogAuthorId={blog.author.id}
                    viewer={viewer}
                  />
                )}
              </>
            )}
          </div>

          {/* Правый рельс — на lg+ */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <SeriesNav chapterLinks={chapterLinks} headings={headings} />
            </div>
          </aside>
        </div>
      </div>
      <FragmentCommentButton enabled={canCommentBlog} />
    </>
  );
}
