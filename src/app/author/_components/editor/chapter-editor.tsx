"use client";

// Редактор главы (Variant B, S5-ядро): чистый документ — заголовок + блоки + явное сохранение.
// RSC грузит черновик → этот клиент правит → PATCH /api/author/chapters/[id]. Слэш-меню/markdown-шорткаты/
// инлайн-тулбар/настройки/SubmitSheet добавляются в S6 поверх этого ядра.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ulid } from "ulid";
import type { Block } from "@/types";
import type { EditorChapter } from "@/lib/queries/author";
import { BLOCK_TYPES, type BlockType } from "@/lib/blocks/constants";
import { AutoTextarea } from "./auto-textarea";
import { BLOCK_LABEL, BlockEditor } from "./block-editor";

function newBlock(type: BlockType): Block {
  const id = ulid();
  switch (type) {
    case "list":
      return { id, type, variant: "bullet", items: [""] };
    case "code":
      return { id, type, text: "", lang: "ts" };
    case "callout":
      return { id, type, variant: "note", text: "" };
    case "image":
      return { id, type, src: "", alt: "" };
    case "table":
      return { id, type, rows: [["", ""], ["", ""]] };
    case "embed":
      return { id, type, url: "" };
    default:
      return { id, type, text: "" };
  }
}

function SaveState({ dirty, savedAt }: { dirty: boolean; savedAt: number | null }) {
  return (
    <span className="flex items-center gap-1.5 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${dirty ? "bg-[var(--warning)]" : "bg-[var(--success)]"}`}
      />
      {dirty ? "не сохранено" : savedAt ? "сохранено" : "нет изменений"}
    </span>
  );
}

function AddBlock({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Добавить блок"
        className="min-h-9 rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        + Блок
      </button>
      {open && (
        <ul
          className="absolute z-10 mt-1 grid w-56 grid-cols-2 gap-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-2"
          role="menu"
        >
          {BLOCK_TYPES.map((t) => (
            <li key={t}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onAdd(t);
                  setOpen(false);
                }}
                className="w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[length:var(--type-small)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {BLOCK_LABEL[t]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ChapterEditor({ data }: { data: EditorChapter }) {
  const editable = data.revision.status === "draft" || data.revision.status === "changes-requested";
  const [title, setTitle] = useState(data.chapter.title);
  const [blocks, setBlocks] = useState<Block[]>(data.revision.blocks);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const markDirty = () => {
    setDirty(true);
    setError(null);
  };

  const updateBlock = (id: string, b: Block) => {
    setBlocks((prev) => prev.map((x) => (x.id === id ? b : x)));
    markDirty();
  };
  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((x) => x.id !== id));
    markDirty();
  };
  const insertAfter = (index: number, type: BlockType) => {
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, newBlock(type));
      return next;
    });
    markDirty();
  };
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    setBlocks((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    markDirty();
  };

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/author/chapters/${data.chapter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, blocks }),
      });
      const json = (await res.json().catch(() => ({}))) as { savedAt?: number; error?: string };
      if (res.ok) {
        setDirty(false);
        setSavedAt(json.savedAt ?? Math.floor(Date.now() / 1000));
      } else {
        setError(json.error ?? "Не удалось сохранить.");
      }
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setSaving(false);
    }
  }, [saving, data.chapter.id, title, blocks]);

  // Ctrl/Cmd+S.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (editable) void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, editable]);

  return (
    <div className="min-h-screen">
      {/* Топбар */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg)] px-6 py-3">
        <Link
          href={`/author/blog/${data.blog.slug}`}
          className="rounded-[var(--radius-sm)] text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          ← Кабинет
        </Link>
        <div className="flex items-center gap-3">
          <SaveState dirty={dirty} savedAt={savedAt} />
          <Link
            href={`/author/blog/${data.blog.slug}/${data.chapter.slug}/preview`}
            className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[length:var(--type-small)] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Просмотр
          </Link>
          {editable && (
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving}
              className="min-h-9 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-1.5 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              {saving ? "Сохраняем…" : "Сохранить"}
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[var(--max-article)] px-6 py-8">
        {/* Хлебные крошки */}
        <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          {data.blog.title} ·{" "}
          {data.revision.status === "draft"
            ? "черновик"
            : data.revision.status === "changes-requested"
              ? "нужны правки"
              : data.revision.status === "under-review"
                ? "на ревью"
                : "опубликовано"}
        </p>

        {!editable && (
          <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] p-4 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            Эта глава {data.revision.status === "under-review" ? "на ревью" : "опубликована"} —
            редактирование недоступно. Откройте «Просмотр», чтобы посмотреть содержимое.
          </div>
        )}

        {/* Заголовок главы */}
        <AutoTextarea
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markDirty();
          }}
          readOnly={!editable}
          placeholder="Заголовок статьи"
          aria-label="Заголовок главы"
          className="mt-4 text-[length:var(--type-h1)] font-[var(--weight-h1)] leading-tight"
          maxLength={200}
        />

        {error && (
          <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]">
            {error}
          </p>
        )}

        {/* Блоки */}
        <div className="mt-6 flex flex-col gap-3">
          {blocks.map((block, i) => (
            <div
              key={block.id}
              className="group rounded-[var(--radius-lg)] border border-[var(--border-secondary)] p-3 focus-within:border-[var(--border)]"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                  {BLOCK_LABEL[block.type]}
                </span>
                {editable && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label="Поднять блок"
                      className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      <span aria-hidden="true">▲</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === blocks.length - 1}
                      aria-label="Опустить блок"
                      className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      <span aria-hidden="true">▼</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      aria-label="Удалить блок"
                      className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  </div>
                )}
              </div>
              <fieldset disabled={!editable} className="border-0 p-0">
                <BlockEditor block={block} onChange={(b) => updateBlock(block.id, b)} />
              </fieldset>
              {editable && (
                <div className="mt-2">
                  <AddBlock onAdd={(t) => insertAfter(i, t)} />
                </div>
              )}
            </div>
          ))}

          {editable && blocks.length === 0 && (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-6 text-center">
              <p className="mb-3 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                Пустой документ. Добавьте первый блок.
              </p>
              <AddBlock onAdd={(t) => insertAfter(-1, t)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
