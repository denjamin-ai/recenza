// Клиент-безопасные константы блоков — БЕЗ импорта drizzle/схемы, чтобы редактор-клиент не тащил
// схему БД в бандл (@/types ре-экспортит ROLES/… из schema → серверный граф). Единый источник
// списка типов блоков и под-вариантов: отсюда импортируют @/types (re-export), валидатор, редактор.
//
// Поля под-типов должны совпадать с тем, что читает src/components/blocks/block-renderer.tsx:
//   list.variant ∈ LIST_VARIANTS · callout.variant ∈ CALLOUT_VARIANTS · code.lang ∈ CODE_LANGS.
// LaTeX в Фазе 6 НЕ поддержан (рендерер не умеет) — в BLOCK_TYPES его нет (PLAN §decisions).

export const BLOCK_TYPES = [
  "p",
  "h2",
  "h3",
  "quote",
  "list",
  "code",
  "callout",
  "mermaid",
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
