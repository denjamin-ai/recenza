// Единая кнопка «назад» (эталон — back-паттерн прототипа: SVG-стрелка + muted-текст,
// hover → foreground, хит-таргет 44px). Два режима: href (Link) или onClick (button).

import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowLeft } from "@/components/icons";

const CLS =
  "inline-flex items-center gap-1.5 min-h-[44px] -ml-1 px-1 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:rounded-[var(--radius-sm)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

function Inner({ children }: { children: ReactNode }) {
  return (
    <>
      <IconArrowLeft className="h-3.5 w-3.5 shrink-0" />
      {children}
    </>
  );
}

export function BackLink({
  href,
  onClick,
  children,
  className,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const cls = className ? `${CLS} ${className}` : CLS;
  if (href) {
    return (
      <Link href={href} className={cls}>
        <Inner>{children}</Inner>
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      <Inner>{children}</Inner>
    </button>
  );
}
