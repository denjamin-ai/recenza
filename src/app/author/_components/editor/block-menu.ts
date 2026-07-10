// Группы меню вставки блоков (эталон — SLASH_GROUPS прототипа editor-blocks.jsx, адаптировано к
// реальным типам constants.ts: list/callout — через variant, latex — в «Спец.»). Единый источник
// для плюс-меню (AddBlock) и слэш-меню (SlashMenu): 4 категории, у пункта title + hint (шорткат).

import type { BlockType, ListVariant } from "@/lib/blocks/constants";

export interface BlockMenuItem {
  type: BlockType;
  variant?: ListVariant;
  title: string;
  hint: string;
}

export interface BlockMenuGroup {
  label: string;
  items: BlockMenuItem[];
}

export const BLOCK_MENU_GROUPS: BlockMenuGroup[] = [
  {
    label: "Текст",
    items: [
      { type: "p", title: "Параграф", hint: "обычный текст" },
      { type: "h2", title: "Заголовок 2", hint: "## " },
      { type: "h3", title: "Заголовок 3", hint: "### " },
      { type: "quote", title: "Цитата", hint: "> " },
    ],
  },
  {
    label: "Списки",
    items: [
      { type: "list", variant: "bullet", title: "Маркированный список", hint: "- " },
      { type: "list", variant: "numbered", title: "Нумерованный список", hint: "1. " },
      { type: "list", variant: "todo", title: "Чек-лист", hint: "[] " },
    ],
  },
  {
    label: "Блоки",
    items: [
      { type: "code", title: "Код", hint: "```" },
      { type: "callout", title: "Callout", hint: "> note:" },
      { type: "image", title: "Изображение", hint: "" },
      { type: "table", title: "Таблица", hint: "" },
    ],
  },
  {
    label: "Спец.",
    items: [
      { type: "mermaid", title: "Схема Mermaid", hint: "> mermaid:" },
      { type: "latex", title: "Формула LaTeX", hint: "$$" },
      { type: "embed", title: "Embed", hint: "" },
    ],
  },
];

const FLAT: BlockMenuItem[] = BLOCK_MENU_GROUPS.flatMap((g) => g.items);

/** Фильтр пунктов по запросу слэш-меню (title/hint/type), в порядке групп. */
export function filterMenuItems(query: string): BlockMenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return FLAT;
  return FLAT.filter(
    (m) => m.title.toLowerCase().includes(q) || m.hint.toLowerCase().includes(q) || m.type.includes(q),
  );
}

/** Группа пункта — для подписей категорий в сгруппированном рендере. */
export function groupOf(item: BlockMenuItem): string {
  return BLOCK_MENU_GROUPS.find((g) => g.items.includes(item))?.label ?? "";
}
