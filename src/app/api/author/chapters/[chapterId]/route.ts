// Сохранение главы автором. Поля маршрутизируются по таблицам (PLAN §R6):
// title/skills → chapters, blocks/summary → revision.
//
// Фаза 13 — жизнь после публикации. Куда пишем, решает состояние последней ревизии:
//   • draft + review_status none|changes-requested → правим ревизию IN PLACE (поведение Фазы 6);
//   • published                                    → заводим ревизию-ЧЕРНОВИК поверх (number+1,
//     review_status='none', prev_blocks = блоки опубликованной). Читатель продолжает видеть
//     опубликованную, пока автор не опубликует новую — ридер-селекторы фильтруют
//     status='published' ДО max(number), поэтому черновик поверх не протекает;
//   • ревью читает ревизию прямо сейчас (requested|in-review) → 409, как и раньше.

import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterRevisions, chapters } from "@/lib/db/schema";
import { requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { stringifyJson } from "@/lib/db/json";
import { MAX_SKILLS, validateBlocks } from "@/lib/blocks/validate";
import { resolveAuthorChapter } from "@/lib/queries/author";
import { isRevisionEditable } from "@/lib/review-status";

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

  // Ownership + последняя ревизия одним резолвером; чужая глава → 404 (не раскрываем существование).
  const target = await resolveAuthorChapter(chapterId, userId);
  if (!target) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });

  const rev = target.revision;
  // Ревью читает эту ревизию прямо сейчас — править нельзя (ход за ревьюерами).
  if (!isRevisionEditable(rev.status, rev.reviewStatus)) {
    return NextResponse.json(
      { error: "Главу нельзя редактировать, пока идёт ревью." },
      { status: 409 },
    );
  }

  // Правка опубликованной заводит НОВУЮ ревизию поверх; правка черновика идёт in place.
  const forkFromPublished = rev.status === "published";
  const now = Math.floor(Date.now() / 1000);
  let revisionNumber = rev.number;

  try {
    await db.transaction(async (tx) => {
      if (forkFromPublished) {
        // Race-safe: номер следующей ревизии перечитываем ВНУТРИ транзакции — параллельный
        // автосейв не должен воткнуть второй черновик и словить unique(chapter_id, number).
        const latest = (
          await tx
            .select({ number: chapterRevisions.number, status: chapterRevisions.status })
            .from(chapterRevisions)
            .where(eq(chapterRevisions.chapterId, chapterId))
            .orderBy(desc(chapterRevisions.number))
            .limit(1)
        )[0];
        if (!latest) throw new Error("revision-vanished");

        if (latest.status === "published") {
          revisionNumber = latest.number + 1;
          await tx.insert(chapterRevisions).values({
            chapterId,
            number: revisionNumber,
            status: "draft",
            reviewStatus: "none",
            summary: summary !== undefined ? summary : rev.summary,
            blocks: blocksJson !== undefined ? blocksJson : rev.blocks,
            prevBlocks: rev.blocks, // снапшот опубликованного — для инлайн-диффа
          });
        } else {
          // Черновик поверх уже успел появиться (параллельный запрос) — пишем в него.
          revisionNumber = latest.number;
          const revSet: { blocks?: string; summary?: string | null } = {};
          if (blocksJson !== undefined) revSet.blocks = blocksJson;
          if (summary !== undefined) revSet.summary = summary;
          if (Object.keys(revSet).length > 0) {
            await tx
              .update(chapterRevisions)
              .set(revSet)
              .where(
                and(
                  eq(chapterRevisions.chapterId, chapterId),
                  eq(chapterRevisions.number, latest.number),
                ),
              );
          }
        }
      } else {
        const revSet: { blocks?: string; summary?: string | null } = {};
        if (blocksJson !== undefined) revSet.blocks = blocksJson;
        if (summary !== undefined) revSet.summary = summary;
        if (Object.keys(revSet).length > 0) {
          await tx.update(chapterRevisions).set(revSet).where(eq(chapterRevisions.id, rev.id));
        }
      }

      if (Object.keys(set).length > 0) {
        await tx.update(chapters).set(set).where(eq(chapters.id, chapterId));
      }
      await tx.update(blogs).set({ lastActivityAt: now }).where(eq(blogs.id, target.blogId));
    });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить, попробуйте ещё раз." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, revisionNumber, savedAt: now, forked: forkFromPublished });
}
