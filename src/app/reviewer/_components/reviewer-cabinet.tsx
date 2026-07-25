"use client";

// Оболочка кабинета ревьюера (Фаза 14.6): плитки + три таба.
//
// Ф14 сменила модель: автор больше не приглашает — он оставляет ЗАЯВКУ, а ревьюер берёт её сам.
// Поэтому единственный экран-инбокс («Входящие приглашения» + «Активные ревью») распался на
// рабочее место с тремя состояниями работы: «Очередь» (чужие свободные заявки) → «Мои ревью»
// (взятое в работу) → «Завершённые» (кредит).
//
// Паттерн Ф13.5 (профиль): секции считает и рендерит RSC-страница, сюда они приходят готовыми
// ReactNode — клиентским остаётся только переключатель. Так табы не тянут в бандл ни запросы,
// ни серверные рендереры.

import { useState, type ReactNode } from "react";

type TabId = "queue" | "active" | "completed";

export interface CabinetTile {
  label: string;
  value: string;
  hint?: string;
}

export function ReviewerCabinet({
  displayName,
  tiles,
  queue,
  queueCount,
  active,
  activeCount,
  completed,
  completedCount,
}: {
  displayName: string;
  tiles: CabinetTile[];
  queue: ReactNode;
  queueCount: number;
  active: ReactNode;
  activeCount: number;
  completed: ReactNode;
  completedCount: number;
}) {
  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "queue", label: "Очередь", count: queueCount },
    { id: "active", label: "Мои ревью", count: activeCount },
    { id: "completed", label: "Завершённые", count: completedCount },
  ];
  const [tab, setTab] = useState<TabId>("queue");

  /**
   * Стрелки ←/→ (и Home/End) переключают табы — обязательная пара к roving tabindex:
   * иначе неактивные табы становятся недостижимыми с клавиатуры вовсе.
   */
  function onTabKey(e: React.KeyboardEvent, id: TabId) {
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
    document.getElementById(`reviewer-tab-${tabs[next].id}`)?.focus();
  }

  const tabCls = (isActive: boolean) =>
    `min-h-9 border-b-2 px-1 pb-2 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
      isActive
        ? "border-[var(--accent)] text-[var(--foreground)]"
        : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
    }`;

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <header>
        <h1>Кабинет ревьюера</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">{displayName} · Заявки и ревью</p>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4"
          >
            <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">{t.label}</p>
            <p className="mt-1 font-display text-[length:var(--type-h3)] text-[var(--foreground)]">{t.value}</p>
            {t.hint && (
              <p className="mt-0.5 text-[length:var(--type-small)] text-[var(--muted-foreground)]">{t.hint}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10">
        <div
          role="tablist"
          aria-label="Разделы кабинета ревьюера"
          className="flex flex-wrap gap-6 border-b border-[var(--border)]"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              // Roving tabindex (backlog Ф14 P3): в tablist по Tab заходит ТОЛЬКО активный таб,
              // между табами переключаются стрелками — иначе скринридер обходит их по одному.
              tabIndex={tab === t.id ? 0 : -1}
              onKeyDown={(e) => onTabKey(e, t.id)}
              id={`reviewer-tab-${t.id}`}
              aria-controls={`reviewer-panel-${t.id}`}
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={tabCls(tab === t.id)}
            >
              {t.label}
              <span className="ml-1.5 rounded-[var(--radius-pill)] bg-[var(--muted)] px-1.5 py-0.5 text-[0.7rem] tabular-nums text-[var(--muted-foreground)]">
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Панели рендерятся все, неактивные скрыты `hidden`: условный рендер размонтировал бы
            RSC-узел, и после claim'а `router.refresh()` пересобирал бы его с нуля. */}
        {tabs.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            id={`reviewer-panel-${t.id}`}
            aria-labelledby={`reviewer-tab-${t.id}`}
            hidden={tab !== t.id}
            className="mt-6"
          >
            {t.id === "queue" ? queue : t.id === "active" ? active : completed}
          </div>
        ))}
      </div>
    </div>
  );
}
