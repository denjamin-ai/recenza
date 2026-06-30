// Создание новой главы в своём блоге (create-then-edit): глава + пустая draft-ревизия.
// order = текущее число глав (в конец). Ownership: blog.authorId === userId.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/lib/db";
import { blogs, chapterRevisions, chapters } from "@/lib/db/schema";
import { requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { stringifyJson } from "@/lib/db/json";
import { slugify, uniqueSlug } from "@/lib/slug";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ blogId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireAuthor();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`author-create-chapter:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { blogId } = await params;

  let title = "Новая глава";
  try {
    const body = (await req.json().catch(() => ({}))) as { title?: unknown };
    if (typeof body.title === "string" && body.title.trim()) title = body.title.trim().slice(0, 200);
  } catch {
    /* пустое тело допустимо */
  }

  // Ownership.
  const blog = (
    await db
      .select({ id: blogs.id, slug: blogs.slug })
      .from(blogs)
      .where(and(eq(blogs.id, blogId), eq(blogs.authorId, userId)))
      .limit(1)
  )[0];
  if (!blog) return NextResponse.json({ error: "Блог не найден." }, { status: 404 });

  const existing = await db.select({ id: chapters.id }).from(chapters).where(eq(chapters.blogId, blogId));
  const order = existing.length;

  const chapterSlug = await uniqueSlug(
    slugify(title),
    async (s) =>
      !!(
        await db
          .select({ id: chapters.id })
          .from(chapters)
          .where(and(eq(chapters.blogId, blogId), eq(chapters.slug, s)))
          .limit(1)
      )[0],
    "chapter",
  );

  const chapterId = ulid();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(chapters).values({ id: chapterId, blogId, slug: chapterSlug, title, order });
      await tx.insert(chapterRevisions).values({
        chapterId,
        number: 1,
        status: "draft",
        blocks: stringifyJson([]),
      });
      await tx.update(blogs).set({ lastActivityAt: Math.floor(Date.now() / 1000) }).where(eq(blogs.id, blogId));
    });
  } catch {
    return NextResponse.json({ error: "Не удалось создать главу, попробуйте ещё раз." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, blogSlug: blog.slug, chapterSlug });
}
