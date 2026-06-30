"use client";

// Чип-инпут (навыки статьи / теги блога): Enter или «,» добавляют, Backspace в пустом — удаляет последний.

import { useState, type KeyboardEvent } from "react";

export function ChipInput({
  value,
  onChange,
  max,
  placeholder,
  ariaLabel,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
  placeholder?: string;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const t = raw.trim();
    if (!t || value.includes(t) || value.length >= max) {
      setDraft("");
      return;
    }
    onChange([...value, t]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] p-2">
      {value.map((chip) => (
        <span
          key={chip}
          className="flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--muted)] px-2 py-0.5 text-[length:var(--type-small)]"
        >
          {chip}
          <button
            type="button"
            onClick={() => onChange(value.filter((c) => c !== chip))}
            aria-label={`Удалить «${chip}»`}
            className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            ✕
          </button>
        </span>
      ))}
      {value.length < max && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-[var(--foreground)] outline-none"
        />
      )}
    </div>
  );
}
