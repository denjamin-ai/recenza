// Ответ в треде ревью (Фаза 7). Участник ревью (автор или назначенный ревьюер). Вложенность тредов
// плоская (ответы одним уровнем). Уведомляем «другую сторону».

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { threadReplies, threads } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { createNotifications } from "@/lib/queries/notifications";
import {
  REVIEW_NOTIFY,
  authorReviewHref,
  resolveReviewAccess,
  reviewerReviewHref,
  userIdsByHandle,
} from "@/lib/queries/review";

const ACTIVE = new Set(["under-review", "changes-requested"]);
const MAX_TEXT = 4000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { threadId } = await params;
  const thread = (
    await db
      .select({ id: threads.id, chapterId: threads.chapterId })
      .from(threads)
      .where(eq(threads.id, threadId))
      .limit(1)
  )[0];
  if (!thread) return NextResponse.json({ error: "Тред не найден." }, { status: 404 });

  const access = await resolveReviewAccess(thread.chapterId);
  if (access instanceof NextResponse) return access;

  const rl = hitActionRate(`review-reply:${access.user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { session } = access;
  if (!ACTIVE.has(session.revision.status)) {
    return NextResponse.json({ error: "Глава не на активном ревью." }, { status: 409 });
  }

  let text: string;
  try {
    const body = (await req.json()) as { text?: unknown };
    const raw = typeof body.text === "string" ? body.text.trim() : "";
    if (!raw) return NextResponse.json({ error: "Пустой ответ." }, { status: 400 });
    text = raw.slice(0, MAX_TEXT);
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(threadReplies).values({ threadId, fromHandle: access.user.handle, text, createdAt: now });
      if (access.role === "reviewer") {
        await createNotifications(tx, [
          {
            recipientId: session.blog.authorId,
            type: REVIEW_NOTIFY.comment,
            payload: {
              href: authorReviewHref(session.blog.slug, session.chapter.slug),
              chapterTitle: session.chapter.title,
              from: access.user.handle,
            },
          },
        ]);
      } else {
        const ids = await userIdsByHandle(session.reviewers.map((r) => r.handle));
        await createNotifications(
          tx,
          session.reviewers
            .map((r) => ids.get(r.handle))
            .filter((id): id is string => !!id)
            .map((recipientId) => ({
              recipientId,
              type: REVIEW_NOTIFY.comment,
              payload: {
                href: reviewerReviewHref(thread.chapterId),
                chapterTitle: session.chapter.title,
                from: access.user.handle,
              },
            })),
        );
      }
    });
  } catch {
    return NextResponse.json({ error: "Не удалось отправить ответ." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
