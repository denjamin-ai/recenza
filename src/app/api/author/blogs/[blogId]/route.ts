// Настройки блога (ChapterSettingsPopover): title/slug/tags/complexity/coverUrl/summary.
// Allowlist (никогда не spread тела в update — правило Фазы 2). slug — транслит+уникальность среди ЧУЖИХ.
// coverUrl — только /uploads/ (как ImageBlock). Ownership: blog.authorId === userId.

import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs } from "@/lib/db/schema";
import { requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { stringifyJson } from "@/lib/db/json";
import { slugify, uniqueSlug } from "@/lib/slug";
import { COMPLEXITIES, type Complexity } from "@/types";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ blogId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireAuthor();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`author-blog-settings:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { blogId } = await params;

  let body: {
    title?: unknown;
    slug?: unknown;
    tags?: unknown;
    complexity?: unknown;
    coverUrl?: unknown;
    summary?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  // Ownership.
  const blog = (
    await db
      .select({ id: blogs.id, slug: blogs.slug, authorId: blogs.authorId })
      .from(blogs)
      .where(eq(blogs.id, blogId))
      .limit(1)
  )[0];
  if (!blog || blog.authorId !== userId) return NextResponse.json({ error: "Блог не найден." }, { status: 404 });

  const set: {
    title?: string;
    slug?: string;
    tags?: string;
    complexity?: Complexity;
    coverUrl?: string | null;
    summary?: string | null;
  } = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "Некорректное название." }, { status: 400 });
    }
    set.title = body.title.trim().slice(0, 200);
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.some((t) => typeof t !== "string")) {
      return NextResponse.json({ error: "Некорректные теги." }, { status: 400 });
    }
    const tags = (body.tags as string[]).map((t) => t.trim()).filter(Boolean).slice(0, 8);
    set.tags = stringifyJson(tags);
  }

  if (body.complexity !== undefined) {
    if (!(COMPLEXITIES as readonly string[]).includes(body.complexity as string)) {
      return NextResponse.json({ error: "Некорректная сложность." }, { status: 400 });
    }
    set.complexity = body.complexity as Complexity;
  }

  if (body.coverUrl !== undefined) {
    if (body.coverUrl === null || body.coverUrl === "") {
      set.coverUrl = null;
    } else if (typeof body.coverUrl === "string" && body.coverUrl.startsWith("/uploads/")) {
      set.coverUrl = body.coverUrl;
    } else {
      return NextResponse.json({ error: "Обложка: только путь /uploads/." }, { status: 400 });
    }
  }

  if (body.summary !== undefined) {
    if (body.summary === null || body.summary === "") set.summary = null;
    else if (typeof body.summary === "string") set.summary = body.summary.trim().slice(0, 2000);
    else return NextResponse.json({ error: "Некорректное описание." }, { status: 400 });
  }

  // slug меняем последним — нужна уникальность среди ЧУЖИХ блогов.
  if (body.slug !== undefined) {
    if (typeof body.slug !== "string") return NextResponse.json({ error: "Некорректный slug." }, { status: 400 });
    const base = slugify(body.slug);
    set.slug = await uniqueSlug(
      base,
      async (s) =>
        s !== blog.slug &&
        !!(
          await db
            .select({ id: blogs.id })
            .from(blogs)
            .where(and(eq(blogs.slug, s), ne(blogs.id, blogId)))
            .limit(1)
        )[0],
      "blog",
    );
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: true, slug: blog.slug });
  }

  try {
    await db.update(blogs).set(set).where(eq(blogs.id, blogId));
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить настройки." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, slug: set.slug ?? blog.slug });
}
