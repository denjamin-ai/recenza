// Корень блога — ОГЛАВЛЕНИЕ (Фаза 15, З-26). До неё роут молча редиректил на первую published-главу,
// и у блога не было собственной страницы. Теперь три представления:
//   `/blog/[slug]`             — оглавление (список глав, точка входа «Читать с начала»);
//   `/blog/[slug]/[chapter]`   — одна глава;
//   `/blog/[slug]?mode=whole`  — весь блог подряд (режим не тронут, на нём стоит review-whole-blog).
// Дубликата контента оглавление не создаёт: тела глав на нём нет, только заголовки и метаданные.
// Только published; видимость — общие гейты getReadableBlog.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser, getSession } from "@/lib/auth";
import { getReadableBlog } from "@/lib/queries/chapters";
import { getReaderEngagement } from "@/lib/queries/engagement";
import { buildReaderSections } from "@/lib/queries/reader-sections";
import { BlogReaderView } from "@/components/reader/blog-reader-view";
import { BlogTocView } from "@/components/reader/blog-toc-view";
import { EngagementBar } from "@/components/reader/engagement-bar";
import { ReportButton } from "@/components/reader/report-dialog";
import { absoluteUrl, truncate } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type Search = Promise<{ mode?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const blog = await getReadableBlog(slug);
  if (!blog) return { title: "Блог не найден" };

  const description = truncate(blog.summary || blog.title);
  const url = absoluteUrl(`/blog/${slug}`);
  return {
    title: blog.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: blog.title,
      description,
      url,
      images: blog.coverUrl ? [absoluteUrl(blog.coverUrl)] : undefined,
    },
  };
}

export default async function BlogPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const { mode } = await searchParams;
  // Фаза 13: ролевой изоляции автора больше нет — любой аккаунт читает любой видимый блог (З-07).
  const [blog, viewer, session] = await Promise.all([
    getReadableBlog(slug),
    getCurrentUser(),
    getSession(),
  ]);
  if (!blog) notFound();
  // Явный guard: getReadableBlog уже возвращает null при нуле published-глав, но защищаемся от
  // обращения blog.chapters[0] по любой будущей ветке (code-review P1).
  if (blog.chapters.length === 0) notFound();

  const canEngage = !session.isAdmin;
  const engagement = await getReaderEngagement({
    blogId: blog.id,
    authorId: blog.author.id,
    userId: viewer?.id,
  });

  // Реакции блога — тот же бар, что в whole-режиме и на странице главы (ui-feedback-5 П1).
  const engagementBar = canEngage ? (
    <EngagementBar
      blogId={blog.id}
      authorId={blog.author.id}
      isAuthed={!!viewer}
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

  if (mode !== "whole") {
    // Ф15: пожаловаться на блог может любой вошедший, кроме его автора (гостю роут ответил бы 401).
    const canReport = !!viewer && viewer.id !== blog.author.id;
    return (
      <BlogTocView
        blog={blog}
        engagementBar={engagementBar}
        reportButton={
          canReport ? (
            <ReportButton
              target={{ targetType: "blog", targetId: blog.id, excerpt: blog.title }}
              className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] px-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />
          ) : null
        }
      />
    );
  }

  const sections = await buildReaderSections(blog, blog.chapters);

  return (
    <BlogReaderView
      blog={blog}
      mode="whole"
      activeSlug={blog.chapters[0].slug}
      sections={sections}
      isAuthed={!!viewer}
      engagement={engagement}
      canEngage={canEngage}
      singleHref={`/blog/${slug}/${blog.chapters[0].slug}`}
      wholeHref={`/blog/${slug}?mode=whole`}
      viewer={
        viewer
          ? { id: viewer.id, handle: viewer.handle, commentingBlocked: viewer.commentingBlocked }
          : null
      }
    />
  );
}
