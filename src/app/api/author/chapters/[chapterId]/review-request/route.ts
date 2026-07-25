// Заявка автора на ревью главы (Фаза 14) — заменила `POST .../submit` с пикером ревьюеров.
//
// Модель: автор описывает НАВЫКИ статьи и оставляет заявку; ревьюер берёт её сам из очереди
// (`POST /api/reviewer/requests/[id]/claim`). Автор нигде не выбирает исполнителя — ни приглашений,
// ни согласия, ни «ведущего» больше нет.
//
// ⚠️ Заявку можно оставить в ЛЮБОМ состоянии главы, ВКЛЮЧАЯ `published` (З-03): ревью — не барьер
// публикации, а награда на выходе. Единственное, что нельзя, — просить ревью на ревизию, у которой
// бейдж уже есть.
//
// DELETE — отзыв заявки автором; только пока её никто не взял (иначе ревьюер уже потратил время).

import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterRevisions, chapters, reviewRequests } from "@/lib/db/schema";
import { requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { parseJson, stringifyJson } from "@/lib/db/json";
import { MAX_SKILLS, readinessChecklist } from "@/lib/blocks/validate";
import { resolveAuthorChapter } from "@/lib/queries/author";
import { SLA_UNCLAIMED_DAYS, dueAtFrom } from "@/lib/review-sla";
import type { Block } from "@/types";

const MAX_NOTE = 2000;

/** Заявка перестала быть подаваемой между проверкой и записью → 409 у вызывающего. */
class RequestConflict extends Error {}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireAuthor();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`author-review-request:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { chapterId } = await params;

  let skills: string[];
  let note: string | null = null;
  try {
    const body = (await req.json()) as { skills?: unknown; note?: unknown };
    if (!Array.isArray(body.skills) || body.skills.some((s) => typeof s !== "string")) {
      return NextResponse.json({ error: "Некорректные навыки." }, { status: 400 });
    }
    skills = [
      ...new Set((body.skills as string[]).map((s) => s.trim().slice(0, 100)).filter(Boolean)),
    ].slice(0, MAX_SKILLS);
    if (typeof body.note === "string" && body.note.trim()) note = body.note.trim().slice(0, MAX_NOTE);
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const target = await resolveAuthorChapter(chapterId, userId);
  if (!target) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });

  // Гейт готовности — повтор серверной правды (клиенту не доверяем никогда).
  const checks = readinessChecklist({
    title: target.chapterTitle,
    blocks: parseJson<Block[]>(target.revision.blocks, []),
    tags: parseJson<string[]>(target.blogTags, []),
    skills,
  });
  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    return NextResponse.json(
      { error: "Не все пункты готовности выполнены.", failedChecks: failed.map((c) => c.label) },
      { status: 400 },
    );
  }

  if (target.revision.verifiedTier !== null) {
    return NextResponse.json({ error: "Эта версия главы уже прошла ревью." }, { status: 409 });
  }

  const now = Math.floor(Date.now() / 1000);
  const dueAt = dueAtFrom(now, SLA_UNCLAIMED_DAYS);
  let requestId: string | null = null;

  try {
    await db.transaction(async (tx) => {
      // TOCTOU: живая заявка на эту ревизию могла появиться между проверкой и записью.
      // Дублирующая страховка — частичный UNIQUE (chapter_id, revision_number) WHERE open|claimed.
      const live = await tx
        .select({ id: reviewRequests.id })
        .from(reviewRequests)
        .where(
          and(
            eq(reviewRequests.chapterId, chapterId),
            eq(reviewRequests.revisionNumber, target.revision.number),
            inArray(reviewRequests.status, ["open", "claimed"]),
          ),
        )
        .limit(1);
      if (live.length > 0) throw new RequestConflict();

      // Навыки — и в главу (рабочее значение автора), и в ревизию (снапшот, который видит читатель),
      // и в саму заявку (по нему ревьюеры находят её в очереди).
      await tx.update(chapters).set({ skills: stringifyJson(skills) }).where(eq(chapters.id, chapterId));
      await tx
        .update(chapterRevisions)
        .set({
          skills: stringifyJson(skills),
          reviewStatus: "requested",
          submittedAt: now,
          // Ревизию могли уже проверять и закрыть без бейджа — открываем сессию заново.
          reviewClosedAt: null,
        })
        .where(eq(chapterRevisions.id, target.revision.id));
      await tx.update(blogs).set({ lastActivityAt: now }).where(eq(blogs.id, target.blogId));

      const inserted = await tx
        .insert(reviewRequests)
        .values({
          chapterId,
          revisionNumber: target.revision.number,
          byHandle: target.authorHandle,
          skills: stringifyJson(skills),
          note,
          channel: "queue",
          status: "open",
          dueAt,
          createdAt: now,
        })
        .returning({ id: reviewRequests.id });
      requestId = inserted[0]?.id ?? null;
    });
  } catch (e) {
    if (e instanceof RequestConflict) {
      return NextResponse.json({ error: "Заявка на эту версию уже подана." }, { status: 409 });
    }
    return NextResponse.json({ error: "Не удалось подать заявку." }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, requestId, dueAt, revisionNumber: target.revision.number },
    { status: 201 },
  );
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireAuthor();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`author-review-request:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { chapterId } = await params;
  const target = await resolveAuthorChapter(chapterId, userId);
  if (!target) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });

  const now = Math.floor(Date.now() / 1000);
  try {
    await db.transaction(async (tx) => {
      // Статус перечитываем ВНУТРИ транзакции: между чтением и записью заявку могли взять,
      // и тогда отзыв означал бы «снять ревьюера с работы» — этого автор делать не может.
      const row = (
        await tx
          .select({ id: reviewRequests.id, status: reviewRequests.status })
          .from(reviewRequests)
          .where(
            and(
              eq(reviewRequests.chapterId, chapterId),
              eq(reviewRequests.revisionNumber, target.revision.number),
              inArray(reviewRequests.status, ["open", "claimed"]),
            ),
          )
          .limit(1)
      )[0];
      if (!row) throw new RequestConflict();
      if (row.status !== "open") throw new RequestConflict();

      await tx
        .update(reviewRequests)
        .set({ status: "cancelled", resolvedAt: now })
        .where(eq(reviewRequests.id, row.id));
      await tx
        .update(chapterRevisions)
        .set({ reviewStatus: "none" })
        .where(eq(chapterRevisions.id, target.revision.id));
    });
  } catch (e) {
    if (e instanceof RequestConflict) {
      return NextResponse.json(
        { error: "Заявку уже взяли в работу — отозвать нельзя." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Не удалось отозвать заявку." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
