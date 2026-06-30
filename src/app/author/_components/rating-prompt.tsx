"use client";

// Оценка ревьюеров после публикации (Фаза 9) — ПРИВАТНО. По 1–5 звёзд на ревьюера → POST
// /api/author/ratings. После сохранения карточка ревьюера помечается «оценён». router.refresh в
// startTransition (не ловим loading.tsx).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RatingPrompt } from "@/lib/queries/author";

const STAR_LABELS = ["", "Слабо", "Ниже среднего", "Нормально", "Хорошо", "Отлично"];

function Stars({
  value,
  onPick,
  disabled,
}: {
  value: number;
  onPick: (n: number) => void;
  disabled: boolean;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <span className="inline-flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onClick={() => onPick(n)}
          aria-label={`${n} — ${STAR_LABELS[n]}`}
          aria-pressed={value === n}
          className={`inline-flex h-9 w-9 items-center justify-center text-lg leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-50 ${
            n <= shown ? "text-[var(--pin)]" : "text-[var(--border)]"
          }`}
        >
          ★
        </button>
      ))}
      {shown > 0 && (
        <span className="ml-1 text-[length:var(--type-small)] text-[var(--muted-foreground)]">{STAR_LABELS[shown]}</span>
      )}
    </span>
  );
}

export function RatingPromptCard({ prompt }: { prompt: RatingPrompt }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Локальное состояние оценок: handle → { stars, saved }.
  const [state, setState] = useState<Record<string, { stars: number; saved: boolean; busy: boolean }>>(() =>
    Object.fromEntries(prompt.reviewers.map((r) => [r.handle, { stars: r.myStars ?? 0, saved: r.myStars != null, busy: false }])),
  );
  const [error, setError] = useState<string | null>(null);

  async function rate(handle: string, stars: number) {
    setState((s) => ({ ...s, [handle]: { ...s[handle], stars, busy: true } }));
    setError(null);
    try {
      const res = await fetch("/api/author/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: prompt.chapterId, reviewerHandle: handle, stars }),
      });
      if (res.ok) {
        setState((s) => ({ ...s, [handle]: { stars, saved: true, busy: false } }));
        startTransition(() => router.refresh());
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Не удалось сохранить оценку.");
        setState((s) => ({ ...s, [handle]: { ...s[handle], busy: false } }));
      }
    } catch {
      setError("Сеть недоступна.");
      setState((s) => ({ ...s, [handle]: { ...s[handle], busy: false } }));
    }
  }

  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <h3 className="text-[length:var(--type-h4)]">{prompt.chapterTitle}</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {prompt.reviewers.map((r) => {
          const st = state[r.handle];
          return (
            <li key={r.handle} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[length:var(--type-small)]">
                {r.displayName}
                {st.saved && <span className="ml-2 text-[var(--success)]">оценён</span>}
              </span>
              <Stars value={st.stars} disabled={st.busy} onPick={(n) => rate(r.handle, n)} />
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
        Оценка приватная — её видит только ревьюер и админ. В рейтинг идёт усреднённый балл.
      </p>
      {error && <p className="mt-2 text-[length:var(--type-small)] text-[var(--danger)]">{error}</p>}
    </article>
  );
}
