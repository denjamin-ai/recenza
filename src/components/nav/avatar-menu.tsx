"use client";

// Меню аватара (Фаза 13, по прототипу shared/components.jsx AvatarMenu): профиль и закладки — ВСЕМ
// (публичный профиль есть у любого аккаунта, реверс uif-6 П6/uif-5 П4).
// ui-feedback-7: пунктов «Кабинет автора»/«Кабинет ревьюера» и строки возможностей в шапке НЕТ —
// вход в кабинеты только через «Рабочее место» (оно видно при наличии возможностей).
// «Сменить аватар» убран по ui-feedback-6 П2 — смена аватарки осталась на своей /u/-странице.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { capabilitiesOf } from "@/lib/roles";

type AvatarUser = {
  displayName: string;
  handle: string;
  slug: string;
  canAuthor: boolean;
  isReviewer: boolean;
  avatarUrl: string | null;
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

  const caps = capabilitiesOf(user);
  const initial = (user.displayName || user.handle).charAt(0).toUpperCase();
  const menuItem =
    "flex min-h-9 w-full items-center rounded-[var(--radius-md)] px-3 py-2 text-left text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

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
        className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] text-[length:var(--type-small)] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)]"
      >
        {user.avatarUrl ? (
          <Image src={user.avatarUrl} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true">{initial}</span>
        )}
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
            {/* Ф13: публичный профиль и закладки есть у ЛЮБОГО аккаунта. */}
            <Link role="menuitem" href={`/u/${user.slug}`} className={menuItem} onClick={() => setOpen(false)}>
              Мой профиль
            </Link>
            {/* Ф13.6: «Рабочее место» — приватный хаб, только при наличии возможностей.
                ui-feedback-7: единственный вход в кабинеты — карточки на /workspace. */}
            {caps.length > 0 && (
              <Link role="menuitem" href="/workspace" className={menuItem} onClick={() => setOpen(false)}>
                Рабочее место
              </Link>
            )}
            <Link role="menuitem" href="/bookmarks" className={menuItem} onClick={() => setOpen(false)}>
              Закладки
            </Link>
            <Link role="menuitem" href="/settings" className={menuItem} onClick={() => setOpen(false)}>
              Настройки
            </Link>
            <button role="menuitem" type="button" onClick={logout} className={menuItem}>
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
