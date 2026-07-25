// Публикация главы автором (Фаза 13) — СВОБОДНАЯ: ревьюеры не требуются ни в каком сценарии.
// Переехало из api/review/[chapterId]/publish: публикация перестала быть частью review-flow,
// это авторское действие над своей главой (ownership, а не позиция в ревью-сессии).
//
// Тело { scheduledAt: number } — запланировать; { scheduledAt: null } — отменить план;
// пустое тело — опубликовать сейчас. Отложенную публикует cron (/api/cron/publish).
// Единственный гейт — «эта ревизия ещё не опубликована» (перепроверяется внутри транзакции).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapterRevisions } from "@/lib/db/schema";
import { requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { resolveAuthorChapter } from "@/lib/queries/author";
import { PublishGateError, publishRevision } from "@/lib/queries/publish";

const MAX_SCHEDULE_AHEAD = 30 * 24 * 60 * 60; // не дальше 30 дней вперёд

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

  const rl = hitActionRate(`author-publish:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { chapterId } = await params;
  const target = await resolveAuthorChapter(chapterId, userId);
  if (!target) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });

  if (target.revision.status === "published") {
    return NextResponse.json({ error: "Эта версия главы уже опубликована." }, { status: 409 });
  }

  let scheduledAt: number | null | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as { scheduledAt?: unknown };
    if (body.scheduledAt === null) scheduledAt = null;
    else if (typeof body.scheduledAt === "number") scheduledAt = body.scheduledAt;
    else if (body.scheduledAt !== undefined) {
      return NextResponse.json(
        { error: "scheduledAt: ожидается число (Unix seconds) или null." },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  // ── Отмена плана. ──
  if (scheduledAt === null) {
    await db
      .update(chapterRevisions)
      .set({ scheduledAt: null })
      .where(eq(chapterRevisions.id, target.revision.id));
    return NextResponse.json({ ok: true, scheduled: false });
  }

  // ── Планирование. ──
  if (typeof scheduledAt === "number") {
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(scheduledAt) || scheduledAt <= now) {
      return NextResponse.json({ error: "Время публикации должно быть в будущем." }, { status: 400 });
    }
    if (scheduledAt > now + MAX_SCHEDULE_AHEAD) {
      return NextResponse.json(
        { error: "Публикацию можно отложить не более чем на 30 дней." },
        { status: 400 },
      );
    }
    await db
      .update(chapterRevisions)
      .set({ scheduledAt })
      .where(eq(chapterRevisions.id, target.revision.id));
    return NextResponse.json({ ok: true, scheduled: true, scheduledAt });
  }

  // ── Публикация сейчас. ──
  try {
    await publishRevision({
      chapterId,
      revisionId: target.revision.id,
      revisionNumber: target.revision.number,
      blogId: target.blogId,
      blogSlug: target.blogSlug,
      chapterSlug: target.chapterSlug,
      chapterTitle: target.chapterTitle,
      authorId: target.authorId,
      authorHandle: target.authorHandle,
    });
  } catch (e) {
    if (e instanceof PublishGateError) return NextResponse.json({ error: e.reason }, { status: 409 });
    return NextResponse.json({ error: "Не удалось опубликовать." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    blogSlug: target.blogSlug,
    chapterSlug: target.chapterSlug,
  });
}
