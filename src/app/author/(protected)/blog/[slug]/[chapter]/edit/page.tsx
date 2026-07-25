import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChapterEditor } from "@/app/author/_components/editor/chapter-editor";
import { getCurrentUser } from "@/lib/auth";
import { getChapterForEditor } from "@/lib/queries/author";
import { getRequestForRevision } from "@/lib/queries/review-requests";

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
  // Ф14: вместо подбора ревьюеров — живая заявка на ЭТУ ревизию (её показывает SubmitSheet).
  const request = await getRequestForRevision(data.chapter.id, data.revision.number);
  return <ChapterEditor data={data} request={request} />;
}
