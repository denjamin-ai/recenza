// Публичный вход пользователей (reader/author/reviewer). Вне группы (reader) → без шапки сайта,
// логотип + Alpha-бейдж (кликабельный, с поповером о статусе) НАД карточкой формы.
// Регистрации нет — доступ выдаёт администратор (альфа-модель), об этом инфоблок под формой.
import type { Metadata } from "next";
import Link from "next/link";
import { AlphaBadge } from "@/components/alpha-badge";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Вход",
  description: "Вход в аккаунт Recenza: читайте девблоги, пишите главы и участвуйте в ревью.",
};

type Search = Promise<{ next?: string; intent?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const { next, intent } = await searchParams;
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
          <div className="mb-5 flex items-center justify-center gap-2">
            <Link
              href="/"
              className="font-display text-[length:var(--type-h3)] font-bold text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]"
            >
              Recenza
            </Link>
            <AlphaBadge />
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
            <div className="mb-5">
              <h1 className="text-[length:var(--type-small)] font-semibold text-[var(--foreground)]">
                Вход в аккаунт
              </h1>
              <p className="mt-1 text-[length:var(--type-small)] text-[var(--muted-foreground)] [text-wrap:pretty]">
                Recenza — многоглавные девблоги, прошедшие редакционное ревью.
              </p>
            </div>
            <LoginForm next={next} intent={intent} />
          </div>

          <div className="mt-4 space-y-1.5 px-1 text-[length:var(--type-small)] text-[var(--muted-foreground)] [text-wrap:pretty]">
            <p>Аккаунты выдаёт администратор — самостоятельной регистрации нет.</p>
            <p>
              <Link
                href="/"
                className="text-[var(--accent)] underline-offset-2 transition-opacity hover:opacity-80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]"
              >
                ← Читать ленту без входа
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
