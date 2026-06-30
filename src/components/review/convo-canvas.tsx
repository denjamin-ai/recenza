// Колонка статьи ReviewPage (Фаза 7). Статья = серверный <BlockRenderer mode="review"> приходит
// пропом `article` (единый рендерер, идентичный ридеру). Поверх — клиентский оверлей: маркеры тредов
// (Bauble) у каждого блока (позиционируются измерением [data-block-id]) + плавающий тулбар выделения
// «Прокомментировать». Скролл+вспышка блока — по активному треду/маркеру.
"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ReviewThread } from "@/lib/queries/review";
import { Bauble } from "./review-primitives";

interface BaublePos {
  blockId: string;
  top: number;
  threads: ReviewThread[];
}

interface RawSelection {
  blockId: string;
  quote: string;
  top: number;
  left: number;
}

export function ConvoCanvas({
  article,
  threadsByBlock,
  activeBlockId,
  flashKey,
  canComment,
  onPickBauble,
  onComment,
  scrollRef,
}: {
  article: ReactNode;
  threadsByBlock: Map<string, ReviewThread[]>;
  activeBlockId: string | null;
  /** Бамп → перескролл+вспышка активного блока (даже при повторном клике по тому же). */
  flashKey: number;
  canComment: boolean;
  onPickBauble: (blockId: string) => void;
  onComment: (blockId: string, quote: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [positions, setPositions] = useState<BaublePos[]>([]);
  const [rawSel, setRawSel] = useState<RawSelection | null>(null);

  // Измеряем top каждого блока с тредами относительно контент-обёртки.
  const measure = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    const contentTop = content.getBoundingClientRect().top;
    const next: BaublePos[] = [];
    for (const [blockId, threads] of threadsByBlock) {
      const el = content.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`);
      if (!el) continue;
      const top = el.getBoundingClientRect().top - contentTop;
      next.push({ blockId, top, threads });
    }
    setPositions(next);
  }, [threadsByBlock]);

  // Перемер при изменении набора блоков-с-тредами (measure зависит от threadsByBlock);
  // изменения высоты блоков (после apply) ловит ResizeObserver ниже.
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(content);
    window.addEventListener("resize", measure);
    // Шрифты (serif) дозагружаются → пересчёт после готовности.
    document.fonts?.ready.then(() => measure()).catch(() => {});
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // Скролл + вспышка активного блока.
  useEffect(() => {
    if (!activeBlockId) return;
    const content = contentRef.current;
    const el = content?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(activeBlockId)}"]`);
    if (!el) return;
    el.classList.remove("blog-fragment-flash");
    // reflow для перезапуска анимации
    void el.offsetWidth;
    el.classList.add("blog-fragment-flash");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = window.setTimeout(() => el.classList.remove("blog-fragment-flash"), 1300);
    return () => window.clearTimeout(t);
  }, [activeBlockId, flashKey]);

  // Захват выделения текста внутри статьи → плавающий тулбар.
  useEffect(() => {
    if (!canComment) return;
    function onUp(e: Event) {
      const target = e.target as Element | null;
      if (target?.closest?.("[data-selection-toolbar]")) return; // клик по тулбару не сбрасывает выделение
      const sel = window.getSelection();
      const content = contentRef.current;
      if (!sel || sel.isCollapsed || !content) {
        setRawSel(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const node = (range.startContainer.parentElement as Element | null)?.closest("[data-block-id]");
      if (!node || !content.contains(node)) {
        setRawSel(null);
        return;
      }
      const quote = sel.toString().trim();
      if (!quote) {
        setRawSel(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setRawSel({
        blockId: (node as HTMLElement).dataset.blockId ?? "",
        quote,
        top: rect.top - 44,
        left: rect.left + rect.width / 2,
      });
    }
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
    };
  }, [canComment]);

  const commitComment = () => {
    if (!rawSel) return;
    onComment(rawSel.blockId, rawSel.quote);
    setRawSel(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div ref={scrollRef} className="relative h-full overflow-y-auto bg-[var(--background)] px-4 py-6 sm:px-6">
      <div ref={contentRef} className="relative mx-auto max-w-[var(--max-content)]">
        {/* Колонка статьи (серверный рендер) с правым полем под маркеры. */}
        <article className="prose-review pr-12">{article}</article>

        {/* Оверлей маркеров тредов. */}
        <div className="pointer-events-none absolute inset-0">
          {positions.map((p) => (
            <div key={p.blockId} className="absolute right-0" style={{ top: p.top }}>
              <span className="pointer-events-auto">
                <Bauble
                  threads={p.threads}
                  active={activeBlockId === p.blockId}
                  onClick={() => onPickBauble(p.blockId)}
                />
              </span>
            </div>
          ))}
        </div>
      </div>

      {rawSel && (
        <div
          data-selection-toolbar=""
          style={{ position: "fixed", top: rawSel.top, left: rawSel.left, transform: "translateX(-50%)", zIndex: 60 }}
          className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-1"
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={commitComment}
            onTouchEnd={(e) => {
              e.preventDefault();
              commitComment();
            }}
            className="inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-[length:var(--type-small)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Прокомментировать
          </button>
        </div>
      )}
    </div>
  );
}
