"use client";

// Клиентская оболочка табов профиля автора (Об авторе · Блоги). Контент панелей — RSC-узлы,
// приходят как children (BlockRenderer — серверный, его нельзя рендерить в клиентском компоненте).

import { useState, type ReactNode } from "react";

export function ProfileTabs({
  hasAbout,
  about,
  blogs,
  blogsCount,
}: {
  hasAbout: boolean;
  about: ReactNode;
  blogs: ReactNode;
  blogsCount?: number;
}) {
  const [tab, setTab] = useState<"about" | "blogs">(hasAbout ? "about" : "blogs");

  if (!hasAbout) return <>{blogs}</>;

  const tabCls = (active: boolean) =>
    `min-h-9 border-b-2 px-1 pb-2 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
      active ? "border-[var(--accent)] text-[var(--foreground)]" : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
    }`;

  return (
    <div>
      <div role="tablist" aria-label="Разделы профиля" className="flex gap-6 border-b border-[var(--border)]">
        <button
          type="button"
          role="tab"
          id="profile-tab-about"
          aria-controls="profile-panel"
          aria-selected={tab === "about"}
          onClick={() => setTab("about")}
          className={tabCls(tab === "about")}
        >
          Об авторе
        </button>
        <button
          type="button"
          role="tab"
          id="profile-tab-blogs"
          aria-controls="profile-panel"
          aria-selected={tab === "blogs"}
          onClick={() => setTab("blogs")}
          className={tabCls(tab === "blogs")}
        >
          Блоги
          {typeof blogsCount === "number" && (
            <span className="ml-1.5 rounded-[var(--radius-pill)] bg-[var(--muted)] px-1.5 py-0.5 text-[0.7rem] tabular-nums text-[var(--muted-foreground)]">
              {blogsCount}
            </span>
          )}
        </button>
      </div>
      <div
        role="tabpanel"
        id="profile-panel"
        aria-labelledby={tab === "about" ? "profile-tab-about" : "profile-tab-blogs"}
        className="mt-6"
      >
        {tab === "about" ? about : blogs}
      </div>
    </div>
  );
}
