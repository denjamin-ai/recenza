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

  /** Стрелки ←/→ и Home/End — пара к roving tabindex (без них неактивные табы недостижимы). */
  function onTabKey(e: React.KeyboardEvent, id: string) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === id);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[next].id);
  }

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
            // Roving tabindex (backlog Ф14 P3): Tab заходит только в активный таб, между табами — стрелки.
            tabIndex={active === t.id ? 0 : -1}
            onKeyDown={(e) => onTabKey(e, t.id)}
            id={`profile-tab-${t.id}`}
            aria-controls={`profile-panel-${t.id}`}
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
      {/* ⚠️ Все панели рендерятся в разметку, неактивные скрыты `hidden`. Условный рендер оставлял
          бы в HTML только активную — и ссылки на блоги автора исчезали бы из первичной разметки
          (профили лежат в sitemap, краулер приходил бы на страницу без единой ссылки на контент).
          Заодно у каждой панели свой id и корректная связка с кнопкой таба. */}
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`profile-panel-${t.id}`}
          aria-labelledby={`profile-tab-${t.id}`}
          hidden={active !== t.id}
          className="mt-6"
        >
          {t.id === "about" ? about : t.id === "blogs" ? blogs : review}
        </div>
      ))}
    </div>
  );
}
