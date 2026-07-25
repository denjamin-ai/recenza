// Закрытие ревью-сессии и выдача бейджа (Фаза 14) — ЕДИНСТВЕННОЕ место в коде, где:
//   · пишется кредит `reviewer_history`,
//   · освобождается `users.review_load`,
//   · вычисляется и замораживается уровень бейджа `chapter_revisions.verified_tier`,
//   · закрываются заявки `review_requests` на эту ревизию.
//
// ⚠️ Зачем модуль вообще появился. До Ф14 кредит выдавался ТОЛЬКО в `publishRevision()`, потому что
// ревью всегда предшествовало публикации. Ф13 разрешила публиковать посреди ревью, а Ф14 — оставлять
// заявку на УЖЕ опубликованную главу: в этом сценарии после одобрения публикации не происходит,
// значит кредита, бейджа и освобождения слота ревьюера не случилось бы никогда, а `review_load`
// протекал бы навсегда. Поэтому закрытие вынесено сюда и вызывается из ДВУХ точек:
//   1) `publishRevision()`            — публикуем (в т.ч. посреди ревью);
//   2) `POST /api/review/[id]/verdict` — все одобрили ревизию, которая уже опубликована.
//
// Идемпотентность — на токене `chapter_revisions.review_closed_at`, который перечитывается ВНУТРИ
// транзакции: двойной `review_load −1` и дубль кредита невозможны даже при гонке publish × verdict.
//
// Все функции принимают executor (db | tx) и НИКОГДА не открывают свою транзакцию — вызывающий
// обязан работать в своей (кредит и бейдж должны быть атомарны с событием, которое их породило).

import { and, eq, inArray, sql } from "drizzle-orm";
import type { db as dbType } from "@/lib/db";
import {
  blogs,
  chapterReviewers,
  chapterRevisions,
  chapters,
  reviewRequests,
  reviewerHistory,
  users,
} from "@/lib/db/schema";
import type { VerifiedTier } from "@/types";

/** db или транзакция: обе поддерживают полный набор операций, который здесь нужен. */
type Executor = Parameters<Parameters<typeof dbType.transaction>[0]>[0] | typeof dbType;

export interface CloseSessionArgs {
  revisionId: string;
  chapterId: string;
  revisionNumber: number;
  /** Handle владельца блога — по нему считается уровень бейджа (кто кого привёл). */
  authorHandle: string;
}

export interface CloseSessionResult {
  /** false — сессия уже была закрыта: полный no-op (идемпотентность). */
  closed: boolean;
  /** Ревьюеры с вердиктом `approve` — только они получают кредит. */
  credited: string[];
  /** Все назначенные — им освобождается слот (`review_load −1`). */
  assigned: string[];
  /** Уровень бейджа; null — кредита нет либо ревизия не опубликована, бейдж не выдан. */
  tier: VerifiedTier | null;
}

/**
 * Уровень бейджа по происхождению ревьюеров (Фаза 14).
 *
 * `invited` — ВСЕ кредитованные ревьюеры приведены самим автором (`users.introduced_by` = его handle).
 * `independent` — есть хотя бы один, кого автор не приводил; только он пускает блог на главную (Ф15).
 *
 * ⚠️ План описывал правило для одного ревьюера («introduced_by == author → invited»); при нескольких
 * оно неоднозначно. Решение: бейдж отвечает на вопрос «проверял ли текст кто-то, кого автор
 * не приводил», поэтому один независимый поднимает уровень всей ревизии.
 */
export function tierFromProvenance(
  credited: { handle: string; introducedBy: string | null }[],
  authorHandle: string,
): VerifiedTier | null {
  if (credited.length === 0) return null;
  return credited.every((r) => r.introducedBy === authorHandle) ? "invited" : "independent";
}

/**
 * Закрывает ревью-сессию ревизии: кредит, бейдж, освобождение слотов, закрытие заявок.
 * Вызывать ВНУТРИ транзакции события. Бейдж выдаётся только опубликованной ревизии — поэтому
 * `publishRevision()` обязан звать эту функцию ПОСЛЕ того, как проставил `status='published'`.
 */
export async function closeReviewSession(
  tx: Executor,
  a: CloseSessionArgs,
): Promise<CloseSessionResult> {
  const now = Math.floor(Date.now() / 1000);
  const empty: CloseSessionResult = { closed: false, credited: [], assigned: [], tier: null };

  // Токен идемпотентности — перечитываем В транзакции (вне её проверка ловила бы гонку не всегда).
  const rev = (
    await tx
      .select({
        status: chapterRevisions.status,
        reviewClosedAt: chapterRevisions.reviewClosedAt,
        verifiedAt: chapterRevisions.verifiedAt,
      })
      .from(chapterRevisions)
      .where(eq(chapterRevisions.id, a.revisionId))
      .limit(1)
  )[0];
  if (!rev || rev.reviewClosedAt !== null) return empty;

  const verdictRows = await tx
    .select({ handle: chapterReviewers.handle, verdict: chapterReviewers.verdict })
    .from(chapterReviewers)
    .where(
      and(
        eq(chapterReviewers.chapterId, a.chapterId),
        eq(chapterReviewers.revisionNumber, a.revisionNumber),
      ),
    );
  const assigned = verdictRows.map((r) => r.handle);
  // ⚠️ Инвариант Ф13: КРЕДИТ — только за фактическое одобрение. Публиковать можно посреди ревью,
  // и ревьюер, запросивший правки, не должен получить публичную строчку «проверил это».
  const credited = verdictRows.filter((r) => r.verdict === "approve").map((r) => r.handle);

  // Кредит по версиям (идемпотентно: чистим и пишем заново).
  await tx
    .delete(reviewerHistory)
    .where(
      and(
        eq(reviewerHistory.chapterId, a.chapterId),
        eq(reviewerHistory.revisionNumber, a.revisionNumber),
      ),
    );
  for (const h of credited) {
    await tx.insert(reviewerHistory).values({
      chapterId: a.chapterId,
      revisionNumber: a.revisionNumber,
      handle: h,
    });
  }

  // Уровень бейджа считается ровно здесь: только тут одновременно известны свежий набор
  // кредитованных, автор блога и происхождение каждого ревьюера. Значение ЗАМОРАЖИВАЕТСЯ —
  // последующая правка `introduced_by` админом не переписывает выданные бейджи.
  let tier: VerifiedTier | null = null;
  if (credited.length > 0 && rev.status === "published") {
    const provenance = await tx
      .select({ handle: users.handle, introducedBy: users.introducedBy })
      .from(users)
      .where(inArray(users.handle, credited));
    tier = tierFromProvenance(provenance, a.authorHandle);
  }

  await tx
    .update(chapterRevisions)
    .set({
      reviewClosedAt: now,
      // Бейдж иммутабелен: если он уже был выдан этой ревизии (повторное открытие ревью и новое
      // закрытие без одобрений), дату первой проверки не затираем.
      ...(tier !== null ? { verifiedAt: rev.verifiedAt ?? now, verifiedTier: tier } : {}),
    })
    .where(eq(chapterRevisions.id, a.revisionId));

  // Слот занимает НАЗНАЧЕНИЕ, а не одобрение — освобождаем всех назначенных.
  if (assigned.length > 0) {
    await tx
      .update(users)
      .set({ reviewLoad: sql`max(${users.reviewLoad} - 1, 0)` })
      .where(inArray(users.handle, assigned));
  }

  // Живые заявки на эту ревизию исполнены — закрываем (иначе они висели бы в очереди и в SLA).
  await tx
    .update(reviewRequests)
    .set({ status: "done", resolvedAt: now })
    .where(
      and(
        eq(reviewRequests.chapterId, a.chapterId),
        eq(reviewRequests.revisionNumber, a.revisionNumber),
        inArray(reviewRequests.status, ["open", "claimed"]),
      ),
    );

  return { closed: true, credited, assigned, tier };
}

/**
 * Пересчитывает денормализованный бейдж блога (`blogs.verified_at`/`verified_tier`).
 *
 * ⚠️ Решение владельца: бейдж БЛОГА — исторический факт «блог проходил ревью», поэтому агрегат
 * берётся по ВСЕМ проверенным ревизиям блога, а не только по текущим опубликованным: правка
 * опечатки не должна выкидывать блог с главной (Ф15). Точная правда живёт на уровне главы —
 * `chapter_revisions.verified_at`/`verified_tier` привязаны к номеру ревизии.
 *
 * Вызывать БЕЗУСЛОВНО из тех же транзакций, что и `closeReviewSession` (даже когда бейдж не выдан):
 * агрегат мог измениться из-за удаления главы или появления более свежей проверенной ревизии.
 */
export async function recomputeBlogVerified(tx: Executor, blogId: string): Promise<void> {
  const rows = await tx
    .select({
      verifiedAt: chapterRevisions.verifiedAt,
      verifiedTier: chapterRevisions.verifiedTier,
    })
    .from(chapterRevisions)
    .innerJoin(chapters, eq(chapters.id, chapterRevisions.chapterId))
    .where(eq(chapters.blogId, blogId));

  const verified = rows.filter((r) => r.verifiedAt !== null);
  if (verified.length === 0) {
    await tx.update(blogs).set({ verifiedAt: null, verifiedTier: null }).where(eq(blogs.id, blogId));
    return;
  }
  const verifiedAt = verified.reduce((max, r) => (r.verifiedAt! > max ? r.verifiedAt! : max), 0);
  const verifiedTier: VerifiedTier = verified.some((r) => r.verifiedTier === "independent")
    ? "independent"
    : "invited";
  await tx.update(blogs).set({ verifiedAt, verifiedTier }).where(eq(blogs.id, blogId));
}
