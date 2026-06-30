"use client";

// Слэш-меню: когда параграф начинается с "/", показываем фильтруемый список типов блоков.
// Выбор заменяет параграф на блок выбранного типа (ChapterEditor).

import { BLOCK_TYPES, type BlockType } from "@/lib/blocks/constants";
import { BLOCK_LABEL } from "./block-editor";

export function SlashMenu({ query, onPick }: { query: string; onPick: (type: BlockType) => void }) {
  const q = query.trim().toLowerCase();
  const matches = BLOCK_TYPES.filter(
    (t) => !q || BLOCK_LABEL[t].toLowerCase().includes(q) || t.includes(q),
  );
  if (matches.length === 0) return null;

  return (
    <ul
      className="absolute z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-1"
      role="listbox"
      aria-label="Вставить блок"
    >
      {matches.map((t) => (
        <li key={t} role="option" aria-selected={false}>
          <button
            type="button"
            onClick={() => onPick(t)}
            className="w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[length:var(--type-small)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {BLOCK_LABEL[t]}
          </button>
        </li>
      ))}
    </ul>
  );
}
