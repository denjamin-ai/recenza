// Доска «Ищем ревьюеров»: правка/удаление направления админом (Фаза 10). Только админ.
// PATCH — allowlist (area/skills/note/hot). DELETE — удалить направление.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { boardCalls } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { stringifyJson } from "@/lib/db/json";
import { MAX_SKILLS } from "@/lib/blocks/validate";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;

  let body: { area?: unknown; skills?: unknown; note?: unknown; hot?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const set: Partial<{ area: string; skills: string; note: string | null; hot: boolean }> = {};
  if (body.area !== undefined) {
    if (typeof body.area !== "string" || !body.area.trim()) return NextResponse.json({ error: "Некорректное направление." }, { status: 400 });
    set.area = body.area.trim().slice(0, 120);
  }
  if (body.skills !== undefined) {
    if (!Array.isArray(body.skills) || body.skills.some((s) => typeof s !== "string")) {
      return NextResponse.json({ error: "Некорректные навыки." }, { status: 400 });
    }
    set.skills = stringifyJson([...new Set((body.skills as string[]).map((s) => s.trim().slice(0, 100)).filter(Boolean))].slice(0, MAX_SKILLS));
  }
  if (body.note !== undefined) {
    set.note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  }
  if (body.hot !== undefined) {
    if (typeof body.hot !== "boolean") return NextResponse.json({ error: "hot: ожидается boolean." }, { status: 400 });
    set.hot = body.hot;
  }
  if (Object.keys(set).length === 0) return NextResponse.json({ error: "Нет полей для изменения." }, { status: 400 });

  const exists = (await db.select({ id: boardCalls.id }).from(boardCalls).where(eq(boardCalls.id, id)).limit(1))[0];
  if (!exists) return NextResponse.json({ error: "Направление не найдено." }, { status: 404 });

  await db.update(boardCalls).set(set).where(eq(boardCalls.id, id));
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
  await db.delete(boardCalls).where(eq(boardCalls.id, id));
  return NextResponse.json({ ok: true });
}
