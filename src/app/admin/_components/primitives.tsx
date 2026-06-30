// Презентационные примитивы админ-портала (Фаза 10). Серверобезопасны (без хуков/«use client»).
// Только токены (никаких raw-цветов): тон pill маппится на семантические переменные globals.css.

import Link from "next/link";
import type { ReactNode } from "react";
import type { Role } from "@/types";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const TONE: Record<Tone, string> = {
  neutral: "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]",
  accent: "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]",
  success: "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]",
  warning: "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]",
  danger: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]",
  info: "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]",
};

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 text-[0.7rem] font-medium ${TONE[tone]}`}>
      {children}
    </span>
  );
}

const ROLE_LABEL: Record<Role, string> = { reader: "Читатель", author: "Автор", reviewer: "Ревьюер", admin: "Админ" };
const ROLE_TONE: Record<Role, Tone> = { reader: "neutral", author: "accent", reviewer: "info", admin: "warning" };

export function RolePill({ role }: { role: Role }) {
  return <Pill tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Pill>;
}

export function ScreenHead({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="mb-1 text-[0.7rem] font-medium uppercase tracking-wider text-[var(--accent)]">{eyebrow}</p>}
      <h1 className="font-display text-[length:var(--type-h3)] font-bold text-[var(--foreground)]">{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-[length:var(--type-small)] text-[var(--muted-foreground)] [text-wrap:pretty]">{description}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-elevated)] p-4 ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-[length:var(--type-small)] font-semibold text-[var(--foreground)]">
      {children}
      {count !== undefined && (
        <span className="rounded-[var(--radius-pill)] bg-[var(--muted)] px-2 py-0.5 text-[0.7rem] text-[var(--muted-foreground)]">{count}</span>
      )}
    </h2>
  );
}

export function KpiTile({ label, value, href, tone = "neutral" }: { label: string; value: number; href?: string; tone?: Tone }) {
  const inner = (
    <>
      <span className={`text-[length:var(--type-h2)] font-bold ${tone === "warning" ? "text-[var(--warning)]" : tone === "danger" ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
        {value}
      </span>
      <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">{label}</span>
    </>
  );
  const cls =
    "flex flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-elevated)] p-4 transition-colors";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] p-6 text-center text-[length:var(--type-small)] text-[var(--muted-foreground)]">
      {children}
    </p>
  );
}

export function SkillChips({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {skills.map((s) => (
        <span key={s} className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[0.7rem] text-[var(--muted-foreground)]">
          {s}
        </span>
      ))}
    </div>
  );
}
