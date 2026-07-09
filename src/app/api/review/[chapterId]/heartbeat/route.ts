// Presence-heartbeat ревьюера (Фаза 12). ReviewScreen шлёт POST каждые ~30с (и на mount);
// онлайн-статус — деривация last_seen_at >= now−90с в getReviewSession. Отдельный POST, а не
// сайд-эффект поллинга: 30с-поллинг — это router.refresh() (RSC-рендер, писать в БД из него нельзя).
// Автор heartbeat не шлёт (presence показывает ревьюеров). Идемпотентен, rate-limit не нужен.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapterReviewers } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { resolveReviewAccess } from "@/lib/queries/review";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { chapterId } = await params;
  const access = await resolveReviewAccess(chapterId);
  if (access instanceof NextResponse) return access;
  if (access.role !== "reviewer") return NextResponse.json({ ok: true });

  await db
    .update(chapterReviewers)
    .set({ lastSeenAt: Math.floor(Date.now() / 1000) })
    .where(
      and(
        eq(chapterReviewers.chapterId, chapterId),
        eq(chapterReviewers.revisionNumber, access.session.revision.number),
        eq(chapterReviewers.handle, access.user.handle),
      ),
    );

  return NextResponse.json({ ok: true });
}
