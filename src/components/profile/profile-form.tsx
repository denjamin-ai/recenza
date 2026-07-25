"use client";

// Форма настроек профиля (Фаза 13.7) — порт ProfileEditModal прототипа (feed.jsx:684).
// Один компонент на два места (решение владельца): страница /settings и модалка «Изменить профиль»
// на своём /u/[slug]. Поля: имя, о себе, ссылки, компетенции (только у ревьюера); аватар —
// отдельный AvatarChanger рядом, у него свой роут загрузки.
//
// Ссылки в прототипе были объектом {github, telegram, website}; в приложении это LinkItem[],
// а иконка выводится по hostname (SocialIcon на /u/) — поэтому форма даёт свободные строки.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LinkItem } from "@/types";

const MAX_LINKS = 5;

const inputCls =
  "min-h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[length:var(--type-small)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
const labelCls =
  "mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]";

export function ProfileForm({
  initial,
  isReviewer,
  onDone,
}: {
  initial: { displayName: string; bio: string | null; links: LinkItem[]; competencies: string[] };
  isReviewer: boolean;
  /** Модалка закрывается по успеху; на странице — undefined. */
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [links, setLinks] = useState<LinkItem[]>(
    initial.links.length > 0 ? initial.links : [{ label: "", url: "" }],
  );
  const [competencies, setCompetencies] = useState(initial.competencies.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setLink(i: number, patch: Partial<LinkItem>) {
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    setSaved(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const body: Record<string, unknown> = {
        displayName,
        bio,
        links: links.filter((l) => l.url.trim()),
      };
      if (isReviewer) {
        body.competencies = competencies
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Не удалось сохранить.");
        return;
      }
      setSaved(true);
      router.refresh();
      onDone?.();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]"
        >
          {error}
        </p>
      )}

      <label className="block">
        <span className={labelCls}>Имя</span>
        <input
          required
          maxLength={80}
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setSaved(false);
          }}
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className={labelCls}>О себе</span>
        <textarea
          rows={3}
          maxLength={1000}
          value={bio}
          onChange={(e) => {
            setBio(e.target.value);
            setSaved(false);
          }}
          className={`${inputCls} min-h-20 resize-y`}
        />
      </label>

      <fieldset className="min-w-0">
        <legend className={labelCls}>Ссылки</legend>
        <div className="flex flex-col gap-2">
          {links.map((l, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input
                aria-label={`Подпись ссылки ${i + 1}`}
                placeholder="GitHub"
                maxLength={40}
                value={l.label}
                onChange={(e) => setLink(i, { label: e.target.value })}
                className={`${inputCls} sm:w-40`}
              />
              <input
                aria-label={`Адрес ссылки ${i + 1}`}
                placeholder="https://…"
                maxLength={200}
                value={l.url}
                onChange={(e) => setLink(i, { url: e.target.value })}
                className={`${inputCls} sm:flex-1`}
              />
            </div>
          ))}
        </div>
        {links.length < MAX_LINKS && (
          <button
            type="button"
            onClick={() => setLinks((p) => [...p, { label: "", url: "" }])}
            className="mt-2 inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            ＋ Ещё ссылка
          </button>
        )}
      </fieldset>

      {isReviewer && (
        <label className="block">
          <span className={labelCls}>Компетенции (через запятую)</span>
          <input
            value={competencies}
            onChange={(e) => {
              setCompetencies(e.target.value);
              setSaved(false);
            }}
            placeholder="TypeScript, Базы данных"
            className={inputCls}
          />
          <span className="mt-1 block text-[0.7rem] text-[var(--muted-foreground)]">
            По ним авторы подбирают ревьюеров — держите список актуальным.
          </span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
        {saved && (
          <span role="status" className="text-[length:var(--type-small)] text-[var(--success)]">
            Сохранено
          </span>
        )}
      </div>
    </form>
  );
}
