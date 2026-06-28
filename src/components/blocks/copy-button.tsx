"use client";

// Кнопка копирования кода. Единственный клиентский кусок код-блока (подсветка — на сервере).

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard недоступен — молча игнорируем */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Скопировано" : "Скопировать код"}
      title={copied ? "Скопировано" : "Скопировать"}
      className="absolute right-2 top-2 inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] opacity-0 transition-opacity hover:text-[var(--foreground)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] group-hover:opacity-100"
    >
      <span aria-hidden="true">{copied ? "✓" : "Копировать"}</span>
    </button>
  );
}
