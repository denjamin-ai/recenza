"use client";

// Публичная доска «Ищем ревьюеров» (Фаза 10, §11.6): фильтр по навыкам, карточки направлений,
// «Откликнуться»/«Стать ревьюером» → ApplyModal (навыки + сообщение). Откликнуться может и гость
// (тогда нужно имя). «Как это работает» — 3 шага. Заявка → POST /api/board/applications.

import { useEffect, useRef, useState } from "react";
import { IconX, IconScan } from "@/components/icons";
import type { BoardCallView } from "@/lib/queries/board";

// Esc закрывает модалку + автофокус на диалог при открытии (a11y для role="dialog"). Два эффекта:
// фокус — один раз на маунт (не воруем фокус из инпутов при ре-рендере); Esc — переподписка на onClose.
function useModalA11y(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return ref;
}

export function ReviewerBoard({ calls, isAuthed }: { calls: BoardCallView[]; isAuthed: boolean }) {
  const [filter, setFilter] = useState<string | null>(null);
  const [apply, setApply] = useState<{ area: string; skills: string[] } | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  const allSkills = [...new Set(calls.flatMap((c) => c.skills))].sort((a, b) => a.localeCompare(b, "ru"));
  const visible = filter ? calls.filter((c) => c.skills.includes(filter)) : calls;

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <header className="mb-8 max-w-2xl">
        <p className="mb-1 text-[0.7rem] font-medium uppercase tracking-wider text-[var(--accent)]">Сообщество</p>
        <h1 className="font-display text-[length:var(--type-h2)] font-bold text-[var(--foreground)] [text-wrap:pretty]">
          Помогите авторам выпускать качественные статьи
        </h1>
        <p className="mt-2 text-[length:var(--type-body)] text-[var(--muted-foreground)] [text-wrap:pretty]">
          Рецензируйте главы по своим компетенциям. Откликнитесь на открытое направление — или подайте общую заявку.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setApply({ area: "", skills: [] })}
            className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          >
            Стать ревьюером
          </button>
          <button
            type="button"
            onClick={() => setHowOpen(true)}
            className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Как это работает
          </button>
        </div>
      </header>

      {allSkills.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilter(null)}
            aria-pressed={filter === null}
            className={`min-h-9 rounded-[var(--radius-pill)] border px-3 py-1 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${filter === null ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"}`}
          >
            Все
          </button>
          {allSkills.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={`min-h-9 rounded-[var(--radius-pill)] border px-3 py-1 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${filter === s ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] p-8 text-center text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Пока нет открытых направлений. Вы всё равно можете подать общую заявку.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <li key={c.id} className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-elevated)] p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="font-display text-[length:var(--type-h4)] font-bold text-[var(--foreground)]">{c.area}</h2>
                {c.hot && (
                  <span className="rounded-[var(--radius-pill)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-2 py-0.5 text-[0.7rem] font-medium text-[var(--danger)]">срочно</span>
                )}
              </div>
              {c.skills.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {c.skills.map((s) => (
                    <span key={s} className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[0.7rem] text-[var(--muted-foreground)]">{s}</span>
                  ))}
                </div>
              )}
              {c.note && <p className="mb-3 text-[length:var(--type-small)] text-[var(--muted-foreground)] [text-wrap:pretty]">{c.note}</p>}
              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                <span className="text-[0.7rem] text-[var(--muted-foreground)]">в ожидании: {c.waiting}</span>
                <button
                  type="button"
                  onClick={() => setApply({ area: c.area, skills: c.skills })}
                  className="min-h-9 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent-bg)] px-3 py-1.5 text-[length:var(--type-small)] font-medium text-[var(--accent)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  Откликнуться
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {apply && <ApplyModal initialArea={apply.area} initialSkills={apply.skills} isAuthed={isAuthed} onClose={() => setApply(null)} />}
      {howOpen && <HowItWorksModal onClose={() => setHowOpen(false)} />}
    </div>
  );
}

function ApplyModal({
  initialArea,
  initialSkills,
  isAuthed,
  onClose,
}: {
  initialArea: string;
  initialSkills: string[];
  isAuthed: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [area, setArea] = useState(initialArea);
  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function addSkill() {
    const s = draft.trim();
    if (s && !skills.includes(s)) setSkills([...skills, s]);
    setDraft("");
  }

  async function submit() {
    setError(null);
    if (!area.trim()) { setError("Укажите направление."); return; }
    if (skills.length === 0) { setError("Добавьте хотя бы один навык."); return; }
    if (!isAuthed && !name.trim()) { setError("Представьтесь, пожалуйста."); return; }
    setPending(true);
    try {
      const res = await fetch("/api/board/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, skills, message: message || undefined, name: isAuthed ? undefined : name }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Не удалось отправить заявку.");
    } catch {
      setError("Сетевая ошибка. Проверьте соединение.");
    } finally {
      setPending(false);
    }
  }

  const dialogRef = useModalA11y(onClose);
  const inputCls =
    "w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[length:var(--type-small)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Заявка на ревью" className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 focus:outline-none">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[length:var(--type-h4)] font-bold text-[var(--foreground)]">Стать ревьюером</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--accent-bg)] text-[var(--accent)]"><IconScan className="h-5 w-5" /></span>
            <p className="text-[length:var(--type-small)] text-[var(--foreground)]">Заявка отправлена! Администратор её рассмотрит.</p>
            <button type="button" onClick={onClose} className="mt-2 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-[length:var(--type-small)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Готово</button>
          </div>
        ) : (
          <div className="space-y-3">
            {error && <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]">{error}</p>}
            {!isAuthed && <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" aria-label="Имя" />}
            <input className={inputCls} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Направление (Frontend, Backend…)" aria-label="Направление" />
            <div>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                  placeholder="Навык + Enter"
                  aria-label="Добавить навык"
                />
                <button type="button" onClick={addSkill} className="min-h-9 shrink-0 rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-[length:var(--type-small)] text-[var(--foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Добавить</button>
              </div>
              {skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <button key={s} type="button" onClick={() => setSkills(skills.filter((x) => x !== s))} className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--accent)] bg-[var(--accent-bg)] px-2 py-0.5 text-[0.7rem] text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
                      {s} <IconX className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <textarea className={`${inputCls} min-h-20`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Пара слов о вашем опыте (необяз.)" aria-label="Сообщение" />
            <button type="button" disabled={pending} onClick={submit} className="w-full min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60">
              {pending ? "Отправка…" : "Отправить заявку"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function HowItWorksModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useModalA11y(onClose);
  const steps = [
    "Подайте заявку с навыками — или откликнитесь на открытое направление.",
    "Администратор рассмотрит заявку; при одобрении вы получите роль ревьюера.",
    "Принимайте приглашения авторов и рецензируйте главы. Авторы оценят вашу работу.",
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Как это работает" className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 focus:outline-none">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[length:var(--type-h4)] font-bold text-[var(--foreground)]">Как это работает</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
            <IconX className="h-4 w-4" />
          </button>
        </div>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--accent-bg)] text-[0.8rem] font-bold text-[var(--accent)]">{i + 1}</span>
              <span className="text-[length:var(--type-small)] text-[var(--foreground)] [text-wrap:pretty]">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
