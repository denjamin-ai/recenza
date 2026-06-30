// Промо-баннеры: правка/удаление админом (Фаза 10). Только админ. PATCH — allowlist; при смене action
// или target перепроверяем валидность target по итоговому action. visible/sort — тоггл/порядок.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { promoBanners } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { isHttpUrl, isInternalPath, isUploadsPath } from "@/lib/url";
import { BANNER_ACTIONS, type BannerAction } from "@/types";

function str(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const current = (
    await db.select({ action: promoBanners.action, target: promoBanners.target }).from(promoBanners).where(eq(promoBanners.id, id)).limit(1)
  )[0];
  if (!current) return NextResponse.json({ error: "Баннер не найден." }, { status: 404 });

  const set: Record<string, unknown> = {};
  for (const key of ["eyebrow", "title", "cta"] as const) {
    if (body[key] !== undefined) set[key] = str(body[key]);
  }
  for (const key of ["tone", "icon"] as const) {
    if (body[key] !== undefined) set[key] = str(body[key], 32);
  }
  if (body.visible !== undefined) {
    if (typeof body.visible !== "boolean") return NextResponse.json({ error: "visible: ожидается boolean." }, { status: 400 });
    set.visible = body.visible;
  }
  if (body.sort !== undefined) {
    if (typeof body.sort !== "number" || !Number.isInteger(body.sort)) return NextResponse.json({ error: "sort: целое." }, { status: 400 });
    set.sort = Math.max(0, Math.min(9999, body.sort));
  }
  if (body.coverUrl !== undefined) {
    const cover = str(body.coverUrl, 500);
    if (cover && !isUploadsPath(cover)) return NextResponse.json({ error: "Обложка: только путь /uploads/." }, { status: 400 });
    set.coverUrl = cover;
  }

  // action / target: перепроверяем target относительно итогового action.
  let action: BannerAction = current.action ?? "internal";
  if (body.action !== undefined) {
    if (typeof body.action !== "string" || !(BANNER_ACTIONS as readonly string[]).includes(body.action)) {
      return NextResponse.json({ error: "Некорректное действие баннера." }, { status: 400 });
    }
    action = body.action as BannerAction;
    set.action = action;
  }
  if (body.target !== undefined || body.action !== undefined) {
    const target = body.target !== undefined ? str(body.target, 500) : current.target;
    if (action === "external" && (!target || !isHttpUrl(target))) {
      return NextResponse.json({ error: "Внешний баннер: укажите http(s)-ссылку." }, { status: 400 });
    }
    if (action === "internal" && (!target || !isInternalPath(target))) {
      return NextResponse.json({ error: "Внутренний баннер: укажите путь, начинающийся с /." }, { status: 400 });
    }
    set.target = action === "donate" ? null : target;
  }

  if (Object.keys(set).length === 0) return NextResponse.json({ error: "Нет полей для изменения." }, { status: 400 });

  await db.update(promoBanners).set(set).where(eq(promoBanners.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  await db.delete(promoBanners).where(eq(promoBanners.id, id));
  return NextResponse.json({ ok: true });
}
