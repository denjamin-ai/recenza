import { ReviewerInboxShell } from "@/app/reviewer/_components/reviewer-inbox-shell";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReviewerPage() {
  const user = await getCurrentUser(); // гарантированно ревьюер (гард в layout)
  return <ReviewerInboxShell displayName={user?.displayName ?? ""} />;
}
