"use client";

// Фрагментное комментирование: выделение текста в прозе → плавающая кнопка «комментировать фрагмент».
// Резолвит выделение в ближайший [data-block-id] (+ [data-chapter-slug] для режима whole) и шлёт
// CustomEvent("recenza:comment-anchor") нужной секции комментариев. Капчур данных — на выделении
// (dataRef), чтобы клик по кнопке не зависел от состояния выделения. onMouseDown preventDefault —
// чтобы кнопка не сбрасывала выделение до клика.

import { useEffect, useRef, useState } from "react";

interface Resolved {
  chapterSlug: string;
  blockId: string;
  quote: string;
}

function resolveSelection(): Resolved | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const quote = sel.toString().trim();
  if (!quote) return null;
  const node = sel.anchorNode;
  const start: HTMLElement | null =
    node && node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : (node?.parentElement ?? null);
  const blockEl = start?.closest<HTMLElement>("[data-block-id]");
  const blockId = blockEl?.getAttribute("data-block-id");
  if (!blockEl || !blockId) return null;
  const chapterSlug = blockEl.closest<HTMLElement>("[data-chapter-slug]")?.getAttribute("data-chapter-slug");
  if (!chapterSlug) return null;
  return { chapterSlug, blockId, quote: quote.slice(0, 600) };
}

export function FragmentCommentButton({ enabled }: { enabled: boolean }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dataRef = useRef<Resolved | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function update() {
      const resolved = resolveSelection();
      const sel = window.getSelection();
      if (!resolved || !sel || sel.rangeCount === 0) {
        setPos(null);
        dataRef.current = null;
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPos(null);
        return;
      }
      dataRef.current = resolved;
      setPos({ x: rect.left + rect.width / 2, y: rect.top });
    }
    function hide() {
      setPos(null);
      dataRef.current = null;
    }
    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) hide();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") hide();
    }

    document.addEventListener("mouseup", update);
    document.addEventListener("keyup", update);
    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mouseup", update);
      document.removeEventListener("keyup", update);
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      document.removeEventListener("keydown", onKey);
    };
  }, [enabled]);

  if (!enabled || !pos) return null;

  function pick() {
    const data = dataRef.current;
    if (!data) return;
    window.dispatchEvent(new CustomEvent<Resolved>("recenza:comment-anchor", { detail: data }));
    window.getSelection()?.removeAllRanges();
    setPos(null);
    dataRef.current = null;
  }

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={pick}
      aria-label="Прокомментировать выделенный фрагмент"
      style={{
        position: "fixed",
        left: pos.x,
        top: Math.max(8, pos.y - 44),
        transform: "translateX(-50%)",
        zIndex: 50,
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--bg-elevated)] px-3 text-[length:var(--type-small)] font-medium text-[var(--accent)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      Комментировать
    </button>
  );
}
