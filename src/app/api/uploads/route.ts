// Загрузка изображений (Фаза 12). Гейт по назначению файла: article/cover — автор,
// donation/banner — админ, avatar — любой пользователь (ui-feedback-5; файл — для собственного
// профиля, привязка к пользователю — в PATCH /api/profile/avatar). MIME проверяется ДВАЖДЫ:
// заявленный тип + magic-bytes содержимого. Возвращает { ok, path } с путём "/uploads/…".

import { NextResponse } from "next/server";
import { requireAdmin, requireAuthor, requireUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  UPLOAD_DIRS,
  saveUpload,
  sniffImageMime,
  type UploadKind,
} from "@/lib/uploads/storage";

// multipart-оверхед (границы, заголовки частей, поле kind) поверх самого файла
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // Ранний отказ ДО буферизации тела (security-ревью Ф12: formData() читает всё в память —
  // без этой проверки большие POST могли бы уронить единственный Node-процесс по OOM).
  // Второй рубеж — request_body max_size в Caddy.
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Файл больше 4 МБ. Сожмите изображение и попробуйте снова." },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ожидается multipart/form-data." }, { status: 400 });
  }

  const kind = form.get("kind");
  if (typeof kind !== "string" || !(kind in UPLOAD_DIRS)) {
    return NextResponse.json(
      { error: "kind: article, cover, donation, banner или avatar." },
      { status: 400 },
    );
  }

  let rateKey: string;
  if (kind === "donation" || kind === "banner") {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;
    rateKey = "upload:admin";
  } else if (kind === "avatar") {
    const gate = await requireUser(); // любая роль с users-строкой (админ без неё — отказ)
    if (gate instanceof NextResponse) return gate;
    rateKey = `upload:${gate.userId}`;
  } else {
    const gate = await requireAuthor();
    if (gate instanceof NextResponse) return gate;
    rateKey = `upload:${gate.userId}`;
  }

  const rate = hitActionRate(rateKey);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Попробуйте через секунду." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter ?? 1) } },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан (поле file)." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Файл больше 4 МБ. Сожмите изображение и попробуйте снова." },
      { status: 400 },
    );
  }
  if (!(file.type in ALLOWED_MIME)) {
    return NextResponse.json(
      { error: "Допустимы только PNG, JPEG и WebP." },
      { status: 400 },
    );
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageMime(data);
  if (sniffed !== file.type) {
    return NextResponse.json(
      { error: "Содержимое файла не похоже на заявленный формат изображения." },
      { status: 400 },
    );
  }

  try {
    const path = await saveUpload(kind as UploadKind, data, sniffed);
    return NextResponse.json({ ok: true, path }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить файл." }, { status: 500 });
  }
}
