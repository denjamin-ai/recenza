// Переупорядочивание глав блога: полный перезапис chapters.order = индекс в присланном списке.
// Целостность: множество присланных id ДОЛЖНО точно совпадать с главами блога (ни лишних, ни недостающих).

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapters } from "@/lib/db/schema";
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

  const rl = hitActionRate(`author-reorder:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  let blogId: string;
  let chapterIds: string[];
  try {
    const body = (await req.json()) as { blogId?: unknown; chapterIds?: unknown };
    if (typeof body.blogId !== "string" || !body.blogId) {
      return NextResponse.json({ error: "Некорректный blogId." }, { status: 400 });
    }
    if (
      !Array.isArray(body.chapterIds) ||
      body.chapterIds.some((x) => typeof x !== "string") ||
      body.chapterIds.length === 0
    ) {
      return NextResponse.json({ error: "Некорректный список глав." }, { status: 400 });
    }
    blogId = body.blogId;
    chapterIds = body.chapterIds as string[];
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  // Ownership.
  const blog = (
    await db
      .select({ id: blogs.id })
      .from(blogs)
      .where(and(eq(blogs.id, blogId), eq(blogs.authorId, userId)))
      .limit(1)
  )[0];
  if (!blog) return NextResponse.json({ error: "Блог не найден." }, { status: 404 });

  // Целостность набора: присланные id == главы блога (без дубликатов/лишних/недостающих).
  const actual = await db.select({ id: chapters.id }).from(chapters).where(eq(chapters.blogId, blogId));
  const actualSet = new Set(actual.map((c) => c.id));
  const postedSet = new Set(chapterIds);
  if (
    postedSet.size !== chapterIds.length ||
    actualSet.size !== postedSet.size ||
    [...postedSet].some((id) => !actualSet.has(id))
  ) {
    return NextResponse.json({ error: "Список глав не совпадает с блогом." }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < chapterIds.length; i++) {
      await tx.update(chapters).set({ order: i }).where(eq(chapters.id, chapterIds[i]));
    }
    await tx.update(blogs).set({ lastActivityAt: Math.floor(Date.now() / 1000) }).where(eq(blogs.id, blogId));
  });

  return NextResponse.json({ ok: true });
}
