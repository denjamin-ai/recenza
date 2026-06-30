// Сохранение черновика главы IN PLACE (Фаза 6): обновляем последнюю ревизию, если она редактируема
// (draft | changes-requested). НИКАКОЙ новой ревизии здесь не создаём — это путь пересдачи Фазы 7
// (когда последняя ревизия published). under-review править нельзя (у ревьюеров).
// Поля маршрутизируются по таблицам (PLAN §R6): title/skills → chapters, blocks/summary → revision.

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterRevisions, chapters } from "@/lib/db/schema";
import { requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { stringifyJson } from "@/lib/db/json";
import { MAX_SKILLS, validateBlocks } from "@/lib/blocks/validate";

const EDITABLE = new Set(["draft", "changes-requested"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireAuthor();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`author-save:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { chapterId } = await params;

  // Тело: все поля опциональны; валидируем по присутствию.
  let body: { title?: unknown; skills?: unknown; blocks?: unknown; summary?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const set: { title?: string; skills?: string } = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string") return NextResponse.json({ error: "Некорректный title." }, { status: 400 });
    set.title = body.title.trim().slice(0, 200);
  }
  if (body.skills !== undefined) {
    if (!Array.isArray(body.skills) || body.skills.some((s) => typeof s !== "string")) {
      return NextResponse.json({ error: "Некорректные навыки." }, { status: 400 });
    }
    const skills = (body.skills as string[]).map((s) => s.trim()).filter(Boolean).slice(0, MAX_SKILLS);
    set.skills = stringifyJson(skills);
  }

  let blocksJson: string | undefined;
  if (body.blocks !== undefined) {
    const v = validateBlocks(body.blocks);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    blocksJson = stringifyJson(v.blocks);
  }

  let summary: string | null | undefined;
  if (body.summary !== undefined) {
    if (body.summary === null) summary = null;
    else if (typeof body.summary === "string") summary = body.summary.trim().slice(0, 2000);
    else return NextResponse.json({ error: "Некорректный summary." }, { status: 400 });
  }

  // Ownership: глава → блог → автор.
  const row = (
    await db
      .select({ chapterId: chapters.id, blogId: blogs.id, authorId: blogs.authorId })
      .from(chapters)
      .innerJoin(blogs, eq(blogs.id, chapters.blogId))
      .where(eq(chapters.id, chapterId))
      .limit(1)
  )[0];
  if (!row || row.authorId !== userId) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });

  // Последняя ревизия.
  const rev = (
    await db
      .select({ id: chapterRevisions.id, number: chapterRevisions.number, status: chapterRevisions.status })
      .from(chapterRevisions)
      .where(eq(chapterRevisions.chapterId, chapterId))
      .orderBy(desc(chapterRevisions.number))
      .limit(1)
  )[0];
  if (!rev) return NextResponse.json({ error: "Ревизия не найдена." }, { status: 404 });
  if (!EDITABLE.has(rev.status)) {
    return NextResponse.json(
      { error: "Главу нельзя редактировать в текущем статусе." },
      { status: 409 },
    );
  }

  const now = Math.floor(Date.now() / 1000);
  await db.transaction(async (tx) => {
    const revSet: { blocks?: string; summary?: string | null } = {};
    if (blocksJson !== undefined) revSet.blocks = blocksJson;
    if (summary !== undefined) revSet.summary = summary;
    if (Object.keys(revSet).length > 0) {
      await tx.update(chapterRevisions).set(revSet).where(eq(chapterRevisions.id, rev.id));
    }
    if (Object.keys(set).length > 0) {
      await tx.update(chapters).set(set).where(eq(chapters.id, chapterId));
    }
    await tx.update(blogs).set({ lastActivityAt: now }).where(eq(blogs.id, row.blogId));
  });

  return NextResponse.json({ ok: true, revisionNumber: rev.number, savedAt: now });
}
