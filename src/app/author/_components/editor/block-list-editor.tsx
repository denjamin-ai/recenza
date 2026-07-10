"use client";

// Переиспользуемый редактор СПИСКА блоков (главы и портфолио). Владеет рендером рамок блоков,
// drag-reorder, слэш-меню, add/move/delete. Состояние blocks держит родитель; сюда — blocks + onChange.
// onChange отдаёт meta.structural=true для структурных правок (вставка/удаление/перестановка/замена
// типа) — родитель может триггерить автосейв (ui-feedback-3, П10), текстовые правки meta не несут.
// Меню вставки — сгруппированное (BLOCK_MENU_GROUPS), якорится к кнопке, закрывается по клику вне
// и Escape; слэш-меню — клавиатура ↑↓/Enter/Escape + active-подсветка (эталон editor-blocks.jsx).

import { useEffect, useRef, useState } from "react";
import { ulid } from "ulid";
import type { Block } from "@/types";
import type { BlockType, ListVariant } from "@/lib/blocks/constants";
import { BLOCK_MENU_GROUPS, filterMenuItems, type BlockMenuItem } from "./block-menu";
import { BLOCK_LABEL, BlockEditor } from "./block-editor";
import { SlashMenu } from "./slash-menu";
import { applyShortcut } from "./markdown";

export type BlocksChangeMeta = { structural?: boolean };

export function newBlock(type: BlockType, variant?: ListVariant): Block {
  const id = ulid();
  switch (type) {
    case "list":
      return { id, type, variant: variant ?? "bullet", items: [""] };
    case "code":
      return { id, type, text: "", lang: "ts" };
    case "callout":
      return { id, type, variant: "note", text: "" };
    case "image":
      return { id, type, src: "", alt: "" };
    case "table":
      return { id, type, rows: [["", ""], ["", ""]] };
    case "embed":
      return { id, type, url: "" };
    default:
      return { id, type, text: "" };
  }
}

function AddBlock({ onAdd }: { onAdd: (item: BlockMenuItem) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Клик вне меню и Escape закрывают попап (замечание владельца: раньше не закрывался).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Добавить блок"
        className="min-h-9 rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        + Блок
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Тип блока"
          className="absolute left-0 top-full z-30 mt-1 max-h-[min(420px,60vh)] w-64 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-2"
        >
          {BLOCK_MENU_GROUPS.map((g) => (
            <div key={g.label} className="mb-1 last:mb-0">
              <p aria-hidden="true" className="px-2 pb-0.5 pt-1 text-[0.65rem] uppercase tracking-wider text-[var(--muted-foreground)]">
                {g.label}
              </p>
              <ul>
                {g.items.map((item) => (
                  <li key={item.title}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onAdd(item);
                        setOpen(false);
                      }}
                      className="flex w-full items-baseline justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)] focus-visible:outline-none"
                    >
                      <span>{item.title}</span>
                      {item.hint && <span className="shrink-0 font-mono text-[0.65rem] text-[var(--muted-foreground)]">{item.hint}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Обёртка блока-параграфа со слэш-меню: владеет active-индексом, dismiss по Escape и клавиатурой. */
function SlashHost({
  block,
  onUpdate,
  onReplace,
}: {
  block: Block;
  onUpdate: (b: Block) => void;
  onReplace: (item: BlockMenuItem) => void;
}) {
  const [active, setActive] = useState(0);
  const [dismissedText, setDismissedText] = useState<string | null>(null);
  const [prevQuery, setPrevQuery] = useState("");

  const text = typeof block.text === "string" ? block.text : "";
  const open = block.type === "p" && text.startsWith("/") && dismissedText !== text;
  const query = open ? text.slice(1) : "";
  const matches = open ? filterMenuItems(query) : [];

  // Сброс подсветки при изменении запроса (adjust-during-render, не эффект) —
  // иначе active может выйти за пределы отфильтрованного списка.
  if (prevQuery !== query) {
    setPrevQuery(query);
    setActive(0);
  }

  return (
    <div
      className="relative"
      onKeyDownCapture={(e) => {
        if (!open || matches.length === 0) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive((a) => (a + 1) % matches.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive((a) => (a - 1 + matches.length) % matches.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          onReplace(matches[Math.min(active, matches.length - 1)]);
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDismissedText(text);
        }
      }}
    >
      <BlockEditor block={block} onChange={onUpdate} />
      {open && <SlashMenu matches={matches} active={active} onHover={setActive} onPick={onReplace} />}
    </div>
  );
}

export function BlockListEditor({
  blocks,
  onChange,
}: {
  blocks: Block[];
  onChange: (next: Block[], meta?: BlocksChangeMeta) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const structural: BlocksChangeMeta = { structural: true };
  const update = (id: string, b: Block) => {
    let typeChanged = false;
    const next = blocks.map((x) => {
      if (x.id !== id) return x;
      const applied = applyShortcut(b);
      typeChanged = applied.type !== x.type;
      return applied;
    });
    // markdown-шорткат сменил тип блока — та же структурная правка, что и через меню.
    onChange(next, typeChanged ? structural : undefined);
  };
  const replace = (id: string, item: BlockMenuItem) =>
    onChange(blocks.map((x) => (x.id === id ? { ...newBlock(item.type, item.variant), id } : x)), structural);
  const remove = (id: string) => onChange(blocks.filter((x) => x.id !== id), structural);
  const insertAfter = (index: number, item: BlockMenuItem) => {
    const next = [...blocks];
    next.splice(index + 1, 0, newBlock(item.type, item.variant));
    onChange(next, structural);
  };
  const swap = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next, structural);
  };
  const moveTo = (from: number, to: number) => {
    if (from === to) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next, structural);
  };

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) => (
        <div
          key={block.id}
          onDragOver={(e) => {
            if (dragIndex !== null) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null) moveTo(dragIndex, i);
            setDragIndex(null);
          }}
          className={`group relative rounded-[var(--radius-lg)] border p-3 focus-within:border-[var(--border)] ${
            dragIndex === i ? "border-[var(--accent)] opacity-60" : "border-[var(--border-secondary)]"
          }`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
              <span
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => setDragIndex(null)}
                aria-label="Перетащить блок"
                title="Перетащить"
                className="cursor-grab select-none text-[var(--muted-foreground)] active:cursor-grabbing"
              >
                ⠿
              </span>
              {BLOCK_LABEL[block.type]}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => swap(i, -1)}
                disabled={i === 0}
                aria-label="Поднять блок"
                className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span aria-hidden="true">▲</span>
              </button>
              <button
                type="button"
                onClick={() => swap(i, 1)}
                disabled={i === blocks.length - 1}
                aria-label="Опустить блок"
                className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span aria-hidden="true">▼</span>
              </button>
              <button
                type="button"
                onClick={() => remove(block.id)}
                aria-label="Удалить блок"
                className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          </div>
          <SlashHost block={block} onUpdate={(b) => update(block.id, b)} onReplace={(item) => replace(block.id, item)} />
          <div className="mt-2">
            <AddBlock onAdd={(item) => insertAfter(i, item)} />
          </div>
        </div>
      ))}

      {blocks.length === 0 && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-3">
          <p className="mb-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            Пустой документ. Добавьте первый блок.
          </p>
          <AddBlock onAdd={(item) => insertAfter(-1, item)} />
        </div>
      )}
    </div>
  );
}
