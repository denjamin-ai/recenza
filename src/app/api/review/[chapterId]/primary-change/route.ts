// Запрос смены ведущего ревьюера (Фаза 7) — author-only. Пишет primary_change_requests (pending) и
// уведомляет админа. Реальная смена ведущего — Фаза 10 (до решения админа ведущий не меняется).
// schema primary_change_requests не хранит reason — причину передаём в payload уведомления админу.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { primaryChangeRequests } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { createNotifications } from "@/lib/queries/notifications";
import { resolveReviewAccess } from "@/lib/queries/review";

const ACTIVE = new Set(["under-review", "changes-requested"]);
const MAX_REASON = 1000;

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
    return NextResponse.json({ error: "Запросить смену ведущего может только автор." }, { status: 403 });
  }

  const rl = hitActionRate(`review-primary:${access.user.id}`);
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
  const currentPrimary = session.chapter.primaryHandle;
  if (!currentPrimary) {
    return NextResponse.json({ error: "У главы нет ведущего ревьюера." }, { status: 409 });
  }

  let toHandle: string;
  let reason: string | null = null;
  try {
    const body = (await req.json()) as { toHandle?: unknown; reason?: unknown };
    if (typeof body.toHandle !== "string" || !body.toHandle) {
      return NextResponse.json({ error: "Не выбран новый ведущий." }, { status: 400 });
    }
    toHandle = body.toHandle.trim();
    if (typeof body.reason === "string" && body.reason.trim()) reason = body.reason.trim().slice(0, MAX_REASON);
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  if (toHandle === currentPrimary) {
    return NextResponse.json({ error: "Это уже ведущий ревьюер." }, { status: 400 });
  }
  // Новый ведущий должен быть среди назначенных ревьюеров.
  if (!session.reviewers.some((r) => r.handle === toHandle)) {
    return NextResponse.json({ error: "Новый ведущий должен быть среди ревьюеров главы." }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(primaryChangeRequests).values({
        chapterId,
        fromHandle: currentPrimary,
        toHandle,
        status: "pending",
        createdAt: now,
      });
      await createNotifications(tx, [
        {
          isAdminRecipient: true,
          type: "primary_change_request",
          payload: {
            chapterTitle: session.chapter.title,
            blogSlug: session.blog.slug,
            chapterSlug: session.chapter.slug,
            fromHandle: currentPrimary,
            toHandle,
            reason,
          },
        },
      ]);
    });
  } catch {
    return NextResponse.json({ error: "Не удалось отправить запрос." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
