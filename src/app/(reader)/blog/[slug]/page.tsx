// Корень блога. Без ?mode — редирект на первую published-главу (нет дубликата контента).
// ?mode=whole — режим «Весь блог»: все главы подряд. Только published; ролевая изоляция автора.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getSession } from "@/lib/auth";
import { getReadableBlog } from "@/lib/queries/chapters";
import { getReaderEngagement } from "@/lib/queries/engagement";
import { buildReaderSections } from "@/lib/queries/reader-sections";
import { BlogReaderView } from "@/components/reader/blog-reader-view";
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

  // По умолчанию ведём на первую главу — единственная поверхность контента (без дубликата).
  if (mode !== "whole") {
    redirect(`/blog/${slug}/${blog.chapters[0].slug}`);
  }

  const [sections, engagement] = await Promise.all([
    buildReaderSections(blog, blog.chapters),
    getReaderEngagement({ blogId: blog.id, authorId: blog.author.id, userId: viewer?.id }),
  ]);

  return (
    <BlogReaderView
      blog={blog}
      mode="whole"
      activeSlug={blog.chapters[0].slug}
      sections={sections}
      isAuthed={!!viewer}
      engagement={engagement}
      canEngage={!session.isAdmin}
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
