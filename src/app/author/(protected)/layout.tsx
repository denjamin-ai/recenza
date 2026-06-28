// Гард кабинета автора + шапка сайта (AppFrame).
import { AppFrame } from "@/components/nav/app-frame";
import { requireAuthorPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuthorProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAuthorPage(); // гость → /login, не-автор → /
  return <AppFrame>{children}</AppFrame>;
}
