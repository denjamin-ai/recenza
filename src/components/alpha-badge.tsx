"use client";

// Бейдж альфа-версии (пост-релизный полиш). Пилюля «Alpha» warning-тоном; с поповером
// (клик → карточка со статусом, закрытие по клику-вне/Escape — паттерн avatar-menu) или
// статично (withPopover=false — логин-страницы, админ-сайдбар). Без теней (frontend-design),
// только CSS-переменные; хит-таргет триггера ≥36px за счёт невизуального паддинга.

import { useEffect, useRef, useState } from "react";

export const ALPHA_COPY =
  "Recenza активно разрабатывается и тестируется, новые изменения на подходе.";

function Pill() {
  return (
    <span className="inline-flex select-none items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-1.5 py-[2px] text-[9.5px] font-bold uppercase leading-none tracking-[0.14em] text-[var(--warning)]">
      <span aria-hidden="true" className="h-1 w-1 rounded-[var(--radius-pill)] bg-current" />
      Alpha
    </span>
  );
}

export function AlphaBadge({ withPopover = true }: { withPopover?: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!withPopover) return <Pill />;

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="О статусе альфа-версии"
        aria-expanded={open}
        className="-my-2 inline-flex min-h-9 items-center rounded-[var(--radius-pill)] px-0.5 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <Pill />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Альфа-версия"
          className="absolute left-0 top-full z-50 mt-2 w-[264px] max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-3.5 text-left"
        >
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--warning)]">
            Альфа-версия
          </p>
          <p className="text-[12.5px] leading-relaxed text-[var(--foreground)] [text-wrap:pretty]">
            {ALPHA_COPY}
          </p>
        </div>
      )}
    </span>
  );
}
