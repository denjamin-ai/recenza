"use client";

// Форма «Новый пользователь» (Фаза 12, альфа): админ создаёт аккаунт и сообщает пароль лично.
// Сворачиваемая панель над таблицей пользователей; успех → сброс формы + router.refresh().

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminMutate } from "@/app/admin/_components/client";

const ROLE_OPTIONS = [
  { value: "reader", label: "Читатель" },
  { value: "author", label: "Автор" },
  { value: "reviewer", label: "Ревьюер" },
] as const;

const inputCls =
  "min-h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[length:var(--type-small)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export function UserCreate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("reader");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    startTransition(async () => {
      const res = await adminMutate("/api/admin/users", "POST", {
        handle,
        displayName,
        password,
        role,
      });
      if (!res.ok) {
        setError(res.error ?? "Не удалось создать пользователя.");
        return;
      }
      setDone(`Пользователь @${handle.trim().toLowerCase()} создан. Сообщите ему пароль лично.`);
      setHandle("");
      setDisplayName("");
      setPassword("");
      setRole("reader");
      router.refresh();
    });
  }

  return (
    <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--border-secondary)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between px-4 py-2 text-left text-[length:var(--type-small)] font-medium text-[var(--foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        Новый пользователь
        <span aria-hidden className="text-[var(--muted-foreground)]">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <form onSubmit={submit} className="space-y-3 border-t border-[var(--border-secondary)] px-4 py-3">
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)] [text-wrap:pretty]">
            Самостоятельной регистрации нет: доступ выдаёт администратор. Роль задаётся один раз
            при создании и обычным API не меняется.
          </p>
          {error && (
            <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]">
              {error}
            </p>
          )}
          {done && (
            <p role="status" className="rounded-[var(--radius-md)] border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--success)]">
              {done}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[length:var(--type-small)] text-[var(--muted-foreground)]">Хэндл</span>
              <input
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                pattern="[a-z0-9_\-]{3,30}"
                title="3–30 символов: a-z, 0-9, «_», «-»"
                placeholder="ivan_petrov"
                autoComplete="off"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[length:var(--type-small)] text-[var(--muted-foreground)]">Отображаемое имя</span>
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                placeholder="Иван Петров"
                autoComplete="off"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[length:var(--type-small)] text-[var(--muted-foreground)]">Пароль (мин. 8 символов)</span>
              <input
                required
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={200}
                autoComplete="off"
                className={`${inputCls} font-mono`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[length:var(--type-small)] text-[var(--muted-foreground)]">Роль</span>
              {/* aria-label: у обёрнутого label accessible name включает тексты <option> — ломает точный матч */}
              <select aria-label="Роль" value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {pending ? "Создаю…" : "Создать пользователя"}
          </button>
        </form>
      )}
    </div>
  );
}
