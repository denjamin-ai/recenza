// Валидация URL/путей для admin-полей (баннеры/пожертвования, Фаза 10). Закрывает Phase-2 backlog
// (P3-Ф10): отклоняем javascript:/data: и протокол-относительные `//host` (open-redirect).

/** Абсолютный http(s)-URL. Любая иная схема (javascript:, data:, ftp:, mailto:) — отклоняется. */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Внутренний путь приложения: начинается с одиночного "/" (не "//" — это протокол-относительный внешний). */
export function isInternalPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

/** Путь загруженного файла (обложки/QR): только префикс /uploads/. */
export function isUploadsPath(value: string): boolean {
  return value.startsWith("/uploads/");
}
