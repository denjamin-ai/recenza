// Гард кабинета ревьюера + шапка сайта (AppFrame).
import { AppFrame } from "@/components/nav/app-frame";
import { requireReviewerPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReviewerProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireReviewerPage(); // гость → /login, не-ревьюер → /
  return <AppFrame>{children}</AppFrame>;
}
