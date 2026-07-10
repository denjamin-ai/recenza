"use client";

// Клиентские действия экрана «Заявки ревьюеров» (Фаза 10): разбор recruit-запросов (approve→доска /
// reject→причина), приём/отклонение заявок apply-to-review. Действия доски — board-actions.tsx
// (страница «Доска ревьюеров», ui-feedback-6 П5).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminMutate } from "@/app/admin/_components/client";
import { btnDangerSoft, btnDangerStrong, btnPrimary, btnText, inputCls } from "@/app/admin/_components/buttons";

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Не удалось.");
        return;
      }
      after?.();
      router.refresh();
    });
  }
  return { run, pending, error };
}

function Err({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-2 rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]">
      {error}
    </p>
  );
}

export function RecruitRequestActions({ id, defaultArea }: { id: string; defaultArea: string }) {
  const { run, pending, error } = useRun();
  const [mode, setMode] = useState<null | "approve" | "reject">(null);
  const [area, setArea] = useState(defaultArea);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");

  if (mode === "approve") {
    return (
      <div className="mt-2 space-y-2">
        <input className={inputCls} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Направление на доске" aria-label="Направление" />
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Заметка (необяз.)" aria-label="Заметка" />
        <div className="flex gap-2">
          <button type="button" disabled={pending} className={btnPrimary} onClick={() => run(() => adminMutate(`/api/admin/recruit-requests/${id}`, "POST", { action: "approve", area: area || undefined, note: note || undefined }), () => setMode(null))}>
            Опубликовать на доске
          </button>
          <button type="button" className={btnText} onClick={() => setMode(null)}>Отмена</button>
        </div>
        <Err error={error} />
      </div>
    );
  }
  if (mode === "reject") {
    return (
      <div className="mt-2 space-y-2">
        <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина отклонения" aria-label="Причина отклонения" />
        <div className="flex gap-2">
          <button type="button" disabled={pending || !reason.trim()} className={btnDangerStrong} onClick={() => run(() => adminMutate(`/api/admin/recruit-requests/${id}`, "POST", { action: "reject", reason }), () => setMode(null))}>
            Отклонить с причиной
          </button>
          <button type="button" className={btnText} onClick={() => setMode(null)}>Отмена</button>
        </div>
        <Err error={error} />
      </div>
    );
  }
  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <button type="button" disabled={pending} className={btnPrimary} onClick={() => setMode("approve")}>Одобрить</button>
        <button type="button" disabled={pending} className={btnDangerSoft} onClick={() => setMode("reject")}>Отклонить</button>
      </div>
      <Err error={error} />
    </div>
  );
}

export function ApplicationActions({ id, canPromote }: { id: string; canPromote: boolean }) {
  const { run, pending, error } = useRun();
  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <button type="button" disabled={pending} className={btnPrimary} onClick={() => run(() => adminMutate(`/api/admin/applications/${id}`, "POST", { action: "accept" }))}>
          {canPromote ? "Принять (выдать роль)" : "Принять"}
        </button>
        <button type="button" disabled={pending} className={btnDangerSoft} onClick={() => run(() => adminMutate(`/api/admin/applications/${id}`, "POST", { action: "decline" }))}>
          Отклонить
        </button>
      </div>
      <Err error={error} />
    </div>
  );
}

