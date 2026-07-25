// Модерация пользователя (Фаза 10) — только админ. Тумблеры isBlocked / commentingBlocked +
// reviewCapacity + смена пароля (password → bcrypt-хэш; активные сессии не гасятся — backlog P2,
// при необходимости немедленного разлогина есть бан). Бан = soft (FK на users.handle запрещает
// hard-delete). Бан автора скрывает его блоги (фильтр users.isBlocked в getReadableChapters).
//
// ⚠️ Фаза 13: сюда добавлены ВОЗМОЖНОСТИ `canAuthor` / `isReviewer` — решение владельца «роли выдаёт
// администратор». Allowlist остаётся СТРОГИМ: спред тела в update() запрещён, поля перечислены явно.
// Ни `role` (legacy-колонка), ни `handle`/`slug` через это API не редактируются никогда.
// Отзыв возможности действует сразу, без перелогина: гарды перечитывают её из БД на каждый запрос.

import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { chapterReviewers, chapterRevisions, reviewRequests, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { SLA_UNCLAIMED_DAYS, dueAtFrom } from "@/lib/review-sla";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ handle: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { handle } = await params;

  let body: {
    isBlocked?: unknown;
    commentingBlocked?: unknown;
    reviewCapacity?: unknown;
    password?: unknown;
    canAuthor?: unknown;
    isReviewer?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const set: Partial<{
    isBlocked: boolean;
    commentingBlocked: boolean;
    reviewCapacity: number;
    passwordHash: string;
    canAuthor: boolean;
    isReviewer: boolean;
    /** Legacy-shim (Ф13): колонка notNull, гейты её не читают — держим синхронной, см. ниже. */
    role: "reader" | "author" | "reviewer";
  }> = {};
  if (body.canAuthor !== undefined) {
    if (typeof body.canAuthor !== "boolean") {
      return NextResponse.json({ error: "canAuthor: ожидается boolean." }, { status: 400 });
    }
    set.canAuthor = body.canAuthor;
  }
  if (body.isReviewer !== undefined) {
    if (typeof body.isReviewer !== "boolean") {
      return NextResponse.json({ error: "isReviewer: ожидается boolean." }, { status: 400 });
    }
    set.isReviewer = body.isReviewer;
  }
  if (body.isBlocked !== undefined) {
    if (typeof body.isBlocked !== "boolean") return NextResponse.json({ error: "isBlocked: ожидается boolean." }, { status: 400 });
    set.isBlocked = body.isBlocked;
  }
  if (body.commentingBlocked !== undefined) {
    if (typeof body.commentingBlocked !== "boolean") return NextResponse.json({ error: "commentingBlocked: ожидается boolean." }, { status: 400 });
    set.commentingBlocked = body.commentingBlocked;
  }
  if (body.reviewCapacity !== undefined) {
    if (typeof body.reviewCapacity !== "number" || !Number.isInteger(body.reviewCapacity) || body.reviewCapacity < 0 || body.reviewCapacity > 50) {
      return NextResponse.json({ error: "reviewCapacity: целое 0..50." }, { status: 400 });
    }
    set.reviewCapacity = body.reviewCapacity;
  }
  if (body.password !== undefined) {
    // Валидация как в POST /api/admin/users: строка 8..200; хэш — bcryptjs cost 10.
    if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 200) {
      return NextResponse.json({ error: "Пароль: от 8 до 200 символов." }, { status: 400 });
    }
    set.passwordHash = await bcrypt.hash(body.password, 10);
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "Нет полей для изменения." }, { status: 400 });
  }

  const target = (
    await db
      .select({ id: users.id, role: users.role, canAuthor: users.canAuthor, isReviewer: users.isReviewer })
      .from(users)
      .where(eq(users.handle, handle))
      .limit(1)
  )[0];
  if (!target) return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
  // Админа из БД не существует (env-based) — но на всякий случай не даём блокировать admin-роль.
  if (target.role === "admin") return NextResponse.json({ error: "Нельзя модерировать администратора." }, { status: 403 });

  // ⚠️ Ф14 (закрыт backlog-пункт Ф13 P2): отзыв возможности «ревьюер» раньше только закрывал ДОСТУП,
  // а назначения оставались висеть — глава числилась «на ревью» у человека, который больше не может
  // в неё войти, а его `review_load` не освобождался никогда. Теперь отзыв ещё и освобождает: взятые
  // заявки возвращаются в очередь (их сможет взять другой), назначения на ОТКРЫТЫЕ сессии снимаются,
  // счётчик пересчитывается по факту. Закрытые сессии (кредит, история) не трогаем — они иммутабельны.
  // ⚠️ Legacy-shim `users.role`: колонка notNull, гейты её НЕ читают (Ф13). До этого фикса
  // POST её выставлял, а PATCH — нет, и значение дрейфовало относительно реальных возможностей.
  // Дропнуть колонку нельзя (на `users` завязаны FK ревью-таблиц), поэтому держим её
  // синхронной с возможностями — единственный способ не иметь заведомо лживых данных.
  if (set.canAuthor !== undefined || set.isReviewer !== undefined) {
    const nextCanAuthor = set.canAuthor ?? target.canAuthor;
    const nextIsReviewer = set.isReviewer ?? target.isReviewer;
    set.role = nextIsReviewer ? "reviewer" : nextCanAuthor ? "author" : "reader";
  }

  const releasing = set.isReviewer === false;
  await db.transaction(async (tx) => {
    await tx.update(users).set(set).where(eq(users.handle, handle));
    if (!releasing) return;

    const now = Math.floor(Date.now() / 1000);
    await tx
      .update(reviewRequests)
      .set({ status: "open", claimedBy: null, claimedAt: null, dueAt: dueAtFrom(now, SLA_UNCLAIMED_DAYS) })
      .where(and(eq(reviewRequests.claimedBy, handle), eq(reviewRequests.status, "claimed")));

    // Снимаем назначения только там, где сессия ещё открыта.
    const assignments = await tx
      .select({ chapterId: chapterReviewers.chapterId, revisionNumber: chapterReviewers.revisionNumber })
      .from(chapterReviewers)
      .innerJoin(
        chapterRevisions,
        and(
          eq(chapterRevisions.chapterId, chapterReviewers.chapterId),
          eq(chapterRevisions.number, chapterReviewers.revisionNumber),
        ),
      )
      .where(and(eq(chapterReviewers.handle, handle), isNull(chapterRevisions.reviewClosedAt)));
    for (const a of assignments) {
      await tx
        .delete(chapterReviewers)
        .where(
          and(
            eq(chapterReviewers.chapterId, a.chapterId),
            eq(chapterReviewers.revisionNumber, a.revisionNumber),
            eq(chapterReviewers.handle, handle),
          ),
        );
      // Не осталось назначенных — ось ревью возвращается в «ждём ревьюера». Иначе глава показывала бы
      // «Ревью пройдено»/«На ревью» без единого живого ревьюера (паритет с SLA-возвратом).
      const rest = await tx
        .select({ handle: chapterReviewers.handle })
        .from(chapterReviewers)
        .where(
          and(
            eq(chapterReviewers.chapterId, a.chapterId),
            eq(chapterReviewers.revisionNumber, a.revisionNumber),
          ),
        );
      if (rest.length === 0) {
        await tx
          .update(chapterRevisions)
          .set({ reviewStatus: "requested" })
          .where(
            and(
              eq(chapterRevisions.chapterId, a.chapterId),
              eq(chapterRevisions.number, a.revisionNumber),
            ),
          );
      }
    }
    // Пересчёт вместо декремента: счётчик мог разъехаться, а здесь мы знаем точную правду.
    await tx.update(users).set({ reviewLoad: 0 }).where(eq(users.handle, handle));
  });

  return NextResponse.json({ ok: true });
}
