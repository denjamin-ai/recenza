// Публикация главы админом (Фаза 10; Фаза 12 — общий сервис publishRevision). Ревизия → published,
// кредит ревьюеров, reviewLoad −1, publishedAt блога, уведомления (автору force_approved, ревьюерам
// published, подписчикам new_chapter), гашение pending-запросов смены ведущего. Только админ.
//
// ⚠️ Фаза 13: «обход гейта» больше не является смыслом этого роута — публикация свободна и для автора.
// Роут остаётся как административное действие «опубликовать за автора» (с уведомлением автору);
// пересмотр админского UI ревью — Ф15.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { getReviewSession } from "@/lib/queries/review";
import { PublishGateError, publishRevision } from "@/lib/queries/publish";

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
  if (session.revision.status === "published") {
    return NextResponse.json({ error: "Эта версия главы уже опубликована." }, { status: 409 });
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
        authorHandle: session.blog.authorHandle,
      },
      { notifyAuthorForceApproved: true },
    );
  } catch (e) {
    if (e instanceof PublishGateError) return NextResponse.json({ error: e.reason }, { status: 409 });
    return NextResponse.json({ error: "Не удалось опубликовать." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, blogSlug: session.blog.slug, chapterSlug: session.chapter.slug });
}
