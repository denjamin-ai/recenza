// Якоря заголовков для ToC/deep-link. Блоки — структурированный JSON (НЕ markdown), поэтому
// rehype-slug не используется: id строится из стабильного block.id (ulid/seed — ASCII, без коллизий
// кириллицы). В режиме «Весь блог» добавляется prefix (slug главы) — уникальность при склейке глав.

/** id DOM-элемента блока: `block-<prefix>-<id>` или `block-<id>`. ToC и заголовок используют ОДИН источник. */
export function blockAnchorId(blockId: string, prefix?: string): string {
  return prefix ? `block-${prefix}-${blockId}` : `block-${blockId}`;
}

/** Человекочитаемый slug (для прочих `#`-фрагментов). Кириллица → как есть в lower-case, пробелы → дефис. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
