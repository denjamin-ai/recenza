// Анкета по инвайт-ссылке эксперта (Фаза 14). Форма повторяет поля ApplyModal доски
// (`reviewer-board.tsx`), но живёт на отдельной странице: приглашённый эксперт приходит по прямой
// ссылке, а не с доски, и модалка тут была бы лишним слоем.
"use client";

import { useState } from "react";
import Link from "next/link";
import { IconCheck, IconX } from "@/components/icons";

const inputCls =
  "w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[length:var(--type-small)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export function InviteForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
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
    if (!name.trim()) {
      setError("Представьтесь, пожалуйста.");
      return;
    }
    if (!area.trim()) {
      setError("Укажите направление.");
      return;
    }
    if (skills.length === 0) {
      setError("Добавьте хотя бы один навык.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/invite/${token}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, area, skills, message: message || undefined }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Не удалось отправить анкету.");
    } catch {
      setError("Сетевая ошибка. Проверьте соединение.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] px-6 py-10 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--success-bg)] text-[var(--success)]">
          <IconCheck className="h-5 w-5" />
        </span>
        <p className="text-[var(--foreground)]">
          Анкета отправлена. Редакция свяжется с вами и заведёт аккаунт.
        </p>
        <Link
          href="/"
          className="mt-1 min-h-9 text-[length:var(--type-small)] text-[var(--accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]"
        >
          {error}
        </p>
      )}
      <input
        className={inputCls}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ваше имя"
        aria-label="Имя"
      />
      <input
        className={inputCls}
        value={area}
        onChange={(e) => setArea(e.target.value)}
        placeholder="Направление (Frontend, Backend…)"
        aria-label="Направление"
      />
      <div>
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill();
              }
            }}
            placeholder="Навык + Enter"
            aria-label="Добавить навык"
          />
          <button
            type="button"
            onClick={addSkill}
            className="min-h-9 shrink-0 rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-[length:var(--type-small)] text-[var(--foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Добавить
          </button>
        </div>
        {skills.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {skills.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => setSkills(skills.filter((x) => x !== s))}
                  aria-label={`Убрать навык ${s}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-[length:var(--type-small)] text-[var(--foreground)] hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  {s}
                  <IconX className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <textarea
        className={`${inputCls} min-h-[96px]`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Коротко о вашем опыте (необязательно)"
        aria-label="О вашем опыте"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="min-h-9 w-full rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[length:var(--type-body)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      >
        {pending ? "Отправляем…" : "Отправить анкету"}
      </button>
    </div>
  );
}
