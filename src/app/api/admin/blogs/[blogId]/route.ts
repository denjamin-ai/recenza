// Флаги видимости блога, которыми управляет админ. Только админ; контент блога он НЕ правит.
//   • `hidden` (Фаза 10) — блог исчезает со всех публичных поверхностей (лента/каталог/подписки/
//     ридер/sitemap/feed) через фильтр `blogs.hidden`, независимо от бана автора.
//   • `featured` (Фаза 15) — «Выбор редакции»: ручное закрепление на витрине главной. Страховка
//     R-2 от пустой витрины, пока проверенных блогов меньше SHOWCASE_MIN_VERIFIED.
// Оба поля — из одного класса «где блог показывается», поэтому живут в одном роуте.

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

  // Строгий allowlist: спред тела запрещён (конвенция admin-роутов).
  const set: { hidden?: boolean; featuredAt?: number | null } = {};
  try {
    const body = (await req.json()) as { hidden?: unknown; featured?: unknown };
    if (body.hidden !== undefined) {
      if (typeof body.hidden !== "boolean") return NextResponse.json({ error: "hidden: ожидается boolean." }, { status: 400 });
      set.hidden = body.hidden;
    }
    if (body.featured !== undefined) {
      if (typeof body.featured !== "boolean") return NextResponse.json({ error: "featured: ожидается boolean." }, { status: 400 });
      // Дата закрепления — сервер, из тела её принимать нельзя (порядок витрины подделывался бы).
      set.featuredAt = body.featured ? Math.floor(Date.now() / 1000) : null;
    }
    if (Object.keys(set).length === 0) {
      return NextResponse.json({ error: "Нужно поле hidden или featured." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const blog = (await db.select({ id: blogs.id }).from(blogs).where(eq(blogs.id, blogId)).limit(1))[0];
  if (!blog) return NextResponse.json({ error: "Блог не найден." }, { status: 404 });

  await db.update(blogs).set(set).where(eq(blogs.id, blogId));
  return NextResponse.json({ ok: true });
}
