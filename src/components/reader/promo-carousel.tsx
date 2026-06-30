"use client";

// Карусель промо-баннеров ленты (Фаза 10, §11.7). Авто-прокрутка + стрелки + точки. Действие CTA:
// internal → переход внутри приложения; external → новая вкладка; donate → модалка «Поддержать».
// «Стать ревьюером» переехала сюда из шапки (баннер pb_recruit → /board). Токены, без теней.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconHeart, IconUsers, IconStar, IconChevronLeft, IconChevronRight, IconExternal } from "@/components/icons";
import { DonateModal } from "@/components/reader/donate-modal";
import type { FeedBanner } from "@/lib/queries/monetization";
import type { DonationConfig } from "@/lib/queries/monetization";

const ROTATE_MS = 6000;

function tone(t: string | null): string {
  if (t === "amber") return "border-[var(--warning-border)] bg-[var(--warning-bg)]";
  if (t === "neutral") return "border-[var(--border)] bg-[var(--bg-secondary)]";
  return "border-[var(--accent)] bg-[var(--accent-bg)]"; // teal по умолчанию
}

function BannerIcon({ name, className }: { name: string | null; className?: string }) {
  if (name === "users") return <IconUsers className={className} />;
  if (name === "heart") return <IconHeart className={className} />;
  return <IconStar className={className} />;
}

export function PromoCarousel({ banners, donation }: { banners: FeedBanner[]; donation: DonationConfig }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [donateOpen, setDonateOpen] = useState(false);

  const count = banners.length;
  useEffect(() => {
    if (count <= 1) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [count]);

  if (count === 0) return null;

  const b = banners[Math.min(index, count - 1)];

  function activate(banner: FeedBanner) {
    if (banner.action === "donate") {
      setDonateOpen(true);
    } else if (banner.action === "external" && banner.target) {
      window.open(banner.target, "_blank", "noopener,noreferrer");
    } else if (banner.action === "internal" && banner.target) {
      router.push(banner.target);
    }
  }

  return (
    <section aria-label="Промо" aria-roledescription="карусель" className="mb-6">
      <div className={`relative flex items-center gap-4 overflow-hidden rounded-[var(--radius-lg)] border p-4 sm:p-5 ${tone(b.tone)}`}>
        <BannerIcon name={b.icon} className="hidden h-10 w-10 shrink-0 text-[var(--foreground)] opacity-70 sm:block" />
        <div className="min-w-0 flex-1">
          {b.eyebrow && <p className="text-[0.7rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{b.eyebrow}</p>}
          {b.title && <p className="font-display text-[length:var(--type-h4)] font-bold text-[var(--foreground)] [text-wrap:pretty]">{b.title}</p>}
        </div>
        {b.cta && (
          <button
            type="button"
            onClick={() => activate(b)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] px-3.5 py-2 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)]"
          >
            {b.cta}
            {b.action === "external" && <IconExternal className="h-3.5 w-3.5" />}
          </button>
        )}

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Предыдущий баннер"
              onClick={() => setIndex((i) => (i - 1 + count) % count)}
              className="absolute left-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[var(--radius-pill)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <IconChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Следующий баннер"
              onClick={() => setIndex((i) => (i + 1) % count)}
              className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[var(--radius-pill)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <IconChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {banners.map((bn, i) => (
            <button
              key={bn.id}
              type="button"
              aria-label={`Баннер ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-[var(--radius-pill)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${i === index ? "w-5 bg-[var(--accent)]" : "w-1.5 bg-[var(--border)]"}`}
            />
          ))}
        </div>
      )}

      <DonateModal open={donateOpen} onClose={() => setDonateOpen(false)} config={donation} />
    </section>
  );
}
