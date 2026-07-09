// Промо-баннеры ленты: создание админом (Фаза 10). Только админ. target валидируется по action:
//   internal → внутренний путь (/...), external → http(s)-URL, donate → target игнорируется.
//   coverUrl (если задан) → только /uploads/. Отклоняем javascript:/data:/протокол-относительные.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { promoBanners } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { isHttpUrl, isInternalPath, isUploadsPath } from "@/lib/url";
import { BANNER_LIMITS, bannerFieldError, type BannerTextField } from "@/lib/banners";
import { BANNER_ACTIONS, type BannerAction } from "@/types";

function str(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

/** Текстовое поле баннера с жёстким лимитом: превышение — ошибка (не тихий slice). */
function limitedStr(v: unknown, field: BannerTextField): { value: string | null } | { error: string } {
  if (typeof v !== "string" || !v.trim()) return { value: null };
  const err = bannerFieldError(field, v);
  if (err) return { error: err };
  return { value: v.trim() };
}

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  if (typeof body.action !== "string" || !(BANNER_ACTIONS as readonly string[]).includes(body.action)) {
    return NextResponse.json({ error: "Некорректное действие баннера." }, { status: 400 });
  }
  const action = body.action as BannerAction;

  const target = str(body.target, 500);
  if (action === "external" && (!target || !isHttpUrl(target))) {
    return NextResponse.json({ error: "Внешний баннер: укажите http(s)-ссылку." }, { status: 400 });
  }
  if (action === "internal" && (!target || !isInternalPath(target))) {
    return NextResponse.json({ error: "Внутренний баннер: укажите путь, начинающийся с /." }, { status: 400 });
  }

  const coverUrl = str(body.coverUrl, 500);
  if (coverUrl && !isUploadsPath(coverUrl)) {
    return NextResponse.json({ error: "Обложка: только путь /uploads/." }, { status: 400 });
  }

  const sort = typeof body.sort === "number" && Number.isInteger(body.sort) ? Math.max(0, Math.min(9999, body.sort)) : 0;

  const texts: Partial<Record<BannerTextField, string | null>> = {};
  for (const field of Object.keys(BANNER_LIMITS) as BannerTextField[]) {
    const res = limitedStr(body[field], field);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    texts[field] = res.value;
  }

  await db.insert(promoBanners).values({
    eyebrow: texts.eyebrow ?? null,
    title: texts.title ?? null,
    cta: texts.cta ?? null,
    tone: str(body.tone, 32),
    icon: str(body.icon, 32),
    action,
    target: action === "donate" ? null : target,
    coverUrl,
    visible: body.visible !== false,
    sort,
  });
  return NextResponse.json({ ok: true });
}
