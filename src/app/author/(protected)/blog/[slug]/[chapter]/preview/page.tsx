// Авторский предпросмотр черновика: рендерит НАСТОЯЩИЙ BlockRenderer (как у читателя) → identical output.
// Доступ — только владелец (getChapterForEditor проверяет ownership); noindex.

import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { getCurrentUser } from "@/lib/auth";
import { getChapterForEditor } from "@/lib/queries/author";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Предпросмотр главы", robots: { index: false, follow: false } };

export default async function ChapterPreviewPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}) {
  const { slug, chapter } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const data = await getChapterForEditor(user.id, slug, chapter);
  if (!data) notFound();

  return (
    <div className="mx-auto w-full max-w-[var(--max-article)] px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Предпросмотр · как видит читатель
        </p>
        <BackLink href={`/author/blog/${data.blog.slug}/${data.chapter.slug}/edit`}>К редактору</BackLink>
      </div>
      <article>
        <h1 className="text-[length:var(--type-h1)] font-[var(--weight-h1)] leading-tight">
          {data.chapter.title}
        </h1>
        <div className="mt-6">
          <BlockRenderer blocks={data.revision.blocks} mode="reader" />
        </div>
      </article>
    </div>
  );
}
