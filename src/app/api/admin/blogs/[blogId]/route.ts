// Скрытие/показ отдельного блога админом (Фаза 10). hidden=true → блог исчезает со всех публичных
// поверхностей (лента/каталог/подписки/ридер/sitemap/feed) через фильтр blogs.hidden, независимо от
// бана автора. Только админ. Админ НЕ создаёт/не правит контент блога — только флаг видимости.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ blogId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { blogId } = await params;

  let hidden: boolean;
  try {
    const body = (await req.json()) as { hidden?: unknown };
    if (typeof body.hidden !== "boolean") return NextResponse.json({ error: "hidden: ожидается boolean." }, { status: 400 });
    hidden = body.hidden;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const blog = (await db.select({ id: blogs.id }).from(blogs).where(eq(blogs.id, blogId)).limit(1))[0];
  if (!blog) return NextResponse.json({ error: "Блог не найден." }, { status: 404 });

  await db.update(blogs).set({ hidden }).where(eq(blogs.id, blogId));
  return NextResponse.json({ ok: true });
}
