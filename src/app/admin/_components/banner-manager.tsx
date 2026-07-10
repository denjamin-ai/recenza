"use client";

// Управление промо-баннерами ленты (Фаза 10): создание/редактирование (с валидацией target по action),
// тоггл видимости, удаление, порядок (sort). Независимо от пожертвований.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminMutate } from "@/app/admin/_components/client";
import { btnPrimary, btnSecondary as btnGhost, btnText, inputCls } from "@/app/admin/_components/buttons";
import { BANNER_ACTIONS, type BannerAction } from "@/types";
import { BANNER_LIMITS } from "@/lib/banners";
import type { AdminBannerRow } from "@/lib/queries/admin";

const ACTION_LABEL: Record<BannerAction, string> = { internal: "Внутр. ссылка", external: "Внешняя ссылка", donate: "Открыть пожертвования" };

interface Draft {
  eyebrow: string;
  title: string;
  cta: string;
  tone: string;
  icon: string;
  action: BannerAction;
  target: string;
}

function fromRow(b?: AdminBannerRow): Draft {
  return {
    eyebrow: b?.eyebrow ?? "",
    title: b?.title ?? "",
    cta: b?.cta ?? "",
    tone: b?.tone ?? "teal",
    icon: b?.icon ?? "heart",
    action: b?.action ?? "internal",
    target: b?.target ?? "",
  };
}

function LimitedField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: string;
  max: number;
  onChange: (v: string) => void;
}) {
  return (
    <span className="relative block">
      <input className={`${inputCls} pr-14`} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} placeholder={label} aria-label={label} />
      <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[0.7rem] tabular-nums text-[var(--muted-foreground)]">
        {value.length}/{max}
      </span>
    </span>
  );
}

function BannerForm({ initial, onSubmit, onCancel, pending }: { initial: Draft; onSubmit: (d: Draft) => void; onCancel: () => void; pending: boolean }) {
  const [d, setD] = useState<Draft>(initial);
  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <LimitedField label="Заголовок" value={d.title} max={BANNER_LIMITS.title} onChange={(v) => set({ title: v })} />
        <LimitedField label="Надзаголовок" value={d.eyebrow} max={BANNER_LIMITS.eyebrow} onChange={(v) => set({ eyebrow: v })} />
        <LimitedField label="Текст кнопки" value={d.cta} max={BANNER_LIMITS.cta} onChange={(v) => set({ cta: v })} />
        <select className={inputCls} value={d.tone} onChange={(e) => set({ tone: e.target.value })} aria-label="Тон">
          <option value="teal">teal</option>
          <option value="amber">amber</option>
          <option value="neutral">neutral</option>
        </select>
        <input className={inputCls} value={d.icon} onChange={(e) => set({ icon: e.target.value })} placeholder="Иконка (users/book/heart…)" aria-label="Иконка" />
        <select className={inputCls} value={d.action} onChange={(e) => set({ action: e.target.value as BannerAction })} aria-label="Действие">
          {BANNER_ACTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_LABEL[a]}</option>
          ))}
        </select>
      </div>
      {d.action !== "donate" && (
        <input
          className={inputCls}
          value={d.target}
          onChange={(e) => set({ target: e.target.value })}
          placeholder={d.action === "external" ? "https://…" : "/путь"}
          aria-label="Цель ссылки"
        />
      )}
      <div className="flex gap-2">
        <button type="button" disabled={pending || !d.title.trim()} className={btnPrimary} onClick={() => onSubmit(d)}>Сохранить</button>
        <button type="button" className={btnText} onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}

export function BannerManager({ banners }: { banners: AdminBannerRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) { setError(res.error ?? "Не удалось."); return; }
      after?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]">{error}</p>
      )}

      <ul className="space-y-2">
        {banners.map((b) => (
          <li key={b.id} className="rounded-[var(--radius-md)] border border-[var(--border-secondary)] p-3">
            {editing === b.id ? (
              <BannerForm
                initial={fromRow(b)}
                pending={pending}
                onCancel={() => setEditing(null)}
                onSubmit={(d) => run(() => adminMutate(`/api/admin/banners/${b.id}`, "PATCH", d), () => setEditing(null))}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="font-medium text-[var(--foreground)]">{b.title ?? "(без заголовка)"}</span>
                  <span className="ml-2 text-[0.7rem] text-[var(--muted-foreground)]">{ACTION_LABEL[b.action ?? "internal"]}{b.target ? ` · ${b.target}` : ""}{b.visible ? "" : " · скрыт"}</span>
                </span>
                <span className="flex shrink-0 gap-2 text-[0.7rem]">
                  <button type="button" disabled={pending} className="text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--accent)] hover:underline" onClick={() => setEditing(b.id)}>править</button>
                  <button type="button" disabled={pending} className="text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--accent)] hover:underline" onClick={() => run(() => adminMutate(`/api/admin/banners/${b.id}`, "PATCH", { visible: !b.visible }))}>
                    {b.visible ? "скрыть" : "показать"}
                  </button>
                  <button type="button" disabled={pending} className="text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--danger)] hover:underline" onClick={() => run(() => adminMutate(`/api/admin/banners/${b.id}`, "DELETE"))}>удалить</button>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--border-secondary)] p-3">
          <BannerForm
            initial={fromRow()}
            pending={pending}
            onCancel={() => setCreating(false)}
            onSubmit={(d) => run(() => adminMutate("/api/admin/banners", "POST", { ...d, sort: banners.length }), () => setCreating(false))}
          />
        </div>
      ) : (
        <button type="button" className={btnGhost} onClick={() => setCreating(true)}>+ Новый баннер</button>
      )}
    </div>
  );
}
