// Отправка главы на ревью (Фаза 6): draft|changes-requested → under-review. Гейт готовности
// применяется ПОВТОРНО на сервере (никогда не доверяем клиенту). Навыки обязательны.
//
// ⚠️ R1 (forward-incompat, PLAN §risks): здесь ревьюеры назначаются НАПРЯМУЮ в chapter_reviewers —
// это ЗАГЛУШКА. Модель согласия (review_invitations: «ревью стартует только после accept») — Фаза 9.
// Прямой write изолирован в assignReviewers(): Фаза 9 заменит его на invitation→accept, не трогая редактор.
// НЕ пишем review_invitations здесь (во избежание двойного моделирования).

import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterReviewers, chapterRevisions, chapters, users } from "@/lib/db/schema";
import { requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { parseJson, stringifyJson } from "@/lib/db/json";
import { createNotifications } from "@/lib/queries/notifications";
import { REVIEW_NOTIFY, reviewerReviewHref } from "@/lib/queries/review";
import { COMPLEXITY_TIERS, MAX_SKILLS, readinessChecklist } from "@/lib/blocks/validate";
import type { Block, Complexity } from "@/types";

/** R1-заглушка: прямое назначение ревьюеров на ревизию. Фаза 9 заменит на согласие/приглашения. */
async function assignReviewers(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  chapterId: string,
  revisionNumber: number,
  reviewers: string[],
  primary: string,
) {
  await tx
    .delete(chapterReviewers)
    .where(and(eq(chapterReviewers.chapterId, chapterId), eq(chapterReviewers.revisionNumber, revisionNumber)));
  for (const handle of reviewers) {
    await tx.insert(chapterReviewers).values({
      chapterId,
      revisionNumber,
      handle,
      isPrimary: handle === primary,
    });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireAuthor();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`author-submit:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { chapterId } = await params;

  // Тело.
  let skills: string[];
  let reviewers: string[];
  let primary: string;
  let note: string | null = null;
  let complexity: Complexity;
  try {
    const body = (await req.json()) as {
      skills?: unknown;
      reviewers?: unknown;
      primary?: unknown;
      note?: unknown;
      complexity?: unknown;
    };
    if (!Array.isArray(body.skills) || body.skills.some((s) => typeof s !== "string")) {
      return NextResponse.json({ error: "Некорректные навыки." }, { status: 400 });
    }
    if (!Array.isArray(body.reviewers) || body.reviewers.some((r) => typeof r !== "string")) {
      return NextResponse.json({ error: "Некорректный список ревьюеров." }, { status: 400 });
    }
    if (typeof body.primary !== "string" || !body.primary) {
      return NextResponse.json({ error: "Не указан ведущий ревьюер." }, { status: 400 });
    }
    if (!["simple", "medium", "complex"].includes(body.complexity as string)) {
      return NextResponse.json({ error: "Некорректная сложность." }, { status: 400 });
    }
    skills = [...new Set((body.skills as string[]).map((s) => s.trim()).filter(Boolean))].slice(0, MAX_SKILLS);
    reviewers = [...new Set((body.reviewers as string[]).map((r) => r.trim()).filter(Boolean))];
    primary = body.primary.trim();
    complexity = body.complexity as Complexity;
    if (typeof body.note === "string" && body.note.trim()) note = body.note.trim().slice(0, 2000);
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  if (!reviewers.includes(primary)) {
    return NextResponse.json({ error: "Ведущий должен быть среди выбранных ревьюеров." }, { status: 400 });
  }

  // Ownership: глава → блог → автор.
  const row = (
    await db
      .select({
        chapterId: chapters.id,
        chapterSlug: chapters.slug,
        chapterTitle: chapters.title,
        blogId: blogs.id,
        blogSlug: blogs.slug,
        blogTags: blogs.tags,
        authorId: blogs.authorId,
      })
      .from(chapters)
      .innerJoin(blogs, eq(blogs.id, chapters.blogId))
      .where(eq(chapters.id, chapterId))
      .limit(1)
  )[0];
  if (!row || row.authorId !== userId) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });

  // Последняя ревизия (отправляем только из draft|changes-requested).
  const rev = (
    await db
      .select({ id: chapterRevisions.id, number: chapterRevisions.number, status: chapterRevisions.status, blocks: chapterRevisions.blocks })
      .from(chapterRevisions)
      .where(eq(chapterRevisions.chapterId, chapterId))
      .orderBy(desc(chapterRevisions.number))
      .limit(1)
  )[0];
  if (!rev) return NextResponse.json({ error: "Ревизия не найдена." }, { status: 404 });
  if (rev.status !== "draft" && rev.status !== "changes-requested") {
    return NextResponse.json({ error: "Главу нельзя отправить из текущего статуса." }, { status: 409 });
  }

  // Ревьюеры существуют и имеют роль reviewer (не заблокированы).
  const reviewerRows = await db
    .select({ handle: users.handle, id: users.id })
    .from(users)
    .where(and(inArray(users.handle, reviewers), eq(users.role, "reviewer"), eq(users.isBlocked, false)));
  const valid = new Set(reviewerRows.map((r) => r.handle));
  if (reviewers.some((h) => !valid.has(h))) {
    return NextResponse.json({ error: "В списке есть несуществующий ревьюер." }, { status: 400 });
  }
  const reviewerIdByHandle = new Map(reviewerRows.map((r) => [r.handle, r.id]));

  // Гейт готовности (повтор серверной правды).
  const checks = readinessChecklist({
    title: row.chapterTitle,
    blocks: parseJson<Block[]>(rev.blocks, []),
    tags: parseJson<string[]>(row.blogTags, []),
    skills,
    complexity,
    reviewers,
    primary,
  });
  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    return NextResponse.json(
      { error: "Не все пункты готовности выполнены.", failedChecks: failed.map((c) => c.label) },
      { status: 400 },
    );
  }
  // tier-границы — диагностический дубль (readiness уже проверил счётчики).
  const tier = COMPLEXITY_TIERS[complexity];
  if (reviewers.length < tier.min || reviewers.length > tier.max) {
    return NextResponse.json({ error: `Для «${tier.label}»: ${tier.min}–${tier.max} ревьюеров.` }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    await db.transaction(async (tx) => {
      await tx.update(chapters).set({ skills: stringifyJson(skills), primaryHandle: primary }).where(eq(chapters.id, chapterId));
      await tx.update(blogs).set({ complexity, lastActivityAt: now }).where(eq(blogs.id, row.blogId));
      await tx
        .update(chapterRevisions)
        .set({ status: "under-review", submittedAt: now, ...(note !== null ? { summary: note } : {}) })
        .where(eq(chapterRevisions.id, rev.id));
      await assignReviewers(tx, chapterId, rev.number, reviewers, primary);
      // Уведомить назначенных ревьюеров (Фаза 7). Модель согласия (приглашение→accept) — Фаза 9;
      // пока это прямое уведомление о назначении (в одной транзакции с записью chapter_reviewers).
      await createNotifications(
        tx,
        reviewers
          .map((h) => reviewerIdByHandle.get(h))
          .filter((id): id is string => !!id)
          .map((recipientId) => ({
            recipientId,
            type: REVIEW_NOTIFY.invited,
            payload: {
              href: reviewerReviewHref(chapterId),
              chapterTitle: row.chapterTitle,
              blogSlug: row.blogSlug,
              chapterSlug: row.chapterSlug,
              revision: rev.number,
            },
          })),
      );
    });
  } catch {
    return NextResponse.json({ error: "Не удалось отправить, попробуйте ещё раз." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, blogSlug: row.blogSlug, chapterSlug: row.chapterSlug, revisionNumber: rev.number });
}
