"use client";

// Карточка входящего приглашения (Фаза 9): match% + навыки + заметка автора + Принять/Отклонить.
// Кнопка «навыки не совпадают» (flag) — только при match < 50% (сервер перепроверяет). После ответа
// карточка исчезает (router.refresh в startTransition — чтобы не словить Suspense loading.tsx).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReviewerInvitationItem } from "@/lib/queries/invitations";

type Action = "accept" | "decline" | "flag";

export function InvitationCard({ invitation }: { invitation: ReviewerInvitationItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | "flagged" | null>(null);

  const canFlag = invitation.matchPct < 50;

  async function respond(action: Action) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/reviewer/invitations/${invitation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (res.ok) {
        setDone(action === "accept" ? "accepted" : action === "decline" ? "declined" : "flagged");
        startTransition(() => router.refresh());
      } else {
        setError(data.error ?? "Не удалось выполнить действие.");
        setBusy(null);
      }
    } catch {
      setError("Сеть недоступна.");
      setBusy(null);
    }
  }

  if (done) {
    const label =
      done === "accepted"
        ? "✓ Принято — автор уведомлён"
        : done === "declined"
          ? "Отклонено — автор уведомлён"
          : "Жалоба отправлена — глава снята с ревью";
    const tone =
      done === "accepted"
        ? "text-[var(--success)]"
        : done === "flagged"
          ? "text-[var(--warning)]"
          : "text-[var(--muted-foreground)]";
    return (
      <li className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] p-3">
        <p className={`text-[length:var(--type-small)] ${tone}`}>{label}</p>
      </li>
    );
  }

  const working = busy !== null || pending;

  return (
    <li className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{invitation.chapterTitle}</p>
          <p className="truncate text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            {invitation.blogTitle} · v{invitation.revision}
            {invitation.asLead ? " · ведущий" : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--accent-bg)] px-2 py-0.5 text-[length:var(--type-small)] font-medium text-[var(--accent)]">
          {invitation.matchPct}% совпадение
        </span>
      </div>

      {invitation.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {invitation.skills.map((s) => {
            const hit = invitation.matched.includes(s);
            return (
              <span
                key={s}
                className={`rounded-[var(--radius-pill)] px-1.5 py-0.5 text-[0.7rem] ${
                  hit ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`}
              >
                {hit ? "✓ " : ""}
                {s}
              </span>
            );
          })}
        </div>
      )}

      {invitation.note && (
        <p className="mt-2 border-l-2 border-[var(--border)] pl-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          «{invitation.note}»
        </p>
      )}

      {error && <p className="mt-2 text-[length:var(--type-small)] text-[var(--danger)]">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => respond("accept")}
          disabled={working}
          className="min-h-9 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          {busy === "accept" ? "Принимаем…" : "Принять"}
        </button>
        <button
          type="button"
          onClick={() => respond("decline")}
          disabled={working}
          className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[length:var(--type-small)] transition-colors hover:border-[var(--accent)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {busy === "decline" ? "Отклоняем…" : "Отклонить"}
        </button>
        {canFlag && (
          <button
            type="button"
            onClick={() => respond("flag")}
            disabled={working}
            className="min-h-9 rounded-[var(--radius-sm)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--warning)] transition-colors hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {busy === "flag" ? "Отправляем…" : "Навыки не совпадают"}
          </button>
        )}
      </div>
    </li>
  );
}
