// Отправка главы на ревью (Фаза 6 → согласие в Фазе 9): draft|changes-requested → under-review.
// Гейт готовности применяется ПОВТОРНО на сервере (никогда не доверяем клиенту). Навыки обязательны.
//
// Фаза 9 (согласие): отправка создаёт ПРИГЛАШЕНИЯ (review_invitations, status=pending), а НЕ пишет
// chapter_reviewers напрямую. Ревью по приглашению стартует только после accept (accept → пишет
// chapter_reviewers). Уже принявшие на этой ревизии не переприглашаются (re-consent не требуется).

import { NextResponse } from "next/server";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterRevisions, chapters, reviewInvitations, users } from "@/lib/db/schema";
import { requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { parseJson, stringifyJson } from "@/lib/db/json";
import { createNotifications } from "@/lib/queries/notifications";
import { REVIEW_NOTIFY, reviewerInboxHref } from "@/lib/queries/review";
import { COMPLEXITY_TIERS, MAX_SKILLS, readinessChecklist } from "@/lib/blocks/validate";
import type { Block, Complexity } from "@/types";

/**
 * Фаза 9: создаёт pending-приглашения для выбранных ревьюеров на (главу, ревизию).
 * Идемпотентно (uniqueIndex chapter+rev+handle): сносит все НЕпринятые приглашения этой ревизии и
 * пересоздаёт pending по новому набору. Уже принявшие (accepted, есть в chapter_reviewers) — не трогаем.
 * Возвращает handle тех, кого реально пригласили (для уведомлений).
 */
async function createInvitations(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  chapterId: string,
  revisionNumber: number,
  reviewers: string[],
  primary: string,
  note: string | null,
  now: number,
): Promise<string[]> {
  const acceptedRows = await tx
    .select({ handle: reviewInvitations.toHandle })
    .from(reviewInvitations)
    .where(
      and(
        eq(reviewInvitations.chapterId, chapterId),
        eq(reviewInvitations.revision, revisionNumber),
        eq(reviewInvitations.status, "accepted"),
      ),
    );
  const accepted = new Set(acceptedRows.map((r) => r.handle));

  // Снимаем непринятые приглашения этой ревизии (pending/declined/flagged) — пересоздадим по набору.
  await tx
    .delete(reviewInvitations)
    .where(
      and(
        eq(reviewInvitations.chapterId, chapterId),
        eq(reviewInvitations.revision, revisionNumber),
        ne(reviewInvitations.status, "accepted"),
      ),
    );

  const toInvite = reviewers.filter((h) => !accepted.has(h));
  if (toInvite.length > 0) {
    await tx.insert(reviewInvitations).values(
      toInvite.map((handle) => ({
        chapterId,
        revision: revisionNumber,
        toHandle: handle,
        asLead: handle === primary,
        note,
        status: "pending" as const,
        invitedAt: now,
      })),
    );
  }
  return toInvite;
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
    skills = [...new Set((body.skills as string[]).map((s) => s.trim().slice(0, 100)).filter(Boolean))].slice(0, MAX_SKILLS);
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
      // Фаза 9: создаём приглашения (а не chapter_reviewers); ревью стартует только после accept.
      const invited = await createInvitations(tx, chapterId, rev.number, reviewers, primary, note, now);
      // Уведомляем приглашённых: ссылка ведёт в кабинет ревьюера (войти в ревью можно лишь после accept).
      await createNotifications(
        tx,
        invited
          .map((h) => reviewerIdByHandle.get(h))
          .filter((id): id is string => !!id)
          .map((recipientId) => ({
            recipientId,
            type: REVIEW_NOTIFY.invited,
            payload: {
              href: reviewerInboxHref(),
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
