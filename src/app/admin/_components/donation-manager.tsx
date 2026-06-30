"use client";

// Управление пожертвованиями (Фаза 10): мастер-флаг donations_enabled + способы (link/qr).
// QR — только путь /uploads/ (загрузка, без генерации). Без сумм. Независимо от баннеров.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminMutate } from "@/app/admin/_components/client";
import { DONATION_TYPES, type DonationType } from "@/types";
import type { AdminDonationData } from "@/lib/queries/admin";

const inputCls =
  "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 text-[length:var(--type-small)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
const btnPrimary =
  "min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60";
const btnGhost =
  "min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60";

type Method = AdminDonationData["methods"][number];

interface Draft {
  name: string;
  type: DonationType;
  url: string;
  qrUrl: string;
  hint: string;
  isPrimary: boolean;
}

function fromRow(m?: Method): Draft {
  return {
    name: m?.name ?? "",
    type: m?.type ?? "link",
    url: m?.url ?? "",
    qrUrl: m?.qrUrl ?? "",
    hint: m?.hint ?? "",
    isPrimary: m?.isPrimary ?? false,
  };
}

function MethodForm({ initial, onSubmit, onCancel, pending }: { initial: Draft; onSubmit: (d: Draft) => void; onCancel: () => void; pending: boolean }) {
  const [d, setD] = useState<Draft>(initial);
  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={inputCls} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Название (DonationAlerts, СБП…)" aria-label="Название" />
        <select className={inputCls} value={d.type} onChange={(e) => set({ type: e.target.value as DonationType })} aria-label="Тип">
          {DONATION_TYPES.map((t) => (
            <option key={t} value={t}>{t === "link" ? "Ссылка" : "QR-код"}</option>
          ))}
        </select>
      </div>
      {d.type === "link" ? (
        <input className={inputCls} value={d.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" aria-label="Ссылка" />
      ) : (
        <input className={inputCls} value={d.qrUrl} onChange={(e) => set({ qrUrl: e.target.value })} placeholder="/uploads/donations/qr.png" aria-label="Путь к QR" />
      )}
      <input className={inputCls} value={d.hint} onChange={(e) => set({ hint: e.target.value })} placeholder="Подсказка (необяз.)" aria-label="Подсказка" />
      <label className="flex items-center gap-2 text-[length:var(--type-small)] text-[var(--foreground)]">
        <input type="checkbox" checked={d.isPrimary} onChange={(e) => set({ isPrimary: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
        Основной способ
      </label>
      <div className="flex gap-2">
        <button type="button" disabled={pending || !d.name.trim()} className={btnPrimary} onClick={() => onSubmit(d)}>Сохранить</button>
        <button type="button" className={btnGhost} onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}

export function DonationManager({ data }: { data: AdminDonationData }) {
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
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]">{error}</p>
      )}

      <label className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-secondary)] p-3">
        <span className="text-[length:var(--type-small)] text-[var(--foreground)]">Пожертвования включены</span>
        <input
          type="checkbox"
          checked={data.enabled}
          disabled={pending}
          onChange={(e) => run(() => adminMutate("/api/admin/settings", "PATCH", { donationsEnabled: e.target.checked }))}
          className="h-5 w-5 accent-[var(--accent)]"
          aria-label="Включить пожертвования"
        />
      </label>

      <ul className="space-y-2">
        {data.methods.map((m) => (
          <li key={m.id} className="rounded-[var(--radius-md)] border border-[var(--border-secondary)] p-3">
            {editing === m.id ? (
              <MethodForm
                initial={fromRow(m)}
                pending={pending}
                onCancel={() => setEditing(null)}
                onSubmit={(d) => run(() => adminMutate(`/api/admin/donation-methods/${m.id}`, "PATCH", d), () => setEditing(null))}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="font-medium text-[var(--foreground)]">{m.name}</span>
                  <span className="ml-2 text-[0.7rem] text-[var(--muted-foreground)]">{m.type === "link" ? "ссылка" : "QR"}{m.isPrimary ? " · основной" : ""}{m.visible ? "" : " · скрыт"}</span>
                </span>
                <span className="flex shrink-0 gap-2 text-[0.7rem]">
                  <button type="button" disabled={pending} className="text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--accent)] hover:underline" onClick={() => setEditing(m.id)}>править</button>
                  <button type="button" disabled={pending} className="text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--accent)] hover:underline" onClick={() => run(() => adminMutate(`/api/admin/donation-methods/${m.id}`, "PATCH", { visible: !m.visible }))}>
                    {m.visible ? "скрыть" : "показать"}
                  </button>
                  <button type="button" disabled={pending} className="text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--danger)] hover:underline" onClick={() => run(() => adminMutate(`/api/admin/donation-methods/${m.id}`, "DELETE"))}>удалить</button>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--border-secondary)] p-3">
          <MethodForm
            initial={fromRow()}
            pending={pending}
            onCancel={() => setCreating(false)}
            onSubmit={(d) => run(() => adminMutate("/api/admin/donation-methods", "POST", { ...d, sort: data.methods.length }), () => setCreating(false))}
          />
        </div>
      ) : (
        <button type="button" className={btnGhost} onClick={() => setCreating(true)}>+ Новый способ</button>
      )}
    </div>
  );
}
