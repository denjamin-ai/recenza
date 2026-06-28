// Публичный вход пользователей (reader/author/reviewer). Вне группы (reader) → без шапки сайта,
// центрированная карточка (по прототипу public/login.jsx). Демо-аккаунты в проде не показываем.
import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage() {
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
            Вход в аккаунт
          </h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
