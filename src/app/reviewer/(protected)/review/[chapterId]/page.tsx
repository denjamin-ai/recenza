// ReviewPage для ревьюера (Фаза 7). POV ревьюера (D1, серверный): только назначенный на главу.
// Не назначен / не та глава → редирект в инбокс. Статья — единый серверный BlockRenderer (review-режим).

import { notFound, redirect } from "next/navigation";
import { requireReviewerPage } from "@/lib/auth";
import { getReviewSession, isAssignedReviewer } from "@/lib/queries/review";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { ReviewScreen } from "@/components/review/review-screen";

export const dynamic = "force-dynamic";

type Params = Promise<{ chapterId: string }>;

export default async function ReviewerReviewPage({ params }: { params: Params }) {
  const user = await requireReviewerPage(); // гость → /login, не-ревьюер → /
  const { chapterId } = await params;

  const session = await getReviewSession(chapterId);
  if (!session) notFound();
  // Доступ только назначенному ревьюеру (серверный гейтинг POV).
  if (!isAssignedReviewer(user.handle, session)) redirect("/reviewer");

  const article = (
    <BlockRenderer blocks={session.revision.blocks} prev={session.revision.prevBlocks} mode="review" />
  );

  return <ReviewScreen session={session} pov="reviewer" viewerHandle={user.handle} article={article} />;
}
