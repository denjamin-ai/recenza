"use client";

// Клиентские действия экрана «Доска ревьюеров» (ui-feedback-6 П5): создание направления
// (форма ВСЕГДА раскрыта — владелец не находил тоггл) и действия в строке («срочно»/удалить).
// Перенесены из recruit-actions.tsx — доска ведётся на своей странице /admin/board.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminMutate } from "@/app/admin/_components/client";
import { btnPrimary, inputCls } from "@/app/admin/_components/buttons";

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

export function BoardCallCreate() {
  const { run, pending, error } = useRun();
  const [area, setArea] = useState("");
  const [skills, setSkills] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-secondary)] p-3">
      <p className="text-[length:var(--type-small)] font-medium text-[var(--foreground)]">Новое направление</p>
      <input className={inputCls} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Направление (напр. Frontend)" aria-label="Направление" />
      <input className={inputCls} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Навыки через запятую" aria-label="Навыки" />
      <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Заметка (необяз.)" aria-label="Заметка" />
      <button
        type="button"
        disabled={pending || !area.trim()}
        className={btnPrimary}
        onClick={() =>
          run(
            () => adminMutate("/api/admin/board-calls", "POST", { area, skills: skills.split(",").map((s) => s.trim()).filter(Boolean), note: note || undefined }),
            () => { setArea(""); setSkills(""); setNote(""); },
          )
        }
      >
        Создать
      </button>
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
