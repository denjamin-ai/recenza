// Гард админ-портала + FULLSCREEN-каркас (Фаза 10, §11.8): НЕ оборачиваем в AppFrame → шапка сайта
// скрыта; вместо неё — собственный AdminShell (сайдбар + топбар). Экраны — RSC route-сегменты ниже.
import { requireAdminPage } from "@/lib/auth";
import { AdminShell } from "@/app/admin/_components/admin-shell";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage(); // гость → /admin/login, иной пользователь → /
  return <AdminShell>{children}</AdminShell>;
}
