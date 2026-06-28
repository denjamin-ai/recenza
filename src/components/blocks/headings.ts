// Извлечение оглавления (h2/h3) из блоков для ToC. Id согласован с заголовком в BlockRenderer
// (через blockAnchorId) — ToC и заголовок ссылаются на ОДИН источник.

import type { Block } from "@/types";
import { blockAnchorId } from "./anchors";

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function extractHeadings(blocks: Block[], prefix?: string): Heading[] {
  const out: Heading[] = [];
  for (const block of blocks) {
    if ((block.type === "h2" || block.type === "h3") && typeof block.text === "string") {
      out.push({
        id: blockAnchorId(block.id, prefix),
        text: block.text,
        level: block.type === "h2" ? 2 : 3,
      });
    }
  }
  return out;
}
