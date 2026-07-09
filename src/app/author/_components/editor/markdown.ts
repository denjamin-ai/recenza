// Markdown-шорткаты в начале параграфа → смена типа блока (как в прототипе; $$ → latex с Фазы 12).
// Применяется в ChapterEditor.updateBlock к блокам типа "p".

import type { Block } from "@/types";
import type { BlockType } from "@/lib/blocks/constants";

export interface ShortcutResult {
  type: BlockType;
  text?: string;
  variant?: string;
  items?: string[];
}

export function detectShortcut(value: string): ShortcutResult | null {
  if (value.startsWith("## ")) return { type: "h2", text: value.slice(3) };
  if (value.startsWith("### ")) return { type: "h3", text: value.slice(4) };
  if (/^>\s?note:/i.test(value)) return { type: "callout", variant: "note", text: value.replace(/^>\s?note:\s?/i, "") };
  if (/^>\s?warning:/i.test(value)) return { type: "callout", variant: "warning", text: value.replace(/^>\s?warning:\s?/i, "") };
  if (/^>\s?info:/i.test(value)) return { type: "callout", variant: "info", text: value.replace(/^>\s?info:\s?/i, "") };
  if (/^>\s?mermaid:/i.test(value)) return { type: "mermaid", text: "" };
  if (value.startsWith("> ")) return { type: "quote", text: value.slice(2) };
  if (value.startsWith("```")) return { type: "code", text: "" };
  if (value.startsWith("$$")) return { type: "latex", text: value.slice(2).trim() };
  if (value.startsWith("- ")) return { type: "list", variant: "bullet", items: [value.slice(2)] };
  if (/^\d+\.\s/.test(value)) return { type: "list", variant: "numbered", items: [value.replace(/^\d+\.\s/, "")] };
  if (value.startsWith("[] ")) return { type: "list", variant: "todo", items: [value.slice(3)] };
  return null;
}

/** Применяет шорткат к p-блоку, сохраняя id. Возвращает преобразованный блок или исходный. */
export function applyShortcut(block: Block): Block {
  if (block.type !== "p" || typeof block.text !== "string") return block;
  const s = detectShortcut(block.text);
  if (!s) return block;
  const next: Block = { id: block.id, type: s.type };
  if (s.text !== undefined) next.text = s.text;
  if (s.variant !== undefined) next.variant = s.variant;
  if (s.items !== undefined) next.items = s.items;
  return next;
}
