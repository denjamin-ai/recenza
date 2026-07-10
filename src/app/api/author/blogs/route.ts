// Создание блога автором (create-then-edit): блог + первая глава "main" + пустая draft-ревизия.
// Контент пишется потом редактором (PATCH). Скелет следует канону src/app/api/bookmarks/route.ts.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/lib/db";
import { blogs, chapterRevisions, chapters } from "@/lib/db/schema";
import { requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { stringifyJson } from "@/lib/db/json";
import { slugify, uniqueSlug } from "@/lib/slug";

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireAuthor();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`author-create-blog:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  let title: string;
  try {
    const body = (await req.json()) as { title?: unknown };
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "Укажите название блога." }, { status: 400 });
    }
    title = body.title.trim().slice(0, 200);
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const blogSlug = await uniqueSlug(
    slugify(title),
    async (s) => !!(await db.select({ id: blogs.id }).from(blogs).where(eq(blogs.slug, s)).limit(1))[0],
    "blog",
  );

  const blogId = ulid();
  const chapterId = ulid();
  const now = Math.floor(Date.now() / 1000);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(blogs).values({
        id: blogId,
        slug: blogSlug,
        title,
        authorId: userId,
        complexity: "medium", // правится в настройках/SubmitSheet
        lastActivityAt: now,
      });
      await tx.insert(chapters).values({
        id: chapterId,
        blogId,
        slug: "main",
        title,
        order: 0,
      });
      await tx.insert(chapterRevisions).values({
        chapterId,
        number: 1,
        status: "draft",
        blocks: stringifyJson([]),
      });
    });
  } catch {
    // гонка по unique(slug) или сбой — безопасный 409 (автор повторит).
    return NextResponse.json({ error: "Не удалось создать блог, попробуйте ещё раз." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, blogId, blogSlug, chapterSlug: "main", chapterId });
}
