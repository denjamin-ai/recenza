// Закладка блога (toggle), race-safe. bookmarkCount обновляется в той же транзакции (не дрейфует).
// ui-feedback-5: закладки — ТОЛЬКО роль reader (модель ролей; решение владельца).

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, bookmarks } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";

async function readState(userId: string, blogId: string) {
  const [markRow, blogRow] = await Promise.all([
    db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.blogId, blogId)))
      .limit(1),
    db.select({ count: blogs.bookmarkCount }).from(blogs).where(eq(blogs.id, blogId)).limit(1),
  ]);
  return { bookmarked: markRow.length > 0, bookmarkCount: blogRow[0]?.count ?? 0 };
}

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireUser("reader");
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`bookmark:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  let blogId: string;
  try {
    const body = (await req.json()) as { blogId?: unknown };
    if (typeof body.blogId !== "string" || !body.blogId) {
      return NextResponse.json({ error: "Некорректный blogId." }, { status: 400 });
    }
    blogId = body.blogId;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const blogRow = (await db.select({ id: blogs.id }).from(blogs).where(eq(blogs.id, blogId)).limit(1))[0];
  if (!blogRow) return NextResponse.json({ error: "Блог не найден." }, { status: 404 });

  try {
    const result = await db.transaction(async (tx) => {
      const existing = (
        await tx
          .select({ id: bookmarks.id })
          .from(bookmarks)
          .where(and(eq(bookmarks.userId, userId), eq(bookmarks.blogId, blogId)))
          .limit(1)
      )[0];

      let bookmarked: boolean;
      if (!existing) {
        await tx.insert(bookmarks).values({ userId, blogId, createdAt: Math.floor(Date.now() / 1000) });
        await tx
          .update(blogs)
          .set({ bookmarkCount: sql`${blogs.bookmarkCount} + 1` })
          .where(eq(blogs.id, blogId));
        bookmarked = true;
      } else {
        await tx.delete(bookmarks).where(eq(bookmarks.id, existing.id));
        await tx
          .update(blogs)
          .set({ bookmarkCount: sql`max(0, ${blogs.bookmarkCount} - 1)` })
          .where(eq(blogs.id, blogId));
        bookmarked = false;
      }

      const countRow = (
        await tx.select({ count: blogs.bookmarkCount }).from(blogs).where(eq(blogs.id, blogId)).limit(1)
      )[0];
      return { bookmarked, bookmarkCount: countRow?.count ?? 0 };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: true, ...(await readState(userId, blogId)) });
  }
}
