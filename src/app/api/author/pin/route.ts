// Закрепление блога в кабинете (users.pinned_blog_id; один пин на автора). Идемпотентный set:
// {blogId} — закрепить; {blogId:null} — снять. Клиент решает toggle (уже закреплён → шлёт null).

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, users } from "@/lib/db/schema";
import { requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireAuthor();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`author-pin:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  let blogId: string | null;
  try {
    const body = (await req.json()) as { blogId?: unknown };
    if (body.blogId === null) {
      blogId = null;
    } else if (typeof body.blogId === "string" && body.blogId) {
      blogId = body.blogId;
    } else {
      return NextResponse.json({ error: "Некорректный blogId." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  // Закрепить можно только СВОЙ блог (ownership).
  if (blogId) {
    const owned = (
      await db
        .select({ id: blogs.id })
        .from(blogs)
        .where(and(eq(blogs.id, blogId), eq(blogs.authorId, userId)))
        .limit(1)
    )[0];
    if (!owned) return NextResponse.json({ error: "Блог не найден." }, { status: 404 });
  }

  await db.update(users).set({ pinnedBlogId: blogId }).where(eq(users.id, userId));
  return NextResponse.json({ ok: true, pinnedBlogId: blogId });
}
