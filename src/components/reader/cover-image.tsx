"use client";

// Обложка карточки: next/image (unoptimized — реальная загрузка в Фазе 12), onError → плейсхолдер
// с инициалом. src валидируется на /uploads/ (внешние URL отклоняются). Заполняет relative-контейнер.

import Image from "next/image";
import { useState } from "react";

export function CoverImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const valid = typeof src === "string" && src.startsWith("/uploads/");

  if (!valid || failed) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-[var(--bg-secondary)]"
        aria-hidden="true"
      >
        <span className="font-display text-[length:var(--type-h2)] text-[var(--muted-foreground)]">
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
