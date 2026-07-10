"use client";

// Модалка «Поддержать» (Фаза 10, §11.7; вёрстка — по прототипу donation-ui.jsx DonateModal,
// ui-feedback-4 П4). Адаптивна под число способов: одиночный QR — крупный герой; только ссылки —
// карточки; смешанно — карточки ссылок + сегмент-переключатель QR + компактная QR-строка. БЕЗ сумм.
// QR — загруженное изображение (без генерации). Контролируется родителем (open/onClose).
// Esc/клик по фону закрывают. Золото — токены --gold* (raw-цвета запрещены); теней нет (правило DS).

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
        className="w-full max-w-[420px] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-elevated)] focus:outline-none"
      >
        {/* Шапка: золотой круг-сердце + заголовок с подписью (прототип :156-165) */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-6 pb-4 pt-5">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--gold-bg)] text-[var(--gold)]">
              <IconHeart className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-[length:var(--type-h4)] font-bold leading-tight tracking-tight text-[var(--foreground)]">
                Поддержать Recenza
              </h2>
              <p className="text-[0.72rem] text-[var(--muted-foreground)]">Пожертвования идут на оплату ревьюеров</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-pill)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {config.methods.length === 0 ? (
            <p className="py-4 text-center text-[length:var(--type-small)] text-[var(--muted-foreground)]">Способы поддержки пока не настроены.</p>
          ) : singleQrHero ? (
            <QrHero qr={qr} />
          ) : (
            <>
              {links.length > 0 && (
                <div className="flex flex-col gap-2">
                  {links.map((m) => (
                    <a
                      key={m.id}
                      href={m.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)] ${
                        m.isPrimary
                          ? "bg-[var(--gold-solid)] text-[var(--gold-solid-foreground)] hover:opacity-90"
                          : "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--bg-secondary)]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${
                          m.isPrimary
                            ? "bg-[color-mix(in_srgb,var(--gold-solid-foreground)_18%,transparent)]"
                            : "bg-[var(--gold-bg)] text-[var(--gold)]"
                        }`}
                      >
                        <IconHeart className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[length:var(--type-small)] font-semibold leading-tight">{m.name}</span>
                        {m.hint && (
                          <span className={`block text-[0.72rem] leading-tight ${m.isPrimary ? "text-[color-mix(in_srgb,var(--gold-solid-foreground)_80%,transparent)]" : "text-[var(--muted-foreground)]"}`}>
                            {m.hint}
                          </span>
                        )}
                      </span>
                      <IconExternal className="h-4 w-4 shrink-0" />
                    </a>
                  ))}
                </div>
              )}

              {qrs.length > 0 && (
                <div className={links.length > 0 ? "mt-5" : ""}>
                  {links.length > 0 && (
                    <div className="mb-3.5 flex items-center gap-3">
                      <span className="h-px flex-1 bg-[var(--border)]" />
                      <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">или по QR-коду</span>
                      <span className="h-px flex-1 bg-[var(--border)]" />
                    </div>
                  )}
                  {qrs.length > 1 && (
                    <div className="mb-3.5 flex w-full items-center gap-1 rounded-[var(--radius-md)] bg-[var(--muted)] p-1">
                      {qrs.map((m, i) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setActiveQr(i)}
                          aria-pressed={i === activeQr}
                          className={`min-h-9 flex-1 rounded-[var(--radius-sm)] px-3 py-1.5 text-[0.78rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                            i === activeQr ? "bg-[var(--bg-elevated)] text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <QrRow qr={qr} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Крупный QR-герой (единственный способ — только QR): 150px по центру, имя и hint под ним. */
function QrHero({ qr }: { qr: DonationMethodView | undefined }) {
  if (!qr || !qr.qrUrl) return null;
  return (
    <div className="flex flex-col items-center pt-1 text-center">
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-2">
        <Image src={qr.qrUrl} alt={`QR-код: ${qr.name}`} width={150} height={150} unoptimized className="h-[150px] w-[150px] object-contain" />
      </div>
      <p className="mt-3 text-[length:var(--type-body)] font-semibold text-[var(--foreground)]">{qr.name}</p>
      {qr.hint && (
        <p className="mt-1 inline-flex items-center gap-1.5 text-[0.78rem] leading-relaxed text-[var(--muted-foreground)]">
          <IconScan className="h-3.5 w-3.5 shrink-0" />
          <span>{qr.hint}</span>
        </p>
      )}
    </div>
  );
}

/** Компактная QR-строка (смешанный режим): QR 108px слева, имя/hint справа (прототип :205-211). */
function QrRow({ qr }: { qr: DonationMethodView | undefined }) {
  if (!qr || !qr.qrUrl) return null;
  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
      <div className="shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5">
        <Image src={qr.qrUrl} alt={`QR-код: ${qr.name}`} width={108} height={108} unoptimized className="h-[108px] w-[108px] object-contain" />
      </div>
      <div className="min-w-0">
        <p className="mb-1 text-[length:var(--type-small)] font-semibold text-[var(--foreground)]">{qr.name}</p>
        {qr.hint && (
          <p className="inline-flex items-start gap-1.5 text-[0.75rem] leading-relaxed text-[var(--muted-foreground)]">
            <IconScan className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{qr.hint}</span>
          </p>
        )}
      </div>
    </div>
  );
}
