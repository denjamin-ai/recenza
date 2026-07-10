"use client";

// Обложка карточки: next/image (unoptimized — реальная загрузка в Фазе 12), onError → плейсхолдер.
// Плейсхолдер — детерминированный тёмный градиент от seed (CoverPlaceholder прототипа; классы
// .cover-ph-* в globals.css) с инициалом. src валидируется на /uploads/ (внешние URL отклоняются).
// Заполняет relative-контейнер.

import Image from "next/image";
import { useState } from "react";

/** Хэш строки → индекс градиента (как в прототипе: сумма кодов символов). */
function gradientClass(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash += ch.charCodeAt(0);
  return `cover-ph-${hash % 6}`;
}

export function CoverImage({ src, alt, seed }: { src: string | null; alt: string; seed?: string }) {
  const [failed, setFailed] = useState(false);
  const valid = typeof src === "string" && src.startsWith("/uploads/");

  if (!valid || failed) {
    return (
      <div
        className={`cover-ph flex h-full w-full items-center justify-center ${gradientClass(seed ?? alt)}`}
        aria-hidden="true"
      >
        <span className="font-display text-[length:var(--type-h2)]">
          {alt.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src!}
      alt={alt}
      fill
      unoptimized
      sizes="(max-width: 768px) 100vw, 400px"
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}
