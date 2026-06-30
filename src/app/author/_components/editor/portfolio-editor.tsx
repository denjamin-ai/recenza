"use client";

// Редактор портфолио «Об авторе» (Фаза 6): мини-статья из блоков + флаг видимости. БЕЗ ревью —
// PUT /api/author/portfolio публикует сразу. Переиспользует BlockListEditor.

import { useState } from "react";
import Link from "next/link";
import type { Block } from "@/types";
import { BlockListEditor } from "./block-list-editor";

export function PortfolioEditor({
  initialBlocks,
  initialVisible,
}: {
  initialBlocks: Block[];
  initialVisible: boolean;
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [visible, setVisible] = useState(initialVisible);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/author/portfolio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks, visible }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      setSavedAt(Math.floor(Date.now() / 1000));
    } else {
      setError(data.error ?? "Не удалось сохранить.");
    }
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg)] px-6 py-3">
        <Link
          href="/author"
          className="rounded-[var(--radius-sm)] text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          ← Кабинет
        </Link>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dirty ? "bg-[var(--warning)]" : "bg-[var(--success)]"}`} />
            {dirty ? "не сохранено" : savedAt ? "сохранено" : "нет изменений"}
          </span>
          <button
            type="button"
            onClick={() => {
              setVisible((v) => !v);
              setDirty(true);
            }}
            aria-pressed={visible}
            className={`min-h-9 rounded-[var(--radius-sm)] border px-3 py-1.5 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              visible ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {visible ? "Видно всем" : "Скрыто"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="min-h-9 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-1.5 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[var(--max-article)] px-6 py-8">
        <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Об авторе · публикуется сразу, без ревью
        </p>
        <h1 className="mt-2 text-[length:var(--type-h1)] font-[var(--weight-h1)] leading-tight">Об авторе</h1>
        {error && (
          <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]">
            {error}
          </p>
        )}
        <div className="mt-6">
          <BlockListEditor
            blocks={blocks}
            onChange={(next) => {
              setBlocks(next);
              setDirty(true);
            }}
          />
        </div>
      </div>
    </div>
  );
}
