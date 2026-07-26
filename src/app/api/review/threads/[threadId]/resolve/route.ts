// Отметить тред решённым (Фаза 7) — без правки текста. Участник ревью (ревьюерский «отметить решённым»;
// автор для треда без suggestion тоже может закрыть). Правка текста по suggestion — отдельный роут apply.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { threads } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { resolveReviewAccess } from "@/lib/queries/review";
import { isReviewOpen } from "@/lib/review-status";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { threadId } = await params;
  const thread = (
    await db
      .select({ id: threads.id, chapterId: threads.chapterId, status: threads.status })
      .from(threads)
      .where(eq(threads.id, threadId))
      .limit(1)
  )[0];
  // ⚠️ Аудит ИБ 2026-07-26: гард ИДЁТ ПЕРЕД любыми сведениями о треде. Раньше 404/409 отдавались
  // до resolveReviewAccess, и посторонний (в т.ч. неаутентифицированный) отличал «треда нет» от
  // «тред есть и открыт/закрыт» — состояние чужой ревью-сессии утекало наружу.
  if (!thread) {
    const gate = await requireUser();
    if (gate instanceof NextResponse) return gate;
    return NextResponse.json({ error: "Тред не найден." }, { status: 404 });
  }

  const access = await resolveReviewAccess(thread.chapterId);
  if (access instanceof NextResponse) return access;

  if (thread.status !== "open") return NextResponse.json({ error: "Тред уже закрыт." }, { status: 409 });

  const rl = hitActionRate(`review-resolve:${access.user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  if (!isReviewOpen(access.session.revision.reviewStatus, access.session.revision.reviewClosedAt)) {
    return NextResponse.json({ error: "Глава не на активном ревью." }, { status: 409 });
  }

  try {
    await db.update(threads).set({ status: "resolved" }).where(eq(threads.id, threadId));
  } catch {
    return NextResponse.json({ error: "Не удалось обновить тред." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
