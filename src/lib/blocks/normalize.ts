// Канонизация блоков: editor working-shape → канонический Block, который читает block-renderer.tsx.
// ЕДИНСТВЕННАЯ точка, где лечится «дрейф имён полей» (PLAN §traps R5): прототип эмитит
// list.subtype / callout.tone / image.caption, а рендерер читает list.variant / callout.variant / image.alt.
// Изоморфно (клиент+сервер); ulid — только для проставления отсутствующего id (isomorphic).

import { ulid } from "ulid";
import type { Block } from "@/types";
import {
  BLOCK_TYPES,
  CALLOUT_VARIANTS,
  LIST_VARIANTS,
  type BlockType,
} from "./constants";

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function inList<T extends readonly string[]>(list: T, v: unknown): v is T[number] {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}

/**
 * Одна сырая запись → канонический Block (только релевантные поля, верные имена). null — мусор.
 * ⚠️ Неизвестный type МОЛЧА коэрсится в "p" (не отбрасывается). Для недоверенного ввода всегда
 * вызывай ПОСЛЕ validateBlocks() (она применяет allowlist BLOCK_TYPES) — иначе allowlist обходится.
 */
export function normalizeBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type: BlockType = inList(BLOCK_TYPES, r.type) ? r.type : "p";
  const id = typeof r.id === "string" && r.id ? r.id : ulid();
  const block: Block = { id, type };

  switch (type) {
    case "p":
    case "h2":
    case "h3":
    case "quote":
    case "mermaid":
      block.text = asString(r.text);
      break;
    case "callout":
      block.text = asString(r.text);
      // дрейф: tone → variant
      block.variant = inList(CALLOUT_VARIANTS, r.variant)
        ? r.variant
        : inList(CALLOUT_VARIANTS, r.tone)
          ? r.tone
          : "note";
      break;
    case "list":
      // дрейф: subtype → variant
      block.variant = inList(LIST_VARIANTS, r.variant)
        ? r.variant
        : inList(LIST_VARIANTS, r.subtype)
          ? r.subtype
          : "bullet";
      block.items = asStringArray(r.items);
      break;
    case "code":
      block.text = asString(r.text);
      block.lang = asString(r.lang);
      break;
    case "image":
      block.src = asString(r.src);
      // дрейф: caption → alt (если alt пуст)
      block.alt = asString(r.alt) || asString(r.caption);
      break;
    case "table": {
      const rows = Array.isArray(r.rows) ? (r.rows as unknown[]).map(asStringArray) : [];
      block.rows = rows;
      break;
    }
    case "embed":
      block.url = asString(r.url);
      break;
  }
  return block;
}

export function normalizeBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeBlock).filter((b): b is Block => b !== null);
}
