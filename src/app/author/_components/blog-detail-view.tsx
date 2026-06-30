"use client";

// Деталь блога автора (Фаза 6): шапка (пин / открыть как читатель / +глава) + фильтр-чипы статусов +
// список глав со статусом, ревизией, командой ревьюеров и переупорядочиванием (кнопки ↑/↓, a11y).

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    { key: "under-review", label: `На ревью (${counts["under-review"]})` },
    { key: "published", label: `Опубликовано (${counts.published})` },
  ];

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <Link
        href="/author"
        className="inline-block rounded-[var(--radius-sm)] text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        ← К списку блогов
      </Link>

      <header className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1>{detail.title}</h1>
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
                      className="flex h-5 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      <span aria-hidden="true">▲</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === order.length - 1 || busy}
                      aria-label={`Опустить главу «${ch.title}»`}
                      className="flex h-5 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      <span aria-hidden="true">▼</span>
                    </button>
                  </span>
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
    </div>
  );
}
