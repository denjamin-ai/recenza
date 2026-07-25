"use client";

// Клиентская оболочка табов профиля (Ф13.5: «О себе» · «Блоги (N)» · «Ревью (N)»).
// Контент панелей — RSC-узлы, приходят пропсами (BlockRenderer серверный, в клиенте не рендерится).
//
// Таб «Ревью» — решение владельца (реверс прототипа, который унёс ревью-активность в приватное):
// ревью-активность публична. Показывается только у аккаунта с возможностью «ревьюер».

import { useState, type ReactNode } from "react";

type TabId = "about" | "blogs" | "review";

export function ProfileTabs({
  about,
  blogs,
  blogsCount,
  review,
  reviewCount,
  showReviewTab,
}: {
  about: ReactNode;
  blogs: ReactNode;
  blogsCount: number;
  review: ReactNode;
  reviewCount: number;
  showReviewTab: boolean;
}) {
  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "about", label: "О себе" },
    ...(blogsCount > 0 ? [{ id: "blogs" as const, label: "Блоги", count: blogsCount }] : []),
    ...(showReviewTab ? [{ id: "review" as const, label: "Ревью", count: reviewCount }] : []),
  ];
  const [tab, setTab] = useState<TabId>("about");
  const active = tabs.some((t) => t.id === tab) ? tab : "about";

  const tabCls = (isActive: boolean) =>
    `min-h-9 border-b-2 px-1 pb-2 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
      isActive
        ? "border-[var(--accent)] text-[var(--foreground)]"
        : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
    }`;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Разделы профиля"
        className="flex flex-wrap gap-6 border-b border-[var(--border)]"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`profile-tab-${t.id}`}
            aria-controls="profile-panel"
            aria-selected={active === t.id}
            onClick={() => setTab(t.id)}
            className={tabCls(active === t.id)}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="ml-1.5 rounded-[var(--radius-pill)] bg-[var(--muted)] px-1.5 py-0.5 text-[0.7rem] tabular-nums text-[var(--muted-foreground)]">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="profile-panel"
        aria-labelledby={`profile-tab-${active}`}
        className="mt-6"
      >
        {active === "about" ? about : active === "blogs" ? blogs : review}
      </div>
    </div>
  );
}
