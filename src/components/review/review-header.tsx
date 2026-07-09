// Шапка ReviewPage (Фаза 7): назад / составной тайтл (блог → глава) / rev / статус / presence /
// триггер команды (мобайл). Strip глав — role=tablist. POV НЕ переключается (D1): серверная роль.
"use client";

import Link from "next/link";
import { BackLink } from "@/components/back-link";
import type { ReviewSession } from "@/lib/queries/review";
import { authorReviewHref } from "@/lib/review-links";
import type { RevisionStatus } from "@/types";

const STATUS_META: Record<RevisionStatus, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "border-[var(--border)] text-[var(--muted-foreground)]" },
  "under-review": { label: "На ревью", cls: "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]" },
  "changes-requested": {
    label: "Нужны правки",
    cls: "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]",
  },
  published: { label: "Опубликовано", cls: "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]" },
};

function dotColor(status: RevisionStatus): string {
  if (status === "published") return "var(--success)";
  if (status === "under-review" || status === "changes-requested") return "var(--info)";
  return "var(--muted-foreground)";
}

export function ReviewHeader({
  session,
  pov,
  onOpenTeam,
}: {
  session: ReviewSession;
  pov: "author" | "reviewer";
  onOpenTeam: () => void;
}) {
  const { blog, chapter, revision, reviewers, chapters } = session;
  const isMulti = chapters.length > 1;
  const meta = STATUS_META[revision.status];
  const backHref = pov === "author" ? `/author/blog/${blog.slug}` : "/reviewer";

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2 px-3 py-2 sm:px-5">
        <BackLink href={backHref} className="shrink-0">
          <span className="hidden sm:inline">{pov === "author" ? "К блогу" : "К списку"}</span>
        </BackLink>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0">
            {isMulti && (
              <p className="truncate text-[length:var(--type-small)] leading-tight text-[var(--muted-foreground)]" title={blog.title}>
                {blog.title}
              </p>
            )}
            <h1 className="truncate text-[length:var(--type-h3)] leading-tight" title={chapter.title}>
              {chapter.title}
            </h1>
          </div>
          <span className="shrink-0 whitespace-nowrap text-[length:var(--type-small)] tabular-nums text-[var(--muted-foreground)]">
            rev {revision.number}
          </span>
          <span
            className={`hidden shrink-0 rounded-[var(--radius-pill)] border px-2 py-0.5 text-[length:var(--type-small)] sm:inline-flex ${meta.cls}`}
          >
            {meta.label}
          </span>
        </div>

        {/* Presence: heartbeat-деривация (last_seen_at ≥ now−90с; D2 — без вебсокетов). */}
        <div className="mr-1 hidden shrink-0 items-center -space-x-1.5 md:flex" aria-label="Команда ревью">
          {reviewers.slice(0, 4).map((r) => (
            <span
              key={r.handle}
              className="relative inline-flex"
              title={`@${r.handle}${r.isPrimary ? " · ведущий" : ""}${r.online ? " · онлайн" : " · был недавно"}`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--muted)] text-[length:var(--type-small)] font-semibold uppercase text-[var(--muted-foreground)] ring-2 ring-[var(--background)] ${
                  r.online ? "" : "opacity-45"
                } ${r.isPrimary ? "outline outline-1 outline-[var(--accent)]" : ""}`}
              >
                {(r.displayName || r.handle).slice(0, 1)}
              </span>
              {r.online && (
                <span className="absolute -bottom-0 -right-0 h-2 w-2 rounded-[var(--radius-pill)] border-2 border-[var(--background)] bg-[var(--success)]" />
              )}
            </span>
          ))}
        </div>

        <span className="hidden shrink-0 text-[length:var(--type-small)] text-[var(--muted-foreground)] lg:inline">
          Вы: <span className="font-medium text-[var(--foreground)]">{pov === "author" ? "автор" : "ревьюер"}</span>
        </span>

        <button
          type="button"
          onClick={onOpenTeam}
          className="inline-flex min-h-9 shrink-0 items-center rounded-[var(--radius-sm)] border border-[var(--border)] px-2 text-[length:var(--type-small)] hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:hidden"
          aria-label="Команда ревью"
        >
          Команда
        </button>
      </div>

      {/* Strip глав. */}
      <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
        <div
          role={isMulti ? "tablist" : undefined}
          aria-label={isMulti ? "Главы блога" : undefined}
          className="flex items-center gap-2 overflow-x-auto whitespace-nowrap px-3 py-1.5 text-[length:var(--type-small)] sm:px-5"
        >
          <span className="shrink-0 text-[length:var(--type-small)] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Главы
          </span>
          {chapters.map((c, i) => {
            const inner = (
              <>
                <span className="h-1.5 w-1.5 shrink-0 rounded-[var(--radius-pill)]" style={{ background: dotColor(c.status) }} />
                <span className="tabular-nums opacity-70">{String(i + 1).padStart(2, "0")}</span>
                <span className="max-w-[160px] truncate">{c.title}</span>
              </>
            );
            const cls = `inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 ${
              c.active
                ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] font-semibold text-[var(--accent)]"
                : "text-[var(--muted-foreground)]"
            }`;
            // В POV автора главы кликабельны (владеет всеми). У ревьюера strip — статусный контекст.
            return pov === "author" && !c.active ? (
              <Link
                key={c.slug}
                href={authorReviewHref(blog.slug, c.slug)}
                role={isMulti ? "tab" : undefined}
                aria-selected={false}
                className={`${cls} hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}
                title={c.title}
              >
                {inner}
              </Link>
            ) : (
              <span
                key={c.slug}
                role={isMulti ? "tab" : undefined}
                aria-selected={c.active}
                className={cls}
                title={c.title}
              >
                {inner}
              </span>
            );
          })}
        </div>
      </div>
    </header>
  );
}
