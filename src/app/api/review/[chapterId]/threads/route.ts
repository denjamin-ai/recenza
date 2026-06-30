// Создание треда/предложения правки (Фаза 7). Участник ревью (автор-владелец или назначенный ревьюер).
// Тред привязан к блоку текущей ревизии. suggestion {from,to} → предложение замены (apply-and-close у автора).
// Текст рендерится текстовыми узлами React (экранируется) — raw HTML не вставляем (XSS-safe).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { threads } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { stringifyJson } from "@/lib/db/json";
import { createNotifications } from "@/lib/queries/notifications";
import {
  REVIEW_NOTIFY,
  authorReviewHref,
  resolveReviewAccess,
  reviewerReviewHref,
  userIdsByHandle,
} from "@/lib/queries/review";
import type { Suggestion } from "@/types";

const ACTIVE = new Set(["under-review", "changes-requested"]);
const MAX_TEXT = 4000;
const MAX_ANCHOR = 600;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { chapterId } = await params;
  const access = await resolveReviewAccess(chapterId);
  if (access instanceof NextResponse) return access;

  const rl = hitActionRate(`review-thread:${access.user.id}`);
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

  let blockId: string;
  let anchor: string | null = null;
  let text: string;
  let suggestion: Suggestion | null = null;
  try {
    const body = (await req.json()) as {
      blockId?: unknown;
      anchor?: unknown;
      text?: unknown;
      suggestion?: unknown;
    };
    if (typeof body.blockId !== "string" || !body.blockId) {
      return NextResponse.json({ error: "Не указан блок." }, { status: 400 });
    }
    blockId = body.blockId;
    if (typeof body.anchor === "string" && body.anchor.trim()) {
      anchor = body.anchor.trim().slice(0, MAX_ANCHOR);
    }
    if (
      body.suggestion &&
      typeof body.suggestion === "object" &&
      typeof (body.suggestion as Suggestion).from === "string" &&
      typeof (body.suggestion as Suggestion).to === "string"
    ) {
      const s = body.suggestion as Suggestion;
      suggestion = { from: s.from.slice(0, MAX_TEXT), to: s.to.slice(0, MAX_TEXT) };
    }
    const rawText = typeof body.text === "string" ? body.text.trim() : "";
    text = rawText ? rawText.slice(0, MAX_TEXT) : suggestion ? "Предложена правка фрагмента." : "";
    if (!text) return NextResponse.json({ error: "Пустой комментарий." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  // Блок должен существовать в текущей ревизии (защита от произвольного blockId).
  if (!session.revision.blocks.some((b) => b.id === blockId)) {
    return NextResponse.json({ error: "Блок не найден в этой ревизии." }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  // Адресаты уведомлений (когда пишет автор) — чистое чтение до транзакции.
  const reviewerIds =
    access.role === "author" ? await userIdsByHandle(session.reviewers.map((r) => r.handle)) : null;

  try {
    await db.transaction(async (tx) => {
      await tx.insert(threads).values({
        chapterId,
        revisionNumber: session.revision.number,
        blockId,
        anchor,
        status: "open",
        fromHandle: access.user.handle,
        text,
        suggestion: suggestion ? stringifyJson(suggestion) : null,
        createdAt: now,
      });
      // Уведомить «другую сторону»: ревьюер написал → автору; автор написал → назначенным ревьюерам.
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
        const ids = reviewerIds ?? new Map<string, string>();
        await createNotifications(
          tx,
          session.reviewers
            .map((r) => ids.get(r.handle))
            .filter((id): id is string => !!id)
            .map((recipientId) => ({
              recipientId,
              type: REVIEW_NOTIFY.comment,
              payload: {
                href: reviewerReviewHref(chapterId),
                chapterTitle: session.chapter.title,
                from: access.user.handle,
              },
            })),
        );
      }
    });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить комментарий." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
