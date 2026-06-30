// «Отправить v{N+1}» (Фаза 7) — author-only. Создаёт НОВУЮ ревизию (number+1) на основе текущих блоков,
// статус under-review, переносит назначения ревьюеров с обнулёнными вердиктами. prev_blocks новой ревизии
// = блоки последней ОПУБЛИКОВАННОЙ ревизии (или []), чтобы инлайн-дифф показывал изменения с публикации.
// Предыдущая ревизия сохраняется как история (снапшот-до-записи соблюдён). Уведомляем ревьюеров.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapterReviewers, chapterRevisions } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { stringifyJson } from "@/lib/db/json";
import { createNotifications } from "@/lib/queries/notifications";
import { REVIEW_NOTIFY, resolveReviewAccess, reviewerReviewHref, userIdsByHandle } from "@/lib/queries/review";

const ACTIVE = new Set(["under-review", "changes-requested"]);
const MAX_SUMMARY = 2000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { chapterId } = await params;
  const access = await resolveReviewAccess(chapterId);
  if (access instanceof NextResponse) return access;
  if (access.role !== "author") {
    return NextResponse.json({ error: "Отправить ревизию может только автор." }, { status: 403 });
  }

  const rl = hitActionRate(`review-resubmit:${access.user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { session } = access;
  if (!ACTIVE.has(session.revision.status)) {
    return NextResponse.json({ error: "Главу нельзя пересдать из текущего статуса." }, { status: 409 });
  }
  if (session.reviewers.length === 0) {
    return NextResponse.json({ error: "Нет назначенных ревьюеров." }, { status: 409 });
  }

  let summary: string | null = null;
  try {
    const body = (await req.json().catch(() => ({}))) as { summary?: unknown };
    if (typeof body.summary === "string" && body.summary.trim()) {
      summary = body.summary.trim().slice(0, MAX_SUMMARY);
    }
  } catch {
    /* тело необязательно */
  }

  // Блоки последней опубликованной ревизии → prev_blocks новой (baseline инлайн-диффа).
  const publishedRows = await db
    .select({ number: chapterRevisions.number, blocks: chapterRevisions.blocks })
    .from(chapterRevisions)
    .where(and(eq(chapterRevisions.chapterId, chapterId), eq(chapterRevisions.status, "published")));
  const lastPublished = publishedRows.reduce<{ number: number; blocks: string | null } | null>(
    (a, b) => (!a || b.number > a.number ? b : a),
    null,
  );
  const prevBlocks = lastPublished ? lastPublished.blocks : null;

  const newNumber = session.revision.number + 1;
  const now = Math.floor(Date.now() / 1000);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(chapterRevisions).values({
        chapterId,
        number: newNumber,
        status: "under-review",
        summary,
        blocks: stringifyJson(session.revision.blocks),
        prevBlocks,
        submittedAt: now,
      });
      // Переносим назначения на новую ревизию с обнулёнными вердиктами.
      for (const r of session.reviewers) {
        await tx.insert(chapterReviewers).values({
          chapterId,
          revisionNumber: newNumber,
          handle: r.handle,
          isPrimary: r.isPrimary,
        });
      }
      const ids = await userIdsByHandle(session.reviewers.map((r) => r.handle));
      await createNotifications(
        tx,
        session.reviewers
          .map((r) => ids.get(r.handle))
          .filter((id): id is string => !!id)
          .map((recipientId) => ({
            recipientId,
            type: REVIEW_NOTIFY.invited,
            payload: {
              href: reviewerReviewHref(chapterId),
              chapterTitle: session.chapter.title,
              revision: newNumber,
            },
          })),
      );
    });
  } catch {
    return NextResponse.json({ error: "Не удалось отправить ревизию." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, revisionNumber: newNumber });
}
