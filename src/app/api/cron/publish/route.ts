// Cron отложенной публикации (Фаза 12). Защита: Authorization: Bearer <CRON_SECRET> ПЕРВОЙ проверкой
// (конвенция CLAUDE.md §API). Находит ЧЕРНОВЫЕ ревизии с наступившим scheduled_at и публикует каждую
// через общий publishRevision. Фаза 13: ревью-гейта больше нет (публикация свободна), поэтому
// PublishGateError остаётся ровно для одного случая — ревизию успели опубликовать иначе; тогда план
// снимается и автор получает scheduled_publish_failed. Запускается systemd-timer'ом каждые 5 минут.

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterRevisions, chapters } from "@/lib/db/schema";
import { REVIEW_NOTIFY } from "@/lib/review-links";
import { createNotifications } from "@/lib/queries/notifications";
import { PublishGateError, publishRevision } from "@/lib/queries/publish";

export const dynamic = "force-dynamic";

/** Constant-time сравнение Bearer-токена (security-ревью Ф12: != течёт тайминг). */
function bearerOk(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || !bearerOk(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const due = await db
    .select({
      revisionId: chapterRevisions.id,
      revisionNumber: chapterRevisions.number,
      chapterId: chapters.id,
      chapterSlug: chapters.slug,
      chapterTitle: chapters.title,
      blogId: blogs.id,
      blogSlug: blogs.slug,
      authorId: blogs.authorId,
    })
    .from(chapterRevisions)
    .innerJoin(chapters, eq(chapters.id, chapterRevisions.chapterId))
    .innerJoin(blogs, eq(blogs.id, chapters.blogId))
    .where(
      and(
        isNotNull(chapterRevisions.scheduledAt),
        lte(chapterRevisions.scheduledAt, now),
        eq(chapterRevisions.status, "draft"),
      ),
    );

  // Страховка: публикуем только ПОСЛЕДНЮЮ ревизию главы. Плановые записи гасятся при появлении
  // новой ревизии (submit-revision и fork в PATCH), но условие дешёвое и снимает целый класс
  // ошибок «cron опубликовал устаревшую версию».
  const maxNumber = new Map<string, number>();
  if (due.length > 0) {
    const all = await db
      .select({ chapterId: chapterRevisions.chapterId, number: chapterRevisions.number })
      .from(chapterRevisions)
      .where(inArray(chapterRevisions.chapterId, [...new Set(due.map((d) => d.chapterId))]));
    for (const r of all) {
      const prev = maxNumber.get(r.chapterId);
      if (prev == null || r.number > prev) maxNumber.set(r.chapterId, r.number);
    }
  }

  let published = 0;
  let failed = 0;
  for (const row of due) {
    if (maxNumber.get(row.chapterId) !== row.revisionNumber) {
      // Поверх запланированной ревизии уже есть новая — снимаем план молча.
      await db
        .update(chapterRevisions)
        .set({ scheduledAt: null })
        .where(eq(chapterRevisions.id, row.revisionId));
      continue;
    }
    try {
      await publishRevision({
        chapterId: row.chapterId,
        revisionId: row.revisionId,
        revisionNumber: row.revisionNumber,
        blogId: row.blogId,
        blogSlug: row.blogSlug,
        chapterSlug: row.chapterSlug,
        chapterTitle: row.chapterTitle,
        authorId: row.authorId,
      });
      published += 1;
    } catch (e) {
      failed += 1;
      // Ревизию опубликовали иначе (автор вручную) → снимаем план и говорим автору.
      // Прочие ошибки план НЕ снимают — следующий тик попробует снова.
      if (e instanceof PublishGateError) {
        await db
          .update(chapterRevisions)
          .set({ scheduledAt: null })
          .where(eq(chapterRevisions.id, row.revisionId));
        await createNotifications(db, [
          {
            recipientId: row.authorId,
            type: REVIEW_NOTIFY.scheduledPublishFailed,
            payload: {
              href: `/author/blog/${row.blogSlug}/${row.chapterSlug}/review`,
              chapterTitle: row.chapterTitle,
              reason: e.reason,
            },
          },
        ]);
      }
    }
  }

  return NextResponse.json({ ok: true, due: due.length, published, failed });
}
