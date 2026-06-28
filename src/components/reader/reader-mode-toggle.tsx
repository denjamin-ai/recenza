// Переключатель режима чтения: «Глава» (одна) ↔ «Весь блог» (все главы подряд). RSC — две ссылки.

import Link from "next/link";

export function ReaderModeToggle({
  singleHref,
  wholeHref,
  mode,
}: {
  singleHref: string;
  wholeHref: string;
  mode: "single" | "whole";
}) {
  const base =
    "inline-flex h-9 items-center justify-center px-3 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
  const active = "bg-[var(--accent)] text-[var(--accent-foreground)]";
  const idle = "text-[var(--foreground)] hover:bg-[var(--muted)]";

  return (
    <div
      role="group"
      aria-label="Режим чтения"
      className="inline-flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]"
    >
      <Link href={singleHref} aria-current={mode === "single" ? "page" : undefined} className={`${base} ${mode === "single" ? active : idle}`}>
        Глава
      </Link>
      <Link href={wholeHref} aria-current={mode === "whole" ? "page" : undefined} className={`${base} border-l border-[var(--border)] ${mode === "whole" ? active : idle}`}>
        Весь блог
      </Link>
    </div>
  );
}
