// Приватные страницы аккаунта (Фаза 13): «Рабочее место» и «Настройки».
// Гард — любой вошедший пользователь (возможности здесь не требуются: настройки есть у всех,
// а «Рабочее место» само показывает пустое состояние). Админ уходит в свой портал.
// robots: noindex — приватные поверхности в поиске не нужны (проверяется seo-агентом).

import type { Metadata } from "next";
import { requireUserPage } from "@/lib/auth";
import { AppFrame } from "@/components/nav/app-frame";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUserPage(); // гость → /login, админ → /admin
  return <AppFrame>{children}</AppFrame>;
}
