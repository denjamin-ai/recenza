"use client";

// Модалка «Поддержать» (Фаза 10, §11.7). Адаптивна под число способов: одиночный QR — крупный герой;
// только ссылки — кнопки; смешанно — кнопки ссылок + переключатель QR. БЕЗ сумм. QR — загруженное
// изображение (без генерации). Контролируется родителем (open/onClose). Esc/клик по фону закрывают.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { IconX, IconHeart, IconExternal, IconScan } from "@/components/icons";
import type { DonationConfig, DonationMethodView } from "@/lib/queries/monetization";

export function DonateModal({ open, onClose, config }: { open: boolean; onClose: () => void; config: DonationConfig }) {
  const links = config.methods.filter((m) => m.type === "link");
  const qrs = config.methods.filter((m) => m.type === "qr");
  const dialogRef = useRef<HTMLDivElement>(null);
  const [activeQr, setActiveQr] = useState(0);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const singleQrHero = qrs.length === 1 && links.length === 0;
  const qr = qrs[Math.min(activeQr, qrs.length - 1)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Поддержать проект"
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 focus:outline-none"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-[length:var(--type-h4)] font-bold text-[var(--foreground)]">
            <IconHeart className="h-5 w-5 text-[var(--accent)]" /> Поддержать Recenza
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {config.methods.length === 0 ? (
          <p className="py-6 text-center text-[length:var(--type-small)] text-[var(--muted-foreground)]">Способы поддержки пока не настроены.</p>
        ) : singleQrHero ? (
          <QrHero qr={qr} />
        ) : (
          <div className="space-y-4">
            {links.length > 0 && (
              <div className="space-y-2">
                {links.map((m) => (
                  <a
                    key={m.id}
                    href={m.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                      m.isPrimary
                        ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)] hover:opacity-90"
                        : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{m.name}</span>
                      {m.hint && <span className="ml-2 text-[0.7rem] text-[var(--muted-foreground)]">{m.hint}</span>}
                    </span>
                    <IconExternal className="h-4 w-4 shrink-0" />
                  </a>
                ))}
              </div>
            )}

            {qrs.length > 0 && (
              <div>
                {links.length > 0 && (
                  <div className="my-3 flex items-center gap-3 text-[0.7rem] uppercase tracking-wider text-[var(--muted-foreground)]">
                    <span className="h-px flex-1 bg-[var(--border)]" /> или сканируйте <span className="h-px flex-1 bg-[var(--border)]" />
                  </div>
                )}
                {qrs.length > 1 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {qrs.map((m, i) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setActiveQr(i)}
                        aria-pressed={i === activeQr}
                        className={`rounded-[var(--radius-pill)] border px-2.5 py-1 text-[0.7rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                          i === activeQr ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
                <QrHero qr={qr} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QrHero({ qr }: { qr: DonationMethodView | undefined }) {
  if (!qr || !qr.qrUrl) return null;
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <span className="flex items-center gap-1.5 text-[length:var(--type-small)] font-medium text-[var(--foreground)]">
        <IconScan className="h-4 w-4 text-[var(--accent)]" /> {qr.name}
      </span>
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-2">
        <Image src={qr.qrUrl} alt={`QR-код: ${qr.name}`} width={176} height={176} unoptimized className="h-44 w-44 object-contain" />
      </div>
      {qr.hint && <p className="text-[0.7rem] text-[var(--muted-foreground)]">{qr.hint}</p>}
    </div>
  );
}
