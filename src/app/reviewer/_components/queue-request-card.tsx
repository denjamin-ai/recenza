"use client";

// Карточка заявки в очереди (Фаза 14.6) + действие «Взять».
//
// Claim — POST /api/reviewer/requests/{id}/claim; сервер решает всё внутри транзакции (заявку могли
// взять параллельно, ревьюер мог упереться в capacity, автор — сдать новую ревизию), поэтому UI
// не предугадывает исход, а показывает текст ошибки из ответа.
//
// ⚠️ CLAUDE.md §Gotchas: router.refresh() обязан жить внутри startTransition — иначе он ловит
// Suspense-границу loading.tsx, кабинет перемонтируется и сообщение об ошибке/выбранный таб теряются.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { QueueRequestItem } from "@/lib/queries/review-requests";
import { formatDueLabel, slaState, type SlaState } from "@/lib/review-sla";

const SLA_CLS: Record<SlaState, string> = {
  ok: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  soon: "bg-[var(--warning-bg)] text-[var(--warning)]",
  overdue: "bg-[var(--danger-bg)] text-[var(--danger)]",
};

export function QueueRequestCard({ item, now }: { item: QueueRequestItem; now: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function claim() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/reviewer/requests/${item.id}/claim`, { method: "POST" });
        if (!res.ok) {
          let message = "Не удалось взять заявку.";
          try {
            const data = (await res.json()) as { error?: string };
            if (data.error) message = data.error;
          } catch {
            /* нет тела ошибки — остаётся общий текст */
          }
          setError(message);
          return;
        }
      } catch {
        setError("Сетевая ошибка. Проверьте соединение.");
        return;
      }
      // Заявка уезжает из «Очереди» в «Мои ревью» — обе секции считает RSC-страница.
      router.refresh();
    });
  }

  const sla = slaState(item.dueAt, now);
  const matched = new Set(item.matched);

  return (
    <li className="rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--background)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[length:var(--type-h4)] text-[var(--foreground)]">
            {item.chapterTitle}
          </p>
          <p className="mt-1 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            {item.blogTitle} ·{" "}
            <Link
              href={`/u/${item.authorSlug}`}
              className="underline-offset-2 hover:text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {item.authorName}
            </Link>{" "}
            · версия {item.revisionNumber}
          </p>
        </div>
        <span className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--accent-bg)] px-2 py-0.5 text-[length:var(--type-small)] tabular-nums text-[var(--accent)]">
          совпадение {item.matchPct}%
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {item.skills.map((s) => (
          <span
            key={s}
            className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[length:var(--type-small)] ${
              matched.has(s)
                ? "bg-[var(--accent-bg)] text-[var(--accent)]"
                : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}
          >
            {s}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.isPublishedRevision && (
          <span className="rounded-[var(--radius-sm)] bg-[var(--info-bg)] px-1.5 py-0.5 text-[length:var(--type-small)] text-[var(--info)]">
            заявка на опубликованную главу
          </span>
        )}
        {item.channel === "editorial" && (
          <span className="rounded-[var(--radius-sm)] bg-[var(--warning-bg)] px-1.5 py-0.5 text-[length:var(--type-small)] text-[var(--warning)]">
            от редакции
          </span>
        )}
        {item.dueAt !== null && (
          <span className={`rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[length:var(--type-small)] ${SLA_CLS[sla]}`}>
            {formatDueLabel(item.dueAt, now)}
          </span>
        )}
      </div>

      {item.note && (
        <p className="mt-3 text-[length:var(--type-small)] text-[var(--muted-foreground)]">{item.note}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={claim}
          disabled={pending}
          className="min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          {pending ? "Берём…" : "Взять"}
        </button>
        {/* Черновик читателю недоступен (404) — ссылку даём только на опубликованную ревизию. */}
        {item.isPublishedRevision && (
          <Link
            href={`/blog/${item.blogSlug}/${item.chapterSlug}`}
            className="inline-flex min-h-9 items-center text-[length:var(--type-small)] text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Открыть главу
          </Link>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]"
        >
          {error}
        </p>
      )}
    </li>
  );
}
