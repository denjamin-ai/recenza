"use client";

// Бейдж альфа-версии (пост-релизный полиш). Пилюля «Alpha» warning-тоном; с поповером
// (клик → карточка со статусом, закрытие по клику-вне/Escape — паттерн avatar-menu) или
// статично (withPopover=false). Без теней (frontend-design), только CSS-переменные.
// Поповер позиционируется fixed с прижимом к краям вьюпорта (на мобиле absolute left-0
// вылезал за экран); координаты считаются при открытии, скролл/резайз закрывают.

import { useEffect, useRef, useState } from "react";

export const ALPHA_COPY =
  "Recenza активно разрабатывается и тестируется, новые изменения на подходе.";

const POPOVER_WIDTH = 264;
const VIEWPORT_MARGIN = 8;

function Pill() {
  return (
    <span className="inline-flex select-none items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-1.5 py-[2px] text-[9.5px] font-bold uppercase leading-none tracking-[0.14em] text-[var(--warning)]">
      <span aria-hidden="true" className="h-1 w-1 rounded-[var(--radius-pill)] bg-current" />
      Alpha
    </span>
  );
}

export function AlphaBadge({ withPopover = true }: { withPopover?: boolean }) {
  // null = закрыт; иначе fixed-координаты, прижатые к вьюпорту.
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const open = pos !== null;

  function toggle() {
    if (pos) {
      setPos(null);
      return;
    }
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const left = Math.min(
      Math.max(r.left, VIEWPORT_MARGIN),
      window.innerWidth - width - VIEWPORT_MARGIN,
    );
    setPos({ top: r.bottom + 8, left, width });
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    // fixed-поповер не следует за триггером — при скролле/резайзе закрываем.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (!withPopover) return <Pill />;

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
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
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed z-50 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-3.5 text-left"
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
