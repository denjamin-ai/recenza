// Чат сессии ревью — вне тредов (Фаза 7). Участник ревью (автор или назначенный ревьюер).
// Лёгкое общение по ходу ревью; уведомления не шлём (видно при поллинге/refresh).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reviewChat } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { resolveReviewAccess } from "@/lib/queries/review";

const ACTIVE = new Set(["under-review", "changes-requested"]);
const MAX_TEXT = 2000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { chapterId } = await params;
  const access = await resolveReviewAccess(chapterId);
  if (access instanceof NextResponse) return access;

  const rl = hitActionRate(`review-chat:${access.user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  if (!ACTIVE.has(access.session.revision.status)) {
    return NextResponse.json({ error: "Глава не на активном ревью." }, { status: 409 });
  }

  let text: string;
  try {
    const body = (await req.json()) as { text?: unknown };
    const raw = typeof body.text === "string" ? body.text.trim() : "";
    if (!raw) return NextResponse.json({ error: "Пустое сообщение." }, { status: 400 });
    text = raw.slice(0, MAX_TEXT);
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  try {
    await db.insert(reviewChat).values({
      chapterId,
      revisionNumber: access.session.revision.number,
      fromHandle: access.user.handle,
      text,
      createdAt: Math.floor(Date.now() / 1000),
    });
  } catch {
    return NextResponse.json({ error: "Не удалось отправить сообщение." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
