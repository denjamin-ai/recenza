// Ревьюер берёт заявку из очереди (Фаза 14) — точка, где ревью реально стартует.
// Пришла на смену accept'у приглашения (`/api/reviewer/invitations/[id]`, удалён): инициатива
// перешла к ревьюеру, но downstream не тронут — треды/вердикты/чат по-прежнему опираются на
// `chapter_reviewers`, строку в которой создаёт именно claim.
//
// ⚠️ Ф15: сама транзакция уехала в общий `claimReviewRequest()` — ту же операцию выполняет
// ручное назначение админом (`POST /api/admin/review-requests/[id]/assign`). Здесь остались
// только гейты входа: возможность «ревьюер», rate-limit и CSRF.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, requireReviewer } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { ClaimError, claimReviewRequest } from "@/lib/queries/review-claim";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireReviewer();
  if (gate instanceof NextResponse) return gate;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`request-claim:${user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { requestId } = await params;
  const now = Math.floor(Date.now() / 1000);

  try {
    const { chapterId } = await db.transaction((tx) =>
      claimReviewRequest(tx, {
        requestId,
        reviewer: { id: user.id, handle: user.handle, displayName: user.displayName },
        now,
      }),
    );
    return NextResponse.json({ ok: true, chapterId });
  } catch (e) {
    if (e instanceof ClaimError) return NextResponse.json({ error: e.reason }, { status: e.status });
    return NextResponse.json({ error: "Не удалось взять заявку." }, { status: 500 });
  }
}
