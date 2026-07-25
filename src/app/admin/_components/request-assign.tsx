"use client";

// Ручное назначение ревьюера на заявку (Фаза 15). Кандидаты ранжируются той же чистой
// `skillMatch()`, что и очередь ревьюера, — редакция видит те же проценты совпадения, что увидел
// бы сам ревьюер, и не «угадывает» соответствие навыков.
//
// Свой блог и перегруженных ревьюеров сервер отклонит в любом случае (общий claimReviewRequest),
// здесь это лишь подсказки в списке.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminMutate } from "@/app/admin/_components/client";
import { btnPrimary, inputCls } from "@/app/admin/_components/buttons";

export interface AssignCandidate {
  handle: string;
  displayName: string;
  load: number;
  capacity: number;
  /** Совпадение компетенций ревьюера с навыками статьи (та же `skillMatch`, что в очереди). */
  matchPct: number;
}

export function RequestAssign({
  requestId,
  authorHandle,
  skills,
  reviewers,
}: {
  requestId: string;
  authorHandle: string;
  skills: string[];
  reviewers: AssignCandidate[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Автор заявки не может быть её ревьюером — сервер это тоже проверяет.
  const candidates = useMemo(
    () => reviewers.filter((r) => r.handle !== authorHandle),
    [reviewers, authorHandle],
  );
  const [handle, setHandle] = useState(candidates[0]?.handle ?? "");

  if (candidates.length === 0) {
    return (
      <p className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
        Нет доступных ревьюеров для назначения.
      </p>
    );
  }

  function assign() {
    setError(null);
    start(async () => {
      const res = await adminMutate(`/api/admin/review-requests/${requestId}/assign`, "POST", { handle });
      if (!res.ok) {
        setError(res.error ?? "Не удалось назначить.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select
        className={`${inputCls} w-auto`}
        aria-label="Ревьюер для назначения"
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
      >
        {candidates.map((c) => (
          <option key={c.handle} value={c.handle} disabled={c.load >= c.capacity}>
            {c.displayName} · совпадение {c.matchPct}% · {c.load}/{c.capacity}
            {c.load >= c.capacity ? " · занят" : ""}
          </option>
        ))}
      </select>
      <button type="button" className={btnPrimary} disabled={pending || !handle} onClick={assign}>
        Назначить
      </button>
      {skills.length > 0 && (
        <span className="text-[0.7rem] text-[var(--muted-foreground)]">навыки: {skills.join(", ")}</span>
      )}
      {error && (
        <p role="alert" className="w-full text-[length:var(--type-small)] text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
