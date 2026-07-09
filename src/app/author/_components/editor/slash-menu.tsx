"use client";

// Слэш-меню: когда параграф начинается с "/", показываем сгруппированный фильтруемый список типов
// блоков (BLOCK_MENU_GROUPS). Управляемое: активный пункт (клавиатура ↑↓/Enter в SlashHost) приходит
// пропсом; выбор мышью — onMouseDown+preventDefault, чтобы textarea не теряла фокус.

import { groupOf, type BlockMenuItem } from "./block-menu";

export function SlashMenu({
  matches,
  active,
  onHover,
  onPick,
}: {
  matches: BlockMenuItem[];
  active: number;
  onHover: (index: number) => void;
  onPick: (item: BlockMenuItem) => void;
}) {
  if (matches.length === 0) return null;

  return (
    <ul
      className="absolute z-20 mt-1 max-h-64 w-64 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-1"
      role="listbox"
      aria-label="Вставить блок"
    >
      {matches.map((m, i) => {
        const group = groupOf(m);
        const showGroup = i === 0 || groupOf(matches[i - 1]) !== group;
        return (
          <li key={`${m.type}-${m.variant ?? ""}`} role="option" aria-selected={i === active}>
            {showGroup && (
              <p aria-hidden="true" className="px-2 pb-0.5 pt-1.5 text-[0.65rem] uppercase tracking-wider text-[var(--muted-foreground)]">
                {group}
              </p>
            )}
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => onHover(i)}
              onClick={() => onPick(m)}
              className={`flex w-full items-baseline justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[length:var(--type-small)] transition-colors ${
                i === active ? "bg-[var(--muted)] text-[var(--foreground)]" : "text-[var(--foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              <span>{m.title}</span>
              {m.hint && <span className="shrink-0 font-mono text-[0.65rem] text-[var(--muted-foreground)]">{m.hint}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
