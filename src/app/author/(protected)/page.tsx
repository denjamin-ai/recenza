import type { Metadata } from "next";
import { AuthorCabinet } from "@/app/author/_components/author-cabinet";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorCabinet, getPortfolioForAuthor, getRecruitRequests } from "@/lib/queries/author";
import { getAuthorReviewRequests } from "@/lib/queries/review-requests";
import { getAuthorExpertInvites } from "@/lib/queries/expert-invites";
import { getNotifications } from "@/lib/queries/notifications";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Кабинет автора", robots: { index: false, follow: false } };

/** Сколько последних уведомлений показывает aside «События» (ui-feedback-4 П1). */
const EVENTS_LIMIT = 6;

/** `Date.now()` в теле RSC ловит правило `react-hooks/purity` — выносим за границу компонента. */
function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export default async function AuthorPage() {
  const user = await getCurrentUser(); // гарантированно автор (гард в layout)
  // Ф14: оценки ревьюеров и «навыки не совпадают» сняты вместе с приглашениями —
  // их место в aside заняли ЗАЯВКИ на ревью с таймером SLA.
  const [cabinet, recruitRequests, reviewRequests, expertInvites, portfolio, notifications] = user
    ? await Promise.all([
        getAuthorCabinet(user.id),
        getRecruitRequests(user.id),
        getAuthorReviewRequests(user.id),
        getAuthorExpertInvites(user.handle),
        getPortfolioForAuthor(user.id),
        getNotifications(user.id),
      ])
    : [{ blogs: [], pinnedBlogId: null }, [], [], [], null, { unread: 0, items: [] }];
  return (
    <AuthorCabinet
      blogs={cabinet.blogs}
      pinnedBlogId={cabinet.pinnedBlogId}
      recruitRequests={recruitRequests}
      reviewRequests={reviewRequests}
      expertInvites={expertInvites}
      // Точка отсчёта таймеров считается на сервере: клиентский Date.now() дал бы расхождение при гидрации.
      now={nowSeconds()}
      portfolio={portfolio}
      events={notifications.items.slice(0, EVENTS_LIMIT)}
    />
  );
}
