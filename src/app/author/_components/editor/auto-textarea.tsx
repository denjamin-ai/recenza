"use client";

// Авто-растущая textarea (высота = контент). Без field-sizing-зависимостей: правим height по scrollHeight.

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

export function AutoTextarea({
  value,
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      className={`w-full resize-none bg-transparent text-[var(--foreground)] outline-none focus-visible:outline-none ${className}`}
      {...rest}
    />
  );
}
