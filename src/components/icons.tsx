// Инлайн-SVG иконки (Фаза 10). Конвенция проекта — без icon-библиотек: каждая иконка — это
// <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"> (наследует цвет токена, работает в dark).
// Используются в админ-портале, на доске «Ищем ревьюеров» и в монетизации (баннеры/пожертвования).
// Чисто презентационные: aria-hidden, размер задаётся className (по умолчанию h-4 w-4).

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Svg({ title, children, className = "h-4 w-4", ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconGauge(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 13a3 3 0 1 0 3-3" />
      <path d="M3.5 18a9 9 0 1 1 17 0" />
    </Svg>
  );
}

export function IconFlag(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 21V4" />
      <path d="M5 4h11l-1.5 3.5L16 11H5" />
    </Svg>
  );
}

export function IconEdit(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  );
}

export function IconUserPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M15 19a6 6 0 0 0-12 0" />
      <circle cx="9" cy="8" r="3.5" />
      <path d="M18 8v6M21 11h-6" />
    </Svg>
  );
}

export function IconUsers(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.3-4.5" />
    </Svg>
  );
}

export function IconImage(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.6" />
      <path d="m4 17 5-5 4 4 3-3 4 4" />
    </Svg>
  );
}

export function IconHeart(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 20s-7-4.6-9-9a4.2 4.2 0 0 1 9-2 4.2 4.2 0 0 1 9 2c-2 4.4-9 9-9 9Z" />
    </Svg>
  );
}

export function IconSearch(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </Svg>
  );
}

export function IconChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function IconChevronLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </Svg>
  );
}

export function IconEye(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconEyeOff(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3.2 3.8" />
      <path d="M6.6 8.4A16 16 0 0 0 2 12s3.5 6 10 6a9.4 9.4 0 0 0 3.4-.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Svg>
  );
}

export function IconGrip(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="18" r="1" />
    </Svg>
  );
}

export function IconUpload(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
      <path d="M12 16V4M7 9l5-5 5 5" />
    </Svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m5 13 4 4 10-11" />
    </Svg>
  );
}

export function IconLink(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 15 15 9" />
      <path d="M10.5 6.5 12 5a4 4 0 0 1 6 6l-1.5 1.5" />
      <path d="M13.5 17.5 12 19a4 4 0 0 1-6-6l1.5-1.5" />
    </Svg>
  );
}

export function IconScan(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M4 12h16" />
    </Svg>
  );
}

export function IconExternal(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 5h5v5" />
      <path d="M19 5l-8 8" />
      <path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </Svg>
  );
}

export function IconX(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconStar(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m12 4 2.4 5 5.6.7-4 3.8 1 5.5-5-2.8-5 2.8 1-5.5-4-3.8 5.6-.7Z" />
    </Svg>
  );
}

export function IconBan(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </Svg>
  );
}

export function IconAlert(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17.5v.5" />
    </Svg>
  );
}
