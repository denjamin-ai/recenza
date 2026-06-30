"use client";

// Переиспользуемый редактор СПИСКА блоков (главы и портфолио). Владеет рендером рамок блоков,
// drag-reorder, слэш-меню, add/move/delete. Состояние blocks держит родитель; сюда — blocks + onChange.

import { useState } from "react";
import { ulid } from "ulid";
import type { Block } from "@/types";
import { BLOCK_TYPES, type BlockType } from "@/lib/blocks/constants";
import { BLOCK_LABEL, BlockEditor } from "./block-editor";
import { SlashMenu } from "./slash-menu";
import { applyShortcut } from "./markdown";

export function newBlock(type: BlockType): Block {
  const id = ulid();
  switch (type) {
    case "list":
      return { id, type, variant: "bullet", items: [""] };
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

function AddBlock({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
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
        <ul
          className="absolute z-10 mt-1 grid w-56 grid-cols-2 gap-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-2"
          role="menu"
        >
          {BLOCK_TYPES.map((t) => (
            <li key={t}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAdd(t);
                  setOpen(false);
                }}
                className="w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[length:var(--type-small)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {BLOCK_LABEL[t]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BlockListEditor({
  blocks,
  onChange,
}: {
  blocks: Block[];
  onChange: (next: Block[]) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const update = (id: string, b: Block) => onChange(blocks.map((x) => (x.id === id ? applyShortcut(b) : x)));
  const replace = (id: string, type: BlockType) => onChange(blocks.map((x) => (x.id === id ? { ...newBlock(type), id } : x)));
  const remove = (id: string) => onChange(blocks.filter((x) => x.id !== id));
  const insertAfter = (index: number, type: BlockType) => {
    const next = [...blocks];
    next.splice(index + 1, 0, newBlock(type));
    onChange(next);
  };
  const swap = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const moveTo = (from: number, to: number) => {
    if (from === to) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
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
          <div className="relative">
            <BlockEditor block={block} onChange={(b) => update(block.id, b)} />
            {block.type === "p" && typeof block.text === "string" && block.text.startsWith("/") && (
              <SlashMenu query={block.text.slice(1)} onPick={(t) => replace(block.id, t)} />
            )}
          </div>
          <div className="mt-2">
            <AddBlock onAdd={(t) => insertAfter(i, t)} />
          </div>
        </div>
      ))}

      {blocks.length === 0 && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-6 text-center">
          <p className="mb-3 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            Пустой документ. Добавьте первый блок.
          </p>
          <AddBlock onAdd={(t) => insertAfter(-1, t)} />
        </div>
      )}
    </div>
  );
}
