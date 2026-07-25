// Клиент-безопасные константы блоков — БЕЗ импорта drizzle/схемы, чтобы редактор-клиент не тащил
// схему БД в бандл (@/types ре-экспортит ROLES/… из schema → серверный граф). Единый источник
// списка типов блоков и под-вариантов: отсюда импортируют @/types (re-export), валидатор, редактор.
//
// Поля под-типов должны совпадать с тем, что читает src/components/blocks/block-renderer.tsx:
//   list.variant ∈ LIST_VARIANTS · callout.variant ∈ CALLOUT_VARIANTS · code.lang ∈ CODE_LANGS.
// latex (Фаза 12): display-формула KaTeX в block.text; рендер — latex-block.tsx (RSC, renderToString).

import type { Complexity } from "@/types";

export const BLOCK_TYPES = [
  "p",
  "h2",
  "h3",
  "quote",
  "list",
  "code",
  "callout",
  "mermaid",
  "latex",
  "image",
  "table",
  "embed",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const LIST_VARIANTS = ["bullet", "numbered", "todo"] as const;
export type ListVariant = (typeof LIST_VARIANTS)[number];

// Порядок/значения как в CALLOUT_STYLES рендерера (default — "note").
export const CALLOUT_VARIANTS = ["note", "warning", "info"] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];

/**
 * Читательская подпись сложности блога (Фаза 14). Раньше сложность жила только в
 * `COMPLEXITY_TIERS` (validate.ts) и означала «сколько нужно ревьюеров» — с приходом заявок состав
 * ревьюеров не выбирается вообще, поэтому в UI осталась ЧИСТАЯ метка для читателя без чисел.
 *
 * Импорт типа — `import type` (стирается компилятором), клиент-безопасность файла сохраняется.
 */
export const COMPLEXITY_LABELS: Record<Complexity, string> = {
  simple: "Простая",
  medium: "Средняя",
  complex: "Сложная",
};

export const CODE_LANGS = [
  "ts",
  "js",
  "tsx",
  "jsx",
  "rs",
  "go",
  "py",
  "sh",
  "json",
  "yaml",
  "sql",
  "html",
  "css",
] as const;
export type CodeLang = (typeof CODE_LANGS)[number];
