import { ReviewerInboxShell } from "@/app/reviewer/_components/reviewer-inbox-shell";
import { getCurrentUser } from "@/lib/auth";
import { getReviewerQueue } from "@/lib/queries/review";

export const dynamic = "force-dynamic";

export default async function ReviewerPage() {
  const user = await getCurrentUser(); // гарантированно ревьюер (гард в layout)
  const queue = user ? await getReviewerQueue(user.handle) : [];
  return <ReviewerInboxShell displayName={user?.displayName ?? ""} queue={queue} />;
}
