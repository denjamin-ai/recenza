// Отметить тред решённым (Фаза 7) — без правки текста. Участник ревью (ревьюерский «отметить решённым»;
// автор для треда без suggestion тоже может закрыть). Правка текста по suggestion — отдельный роут apply.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { threads } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { resolveReviewAccess } from "@/lib/queries/review";

const ACTIVE = new Set(["under-review", "changes-requested"]);

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

  const rl = hitActionRate(`review-resolve:${access.user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  if (!ACTIVE.has(access.session.revision.status)) {
    return NextResponse.json({ error: "Глава не на активном ревью." }, { status: 409 });
  }

  try {
    await db.update(threads).set({ status: "resolved" }).where(and(eq(threads.id, threadId)));
  } catch {
    return NextResponse.json({ error: "Не удалось обновить тред." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
