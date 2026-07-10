"use client";

// Публичная доска «Ищем ревьюеров» (Фаза 10, §11.6; вёрстка — по прототипу reviewer-board.jsx,
// ui-feedback-5 П5): центрированный hero (eyebrow между линиями, 2 CTA, 3 метрики), секция
// «Открытые направления» с фильтром по навыкам, карточки направлений с футером «N глав ждут».
// «Откликнуться»/«Стать ревьюером» → ApplyModal (навыки + сообщение; гостю нужно имя).
// «Как это работает» — 3 шага. Заявка → POST /api/board/applications.

import { useEffect, useRef, useState } from "react";
import { BackLink } from "@/components/back-link";
import { IconX, IconScan, IconEdit } from "@/components/icons";
import { plural } from "@/lib/plural";
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
  const totalWaiting = calls.reduce((sum, c) => sum + c.waiting, 0);

  const chip = (active: boolean) =>
    `min-h-9 rounded-[var(--radius-pill)] border px-3 py-1 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
      active
        ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]"
        : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
    }`;

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-6">
      <div className="mb-4">
        <BackLink href="/">К блогам</BackLink>
      </div>

      {/* Hero по прототипу: центр, eyebrow между линиями, 2 CTA, ряд метрик */}
      <header className="mx-auto mb-10 max-w-2xl border-b border-[var(--border)] pb-10 pt-4 text-center">
        <p className="mb-4 inline-flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          <span aria-hidden="true" className="h-px w-6 bg-[color-mix(in_srgb,var(--accent)_45%,transparent)]" />
          Ищем ревьюеров
          <span aria-hidden="true" className="h-px w-6 bg-[color-mix(in_srgb,var(--accent)_45%,transparent)]" />
        </p>
        <h1 className="mx-auto mb-4 max-w-2xl font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-[var(--foreground)] sm:text-5xl [text-wrap:pretty]">
          Помогите авторам выпускать качественные статьи
        </h1>
        <p className="mx-auto mb-7 max-w-xl text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)] [text-wrap:pretty]">
          Каждая статья проходит ревью перед публикацией. Мы ищем специалистов по направлениям ниже —
          выберите своё и подключайтесь.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setApply({ area: "", skills: [] })}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-5 py-2.5 text-[length:var(--type-small)] font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          >
            <IconEdit className="h-4 w-4" />
            Стать ревьюером
          </button>
          <button
            type="button"
            onClick={() => setHowOpen(true)}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-2.5 text-[length:var(--type-small)] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Как это работает
          </button>
        </div>
        <div className="mt-10 flex items-start justify-center gap-8 sm:gap-12">
          {(
            [
              [String(calls.length), "открытых направлений"],
              [String(totalWaiting), "глав ждут ревью"],
              ["1–5", "звёзд — оценка авторов"],
            ] as const
          ).map(([n, label]) => (
            <div key={label} className="text-center">
              <p className="font-display text-2xl font-extrabold leading-none tabular-nums text-[var(--accent)] sm:text-[26px]">{n}</p>
              <p className="mt-1.5 max-w-[110px] text-[0.72rem] text-[var(--muted-foreground)]">{label}</p>
            </div>
          ))}
        </div>
      </header>

      {/* Открытые направления: заголовок + подпись «ведёт редакция» + фильтр по навыкам */}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight text-[var(--foreground)]">Открытые направления</h2>
        <span className="shrink-0 text-[0.75rem] text-[var(--muted-foreground)]">Список ведёт редакция</span>
      </div>

      {allSkills.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setFilter(null)} aria-pressed={filter === null} className={chip(filter === null)}>
            Все
          </button>
          {allSkills.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(filter === s ? null : s)}
              aria-pressed={filter === s}
              className={chip(filter === s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] p-8 text-center text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          {calls.length === 0
            ? "Открытых направлений сейчас нет. Вы всё равно можете подать общую заявку."
            : "Нет направлений по этому навыку."}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 transition-colors hover:border-[color-mix(in_srgb,var(--foreground)_18%,var(--border))]"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-[17px] font-bold leading-snug tracking-tight text-[var(--foreground)]">{c.area}</h3>
                {c.hot && (
                  <span className="shrink-0 rounded-[var(--radius-pill)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-[var(--accent)]">срочно</span>
                )}
              </div>
              {c.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {c.skills.map((s) => (
                    <span key={s} className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[0.72rem] text-[var(--muted-foreground)]">{s}</span>
                  ))}
                </div>
              )}
              <p className="flex-1 text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)] [text-wrap:pretty]">{c.note}</p>
              <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                <span className="text-[0.75rem] tabular-nums text-[var(--muted-foreground)]">
                  {c.waiting} {plural(c.waiting, "глава ждёт", "главы ждут", "глав ждут")}
                </span>
                <button
                  type="button"
                  onClick={() => setApply({ area: c.area, skills: c.skills })}
                  className="min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] px-3.5 py-1.5 text-[length:var(--type-small)] font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)]"
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
