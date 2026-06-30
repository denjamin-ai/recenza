"use client";

// Клиентские действия экрана «Заявки ревьюеров» (Фаза 10): разбор recruit-запросов (approve→доска /
// reject→причина), создание/удаление направлений доски, приём/отклонение заявок apply-to-review.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminMutate } from "@/app/admin/_components/client";

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

const btnPrimary =
  "min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60";
const btnGhost =
  "min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60";
const inputCls =
  "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 text-[length:var(--type-small)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

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
          <button type="button" className={btnGhost} onClick={() => setMode(null)}>Отмена</button>
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
          <button type="button" disabled={pending || !reason.trim()} className={btnPrimary} onClick={() => run(() => adminMutate(`/api/admin/recruit-requests/${id}`, "POST", { action: "reject", reason }), () => setMode(null))}>
            Отклонить с причиной
          </button>
          <button type="button" className={btnGhost} onClick={() => setMode(null)}>Отмена</button>
        </div>
        <Err error={error} />
      </div>
    );
  }
  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <button type="button" disabled={pending} className={btnPrimary} onClick={() => setMode("approve")}>Одобрить</button>
        <button type="button" disabled={pending} className={btnGhost} onClick={() => setMode("reject")}>Отклонить</button>
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
        <button type="button" disabled={pending} className={btnGhost} onClick={() => run(() => adminMutate(`/api/admin/applications/${id}`, "POST", { action: "decline" }))}>
          Отклонить
        </button>
      </div>
      <Err error={error} />
    </div>
  );
}

export function BoardCallCreate() {
  const { run, pending, error } = useRun();
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState("");
  const [skills, setSkills] = useState("");
  const [note, setNote] = useState("");

  if (!open) {
    return (
      <button type="button" className={btnGhost} onClick={() => setOpen(true)}>+ Добавить направление</button>
    );
  }
  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-secondary)] p-3">
      <input className={inputCls} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Направление (напр. Frontend)" aria-label="Направление" />
      <input className={inputCls} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Навыки через запятую" aria-label="Навыки" />
      <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Заметка (необяз.)" aria-label="Заметка" />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !area.trim()}
          className={btnPrimary}
          onClick={() =>
            run(
              () => adminMutate("/api/admin/board-calls", "POST", { area, skills: skills.split(",").map((s) => s.trim()).filter(Boolean), note: note || undefined }),
              () => { setOpen(false); setArea(""); setSkills(""); setNote(""); },
            )
          }
        >
          Создать
        </button>
        <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Отмена</button>
      </div>
      <Err error={error} />
    </div>
  );
}

export function BoardCallActions({ id, hot }: { id: string; hot: boolean }) {
  const { run, pending, error } = useRun();
  return (
    <div>
      <div className="flex gap-2">
        <button type="button" disabled={pending} className="text-[0.7rem] text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" onClick={() => run(() => adminMutate(`/api/admin/board-calls/${id}`, "PATCH", { hot: !hot }))}>
          {hot ? "снять «срочно»" : "пометить «срочно»"}
        </button>
        <button type="button" disabled={pending} className="text-[0.7rem] text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--danger)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" onClick={() => run(() => adminMutate(`/api/admin/board-calls/${id}`, "DELETE"))}>
          удалить
        </button>
      </div>
      <Err error={error} />
    </div>
  );
}
