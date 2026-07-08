"use client";

// Настройки блога (slug / теги / сложность / обложка / описание). PATCH /api/author/blogs/[blogId].
// При смене slug меняется URL главы — навигируем на новый путь.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Complexity } from "@/types";
import { COMPLEXITIES } from "@/types";
import { UploadField } from "@/components/upload-field";
import { ChipInput } from "./chip-input";

const COMPLEXITY_LABEL: Record<Complexity, string> = {
  simple: "Простая",
  medium: "Средняя",
  complex: "Сложная",
};

const fieldCls =
  "w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export function SettingsPopover({
  blogId,
  blogSlug,
  chapterSlug,
  initial,
  onClose,
}: {
  blogId: string;
  blogSlug: string;
  chapterSlug: string;
  initial: { slug: string; tags: string[]; complexity: Complexity; coverUrl: string | null; summary: string | null };
  onClose: () => void;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(initial.slug);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [complexity, setComplexity] = useState<Complexity>(initial.complexity);
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl ?? "");
  const [summary, setSummary] = useState(initial.summary ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/author/blogs/${blogId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, tags, complexity, coverUrl: coverUrl || null, summary: summary || null }),
    });
    const data = (await res.json().catch(() => ({}))) as { slug?: string; error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Не удалось сохранить.");
      return;
    }
    onClose();
    const nextSlug = data.slug ?? blogSlug;
    if (nextSlug !== blogSlug) {
      router.replace(`/author/blog/${nextSlug}/${chapterSlug}/edit`);
    } else {
      router.refresh();
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-[var(--overlay)] p-4 pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Настройки блога"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="w-full max-w-[440px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[length:var(--type-h4)]">Настройки блога</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">Адрес (slug)</span>
            <span className="flex items-center gap-1">
              <span className="font-mono text-[length:var(--type-small)] text-[var(--muted-foreground)]">/blog/</span>
              <input autoFocus value={slug} onChange={(e) => setSlug(e.target.value)} className={fieldCls} aria-label="slug" />
            </span>
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">Теги (обязательны для отправки)</span>
            <ChipInput value={tags} onChange={setTags} max={8} placeholder="Next.js, App Router…" ariaLabel="Теги блога" />
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">Сложность</span>
            <select
              value={complexity}
              onChange={(e) => setComplexity(e.target.value as Complexity)}
              className={fieldCls}
              aria-label="Сложность блога"
            >
              {COMPLEXITIES.map((c) => (
                <option key={c} value={c}>
                  {COMPLEXITY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">Обложка (путь /uploads/)</span>
            <UploadField
              kind="cover"
              value={coverUrl}
              onChange={setCoverUrl}
              placeholder="/uploads/covers/…"
              ariaLabel="URL обложки"
              inputClassName={fieldCls}
            />
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">Краткое описание</span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              className={`${fieldCls} resize-none`}
              aria-label="Описание блога"
            />
          </label>

          {error && <p className="text-[length:var(--type-small)] text-[var(--danger)]">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="min-h-9 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              {saving ? "Сохраняем…" : "Готово"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
