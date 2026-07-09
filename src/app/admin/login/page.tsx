// Неафишируемый вход администратора (только пароль → /api/auth). Не индексируется, без ссылок из UI.
import type { Metadata } from "next";
import Link from "next/link";
import { AlphaBadge, ALPHA_COPY } from "@/components/alpha-badge";
import { AdminLoginForm } from "@/components/auth/admin-login-form";

export const metadata: Metadata = {
  title: "Вход администратора",
  description: "Служебный вход администратора Recenza.",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-[var(--bg-elevated)] focus:px-4 focus:py-2 focus:ring-2 focus:ring-[var(--accent)]"
      >
        К содержимому
      </a>
      <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 py-20 focus:outline-none">
        <div className="w-full max-w-sm">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
            <div className="mb-6">
              <span className="flex items-center gap-2">
                <Link
                  href="/"
                  className="font-display text-[length:var(--type-h4)] font-bold text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]"
                >
                  Recenza
                </Link>
                <AlphaBadge withPopover={false} />
              </span>
              <h1 className="mt-3 text-[length:var(--type-body)] font-medium text-[var(--foreground)]">
                Вход администратора
              </h1>
              <p className="mt-1 text-[length:var(--type-small)] text-[var(--muted-foreground)] [text-wrap:pretty]">
                Служебная страница модерации и настройки платформы.
              </p>
            </div>
            <AdminLoginForm />
          </div>

          <p className="mt-4 px-1 text-[length:var(--type-small)] text-[var(--muted-foreground)] [text-wrap:pretty]">
            {ALPHA_COPY}
          </p>
        </div>
      </main>
    </>
  );
}
