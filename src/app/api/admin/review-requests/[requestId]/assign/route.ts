// Ручное назначение ревьюера на заявку (Фаза 15) — подстраховка холодного старта: пока ревьюеров
// мало, заявка может висеть в очереди до самой SLA-эскалации, и редакции нужен способ закрыть её
// руками, не подменяя модель («автор нигде не выбирает ревьюеров» — выбирает редакция, не автор).
//
// ⚠️ Транзакция — тот же общий `claimReviewRequest()`, что и у ревьюерского claim'а. Все гейты
// (заявка ещё open, ревизия актуальна, не свой блог, ёмкость ревьюера) действуют и здесь: админ
// не может «продавить» перегруженного ревьюера.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { ClaimError, claimReviewRequest } from "@/lib/queries/review-claim";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  // Лимит символический (actor — только админ), но он есть у всех мутаций назначения:
  // единообразие важнее, чем «здесь и так безопасно» (backlog Ф15, security-reviewer LOW).
  const rl = hitActionRate("admin:assign-reviewer");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { requestId } = await params;

  let handle: string;
  try {
    const body = (await req.json()) as { handle?: unknown };
    if (typeof body.handle !== "string" || !/^[a-z0-9_-]{3,30}$/.test(body.handle)) {
      return NextResponse.json({ error: "Укажите ревьюера." }, { status: 400 });
    }
    handle = body.handle;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const reviewer = (
    await db
      .select({
        id: users.id,
        handle: users.handle,
        displayName: users.displayName,
        isReviewer: users.isReviewer,
        isBlocked: users.isBlocked,
      })
      .from(users)
      .where(eq(users.handle, handle))
      .limit(1)
  )[0];
  if (!reviewer) return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
  if (!reviewer.isReviewer || reviewer.isBlocked) {
    return NextResponse.json({ error: "У пользователя нет возможности «ревьюер»." }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    const { chapterId } = await db.transaction((tx) =>
      claimReviewRequest(tx, {
        requestId,
        reviewer: { id: reviewer.id, handle: reviewer.handle, displayName: reviewer.displayName },
        byAdmin: true,
        now,
      }),
    );
    return NextResponse.json({ ok: true, chapterId });
  } catch (e) {
    if (e instanceof ClaimError) return NextResponse.json({ error: e.reason }, { status: e.status });
    return NextResponse.json({ error: "Не удалось назначить ревьюера." }, { status: 500 });
  }
}
