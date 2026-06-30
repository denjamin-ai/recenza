import type { Metadata } from "next";
import { AuthorCabinet } from "@/app/author/_components/author-cabinet";
import { getCurrentUser } from "@/lib/auth";
import {
  getAuthorCabinet,
  getRatingPrompts,
  getRecruitRequests,
  getSkillsMismatchNotices,
} from "@/lib/queries/author";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Кабинет автора", robots: { index: false, follow: false } };

export default async function AuthorPage() {
  const user = await getCurrentUser(); // гарантированно автор (гард в layout)
  const [cabinet, recruitRequests, ratingPrompts, mismatches] = user
    ? await Promise.all([
        getAuthorCabinet(user.id),
        getRecruitRequests(user.id),
        getRatingPrompts(user.id),
        getSkillsMismatchNotices(user.id),
      ])
    : [{ blogs: [], pinnedBlogId: null }, [], [], []];
  return (
    <AuthorCabinet
      displayName={user?.displayName ?? ""}
      blogs={cabinet.blogs}
      pinnedBlogId={cabinet.pinnedBlogId}
      recruitRequests={recruitRequests}
      ratingPrompts={ratingPrompts}
      mismatches={mismatches}
    />
  );
}
