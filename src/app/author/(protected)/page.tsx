import { AuthorPortalShell } from "@/app/author/_components/author-portal-shell";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuthorPage() {
  const user = await getCurrentUser(); // гарантированно автор (гард в layout); fallback на пустую строку
  return <AuthorPortalShell displayName={user?.displayName ?? ""} />;
}
