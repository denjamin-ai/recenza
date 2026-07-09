// Общая шапка сайта (по прототипу shared/components.jsx). Серверный компонент: роль-зависимая
// навигация по текущему пользователю. Гость → «Войти»; пользователь → колокол + меню аватара.
// Вход в ролевой кабинет — внутри AvatarMenu (автор/ревьюер). Админ шапку сайта не видит (fullscreen).

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { AlphaBadge } from "@/components/alpha-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { AvatarMenu } from "@/components/nav/avatar-menu";
import { NotificationBell } from "@/components/nav/notification-bell";

export async function SiteNav() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
      <nav className="mx-auto flex h-16 w-full max-w-[var(--max-article)] items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <Link
              href="/"
              className="font-display text-[length:var(--type-h4)] font-bold text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)] rounded-[var(--radius-sm)]"
            >
              Recenza
            </Link>
            <AlphaBadge />
          </span>
          <Link
            href="/"
            className="text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)] rounded-[var(--radius-sm)]"
          >
            Лента
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <NotificationBell />
              <AvatarMenu
                user={{
                  displayName: user.displayName,
                  handle: user.handle,
                  slug: user.slug,
                  role: user.role,
                  avatarUrl: user.avatarUrl,
                }}
              />
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)]"
            >
              Войти
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
