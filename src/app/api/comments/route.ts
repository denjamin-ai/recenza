// Создание публичного комментария (Фаза 8): top-level или ответ (дискриминатор parentId).
// Порядок: CSRF → auth → rate-limit → валидация → resolve цели (ревизия с сервера) → гейтинг ролей →
// гейт глубины (≤2) → транзакция (insert + уведомление «другой стороне»).
// Текст и anchor.quote рендерятся текстовыми узлами React (экранируются) — raw HTML не храним (XSS-safe).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/lib/db";
import { publicComments, users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { stringifyJson } from "@/lib/db/json";
import { createNotifications } from "@/lib/queries/notifications";
import { commentGate, resolveCommentTarget } from "@/lib/queries/comments";
import type { CommentAnchor } from "@/types";

const MAX_TEXT = 4000;
const MAX_QUOTE = 600;

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireUser();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`comment-create:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  // ── Валидация тела ──
  let blogSlug: string;
  let chapterSlug: string;
  let parentId: string | null = null;
  let text: string;
  let anchor: CommentAnchor | null = null;
  try {
    const body = (await req.json()) as {
      blogSlug?: unknown;
      chapterSlug?: unknown;
      parentId?: unknown;
      text?: unknown;
      anchor?: unknown;
    };
    if (typeof body.blogSlug !== "string" || !body.blogSlug) {
      return NextResponse.json({ error: "Не указан блог." }, { status: 400 });
    }
    if (typeof body.chapterSlug !== "string" || !body.chapterSlug) {
      return NextResponse.json({ error: "Не указана глава." }, { status: 400 });
    }
    blogSlug = body.blogSlug;
    chapterSlug = body.chapterSlug;
    if (typeof body.parentId === "string" && body.parentId) parentId = body.parentId;

    const rawText = typeof body.text === "string" ? body.text.trim() : "";
    if (!rawText) return NextResponse.json({ error: "Пустой комментарий." }, { status: 400 });
    text = rawText.slice(0, MAX_TEXT);

    // Якорь — только у top-level (у ответов игнорируется).
    if (
      !parentId &&
      body.anchor &&
      typeof body.anchor === "object" &&
      typeof (body.anchor as CommentAnchor).blockId === "string" &&
      (body.anchor as CommentAnchor).blockId
    ) {
      const a = body.anchor as CommentAnchor;
      anchor = {
        blockId: a.blockId,
        ...(typeof a.quote === "string" && a.quote.trim()
          ? { quote: a.quote.trim().slice(0, MAX_QUOTE) }
          : {}),
      };
    }
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  // ── Цель (ревизия — с сервера, не из клиента) ──
  const target = await resolveCommentTarget(blogSlug, chapterSlug);
  if (!target) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });

  // ── Гейтинг ролей (авторитетно на сервере) ──
  const commenter = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { handle: true, role: true, commentingBlocked: true },
  });
  if (!commenter) return NextResponse.json({ error: "Сессия недействительна." }, { status: 401 });

  const gate = commentGate(
    { id: userId, role: commenter.role, commentingBlocked: commenter.commentingBlocked },
    target.blogAuthorId,
  );
  if (!gate.canComment) {
    return NextResponse.json({ error: gate.blockedReason ?? "Недостаточно прав." }, { status: 403 });
  }

  // ── Гейт глубины (binding, ≤2) + адресат уведомления-ответа ──
  let parentAuthorId: string | null = null;
  if (parentId) {
    const parent = (
      await db
        .select({
          id: publicComments.id,
          parentId: publicComments.parentId,
          blogSlug: publicComments.blogSlug,
          chapterSlug: publicComments.chapterSlug,
          authorId: publicComments.authorId,
          deletedAt: publicComments.deletedAt,
        })
        .from(publicComments)
        .where(eq(publicComments.id, parentId))
        .limit(1)
    )[0];
    if (!parent) return NextResponse.json({ error: "Родительский комментарий не найден." }, { status: 404 });
    if (parent.blogSlug !== blogSlug || parent.chapterSlug !== chapterSlug) {
      return NextResponse.json({ error: "Ответ в другой главе." }, { status: 400 });
    }
    if (parent.deletedAt != null) {
      return NextResponse.json({ error: "Нельзя ответить на удалённый комментарий." }, { status: 409 });
    }
    // Глубина родителя: 0 (top-level) / 1 / 2. Разрешаем ответ только при глубине родителя ≤1.
    let parentDepth = 0;
    if (parent.parentId) {
      parentDepth = 1;
      const grand = (
        await db
          .select({ parentId: publicComments.parentId })
          .from(publicComments)
          .where(eq(publicComments.id, parent.parentId))
          .limit(1)
      )[0];
      if (grand?.parentId) parentDepth = 2;
    }
    if (parentDepth >= 2) {
      return NextResponse.json({ error: "Слишком глубокая вложенность." }, { status: 409 });
    }
    parentAuthorId = parent.authorId;
  }

  const now = Math.floor(Date.now() / 1000);
  const newId = ulid();
  const href = `/blog/${blogSlug}/${chapterSlug}#comment-${newId}`;

  // Адресат уведомления — чистое чтение до транзакции; spec пропускается при self / отсутствии.
  const recipientId = parentId ? parentAuthorId : target.blogAuthorId;
  const notifyType = parentId ? "comment_reply" : "comment_new";
  const notify =
    recipientId && recipientId !== userId
      ? [
          {
            recipientId,
            type: notifyType,
            payload: {
              href,
              chapterTitle: target.chapterTitle,
              from: commenter.handle,
              commentId: newId,
            },
          },
        ]
      : [];

  try {
    await db.transaction(async (tx) => {
      await tx.insert(publicComments).values({
        id: newId,
        blogSlug,
        chapterSlug,
        revision: target.currentRevision,
        authorId: userId,
        parentId: parentId ?? null,
        text,
        anchor: anchor ? stringifyJson(anchor) : null,
        createdAt: now,
      });
      await createNotifications(tx, notify);
    });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить комментарий." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: newId });
}
