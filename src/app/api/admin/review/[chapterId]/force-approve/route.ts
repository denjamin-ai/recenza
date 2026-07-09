// Force-approve главы админом (Фаза 10; Фаза 12 — общий сервис publishRevision). ОБХОДИТ гейт
// «все approve» (gate="force"), но сохраняет всё остальное: ревизия → published, кредит ревьюеров,
// reviewLoad −1, publishedAt блога, уведомления (автору force_approved, ревьюерам published,
// подписчикам new_chapter), гашение pending-запросов смены ведущего. Только админ.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { getReviewSession } from "@/lib/queries/review";
import {
  ACTIVE_REVISION_STATUSES,
  PublishGateError,
  publishRevision,
} from "@/lib/queries/publish";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { chapterId } = await params;
  const session = await getReviewSession(chapterId);
  if (!session) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });
  if (!ACTIVE_REVISION_STATUSES.has(session.revision.status)) {
    return NextResponse.json({ error: "Главу нельзя опубликовать из текущего статуса." }, { status: 409 });
  }

  try {
    await publishRevision(
      {
        chapterId,
        revisionId: session.revision.id,
        revisionNumber: session.revision.number,
        blogId: session.blog.id,
        blogSlug: session.blog.slug,
        chapterSlug: session.chapter.slug,
        chapterTitle: session.chapter.title,
        authorId: session.blog.authorId,
      },
      { gate: "force", notifyAuthorForceApproved: true },
    );
  } catch (e) {
    if (e instanceof PublishGateError) return NextResponse.json({ error: e.reason }, { status: 409 });
    return NextResponse.json({ error: "Не удалось опубликовать." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, blogSlug: session.blog.slug, chapterSlug: session.chapter.slug });
}
