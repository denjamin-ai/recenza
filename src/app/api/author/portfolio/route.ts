// Портфолио «Об авторе» (одно на автора): upsert блоков + флаг видимости. БЕЗ review-flow — публикуется
// сразу. Тело {blocks?, visible?} (хотя бы одно). Один эндпоинт обслуживает и редактор, и toggle на профиле.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { portfolios } from "@/lib/db/schema";
import { requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { stringifyJson } from "@/lib/db/json";
import { validateBlocks } from "@/lib/blocks/validate";

export async function PUT(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireAuthor();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`author-portfolio:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  let body: { blocks?: unknown; visible?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }
  if (body.blocks === undefined && body.visible === undefined) {
    return NextResponse.json({ error: "Нечего сохранять." }, { status: 400 });
  }

  let blocksJson: string | undefined;
  if (body.blocks !== undefined) {
    const v = validateBlocks(body.blocks);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    blocksJson = stringifyJson(v.blocks);
  }
  let visible: boolean | undefined;
  if (body.visible !== undefined) {
    if (typeof body.visible !== "boolean") return NextResponse.json({ error: "Некорректный флаг видимости." }, { status: 400 });
    visible = body.visible;
  }

  const now = Math.floor(Date.now() / 1000);
  const existing = (
    await db.select({ id: portfolios.id, isVisible: portfolios.isVisible }).from(portfolios).where(eq(portfolios.authorId, userId)).limit(1)
  )[0];

  if (existing) {
    const set: { blocks?: string; isVisible?: boolean; updatedAt: number } = { updatedAt: now };
    if (blocksJson !== undefined) set.blocks = blocksJson;
    if (visible !== undefined) set.isVisible = visible;
    await db.update(portfolios).set(set).where(eq(portfolios.id, existing.id));
    return NextResponse.json({ ok: true, isVisible: visible ?? existing.isVisible });
  }

  await db.insert(portfolios).values({
    authorId: userId,
    blocks: blocksJson ?? stringifyJson([]),
    isVisible: visible ?? false,
    updatedAt: now,
  });
  return NextResponse.json({ ok: true, isVisible: visible ?? false });
}
