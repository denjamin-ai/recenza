// Публичный вход (reader/author/reviewer). Вариант A: логотип + Alpha-бейдж
// над формой, без карточки. Регистрации нет — доступ выдаёт администратор.
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
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center px-4 py-20 focus:outline-none"
      >
        <div className="w-full max-w-sm">
          {/* Доступное имя страницы — визуально скрыто, экраны чтения видят */}
          <h1 className="sr-only">Вход в аккаунт Recenza</h1>

          {/* Логотип + Alpha-бейдж над формой, без карточки */}
          <div className="mb-7 flex items-center justify-center gap-2">
            <Link
              href="/"
              className="font-display text-[1.875rem] font-extrabold leading-none tracking-tight text-[var(--foreground)] rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Recenza
            </Link>
            <AlphaBadge />
          </div>

          <LoginForm next={next} intent={intent} />
        </div>
      </main>
    </>
  );
}
