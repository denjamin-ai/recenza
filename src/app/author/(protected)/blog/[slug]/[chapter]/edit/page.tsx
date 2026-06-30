import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChapterEditor } from "@/app/author/_components/editor/chapter-editor";
import { getCurrentUser } from "@/lib/auth";
import { getChapterForEditor, getReviewerMatches } from "@/lib/queries/author";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Редактор главы", robots: { index: false, follow: false } };

export default async function ChapterEditPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}) {
  const { slug, chapter } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const data = await getChapterForEditor(user.id, slug, chapter);
  if (!data) notFound(); // не найдено ИЛИ чужое (ownership)
  const reviewers = await getReviewerMatches(data.chapter.id);
  return <ChapterEditor data={data} reviewers={reviewers} />;
}
