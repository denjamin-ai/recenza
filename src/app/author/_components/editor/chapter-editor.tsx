"use client";

// Редактор главы (Variant B): чистый документ — заголовок + список блоков (BlockListEditor) +
// явное сохранение + ⚙ настройки (SettingsPopover) + «Отправить на ревью» (SubmitSheet).
// RSC грузит черновик → этот клиент правит → PATCH /api/author/chapters/[id].

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Block } from "@/types";
import type { EditorChapter, ReviewerOption } from "@/lib/queries/author";
import { AutoTextarea } from "./auto-textarea";
import { BlockListEditor } from "./block-list-editor";
import { SettingsPopover } from "./settings-popover";
import { SubmitSheet } from "./submit-sheet";

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

export function ChapterEditor({ data, reviewers }: { data: EditorChapter; reviewers: ReviewerOption[] }) {
  const editable = data.revision.status === "draft" || data.revision.status === "changes-requested";
  const [title, setTitle] = useState(data.chapter.title);
  const [blocks, setBlocks] = useState<Block[]>(data.revision.blocks);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);

  const markDirty = () => {
    setDirty(true);
    setError(null);
  };

  const save = useCallback(async (): Promise<boolean> => {
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
        return true;
      }
      setError(json.error ?? "Не удалось сохранить.");
      return false;
    } catch {
      setError("Сеть недоступна.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [data.chapter.id, title, blocks]);

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
            <>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                aria-label="Настройки блога"
                className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span aria-hidden="true">⚙</span>
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-1.5 text-[length:var(--type-small)] transition-colors hover:border-[var(--accent)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {saving ? "Сохраняем…" : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (dirty) await save();
                  setShowSubmit(true);
                }}
                className="min-h-9 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-1.5 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              >
                Отправить на ревью →
              </button>
            </>
          )}
        </div>
      </div>

      {showSettings && (
        <SettingsPopover
          blogId={data.blog.id}
          blogSlug={data.blog.slug}
          chapterSlug={data.chapter.slug}
          initial={{
            slug: data.blog.slug,
            tags: data.blog.tags,
            complexity: data.blog.complexity,
            coverUrl: data.blog.coverUrl,
            summary: data.blog.summary,
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showSubmit && (
        <SubmitSheet
          chapterId={data.chapter.id}
          chapterTitle={title}
          blocks={blocks}
          tags={data.blog.tags}
          initialSkills={data.chapter.skills}
          initialComplexity={data.blog.complexity}
          reviewers={reviewers}
          onSave={save}
          onClose={() => setShowSubmit(false)}
        />
      )}

      <div className="mx-auto w-full max-w-[var(--max-article)] px-6 py-8">
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

        {editable && (
          <div className="mt-6">
            <BlockListEditor
              blocks={blocks}
              onChange={(next) => {
                setBlocks(next);
                markDirty();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
