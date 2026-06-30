"use client";

// Кабинет автора (Фаза 6): сетка блогов с плиткой «создать» первой + закрепление (пин → вперёд + кольцо).
// Создание = create-then-edit: POST /api/author/blogs → редирект на деталь блога.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AuthorBlogCard } from "@/lib/queries/author";
import type { RevisionStatus } from "@/types";

const STATUS_DOT: Record<RevisionStatus, string> = {
  published: "bg-[var(--success)]",
  "under-review": "bg-[var(--warning)]",
  "changes-requested": "bg-[var(--danger)]",
  draft: "bg-[var(--border)]",
};

function ChapterDots({ statuses }: { statuses: { order: number; status: RevisionStatus }[] }) {
  if (statuses.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1" aria-hidden="true">
      {statuses.map((s, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[s.status]}`} />
      ))}
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

async function postPin(blogId: string | null): Promise<boolean> {
  const res = await fetch("/api/author/pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blogId }),
  });
  return res.ok;
}

function CreateTile() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setError(null);
    start(async () => {
      const res = await fetch("/api/author/blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      const data = (await res.json().catch(() => ({}))) as { blogSlug?: string; error?: string };
      if (res.ok && data.blogSlug) {
        router.push(`/author/blog/${data.blogSlug}`);
      } else {
        setError(data.error ?? "Не удалось создать блог.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[10rem] flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] p-5 text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <span aria-hidden="true" className="text-2xl leading-none">
          +
        </span>
        <span className="text-[length:var(--type-small)]">Новый блог</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex min-h-[10rem] flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--accent)] bg-[var(--bg-elevated)] p-4"
    >
      <label htmlFor="new-blog-title" className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
        Название блога
      </label>
      <input
        id="new-blog-title"
        autoFocus
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Например: Внутренности JavaScript"
        className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      />
      {error && <p className="text-[length:var(--type-small)] text-[var(--danger)]">{error}</p>}
      <div className="mt-auto flex gap-2">
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="min-h-9 flex-1 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-2 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          {pending ? "Создаём…" : "Создать"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTitle("");
            setError(null);
          }}
          className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

function BlogTile({ blog, pinned }: { blog: AuthorBlogCard; pinned: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const onReview = blog.chapterStatuses.filter((c) => c.status === "under-review").length;
  const drafts = blog.chapterStatuses.filter((c) => c.status === "draft").length;

  function togglePin() {
    start(async () => {
      const ok = await postPin(pinned ? null : blog.id);
      if (ok) router.refresh();
    });
  }

  return (
    <article
      className={`flex flex-col gap-3 rounded-[var(--radius-lg)] border bg-[var(--bg-elevated)] p-4 transition-colors ${
        pinned ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[length:var(--type-small)] ${
              blog.isPublished
                ? "bg-[var(--success-bg)] text-[var(--success)]"
                : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}
          >
            {blog.isPublished ? "Опубликован" : "Черновик"}
          </span>
          {pinned && (
            <span className="rounded-[var(--radius-pill)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 text-[length:var(--type-small)] text-[var(--accent)]">
              Закреплён
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={togglePin}
          disabled={pending}
          aria-pressed={pinned}
          aria-label={pinned ? "Открепить блог" : "Закрепить блог"}
          title={pinned ? "Открепить" : "Закрепить"}
          className={`flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            pinned
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          } disabled:opacity-50`}
        >
          <span aria-hidden="true">📌</span>
        </button>
      </div>

      <Link
        href={`/author/blog/${blog.slug}`}
        className="rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <h3 className="text-[length:var(--type-h4)]">{blog.title}</h3>
      </Link>
      {blog.summary && (
        <p className="line-clamp-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          {blog.summary}
        </p>
      )}

      <ChapterDots statuses={blog.chapterStatuses} />

      <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
        <span className="tabular-nums">
          {blog.chapterCount} {plural(blog.chapterCount, "глава", "главы", "глав")}
          {blog.publishedCount > 0 ? ` · ${blog.publishedCount} опубл.` : ""}
        </span>
        {(onReview > 0 || drafts > 0) && (
          <span className="tabular-nums">
            {onReview > 0 ? `${onReview} на ревью` : ""}
            {onReview > 0 && drafts > 0 ? " · " : ""}
            {drafts > 0 ? `${drafts} черн.` : ""}
          </span>
        )}
      </div>

      <Link
        href={`/author/blog/${blog.slug}`}
        className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-center text-[length:var(--type-small)] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        Открыть →
      </Link>
    </article>
  );
}

export function AuthorCabinet({
  displayName,
  blogs,
  pinnedBlogId,
}: {
  displayName: string;
  blogs: AuthorBlogCard[];
  pinnedBlogId: string | null;
}) {
  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <header>
        <h1>Кабинет автора</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          {displayName ? `${displayName}, ` : ""}здесь ваши блоги и главы.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-[length:var(--type-h4)]">Мои блоги</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CreateTile />
          {blogs.map((blog) => (
            <BlogTile key={blog.id} blog={blog} pinned={blog.id === pinnedBlogId} />
          ))}
        </div>
      </section>
    </div>
  );
}
