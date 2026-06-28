"use client";

// Меню аватара: профиль (автор/ревьюер) + закладки + вход в ролевой кабинет (автор/ревьюер) + выход.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Role } from "@/types";

type AvatarUser = {
  displayName: string;
  handle: string;
  slug: string;
  role: Role;
  avatarUrl: string | null;
};

const PORTAL: Partial<Record<Role, { href: string; label: string }>> = {
  author: { href: "/author", label: "Кабинет автора" },
  reviewer: { href: "/reviewer", label: "Кабинет ревьюера" },
};

export function AvatarMenu({ user }: { user: AvatarUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus(); // Escape возвращает фокус на триггер (ARIA menu button)
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    try {
      await fetch("/api/auth/user", { method: "DELETE" });
    } finally {
      window.location.assign("/");
    }
  }

  const portal = PORTAL[user.role];
  const initial = (user.displayName || user.handle).charAt(0).toUpperCase();
  const menuItem =
    "block w-full rounded-[var(--radius-md)] px-3 py-2 text-left text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

  return (
    <div
      ref={ref}
      className="relative"
      onBlur={(e) => {
        // Закрываем при уходе фокуса за пределы меню (Tab-навигация с клавиатуры).
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Меню пользователя"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] text-[length:var(--type-small)] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)]"
      >
        <span aria-hidden="true">{initial}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Меню пользователя"
          className="absolute right-0 z-50 mt-2 w-56 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-2"
        >
          <div className="border-b border-[var(--border-secondary)] px-3 py-2">
            <p className="truncate text-[length:var(--type-small)] font-medium text-[var(--foreground)]">
              {user.displayName}
            </p>
            <p className="truncate font-mono text-[11px] text-[var(--muted-foreground)]">
              @{user.handle}
            </p>
          </div>

          <div className="pt-1">
            {/* Публичный профиль есть только у автора/ревьюера (у читателя — нет). */}
            {(user.role === "author" || user.role === "reviewer") && (
              <Link role="menuitem" href={`/u/${user.slug}`} className={menuItem} onClick={() => setOpen(false)}>
                Мой профиль
              </Link>
            )}
            <Link role="menuitem" href="/bookmarks" className={menuItem} onClick={() => setOpen(false)}>
              Закладки
            </Link>
            {portal && (
              <Link role="menuitem" href={portal.href} className={menuItem} onClick={() => setOpen(false)}>
                {portal.label}
              </Link>
            )}
            <button role="menuitem" type="button" onClick={logout} className={menuItem}>
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
