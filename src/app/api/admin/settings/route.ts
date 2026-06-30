// Платформенные флаги (app_settings KV) — Фаза 10. Только админ. Пока единственный флаг:
// donationsEnabled (donations_enabled). Allowlist ключей — произвольные ключи писать нельзя.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { DONATIONS_ENABLED_KEY, setAppFlag } from "@/lib/queries/settings";

export async function PATCH(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  let body: { donationsEnabled?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  if (body.donationsEnabled === undefined) {
    return NextResponse.json({ error: "Нет известных флагов для изменения." }, { status: 400 });
  }
  if (typeof body.donationsEnabled !== "boolean") {
    return NextResponse.json({ error: "donationsEnabled: ожидается boolean." }, { status: 400 });
  }

  await setAppFlag(db, DONATIONS_ENABLED_KEY, body.donationsEnabled);
  return NextResponse.json({ ok: true });
}
