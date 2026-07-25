// Читатель главы (data-driven, режим single). Регресс-ловушка: контент полностью из
// getReadableBlog(slug) → активная глава по [chapter]; разные блоги/главы → разный контент,
// title/OG обновляются (generateMetadata зовёт ту же функцию). Только published-главы.
//
// Ф14 — `?v=N`: чтение КОНКРЕТНОЙ проверенной версии главы (бейдж привязан к номеру ревизии,
// поэтому «проверенная версия» обязана оставаться читаемой после правки). Режим read-only:
// без реакций и комментариев (они у текущей ревизии), noindex + canonical на версию без `?v=`.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getSession } from "@/lib/auth";
import { getReadableBlog, getReadableChapterRevision } from "@/lib/queries/chapters";
import { getReaderEngagement } from "@/lib/queries/engagement";
import { buildReaderSections } from "@/lib/queries/reader-sections";
import { BlogReaderView, type ArchiveView } from "@/components/reader/blog-reader-view";
import { extractPlainText } from "@/components/blocks/extract-plain-text";
import { JsonLd } from "@/lib/jsonld";
import { absoluteUrl, truncate } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string; chapter: string }>;
type Search = Promise<{ v?: string }>;

/** `?v=` → номер ревизии. Мусор/0/отрицательные → null (обычное чтение текущей версии). */
function parseVersion(raw: string | undefined): number | null {
  if (typeof raw !== "string" || !/^\d{1,6}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? n : null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}): Promise<Metadata> {
  const { slug, chapter } = await params;
  const { v } = await searchParams;
  const requested = parseVersion(v);

  const blog = await getReadableBlog(slug);
  const active = blog?.chapters.find((c) => c.slug === chapter);
  if (!blog || !active) return { title: "Глава не найдена" };

  const canonical = absoluteUrl(`/blog/${slug}/${chapter}`);

  // Архив версии — дубликат контента: из индекса вон, canonical на текущую главу.
  if (requested !== null && requested !== active.revisionNumber) {
    const archived = await getReadableChapterRevision(slug, chapter, requested);
    if (!archived) return { title: "Версия не найдена" };
    return {
      title: `${archived.title} — версия ${archived.revisionNumber}`,
      description: truncate(archived.summary || extractPlainText(archived.blocks) || blog.summary || ""),
      alternates: { canonical },
      robots: { index: false, follow: false },
    };
  }

  const description = truncate(active.summary || extractPlainText(active.blocks) || blog.summary || "");
  const url = canonical;

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

export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug, chapter } = await params;
  const { v } = await searchParams;
  const requested = parseVersion(v);
  // Фаза 13: ролевой изоляции автора больше нет — любой аккаунт читает любой видимый блог (З-07).
  const [blog, viewer, session] = await Promise.all([
    getReadableBlog(slug),
    getCurrentUser(),
    getSession(),
  ]);
  if (!blog) notFound();

  const active = blog.chapters.find((c) => c.slug === chapter);
  if (!active) notFound();

  const currentHref = `/blog/${slug}/${active.slug}`;
  // `?v=` текущей версии — тот же контент по другому адресу: уводим на канонический URL.
  if (requested !== null && requested === active.revisionNumber) redirect(currentHref);

  // Архивная версия: селектор сам отдаёт null, если ревизия не published или блог невидим.
  const archived =
    requested !== null ? await getReadableChapterRevision(slug, chapter, requested) : null;
  if (requested !== null && !archived) notFound();

  const shown = archived ?? active;
  const archive: ArchiveView | null = archived
    ? {
        version: archived.revisionNumber,
        date: archived.verifiedAt ?? archived.publishedAt,
        currentVersion: active.revisionNumber,
        currentHref,
      }
    : null;

  const [sections, engagement] = await Promise.all([
    buildReaderSections(blog, [shown]),
    getReaderEngagement({ blogId: blog.id, authorId: blog.author.id, userId: viewer?.id }),
  ]);

  const description = truncate(shown.summary || extractPlainText(shown.blocks) || "");
  const url = absoluteUrl(currentHref);

  return (
    <>
      {/* Разметку статьи отдаём только у канонической версии — архив не индексируется. */}
      {!archive && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: shown.title,
            description,
            mainEntityOfPage: url,
            image: blog.coverUrl ? absoluteUrl(blog.coverUrl) : undefined,
            datePublished: shown.publishedAt ? new Date(shown.publishedAt * 1000).toISOString() : undefined,
            author: { "@type": "Person", name: blog.author.displayName, url: absoluteUrl(`/u/${blog.author.slug}`) },
          }}
        />
      )}
      <BlogReaderView
        blog={blog}
        mode="single"
        activeSlug={active.slug}
        sections={sections}
        isAuthed={!!viewer}
        engagement={engagement}
        canEngage={!session.isAdmin}
        singleHref={currentHref}
        wholeHref={`/blog/${slug}?mode=whole`}
        archive={archive}
        viewer={
          viewer
            ? { id: viewer.id, handle: viewer.handle, commentingBlocked: viewer.commentingBlocked }
            : null
        }
      />
    </>
  );
}
