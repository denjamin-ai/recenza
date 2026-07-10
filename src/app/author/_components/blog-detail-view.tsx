"use client";

// Деталь блога автора (Фаза 6): шапка (пин / открыть как читатель / +глава) + фильтр-чипы статусов +
// список глав со статусом, ревизией, командой ревьюеров и переупорядочиванием (кнопки ↑/↓, a11y).
// ui-feedback-3: inline-rename заголовка (dblclick — паттерн прототипа author-portal) + danger-зона
// удаления блога-черновика (DELETE /api/author/blogs/[id], гейт «только draft» перепроверяет сервер).

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import type { AuthorBlogDetail, AuthorChapterRow } from "@/lib/queries/author";
import type { RevisionStatus } from "@/types";

const STATUS_META: Record<RevisionStatus, { label: string; cls: string }> = {
  published: { label: "Опубликовано", cls: "bg-[var(--success-bg)] text-[var(--success)]" },
  "under-review": { label: "На ревью", cls: "bg-[var(--warning-bg)] text-[var(--warning)]" },
  "changes-requested": { label: "Нужны правки", cls: "bg-[var(--danger-bg)] text-[var(--danger)]" },
  draft: { label: "Черновик", cls: "bg-[var(--muted)] text-[var(--muted-foreground)]" },
};

type Filter = "all" | RevisionStatus;

function StatusPill({ status }: { status: RevisionStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[length:var(--type-small)] ${m.cls}`}>
      {m.label}
    </span>
  );
}

function ReviewerChips({ reviewers }: { reviewers: AuthorChapterRow["reviewers"] }) {
  if (reviewers.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">Команда:</span>
      <div className="flex -space-x-1">
        {reviewers.slice(0, 4).map((r) => (
          <span
            key={r.handle}
            title={`${r.displayName}${r.isPrimary ? " · ведущий" : ""}${r.verdict ? ` · ${r.verdict === "approve" ? "одобрил" : "нужны правки"}` : ""}`}
            className={`flex h-6 w-6 items-center justify-center rounded-full border bg-[var(--bg-secondary)] text-[0.7rem] ${
              r.isPrimary ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted-foreground)]"
            }`}
          >
            {r.displayName.slice(0, 1).toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BlogDetailView({ detail }: { detail: AuthorBlogDetail }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [order, setOrder] = useState<AuthorChapterRow[]>(detail.chapters);
  const [pinned, setPinned] = useState(detail.isPinned);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(detail.title);
  const [titleDraft, setTitleDraft] = useState(detail.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // blur после Enter/Escape не должен коммитить второй раз.
  const titleCommittedRef = useRef(false);

  const allDraft = order.every((c) => c.status === "draft");

  function commitTitle() {
    if (titleCommittedRef.current) return;
    titleCommittedRef.current = true;
    setEditingTitle(false);
    const next = titleDraft.trim();
    if (!next || next === title) {
      setTitleDraft(title);
      return;
    }
    start(async () => {
      const res = await fetch(`/api/author/blogs/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (res.ok) {
        setTitle(next);
        setTitleDraft(next);
        router.refresh();
      } else {
        setTitleDraft(title);
      }
    });
  }

  function cancelTitle() {
    titleCommittedRef.current = true;
    setEditingTitle(false);
    setTitleDraft(title);
  }

  function deleteBlog() {
    setDeleteError(null);
    start(async () => {
      const res = await fetch(`/api/author/blogs/${detail.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/author");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setDeleteError(data.error ?? "Не удалось удалить блог.");
    });
  }

  const counts = useMemo(() => {
    const c = { all: order.length, draft: 0, "under-review": 0, "changes-requested": 0, published: 0 };
    for (const ch of order) c[ch.status]++;
    return c;
  }, [order]);

  const visible = filter === "all" ? order : order.filter((c) => c.status === filter);

  function togglePin() {
    start(async () => {
      const next = pinned ? null : detail.id;
      const res = await fetch("/api/author/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogId: next }),
      });
      if (res.ok) setPinned(!pinned);
    });
  }

  function createChapter() {
    start(async () => {
      const res = await fetch(`/api/author/blogs/${detail.id}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as { chapterSlug?: string };
      if (res.ok && data.chapterSlug) {
        router.push(`/author/blog/${detail.slug}/${data.chapterSlug}/edit`);
      }
    });
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= order.length || busy) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setBusy(true);
    const res = await fetch("/api/author/chapters/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blogId: detail.id, chapterIds: next.map((c) => c.id) }),
    });
    setBusy(false);
    if (!res.ok) setOrder(order); // откат при ошибке
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: `Все (${counts.all})` },
    { key: "draft", label: `Черновики (${counts.draft})` },
    { key: "changes-requested", label: `Нужны правки (${counts["changes-requested"]})` },
    { key: "under-review", label: `На ревью (${counts["under-review"]})` },
    { key: "published", label: `Опубликовано (${counts.published})` },
  ];

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <BackLink href="/author">К списку блогов</BackLink>

      <header className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              maxLength={64}
              aria-label="Название блога"
              onChange={(e) => setTitleDraft(e.target.value)}
              onFocus={() => {
                titleCommittedRef.current = false;
              }}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") cancelTitle();
              }}
              className="min-w-0 flex-1 border-b-2 border-[var(--accent)] bg-transparent font-display text-[length:var(--type-h1)] font-[var(--weight-h1)] leading-tight text-[var(--foreground)] focus-visible:outline-none"
            />
          ) : (
            <h1 title="Двойной клик — переименовать" onDoubleClick={() => setEditingTitle(true)} className="cursor-text">
              {title}
            </h1>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={createChapter}
              disabled={pending}
              className="min-h-9 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-2 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              + Новая глава
            </button>
            {detail.chapters.some((c) => c.status === "published") && (
              <Link
                href={`/blog/${detail.slug}`}
                className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[length:var(--type-small)] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                Открыть как читатель →
              </Link>
            )}
            <button
              type="button"
              onClick={togglePin}
              disabled={pending}
              aria-pressed={pinned}
              className={`min-h-9 rounded-[var(--radius-sm)] border px-3 py-2 text-[length:var(--type-small)] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                pinned ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {pinned ? "Закреплён" : "Закрепить"}
            </button>
          </div>
        </div>
        {detail.summary && <p className="text-[var(--muted-foreground)]">{detail.summary}</p>}
        {detail.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {detail.tags.map((t) => (
              <li
                key={t}
                className="rounded-[var(--radius-pill)] bg-[var(--muted)] px-2 py-0.5 text-[length:var(--type-small)] text-[var(--muted-foreground)]"
              >
                {t}
              </li>
            ))}
          </ul>
        )}
      </header>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Фильтр глав">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`min-h-9 rounded-[var(--radius-pill)] px-3 py-1.5 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              filter === f.key
                ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {visible.length === 0 && (
          <li className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-6 text-center text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            Нет глав в этом фильтре.
          </li>
        )}
        {visible.map((ch) => {
          const idx = order.findIndex((c) => c.id === ch.id);
          return (
            <li
              key={ch.id}
              className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 font-mono text-[length:var(--type-small)] text-[var(--muted-foreground)] tabular-nums">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={ch.status} />
                    {ch.latestRevisionNumber > 1 && (
                      <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                        rev {ch.latestRevisionNumber}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 truncate text-[length:var(--type-h4)]">{ch.title}</h3>
                  <div className="mt-1">
                    <ReviewerChips reviewers={ch.reviewers} />
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {filter === "all" && (
                  <span className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0 || busy}
                      aria-label={`Поднять главу «${ch.title}»`}
                      className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      <span aria-hidden="true">▲</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === order.length - 1 || busy}
                      aria-label={`Опустить главу «${ch.title}»`}
                      className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      <span aria-hidden="true">▼</span>
                    </button>
                  </span>
                )}
                {(ch.status === "under-review" || ch.status === "changes-requested") && (
                  <Link
                    href={`/author/blog/${detail.slug}/${ch.slug}/review`}
                    className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--info-border)] bg-[var(--info-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--info)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    Ревью
                  </Link>
                )}
                <Link
                  href={`/author/blog/${detail.slug}/${ch.slug}/preview`}
                  className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[length:var(--type-small)] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  Превью
                </Link>
                <Link
                  href={`/author/blog/${detail.slug}/${ch.slug}/edit`}
                  className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--accent)] px-3 py-2 text-[length:var(--type-small)] text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  Редактировать
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Danger-зона: удаление доступно только блогу-черновику; сервер перепроверяет гейт (409). */}
      <section className="mt-10 rounded-[var(--radius-lg)] border border-[var(--danger-border)] p-4">
        <h2 className="text-[length:var(--type-h4)] text-[var(--danger)]">Удаление блога</h2>
        <p className="mt-1 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          {allDraft
            ? "Блог и все его главы будут удалены безвозвратно."
            : "Удалить можно только блог-черновик: все главы должны быть в статусе «Черновик»."}
        </p>
        {deleteError && (
          <p role="alert" className="mt-2 rounded-[var(--radius-sm)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]">
            {deleteError}
          </p>
        )}
        <button
          type="button"
          disabled={pending || !allDraft}
          onClick={() => setConfirmDelete(true)}
          className="mt-3 min-h-9 rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
        >
          Удалить блог
        </button>
      </section>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--overlay)] px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Подтверждение удаления блога"
          onKeyDown={(e) => e.key === "Escape" && setConfirmDelete(false)}
        >
          <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="text-[length:var(--type-h4)]">Удалить «{title}»?</h2>
            <p className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
              Все главы и черновики будут удалены безвозвратно.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmDelete(false)}
                className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[length:var(--type-small)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setConfirmDelete(false);
                  deleteBlog();
                }}
                className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
