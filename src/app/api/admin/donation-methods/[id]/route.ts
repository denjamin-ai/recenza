// Способы пожертвования: правка/удаление админом (Фаза 10). Только админ. PATCH — allowlist;
// при смене type/url/qrUrl перепроверяем по итоговому типу. visible/isPrimary/sort — тоггл/порядок.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { donationMethods } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { isHttpUrl, isUploadsPath } from "@/lib/url";
import { DONATION_TYPES, type DonationType } from "@/types";

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
    await db.select({ type: donationMethods.type, url: donationMethods.url, qrUrl: donationMethods.qrUrl }).from(donationMethods).where(eq(donationMethods.id, id)).limit(1)
  )[0];
  if (!current) return NextResponse.json({ error: "Способ не найден." }, { status: 404 });

  const set: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = str(body.name, 120);
    if (!name) return NextResponse.json({ error: "Некорректное название." }, { status: 400 });
    set.name = name;
  }
  if (body.hint !== undefined) set.hint = str(body.hint, 200);
  if (body.visible !== undefined) {
    if (typeof body.visible !== "boolean") return NextResponse.json({ error: "visible: ожидается boolean." }, { status: 400 });
    set.visible = body.visible;
  }
  if (body.isPrimary !== undefined) {
    if (typeof body.isPrimary !== "boolean") return NextResponse.json({ error: "isPrimary: ожидается boolean." }, { status: 400 });
    set.isPrimary = body.isPrimary;
  }
  if (body.sort !== undefined) {
    if (typeof body.sort !== "number" || !Number.isInteger(body.sort)) return NextResponse.json({ error: "sort: целое." }, { status: 400 });
    set.sort = body.sort;
  }

  let type: DonationType = current.type;
  if (body.type !== undefined) {
    if (typeof body.type !== "string" || !(DONATION_TYPES as readonly string[]).includes(body.type)) {
      return NextResponse.json({ error: "Некорректный тип (link|qr)." }, { status: 400 });
    }
    type = body.type as DonationType;
    set.type = type;
  }
  if (body.type !== undefined || body.url !== undefined || body.qrUrl !== undefined) {
    const url = body.url !== undefined ? str(body.url, 500) : current.url;
    const qrUrl = body.qrUrl !== undefined ? str(body.qrUrl, 500) : current.qrUrl;
    if (type === "link" && (!url || !isHttpUrl(url))) {
      return NextResponse.json({ error: "Ссылочный способ: укажите http(s)-ссылку." }, { status: 400 });
    }
    if (type === "qr" && (!qrUrl || !isUploadsPath(qrUrl))) {
      return NextResponse.json({ error: "QR: загрузите изображение (путь /uploads/)." }, { status: 400 });
    }
    set.url = type === "link" ? url : null;
    set.qrUrl = type === "qr" ? qrUrl : null;
  }

  if (Object.keys(set).length === 0) return NextResponse.json({ error: "Нет полей для изменения." }, { status: 400 });

  await db.update(donationMethods).set(set).where(eq(donationMethods.id, id));
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
  await db.delete(donationMethods).where(eq(donationMethods.id, id));
  return NextResponse.json({ ok: true });
}
