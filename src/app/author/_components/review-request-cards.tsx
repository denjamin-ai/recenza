"use client";

// Карточки заявок автора на ревью (Фаза 14) — aside кабинета «Заявки на ревью».
//
// Заменили секцию «Оцените ревьюеров» (рейтинг снят) и «Навыки не совпадают» (флоу flag ушёл
// вместе с приглашениями). Единственный источник сроков — `review-sla.ts`: тон подписи выводится
// из `slaState`, текст — из `formatDueLabel`, локальных копий чисел SLA здесь нет.
//
// `now` приходит пропом с сервера (RSC-страница кабинета): считать `Date.now()` при рендере значило бы
// расхождение серверной и клиентской разметки при гидрации.

import Link from "next/link";
import type { AuthorRequestView } from "@/lib/queries/review-requests";
import { formatDueLabel, slaState, type SlaState } from "@/lib/review-sla";
import { plural } from "@/lib/plural";

/** Тон таймера. Цвет — не единственный сигнификатор: рядом всегда текст срока. */
const SLA_TONE: Record<SlaState, string> = {
  ok: "text-[var(--muted-foreground)]",
  soon: "text-[var(--warning)]",
  overdue: "text-[var(--danger)]",
};

const STATUS_CHIP: Record<"open" | "claimed", { label: string; cls: string }> = {
  open: { label: "В очереди", cls: "bg-[var(--muted)] text-[var(--muted-foreground)]" },
  claimed: { label: "В работе", cls: "bg-[var(--info-bg)] text-[var(--info)]" },
};

function RequestCard({ request, now }: { request: AuthorRequestView; now: number }) {
  // Живые заявки — только open|claimed (getAuthorReviewRequests), остальные статусы сюда не доходят.
  const chip = STATUS_CHIP[request.status === "claimed" ? "claimed" : "open"];
  return (
    <li className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          href={`/author/blog/${request.blogSlug}/${request.chapterSlug}/edit`}
          className="min-w-0 flex-1 truncate text-[0.82rem] font-medium transition-colors hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          title={`${request.chapterTitle} · ${request.blogTitle}`}
        >
          {request.chapterTitle}
        </Link>
        <span className={`shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.7rem] ${chip.cls}`}>
          {chip.label}
        </span>
      </div>

      <p className="mt-0.5 truncate text-[0.72rem] text-[var(--muted-foreground)]">
        {request.blogTitle} · версия {request.revisionNumber}
      </p>

      {request.status === "claimed" && request.claimedByName && (
        <p className="mt-1.5 text-[0.72rem] text-[var(--muted-foreground)]">
          Взял в работу{" "}
          {request.claimedBySlug ? (
            <Link
              href={`/u/${request.claimedBySlug}`}
              className="text-[var(--foreground)] underline decoration-[var(--border)] underline-offset-2 transition-colors hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {request.claimedByName}
            </Link>
          ) : (
            <span className="text-[var(--foreground)]">{request.claimedByName}</span>
          )}
        </p>
      )}

      {request.dueAt !== null && (
        <p className={`mt-1 text-[0.72rem] tabular-nums ${SLA_TONE[slaState(request.dueAt, now)]}`}>
          {request.status === "claimed" ? "Ответ ревьюера: " : "Ждём ревьюера: "}
          {formatDueLabel(request.dueAt, now)}
        </p>
      )}

      {request.returnCount > 0 && (
        <p className="mt-1 text-[0.72rem] text-[var(--warning)]">
          Заявка возвращалась в очередь {request.returnCount}{" "}
          {plural(request.returnCount, "раз", "раза", "раз")}.
        </p>
      )}

      {request.channel === "editorial" && (
        <p className="mt-1 text-[0.72rem] text-[var(--info)]">
          Подключена редакция — направление на доске «Ищем ревьюеров».
        </p>
      )}

      {request.status === "claimed" && (
        <Link
          href={`/author/blog/${request.blogSlug}/${request.chapterSlug}/review`}
          className="mt-2 inline-flex min-h-9 items-center rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[0.78rem] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Открыть ревью →
        </Link>
      )}
    </li>
  );
}

export function ReviewRequestCards({ requests, now }: { requests: AuthorRequestView[]; now: number }) {
  if (requests.length === 0) return null;
  return (
    <section aria-label="Заявки на ревью">
      <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        Заявки на ревью
      </h2>
      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <RequestCard key={r.id} request={r} now={now} />
        ))}
      </ul>
    </section>
  );
}
