import type { Metadata } from "next";
import { AuthorCabinet } from "@/app/author/_components/author-cabinet";
import { getCurrentUser } from "@/lib/auth";
import {
  getAuthorCabinet,
  getPortfolioForAuthor,
  getRatingPrompts,
  getRecruitRequests,
  getSkillsMismatchNotices,
} from "@/lib/queries/author";
import { getNotifications } from "@/lib/queries/notifications";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Кабинет автора", robots: { index: false, follow: false } };

/** Сколько последних уведомлений показывает aside «События» (ui-feedback-4 П1). */
const EVENTS_LIMIT = 6;

export default async function AuthorPage() {
  const user = await getCurrentUser(); // гарантированно автор (гард в layout)
  const [cabinet, recruitRequests, ratingPrompts, mismatches, portfolio, notifications] = user
    ? await Promise.all([
        getAuthorCabinet(user.id),
        getRecruitRequests(user.id),
        getRatingPrompts(user.id),
        getSkillsMismatchNotices(user.id),
        getPortfolioForAuthor(user.id),
        getNotifications(user.id),
      ])
    : [{ blogs: [], pinnedBlogId: null }, [], [], [], null, { unread: 0, items: [] }];
  return (
    <AuthorCabinet
      blogs={cabinet.blogs}
      pinnedBlogId={cabinet.pinnedBlogId}
      recruitRequests={recruitRequests}
      ratingPrompts={ratingPrompts}
      mismatches={mismatches}
      portfolio={portfolio}
      events={notifications.items.slice(0, EVENTS_LIMIT)}
    />
  );
}
