// ReviewPage для автора (Фаза 7). POV автора (D1, серверный): только владелец блога. Статья рендерится
// единым серверным BlockRenderer (review-режим, инлайн-дифф vs prev_blocks) и передаётся в клиентский экран.

import { notFound } from "next/navigation";
import { requireAuthorPage } from "@/lib/auth";
import { getChapterIdBySlugs, getReviewSession } from "@/lib/queries/review";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { ReviewScreen } from "@/components/review/review-screen";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string; chapter: string }>;

export default async function AuthorReviewPage({ params }: { params: Params }) {
  const user = await requireAuthorPage(); // гость → /login, не-автор → /
  const { slug, chapter } = await params;

  const chapterId = await getChapterIdBySlugs(slug, chapter);
  if (!chapterId) notFound();

  const session = await getReviewSession(chapterId);
  if (!session) notFound();
  // Ownership: автор открывает ТОЛЬКО свой блог (CLAUDE.md binding).
  if (session.blog.authorId !== user.id) notFound();

  const article = (
    <BlockRenderer blocks={session.revision.blocks} prev={session.revision.prevBlocks} mode="review" />
  );

  return (
    <ReviewScreen session={session} pov="author" viewerHandle={session.blog.authorHandle} article={article} />
  );
}
