// Неафишируемый вход администратора (только пароль → /api/auth). Не индексируется, без ссылок из UI.
import type { Metadata } from "next";
import Link from "next/link";
import { AdminLoginForm } from "@/components/auth/admin-login-form";

export const metadata: Metadata = {
  title: "Вход администратора",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 py-20 focus:outline-none">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="font-display text-[length:var(--type-h2)] font-bold text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]"
          >
            Recenza
          </Link>
          <h1 className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            Вход администратора
          </h1>
        </div>
        <AdminLoginForm />
      </div>
    </main>
  );
}
