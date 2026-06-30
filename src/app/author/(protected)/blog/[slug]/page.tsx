import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogDetailView } from "@/app/author/_components/blog-detail-view";
import { getCurrentUser } from "@/lib/auth";
import { getBlogDetailForAuthor } from "@/lib/queries/author";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Блог автора", robots: { index: false, follow: false } };

export default async function AuthorBlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const detail = await getBlogDetailForAuthor(user.id, slug);
  if (!detail) notFound(); // не найден ИЛИ чужой (ownership)
  return <BlogDetailView detail={detail} />;
}
