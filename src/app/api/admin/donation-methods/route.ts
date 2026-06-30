// Способы пожертвования: создание админом (Фаза 10). Только админ. type=link → url (http(s));
// type=qr → qrUrl (только /uploads/, генерации нет — загрузка). Без сумм. Независимо от баннеров.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { donationMethods } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { isHttpUrl, isUploadsPath } from "@/lib/url";
import { DONATION_TYPES, type DonationType } from "@/types";

function str(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
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

  const name = str(body.name, 120);
  if (!name) return NextResponse.json({ error: "Укажите название способа." }, { status: 400 });
  if (typeof body.type !== "string" || !(DONATION_TYPES as readonly string[]).includes(body.type)) {
    return NextResponse.json({ error: "Некорректный тип (link|qr)." }, { status: 400 });
  }
  const type = body.type as DonationType;
  const url = str(body.url, 500);
  const qrUrl = str(body.qrUrl, 500);
  if (type === "link" && (!url || !isHttpUrl(url))) {
    return NextResponse.json({ error: "Ссылочный способ: укажите http(s)-ссылку." }, { status: 400 });
  }
  if (type === "qr" && (!qrUrl || !isUploadsPath(qrUrl))) {
    return NextResponse.json({ error: "QR: загрузите изображение (путь /uploads/)." }, { status: 400 });
  }

  const sort = typeof body.sort === "number" && Number.isInteger(body.sort) ? Math.max(0, Math.min(9999, body.sort)) : 0;

  await db.insert(donationMethods).values({
    name,
    type,
    url: type === "link" ? url : null,
    qrUrl: type === "qr" ? qrUrl : null,
    hint: str(body.hint, 200),
    visible: body.visible !== false,
    isPrimary: body.isPrimary === true,
    sort,
  });
  return NextResponse.json({ ok: true });
}
