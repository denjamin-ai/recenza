// Plain-text экстрактор из блоков для SEO-описаний/OG (правило mdx-components: стрип кода/HTML).
// Пропускает не-текстовые/технические блоки (code/embed/mermaid/image); склеивает текст абзацев,
// заголовков, списков, цитат, ячеек таблиц, callout. Результат нормализуется/обрезается в seo.truncate.

import type { Block } from "@/types";

const SKIP: ReadonlySet<string> = new Set(["code", "embed", "mermaid", "image"]);

export function extractPlainText(blocks: Block[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    if (SKIP.has(block.type)) continue;

    if (typeof block.text === "string" && block.text.trim()) {
      parts.push(block.text);
    }

    if (block.type === "list" && Array.isArray(block.items)) {
      for (const item of block.items) {
        if (typeof item === "string") parts.push(item);
      }
    }

    if (block.type === "table" && Array.isArray(block.rows)) {
      for (const row of block.rows as unknown[]) {
        if (Array.isArray(row)) {
          for (const cell of row) if (typeof cell === "string") parts.push(cell);
        }
      }
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}
