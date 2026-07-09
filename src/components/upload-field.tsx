"use client";

// Поле «путь + загрузка файла» (Фаза 12). Текстовый ввод пути /uploads/… остаётся (fallback и
// правка вручную), кнопка «Загрузить…» шлёт файл в POST /api/uploads и подставляет полученный путь.
// Используется в редакторе (image/cover) и админке (QR/баннер) — kind определяет серверный гейт.

import { useRef, useState } from "react";
import type { UploadKind } from "@/lib/uploads/storage";

export function UploadField(props: {
  kind: UploadKind;
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  ariaLabel: string;
  inputClassName: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("kind", props.kind);
      form.set("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok || !data.path) {
        setError(data.error ?? "Не удалось загрузить файл.");
        return;
      }
      props.onChange(data.path);
    } catch {
      setError("Сетевая ошибка. Проверьте соединение.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          aria-label={props.ariaLabel}
          className={`${props.inputClassName} min-w-0 flex-1`}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="min-h-9 shrink-0 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
        >
          {busy ? "Загружаю…" : "Загрузить…"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[length:var(--type-small)] text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
