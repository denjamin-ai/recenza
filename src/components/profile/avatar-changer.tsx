"use client";

// Смена аватарки своего профиля (ui-feedback-5 П2): скрытый file-input → POST /api/uploads
// (kind=avatar) → PATCH /api/profile/avatar → router.refresh() (в startTransition — CLAUDE gotcha).
// Два варианта отображения: menuitem (меню аватара в шапке — доступно ВСЕМ ролям, в т.ч. читателю
// без публичного профиля) и button (кнопка на своей странице /u/…).

import { startTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function AvatarChanger({
  variant,
  className = "",
  onDone,
}: {
  variant: "menuitem" | "button";
  className?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // повторный выбор того же файла снова триггерит onChange
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("kind", "avatar");
      form.set("file", file);
      const up = await fetch("/api/uploads", { method: "POST", body: form });
      const upData = (await up.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!up.ok || !upData.path) {
        setError(upData.error ?? "Не удалось загрузить файл.");
        return;
      }
      const patch = await fetch("/api/profile/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: upData.path }),
      });
      if (!patch.ok) {
        const data = (await patch.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Не удалось сохранить аватар.");
        return;
      }
      startTransition(() => router.refresh());
      onDone?.();
    } catch {
      setError("Сеть недоступна. Повторите.");
    } finally {
      setBusy(false);
    }
  }

  const cls =
    variant === "menuitem"
      ? "block w-full rounded-[var(--radius-md)] px-3 py-2 text-left text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50"
      : "inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[length:var(--type-small)] font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50";

  return (
    <span className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={onFile}
      />
      <button
        type="button"
        role={variant === "menuitem" ? "menuitem" : undefined}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={cls}
      >
        {busy ? "Загружаем…" : "Сменить аватар"}
      </button>
      {error && (
        <span role="alert" className="mt-1 block text-[0.72rem] text-[var(--danger)]">
          {error}
        </span>
      )}
    </span>
  );
}
