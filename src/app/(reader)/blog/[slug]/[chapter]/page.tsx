// Читатель главы (data-driven, режим single). Регресс-ловушка: контент полностью из
// getReadableBlog(slug) → активная глава по [chapter]; разные блоги/главы → разный контент,
// title/OG обновляются (generateMetadata зовёт ту же функцию). Только published-главы.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser, getSession } from "@/lib/auth";
import { getReadableBlog } from "@/lib/queries/chapters";
import { getReaderEngagement } from "@/lib/queries/engagement";
import { buildReaderSections } from "@/lib/queries/reader-sections";
import { BlogReaderView } from "@/components/reader/blog-reader-view";
import { extractPlainText } from "@/components/blocks/extract-plain-text";
import { JsonLd } from "@/lib/jsonld";
import { absoluteUrl, truncate } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string; chapter: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, chapter } = await params;
  const blog = await getReadableBlog(slug);
  const active = blog?.chapters.find((c) => c.slug === chapter);
  if (!blog || !active) return { title: "Глава не найдена" };

  const description = truncate(active.summary || extractPlainText(active.blocks) || blog.summary || "");
  const url = absoluteUrl(`/blog/${slug}/${chapter}`);

  return {
    title: active.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: active.title,
      description,
      url,
      images: blog.coverUrl ? [absoluteUrl(blog.coverUrl)] : undefined,
      publishedTime: active.publishedAt ? new Date(active.publishedAt * 1000).toISOString() : undefined,
    },
    twitter: { card: "summary_large_image", title: active.title, description },
  };
}

export default async function ChapterPage({ params }: { params: Params }) {
  const { slug, chapter } = await params;
  // Фаза 13: ролевой изоляции автора больше нет — любой аккаунт читает любой видимый блог (З-07).
  const [blog, viewer, session] = await Promise.all([
    getReadableBlog(slug),
    getCurrentUser(),
    getSession(),
  ]);
  if (!blog) notFound();

  const active = blog.chapters.find((c) => c.slug === chapter);
  if (!active) notFound();

  const [sections, engagement] = await Promise.all([
    buildReaderSections(blog, [active]),
    getReaderEngagement({ blogId: blog.id, authorId: blog.author.id, userId: viewer?.id }),
  ]);

  const description = truncate(active.summary || extractPlainText(active.blocks) || "");
  const url = absoluteUrl(`/blog/${slug}/${chapter}`);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: active.title,
          description,
          mainEntityOfPage: url,
          image: blog.coverUrl ? absoluteUrl(blog.coverUrl) : undefined,
          datePublished: active.publishedAt ? new Date(active.publishedAt * 1000).toISOString() : undefined,
          author: { "@type": "Person", name: blog.author.displayName, url: absoluteUrl(`/u/${blog.author.slug}`) },
        }}
      />
      <BlogReaderView
        blog={blog}
        mode="single"
        activeSlug={active.slug}
        sections={sections}
        isAuthed={!!viewer}
        engagement={engagement}
        canEngage={!session.isAdmin}
        singleHref={`/blog/${slug}/${active.slug}`}
        wholeHref={`/blog/${slug}?mode=whole`}
        viewer={
          viewer
            ? { id: viewer.id, handle: viewer.handle, commentingBlocked: viewer.commentingBlocked }
            : null
        }
      />
    </>
  );
}
