// Публикация главы (Фаза 7; Фаза 12 — общий сервис + отложенная публикация) — author-only.
// Гейт «все approve» (перепроверяется в БД, race-safe) — в publishRevision(); иначе 409.
// Тело { scheduledAt: number } — запланировать (гейт должен проходить УЖЕ на момент планирования);
// { scheduledAt: null } — отменить план; без scheduledAt — опубликовать сейчас.
// Отложенную публикует cron (/api/cron/publish), перепроверяя гейт в момент срабатывания.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapterReviewers, chapterRevisions } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { resolveReviewAccess } from "@/lib/queries/review";
import {
  ACTIVE_REVISION_STATUSES,
  PublishGateError,
  publishRevision,
} from "@/lib/queries/publish";

const MAX_SCHEDULE_AHEAD = 30 * 24 * 60 * 60; // не дальше 30 дней вперёд

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
    return NextResponse.json({ error: "Публиковать может только автор." }, { status: 403 });
  }

  const rl = hitActionRate(`review-publish:${access.user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { session } = access;
  if (!ACTIVE_REVISION_STATUSES.has(session.revision.status)) {
    return NextResponse.json({ error: "Главу нельзя опубликовать из текущего статуса." }, { status: 409 });
  }

  let scheduledAt: number | null | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as { scheduledAt?: unknown };
    if (body.scheduledAt === null) scheduledAt = null;
    else if (typeof body.scheduledAt === "number") scheduledAt = body.scheduledAt;
    else if (body.scheduledAt !== undefined) {
      return NextResponse.json({ error: "scheduledAt: ожидается число (Unix seconds) или null." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  // ── Отмена плана: доступна в любой момент активного ревью, гейт не нужен. ──
  if (scheduledAt === null) {
    await db
      .update(chapterRevisions)
      .set({ scheduledAt: null })
      .where(eq(chapterRevisions.id, session.revision.id));
    return NextResponse.json({ ok: true, scheduled: false });
  }

  const revNumber = session.revision.number;

  // Быстрый путь (UX): предварительная проверка гейта вне транзакции — чтобы не открывать tx зря.
  // Для планирования это ЕДИНСТВЕННАЯ проверка на запись: cron перепроверит гейт при срабатывании.
  const preRows = await db
    .select({ verdict: chapterReviewers.verdict })
    .from(chapterReviewers)
    .where(and(eq(chapterReviewers.chapterId, chapterId), eq(chapterReviewers.revisionNumber, revNumber)));
  if (preRows.length === 0) {
    return NextResponse.json({ error: "Нет назначенных ревьюеров." }, { status: 409 });
  }
  if (!preRows.every((r) => r.verdict === "approve")) {
    return NextResponse.json({ error: "Опубликовать можно только когда все ревьюеры одобрили." }, { status: 409 });
  }

  // ── Планирование. ──
  if (typeof scheduledAt === "number") {
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(scheduledAt) || scheduledAt <= now) {
      return NextResponse.json({ error: "Время публикации должно быть в будущем." }, { status: 400 });
    }
    if (scheduledAt > now + MAX_SCHEDULE_AHEAD) {
      return NextResponse.json({ error: "Публикацию можно отложить не более чем на 30 дней." }, { status: 400 });
    }
    await db
      .update(chapterRevisions)
      .set({ scheduledAt })
      .where(eq(chapterRevisions.id, session.revision.id));
    return NextResponse.json({ ok: true, scheduled: true, scheduledAt });
  }

  // ── Публикация сейчас. ──
  try {
    await publishRevision(
      {
        chapterId,
        revisionId: session.revision.id,
        revisionNumber: revNumber,
        blogId: session.blog.id,
        blogSlug: session.blog.slug,
        chapterSlug: session.chapter.slug,
        chapterTitle: session.chapter.title,
        authorId: session.blog.authorId,
      },
      { gate: "all-approve" },
    );
  } catch (e) {
    if (e instanceof PublishGateError) return NextResponse.json({ error: e.reason }, { status: 409 });
    return NextResponse.json({ error: "Не удалось опубликовать." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    blogSlug: session.blog.slug,
    chapterSlug: session.chapter.slug,
  });
}
