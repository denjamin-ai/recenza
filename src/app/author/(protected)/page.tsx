import type { Metadata } from "next";
import { AuthorCabinet } from "@/app/author/_components/author-cabinet";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorCabinet } from "@/lib/queries/author";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Кабинет автора", robots: { index: false, follow: false } };

export default async function AuthorPage() {
  const user = await getCurrentUser(); // гарантированно автор (гард в layout)
  const cabinet = user ? await getAuthorCabinet(user.id) : { blogs: [], pinnedBlogId: null };
  return (
    <AuthorCabinet
      displayName={user?.displayName ?? ""}
      blogs={cabinet.blogs}
      pinnedBlogId={cabinet.pinnedBlogId}
    />
  );
}
