"use client";

// Картинка контента: next/image + обязательный alt. src валидируется на префикс /uploads/
// (как cover_url — внешние URL отклоняются). unoptimized — реальная загрузка/сторедж в Фазе 12;
// onError → аккуратный плейсхолдер (нет битой иконки и шума в консоли).

import Image from "next/image";
import { useState } from "react";

export function ImageBlock({ src, alt }: { src?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  const caption = alt?.trim() || "";
  const valid = typeof src === "string" && src.startsWith("/uploads/");

  return (
    <figure className="my-6">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)]">
        {valid && !failed ? (
          <Image
            src={src!}
            alt={caption}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-contain"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            {caption || "Изображение"}
          </div>
        )}
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
