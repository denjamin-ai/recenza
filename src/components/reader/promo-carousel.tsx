"use client";

// Карусель промо-баннеров ленты (Фаза 10, §11.7). Авто-прокрутка + стрелки + точки. Действие CTA:
// internal → переход внутри приложения; external → новая вкладка; donate → модалка «Поддержать».
// «Стать ревьюером» переехала сюда из шапки (баннер pb_recruit → /board). Токены, без теней.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconHeart, IconUsers, IconStar, IconEdit, IconChevronLeft, IconChevronRight, IconExternal } from "@/components/icons";
import { DonateModal } from "@/components/reader/donate-modal";
import { isHttpUrl, isInternalPath } from "@/lib/url";
import type { FeedBanner } from "@/lib/queries/monetization";
import type { DonationConfig } from "@/lib/queries/monetization";

const ROTATE_MS = 6000;

/** Тон слайда → класс с --promo-ink (заливки считает globals.css: .promo-slide/-art/-wash). */
function tone(t: string | null): string {
  if (t === "amber") return "promo-ink-warning";
  if (t === "neutral") return "promo-ink-neutral";
  return "promo-ink-accent"; // teal по умолчанию
}

function BannerIcon({ name, className }: { name: string | null; className?: string }) {
  if (name === "users") return <IconUsers className={className} />;
  if (name === "heart") return <IconHeart className={className} />;
  if (name === "pen") return <IconEdit className={className} />;
  return <IconStar className={className} />;
}

export function PromoCarousel({ banners, donation }: { banners: FeedBanner[]; donation: DonationConfig }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [donateOpen, setDonateOpen] = useState(false);
  const pausedRef = useRef(false);

  const count = banners.length;
  useEffect(() => {
    if (count <= 1) return;
    // Авторотация ВСЕГДА (ui-feedback-5 П3): смена слайда мгновенная (не анимация), поэтому
    // prefers-reduced-motion её не блокирует; WCAG 2.2.2-контроль — пауза при hover/focus
    // (pausedRef) + ручные точки/стрелки.
    const t = window.setInterval(() => {
      if (!pausedRef.current) setIndex((i) => (i + 1) % count);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [count]);

  if (count === 0) return null;

  const b = banners[Math.min(index, count - 1)];

  function activate(banner: FeedBanner) {
    if (banner.action === "donate") {
      setDonateOpen(true);
    } else if (banner.action === "external" && banner.target && isHttpUrl(banner.target)) {
      window.open(banner.target, "_blank", "noopener,noreferrer");
    } else if (banner.action === "internal" && banner.target && isInternalPath(banner.target)) {
      router.push(banner.target);
    }
  }

  return (
    <section
      aria-label="Промо"
      aria-roledescription="карусель"
      className="mb-6"
      onPointerEnter={() => { pausedRef.current = true; }}
      onPointerLeave={() => { pausedRef.current = false; }}
      onFocusCapture={() => { pausedRef.current = true; }}
      onBlurCapture={() => { pausedRef.current = false; }}
    >
      {/* Слайд по прототипу (donation-ui.jsx BannerSlide): декоративная панель-иконка (sm+) +
          контент колонкой на градиентной заливке: eyebrow → title → CTA ПОД текстом слева
          (ui-feedback-4, реверс «всегда справа» из ui-feedback-3). CTA — пилюля --promo-cta-bg
          с ВСЕГДА белым текстом (в dark фон кнопки затемняется токеном, см. globals.css). */}
      <div className={`promo-slide relative flex min-h-36 overflow-hidden rounded-[var(--radius-xl)] ${tone(b.tone)}`}>
        <div className="promo-slide-art relative hidden w-[30%] shrink-0 sm:block">
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[var(--promo-ink)] opacity-40">
            <BannerIcon name={b.icon} className="h-10 w-10" />
          </span>
        </div>
        {/* max-sm:pl-12 — на узких экранах контент начинается правее левой стрелки (панели-иконки нет) */}
        <div className={`promo-slide-wash flex min-w-0 flex-1 flex-col justify-center px-5 py-5 sm:px-6 ${count > 1 ? "max-sm:pl-12" : ""}`}>
          {b.eyebrow && (
            <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--promo-ink)]">{b.eyebrow}</p>
          )}
          {b.title && (
            <p className="max-w-md font-display text-[length:var(--type-h4)] font-bold leading-tight text-[var(--foreground)] [text-wrap:pretty] sm:text-[21px]">
              {b.title}
            </p>
          )}
          {b.cta && (
            <button
              type="button"
              onClick={() => activate(b)}
              className="mt-3.5 inline-flex items-center gap-2 self-start rounded-[var(--radius-pill)] bg-[var(--promo-cta-bg)] py-2 pl-2.5 pr-4 text-[length:var(--type-small)] font-semibold text-[var(--promo-cta-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)]"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[var(--radius-pill)] bg-[color-mix(in_srgb,var(--promo-cta-foreground)_22%,transparent)]"
              >
                <BannerIcon name={b.icon} className="h-3.5 w-3.5" />
              </span>
              {b.cta}
              {b.action === "external" && <IconExternal className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {count > 1 && (
          <>
            {/* Стрелки по прототипу: «плавающие» круги с фоном и рамкой — не сливаются с CTA. */}
            <button
              type="button"
              aria-label="Предыдущий баннер"
              onClick={() => setIndex((i) => (i - 1 + count) % count)}
              className="absolute left-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--bg-elevated)]/85 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <IconChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Следующий баннер"
              onClick={() => setIndex((i) => (i + 1) % count)}
              className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--bg-elevated)]/85 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <IconChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {banners.map((bn, i) => (
            <button
              key={bn.id}
              type="button"
              aria-label={`Баннер ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
              className={`h-[7px] rounded-[var(--radius-pill)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${i === index ? "w-[22px] bg-[var(--accent)]" : "w-[7px] bg-[var(--border)]"}`}
            />
          ))}
        </div>
      )}

      <DonateModal open={donateOpen} onClose={() => setDonateOpen(false)} config={donation} />
    </section>
  );
}
