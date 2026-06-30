"use client";

// Редактор одного блока (Фаза 6, S5): поля по типу с КАНОНИЧЕСКИМИ именами (variant/items/alt/rows/url),
// которые читает block-renderer.tsx. Текстовые поля хранят сырой markdown (инлайн-тулбар — S6).

import type { Block } from "@/types";
import { CALLOUT_VARIANTS, CODE_LANGS, LIST_VARIANTS, type BlockType } from "@/lib/blocks/constants";
import { AutoTextarea } from "./auto-textarea";
import { MarkableTextarea } from "./markable-textarea";

export const BLOCK_LABEL: Record<BlockType, string> = {
  p: "Параграф",
  h2: "Заголовок 2",
  h3: "Заголовок 3",
  quote: "Цитата",
  list: "Список",
  code: "Код",
  callout: "Callout",
  mermaid: "Схема Mermaid",
  image: "Изображение",
  table: "Таблица",
  embed: "Embed",
};

const CALLOUT_LABEL: Record<string, string> = { note: "Заметка", warning: "Важно", info: "Инфо" };
const LIST_LABEL: Record<string, string> = { bullet: "Маркированный", numbered: "Нумерованный", todo: "Чек-лист" };

const selectCls =
  "rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1 text-[length:var(--type-small)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
const inputCls =
  "w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asItems(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function asRows(v: unknown): string[][] {
  return Array.isArray(v) ? v.map((r) => (Array.isArray(r) ? r.filter((c): c is string => typeof c === "string") : [])) : [];
}

export function BlockEditor({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  const set = (patch: Partial<Block>) => onChange({ ...block, ...patch });

  switch (block.type) {
    case "h2":
    case "h3":
      return (
        <input
          value={asString(block.text)}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="Заголовок раздела"
          aria-label={BLOCK_LABEL[block.type]}
          className={`${inputCls} ${block.type === "h2" ? "text-[length:var(--type-h3)] font-semibold" : "font-medium"}`}
        />
      );
    case "p":
      return (
        <MarkableTextarea
          value={asString(block.text)}
          onChange={(v) => set({ text: v })}
          placeholder='Текст. "/" — типы блоков; **жирный**, *курсив*, `код`, ## — шорткаты'
          aria-label="Параграф"
          className="leading-[var(--leading-body)]"
        />
      );
    case "quote":
      return (
        <MarkableTextarea
          value={asString(block.text)}
          onChange={(v) => set({ text: v })}
          placeholder="Текст цитаты"
          aria-label="Цитата"
          className="border-l-2 border-[var(--accent)] pl-3 italic text-[var(--muted-foreground)]"
        />
      );
    case "callout":
      return (
        <div className="flex flex-col gap-2">
          <select
            value={asString(block.variant) || "note"}
            onChange={(e) => set({ variant: e.target.value })}
            aria-label="Тип callout"
            className={selectCls}
          >
            {CALLOUT_VARIANTS.map((v) => (
              <option key={v} value={v}>
                {CALLOUT_LABEL[v]}
              </option>
            ))}
          </select>
          <MarkableTextarea
            value={asString(block.text)}
            onChange={(v) => set({ text: v })}
            placeholder="Текст выноски"
            aria-label="Текст callout"
          />
        </div>
      );
    case "code":
      return (
        <div className="flex flex-col gap-2">
          <select
            value={asString(block.lang) || "ts"}
            onChange={(e) => set({ lang: e.target.value })}
            aria-label="Язык кода"
            className={selectCls}
          >
            {CODE_LANGS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <AutoTextarea
            value={asString(block.text)}
            onChange={(e) => set({ text: e.target.value })}
            placeholder="// код"
            aria-label="Код"
            spellCheck={false}
            className="rounded-[var(--radius-sm)] bg-[var(--bg-secondary)] p-3 font-mono text-[length:var(--type-small)]"
          />
        </div>
      );
    case "mermaid":
      return (
        <div className="flex flex-col gap-1">
          <AutoTextarea
            value={asString(block.text)}
            onChange={(e) => set({ text: e.target.value })}
            placeholder="graph TD; A--&gt;B;"
            aria-label="Mermaid-схема"
            spellCheck={false}
            className="rounded-[var(--radius-sm)] bg-[var(--bg-secondary)] p-3 font-mono text-[length:var(--type-small)]"
          />
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            Превью схемы появляется в ридере.
          </p>
        </div>
      );
    case "list":
      return (
        <div className="flex flex-col gap-2">
          <select
            value={asString(block.variant) || "bullet"}
            onChange={(e) => set({ variant: e.target.value })}
            aria-label="Тип списка"
            className={selectCls}
          >
            {LIST_VARIANTS.map((v) => (
              <option key={v} value={v}>
                {LIST_LABEL[v]}
              </option>
            ))}
          </select>
          <AutoTextarea
            value={asItems(block.items).join("\n")}
            onChange={(e) => set({ items: e.target.value.split("\n") })}
            placeholder={"Пункт списка\nЕщё пункт"}
            aria-label="Пункты списка (по строке на пункт)"
          />
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">Один пункт — одна строка.</p>
        </div>
      );
    case "image":
      return (
        <div className="flex flex-col gap-2">
          <input
            value={asString(block.src)}
            onChange={(e) => set({ src: e.target.value })}
            placeholder="/uploads/articles/…"
            aria-label="Путь изображения"
            className={inputCls}
          />
          <input
            value={asString(block.alt)}
            onChange={(e) => set({ alt: e.target.value })}
            placeholder="Альтернативный текст (alt)"
            aria-label="Alt изображения"
            className={inputCls}
          />
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            Разрешён только путь, начинающийся с /uploads/.
          </p>
        </div>
      );
    case "table":
      return (
        <div className="flex flex-col gap-1">
          <AutoTextarea
            value={asRows(block.rows)
              .map((r) => r.join(" | "))
              .join("\n")}
            onChange={(e) =>
              set({
                rows: e.target.value.split("\n").map((line) => line.split("|").map((c) => c.trim())),
              })
            }
            placeholder={"Заголовок 1 | Заголовок 2\nЯчейка | Ячейка"}
            aria-label="Таблица (строки; ячейки через |)"
            spellCheck={false}
            className="font-mono text-[length:var(--type-small)]"
          />
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            Первая строка — заголовок; ячейки разделяйте «|».
          </p>
        </div>
      );
    case "embed":
      return (
        <input
          value={asString(block.url)}
          onChange={(e) => set({ url: e.target.value })}
          placeholder="https://…"
          aria-label="URL для embed"
          className={inputCls}
        />
      );
    default:
      return null;
  }
}
