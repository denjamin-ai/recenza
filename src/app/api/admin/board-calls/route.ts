// Доска «Ищем ревьюеров»: создание направления админом (Фаза 10). Только админ.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { boardCalls } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { stringifyJson } from "@/lib/db/json";
import { MAX_SKILLS } from "@/lib/blocks/validate";

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  let area: string;
  let skills: string[];
  let note: string | null;
  let hot: boolean;
  try {
    const body = (await req.json()) as { area?: unknown; skills?: unknown; note?: unknown; hot?: unknown };
    if (typeof body.area !== "string" || !body.area.trim()) {
      return NextResponse.json({ error: "Укажите направление." }, { status: 400 });
    }
    area = body.area.trim().slice(0, 120);
    if (body.skills !== undefined && (!Array.isArray(body.skills) || body.skills.some((s) => typeof s !== "string"))) {
      return NextResponse.json({ error: "Некорректные навыки." }, { status: 400 });
    }
    skills = Array.isArray(body.skills)
      ? [...new Set((body.skills as string[]).map((s) => s.trim().slice(0, 100)).filter(Boolean))].slice(0, MAX_SKILLS)
      : [];
    note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
    hot = body.hot === true;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  await db.insert(boardCalls).values({ area, skills: stringifyJson(skills), waiting: 0, note, hot });
  return NextResponse.json({ ok: true });
}
