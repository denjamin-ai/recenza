// Гард админ-портала + FULLSCREEN: НЕ оборачиваем в AppFrame → шапка сайта скрыта (README §11.8).
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage(); // гость → /admin/login, иной пользователь → /
  return <>{children}</>;
}
