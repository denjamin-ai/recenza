"use client";

// Форма входа администратора (только пароль) → POST /api/auth. Неафишируемый маршрут /admin/login,
// без ссылок из публичного UI. После входа — переход в админ-портал /admin.

import { useState } from "react";

export function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Введите пароль.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.assign("/admin");
        return;
      }
      setError(
        res.status === 429
          ? "Слишком много попыток. Попробуйте через 15 минут."
          : "Неверный пароль.",
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
        <label htmlFor="admin-password" className="text-[length:var(--type-small)] font-medium text-[var(--foreground)]">
          Пароль
        </label>
        <input
          id="admin-password"
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
        {loading ? "Вход…" : "Войти как администратор"}
      </button>
    </form>
  );
}
