// Cron отложенной публикации (Фаза 12). Защита: Authorization: Bearer <CRON_SECRET> ПЕРВОЙ проверкой
// (конвенция CLAUDE.md §API). Находит активные ревизии с наступившим scheduled_at и публикует каждую
// через общий publishRevision (гейт «все approve» перепроверяется в транзакции — вердикт мог
// измениться после планирования). Провал гейта — не ошибка cron: план снимается, автор получает
// уведомление scheduled_publish_failed. Запускается systemd-timer'ом на сервере каждые 5 минут.

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
        inArray(chapterRevisions.status, ["under-review", "changes-requested"]),
      ),
    );

  let published = 0;
  let failed = 0;
  for (const row of due) {
    try {
      await publishRevision(
        {
          chapterId: row.chapterId,
          revisionId: row.revisionId,
          revisionNumber: row.revisionNumber,
          blogId: row.blogId,
          blogSlug: row.blogSlug,
          chapterSlug: row.chapterSlug,
          chapterTitle: row.chapterTitle,
          authorId: row.authorId,
        },
        { gate: "all-approve" },
      );
      published += 1;
    } catch (e) {
      failed += 1;
      // Гейт перестал проходить (вердикт отозван/сменился состав) → снимаем план и говорим автору.
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
