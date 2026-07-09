"use client";

// Редактор главы (Variant B): чистый документ — заголовок + список блоков (BlockListEditor) +
// сохранение + ⚙ настройки (SettingsPopover) + «Отправить на ревью» (SubmitSheet).
// RSC грузит черновик → этот клиент правит → PATCH /api/author/chapters/[id].
// Сохранение (ui-feedback-3, П10): save читает title/blocks из refs (не из замыкания), сейвы
// сериализованы через цепочку промисов, 429 ретраится один раз по Retry-After; структурные правки
// блоков (meta.structural из BlockListEditor) планируют дебаунс-автосейв 1.6с (> окна рейт-лимита
// author-save 1/с); «Просмотр» сохраняет черновик перед переходом.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/back-link";
import type { Block } from "@/types";
import type { EditorChapter } from "@/lib/queries/author";
import type { RankedReviewer } from "@/lib/reviewer-match";
import { AutoTextarea } from "./auto-textarea";
import { BlockListEditor } from "./block-list-editor";
import { SettingsPopover } from "./settings-popover";
import { SubmitSheet } from "./submit-sheet";

const AUTOSAVE_DELAY_MS = 1600;

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

export function ChapterEditor({ data, reviewers }: { data: EditorChapter; reviewers: RankedReviewer[] }) {
  const router = useRouter();
  const editable = data.revision.status === "draft" || data.revision.status === "changes-requested";
  const [title, setTitle] = useState(data.chapter.title);
  const [blocks, setBlocks] = useState<Block[]>(data.revision.blocks);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);

  // Актуальный контент для save() — refs, а не замыкание: автосейв/отложенный сейв всегда шлют
  // последнее состояние. editSeq отличает «правки во время PATCH» (dirty не сбрасываем).
  const titleRef = useRef(title);
  const blocksRef = useRef(blocks);
  const editSeqRef = useRef(0);
  const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const autosaveTimerRef = useRef<number | null>(null);

  const markDirty = () => {
    editSeqRef.current += 1;
    setDirty(true);
    setError(null);
  };

  const cancelAutosave = useCallback(() => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const save = useCallback((): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      cancelAutosave();
      const seq = editSeqRef.current;
      setSaving(true);
      setError(null);
      try {
        const doFetch = () =>
          fetch(`/api/author/chapters/${data.chapter.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: titleRef.current, blocks: blocksRef.current }),
          });
        let res = await doFetch();
        if (res.status === 429) {
          // Рейт-лимит author-save 1/с: один авторетрай по Retry-After.
          const retryAfter = Number(res.headers.get("Retry-After") ?? "1");
          await new Promise((r) => window.setTimeout(r, Math.max(1, retryAfter) * 1000 + 100));
          res = await doFetch();
        }
        const json = (await res.json().catch(() => ({}))) as { savedAt?: number; error?: string };
        if (res.ok) {
          if (editSeqRef.current === seq) setDirty(false);
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
    };
    // Сериализация: параллельные вызовы выстраиваются в цепочку (второй PATCH не перетрёт первый).
    const p = saveChainRef.current.then(run, run);
    saveChainRef.current = p;
    return p;
  }, [data.chapter.id, cancelAutosave]);

  const scheduleAutosave = useCallback(() => {
    if (!editable) return;
    cancelAutosave();
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void save();
    }, AUTOSAVE_DELAY_MS);
  }, [editable, cancelAutosave, save]);

  useEffect(() => cancelAutosave, [cancelAutosave]);

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
        <BackLink href={`/author/blog/${data.blog.slug}`}>Кабинет</BackLink>
        <div className="flex items-center gap-3">
          <SaveState dirty={dirty} savedAt={savedAt} />
          <button
            type="button"
            onClick={async () => {
              // «Просмотр» сохраняет черновик (замечание владельца) — иначе превью покажет старое.
              if (editable && dirty) {
                const ok = await save();
                if (!ok) return;
              }
              router.push(`/author/blog/${data.blog.slug}/${data.chapter.slug}/preview`);
            }}
            className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[length:var(--type-small)] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Просмотр
          </button>
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
            title: data.blog.title,
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
            titleRef.current = e.target.value;
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
              onChange={(next, meta) => {
                setBlocks(next);
                blocksRef.current = next;
                markDirty();
                // Структурная правка (добавление/удаление/перестановка/смена типа) → автосейв.
                if (meta?.structural) scheduleAutosave();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
