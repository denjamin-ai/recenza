// Бейдж проверки (Ф14) для читательских поверхностей. Чистый RSC — без хуков и клиентских API.
//
// Два уровня — это ПРОЗРАЧНОСТЬ, а не запрет: читатель должен видеть, кем проверена статья.
//   • independent — ревьюер, не связанный с автором   → «Проверено на Recenza» (--success)
//   • invited     — эксперт, приглашённый автором      → «Проверено приглашённым экспертом» (--info)
//
// Бейдж привязан к НОМЕРУ ревизии и иммутабелен. Если проверенная версия старше отображаемой,
// рисуем приглушённый вариант с точной формулировкой владельца:
// «Проверена версия {N} от {дата} · текущая версия изменилась» — он же ссылка на `?v={N}`.

import Link from "next/link";
import { IconShieldCheck } from "@/components/icons";
import type { VerifiedTier } from "@/types";

const TIER_LABEL: Record<VerifiedTier, string> = {
  independent: "Проверено на Recenza",
  invited: "Проверено приглашённым экспертом",
};

const TIER_CLASS: Record<VerifiedTier, string> = {
  independent: "bg-[var(--success-bg)] text-[var(--success)]",
  invited: "bg-[var(--info-bg)] text-[var(--info)]",
};

const CHIP_BASE =
  "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] font-medium";
/** Размеры чипа: md — ридер/кредит, sm — плотный eyebrow карточки каталога. */
const CHIP_SIZE = {
  md: "px-2.5 py-1 text-[length:var(--type-small)]",
  sm: "px-2 py-0.5 text-[0.66rem]",
} as const;

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Unix seconds → «5 июля 2026». null → null. */
export function formatVerifiedDate(unixSeconds: number | null): string | null {
  if (!unixSeconds) return null;
  return dateFmt.format(new Date(unixSeconds * 1000));
}

/** Читаемая подпись уровня (для мест, где нужен только текст). */
export function verifiedLabel(tier: VerifiedTier | null): string | null {
  return tier ? TIER_LABEL[tier] : null;
}

/**
 * Компактный чип уровня без логики устаревания — карточки каталога и агрегированный кредит блога
 * (там бейдж исторический: «блог проходил ревью»).
 */
export function VerifiedChip({
  tier,
  size = "md",
}: {
  tier: VerifiedTier | null;
  size?: keyof typeof CHIP_SIZE;
}) {
  if (!tier) return null;
  return (
    <span className={`${CHIP_BASE} ${CHIP_SIZE[size]} ${TIER_CLASS[tier]}`}>
      <IconShieldCheck className={size === "sm" ? "h-3 w-3 shrink-0" : "h-3.5 w-3.5 shrink-0"} />
      {TIER_LABEL[tier]}
    </span>
  );
}

export function VerifiedBadge({
  tier,
  verifiedRevision,
  currentRevision,
  verifiedAt,
  href,
}: {
  tier: VerifiedTier | null;
  /** Номер ПРОВЕРЕННОЙ ревизии (может быть старше отображаемой). */
  verifiedRevision: number | null;
  /** Номер отображаемой ревизии. */
  currentRevision: number;
  verifiedAt: number | null;
  /** Куда ведёт приглушённый бейдж (обычно `?v={verifiedRevision}`). */
  href?: string;
}) {
  if (!tier) return null;

  const stale = verifiedRevision !== null && verifiedRevision < currentRevision;

  if (!stale) {
    return (
      <span
        className={`${CHIP_BASE} ${CHIP_SIZE.md} ${TIER_CLASS[tier]}`}
        title={formatVerifiedDate(verifiedAt) ?? undefined}
      >
        <IconShieldCheck className="h-3.5 w-3.5 shrink-0" />
        {TIER_LABEL[tier]}
      </span>
    );
  }

  const date = formatVerifiedDate(verifiedAt);
  // ⚠️ Формулировка — прямое требование владельца, менять нельзя.
  const text = `Проверена версия ${verifiedRevision} от ${date ?? "—"} · текущая версия изменилась`;
  const muted = `${CHIP_BASE} ${CHIP_SIZE.md} bg-[var(--muted)] text-[var(--muted-foreground)]`;

  if (!href) {
    return (
      <span className={muted}>
        <IconShieldCheck className="h-3.5 w-3.5 shrink-0" />
        {text}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${muted} underline-offset-2 transition-colors hover:text-[var(--foreground)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}
    >
      <IconShieldCheck className="h-3.5 w-3.5 shrink-0" />
      {text}
    </Link>
  );
}
