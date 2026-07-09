// Локальный сторедж загрузок (Фаза 12). В БД всегда хранится путь "/uploads/<dir>/<файл>" —
// валидаторы (isUploadsPath, validate.ts, image-block) не знают о физическом расположении.
// Куда пишем: UPLOADS_DIR (прод: /srv/recenza/shared/uploads, файлы отдаёт Caddy) →
// fallback public/uploads (dev/test: файлы отдаёт сам Next из public/).
// Имя файла — ulid + расширение ИЗ MIME (клиентское имя не используется — никаких path-traversal).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ulid } from "ulid";

export type UploadKind = "article" | "cover" | "donation" | "banner";

export const UPLOAD_DIRS: Record<UploadKind, string> = {
  article: "articles",
  cover: "covers",
  donation: "donations",
  banner: "banners",
};

export const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 МБ

/** Magic-bytes: MIME из multipart доверять нельзя — сверяем сигнатуру содержимого. */
export function sniffImageMime(data: Uint8Array): keyof typeof ALLOWED_MIME | null {
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return "image/png";
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    data.length >= 12 &&
    data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 && // RIFF
    data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  return null;
}

function uploadsRoot(): string {
  return process.env.UPLOADS_DIR?.trim() || path.join(process.cwd(), "public", "uploads");
}

/** Сохраняет файл и возвращает публичный путь "/uploads/<dir>/<ulid>.<ext>". */
export async function saveUpload(
  kind: UploadKind,
  data: Uint8Array,
  mime: keyof typeof ALLOWED_MIME,
): Promise<string> {
  const dir = UPLOAD_DIRS[kind];
  const name = `${ulid().toLowerCase()}.${ALLOWED_MIME[mime]}`;
  const target = path.join(uploadsRoot(), dir);
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, name), data);
  return `/uploads/${dir}/${name}`;
}
