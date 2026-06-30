"use client";

// Авто-растущая textarea + инлайн-тулбар (B/I/Code/Link). На выделении показывает тулбар; кнопки
// оборачивают выделение в markdown (**, *, `, [..](url)) — чистые строковые операции (без execCommand).

import { useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from "react";

const SAFE_URL = /^(https?:\/\/|\/)/i;

export function MarkableTextarea({
  value,
  onChange,
  className = "",
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  value: string;
  onChange: (next: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [hasSel, setHasSel] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  function syncSel() {
    const el = ref.current;
    if (!el) return;
    setHasSel(el.selectionStart !== el.selectionEnd);
  }

  function wrap(before: string, after: string) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    if (s === e) return;
    const mid = value.slice(s, e);
    const next = value.slice(0, s) + before + mid + after + value.slice(e);
    onChange(next);
    setHasSel(false);
    // вернуть фокус и выделить с учётом добавленных символов
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, e + before.length);
    });
  }

  function link() {
    const el = ref.current;
    if (!el || el.selectionStart === el.selectionEnd) return;
    const url = window.prompt("URL ссылки");
    if (!url) return;
    if (!SAFE_URL.test(url)) {
      window.alert("Разрешён только http(s):// или относительный /путь.");
      return;
    }
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const label = value.slice(s, e);
    const next = value.slice(0, s) + `[${label}](${url})` + value.slice(e);
    onChange(next);
    setHasSel(false);
  }

  const btn =
    "flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-sm)] px-2 text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

  return (
    <div className="relative">
      {hasSel && (
        <div
          className="absolute -top-9 left-0 z-10 flex items-center gap-0.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5"
          role="toolbar"
          aria-label="Форматирование"
          onMouseDown={(e) => e.preventDefault()} // не терять выделение
        >
          <button type="button" className={`${btn} font-bold`} onClick={() => wrap("**", "**")} aria-label="Жирный">
            B
          </button>
          <button type="button" className={`${btn} italic`} onClick={() => wrap("*", "*")} aria-label="Курсив">
            I
          </button>
          <button type="button" className={`${btn} font-mono`} onClick={() => wrap("`", "`")} aria-label="Код">
            {"<>"}
          </button>
          <button type="button" className={btn} onClick={link} aria-label="Ссылка">
            🔗
          </button>
        </div>
      )}
      <textarea
        ref={ref}
        value={value}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        onSelect={syncSel}
        onMouseUp={syncSel}
        onKeyUp={syncSel}
        onBlur={() => setHasSel(false)}
        className={`w-full resize-none bg-transparent text-[var(--foreground)] outline-none ${className}`}
        {...rest}
      />
    </div>
  );
}
