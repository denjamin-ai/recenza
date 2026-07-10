"use client";

// Форма входа пользователя (reader/author/reviewer) → POST /api/auth/user.
// После входа — полный переход (window.location) по роли, чтобы серверная шапка перерисовалась с сессией.
// Гостевой intent (vote/bookmark/follow) реплеится через авторизованный API; next — относительный (anti-open-redirect).

import { useState } from "react";
import { parseIntent, safeNext } from "@/lib/intent";

function roleHome(role?: string): string {
  return role === "author" ? "/author" : role === "reviewer" ? "/reviewer" : "/";
}

// Реплей одного гостевого намерения (best-effort, идемпотентно — toggle-API не задваивает).
async function replayIntent(raw?: string): Promise<void> {
  const intent = parseIntent(raw);
  if (!intent) return;
  const common = { method: "POST", headers: { "Content-Type": "application/json" } } as const;
  try {
    if (intent.verb === "vote") {
      // ui-feedback-5 П1: голоса блоговые — intent.id = blogId.
      await fetch(`/api/blogs/${intent.id}/vote`, { ...common, body: JSON.stringify({ value: intent.value }) });
    } else if (intent.verb === "bookmark") {
      await fetch(`/api/bookmarks`, { ...common, body: JSON.stringify({ blogId: intent.id }) });
    } else if (intent.verb === "follow") {
      await fetch(`/api/follows`, { ...common, body: JSON.stringify({ authorId: intent.id }) });
    }
  } catch {
    /* реплей best-effort — игнорируем сетевые ошибки */
  }
}

export function LoginForm({ next, intent }: { next?: string; intent?: string }) {
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!handle.trim() || !password) {
      setError("Введите никнейм и пароль.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle.trim(), password }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as { user?: { role?: string } } | null;
        const role = data?.user?.role;
        await replayIntent(intent);
        const dest = next ? safeNext(next, roleHome(role)) : roleHome(role);
        window.location.assign(dest);
        return;
      }
      setError(
        res.status === 429
          ? "Слишком много попыток. Попробуйте через 15 минут."
          : "Неверный никнейм или пароль.",
      );
    } catch {
      setError("Не удалось войти. Проверьте соединение.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="handle" className="text-[length:var(--type-small)] font-medium text-[var(--foreground)]">
          Никнейм
        </label>
        <input
          id="handle"
          name="handle"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-3 text-[length:var(--type-small)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[length:var(--type-small)] font-medium text-[var(--foreground)]">
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-3 text-[length:var(--type-small)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        />
      </div>

      {error && (
        <p role="alert" className="text-[length:var(--type-small)] text-[var(--danger)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:opacity-50"
      >
        {loading ? "Вход…" : "Войти"}
      </button>
    </form>
  );
}
