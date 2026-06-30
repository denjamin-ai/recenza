// Ответ ревьюера на приглашение (Фаза 9, согласие): accept | decline | flag.
// Гейт: requireReviewer + приглашение адресовано ИМЕННО этому ревьюеру (toHandle) и ещё pending.
//   accept  → приглашение accepted; ревьюер пишется в chapter_reviewers (ревью стартует только тут);
//             reviewLoad += 1; автору уведомление. Отказ, если ревьюер уже full (защита от гонок).
//   decline → приглашение declined; автору уведомление. chapter_reviewers/reviewLoad не трогаем.
//   flag    → ТОЛЬКО при match < 50% (перепроверка на сервере): «навыки не совпадают». Глава снимается
//             с ревью (ревизия → changes-requested), остальные pending-приглашения этой ревизии гасятся
//             (declined), уже принявшие остаются. Автору вердикт «исправьте навыки».

import { NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterReviewers, chapterRevisions, chapters, reviewInvitations, users } from "@/lib/db/schema";
import { getCurrentUser, requireReviewer } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { parseJson } from "@/lib/db/json";
import { createNotifications } from "@/lib/queries/notifications";
import { REVIEW_NOTIFY, authorReviewHref } from "@/lib/queries/review";
import { skillMatch } from "@/lib/reviewer-match";

const ACTIONS = new Set(["accept", "decline", "flag"]);
const ACTIVE = new Set(["under-review", "changes-requested"]);

/** Гонка: приглашение перестало быть pending между внетранзакционной проверкой и записью → 409. */
class InviteConflict extends Error {}

/** Перечитывает статус ВНУТРИ транзакции; бросает InviteConflict, если он уже не pending (TOCTOU-защита). */
async function assertStillPending(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  invitationId: string,
): Promise<void> {
  const cur = (
    await tx.select({ status: reviewInvitations.status }).from(reviewInvitations).where(eq(reviewInvitations.id, invitationId)).limit(1)
  )[0];
  if (!cur || cur.status !== "pending") throw new InviteConflict();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ invitationId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireReviewer();
  if (gate instanceof NextResponse) return gate;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`invite-respond:${user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { invitationId } = await params;

  let action: "accept" | "decline" | "flag";
  let flagReason: string | null = null;
  try {
    const body = (await req.json()) as { action?: unknown; flagReason?: unknown };
    if (typeof body.action !== "string" || !ACTIONS.has(body.action)) {
      return NextResponse.json({ error: "Некорректное действие." }, { status: 400 });
    }
    action = body.action as "accept" | "decline" | "flag";
    if (typeof body.flagReason === "string" && body.flagReason.trim()) {
      flagReason = body.flagReason.trim().slice(0, 500);
    }
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  // Приглашение: адресовано этому ревьюеру и ещё pending.
  const inv = (
    await db
      .select({
        id: reviewInvitations.id,
        chapterId: reviewInvitations.chapterId,
        revision: reviewInvitations.revision,
        toHandle: reviewInvitations.toHandle,
        asLead: reviewInvitations.asLead,
        status: reviewInvitations.status,
      })
      .from(reviewInvitations)
      .where(eq(reviewInvitations.id, invitationId))
      .limit(1)
  )[0];
  if (!inv) return NextResponse.json({ error: "Приглашение не найдено." }, { status: 404 });
  if (inv.toHandle !== user.handle) {
    return NextResponse.json({ error: "Это приглашение адресовано не вам." }, { status: 403 });
  }
  if (inv.status !== "pending") {
    return NextResponse.json({ error: "На приглашение уже дан ответ." }, { status: 409 });
  }

  // Глава + блог + последняя ревизия (для актуальности приглашения и адресата уведомления).
  const ctx = (
    await db
      .select({
        chapterTitle: chapters.title,
        chapterSlug: chapters.slug,
        chapterSkills: chapters.skills,
        blogSlug: blogs.slug,
        authorId: blogs.authorId,
      })
      .from(chapters)
      .innerJoin(blogs, eq(blogs.id, chapters.blogId))
      .where(eq(chapters.id, inv.chapterId))
      .limit(1)
  )[0];
  if (!ctx) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });

  const latestRev = (
    await db
      .select({ id: chapterRevisions.id, number: chapterRevisions.number, status: chapterRevisions.status })
      .from(chapterRevisions)
      .where(eq(chapterRevisions.chapterId, inv.chapterId))
      .orderBy(sql`${chapterRevisions.number} desc`)
      .limit(1)
  )[0];
  if (!latestRev) return NextResponse.json({ error: "Ревизия не найдена." }, { status: 404 });

  const now = Math.floor(Date.now() / 1000);
  const authorPayload = {
    href: authorReviewHref(ctx.blogSlug, ctx.chapterSlug),
    chapterTitle: ctx.chapterTitle,
    revision: inv.revision,
  };

  // ── DECLINE ─────────────────────────────────────────────────────────────────
  if (action === "decline") {
    try {
      await db.transaction(async (tx) => {
        await assertStillPending(tx, inv.id); // защита от гонки двойного ответа
        await tx
          .update(reviewInvitations)
          .set({ status: "declined", respondedAt: now })
          .where(eq(reviewInvitations.id, inv.id));
        await createNotifications(tx, [
          { recipientId: ctx.authorId, type: REVIEW_NOTIFY.inviteDeclined, payload: authorPayload },
        ]);
      });
    } catch (e) {
      if (e instanceof InviteConflict) return NextResponse.json({ error: "На приглашение уже дан ответ." }, { status: 409 });
      return NextResponse.json({ error: "Не удалось отклонить приглашение." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: "declined" });
  }

  // Дальше (accept/flag) приглашение должно относиться к ТЕКУЩЕЙ ревизии и активному ревью.
  if (inv.revision !== latestRev.number || !ACTIVE.has(latestRev.status)) {
    return NextResponse.json({ error: "Приглашение устарело — есть новая ревизия." }, { status: 409 });
  }

  // ── FLAG (навыки не совпадают) ───────────────────────────────────────────────
  if (action === "flag") {
    const competencies = parseJson<string[]>(user.competencies, []);
    const skills = parseJson<string[]>(ctx.chapterSkills, []);
    const pct = skillMatch(competencies, skills).pct;
    if (pct >= 50) {
      return NextResponse.json(
        { error: "Жалоба «навыки не совпадают» доступна только при совпадении < 50%." },
        { status: 409 },
      );
    }
    const reason = flagReason ?? "навыки не совпадают";
    try {
      await db.transaction(async (tx) => {
        await assertStillPending(tx, inv.id); // защита от гонки двойного ответа
        await tx
          .update(reviewInvitations)
          .set({ status: "flagged", flagReason: reason, respondedAt: now })
          .where(eq(reviewInvitations.id, inv.id));
        // Снимаем главу с ревью: ревизия → changes-requested (автор исправляет навыки и шлёт заново).
        if (latestRev.status !== "changes-requested") {
          await tx
            .update(chapterRevisions)
            .set({ status: "changes-requested" })
            .where(eq(chapterRevisions.id, latestRev.id));
        }
        // Гасим остальные pending-приглашения этой ревизии (уже принявшие остаются).
        await tx
          .update(reviewInvitations)
          .set({ status: "declined", respondedAt: now })
          .where(
            and(
              eq(reviewInvitations.chapterId, inv.chapterId),
              eq(reviewInvitations.revision, inv.revision),
              eq(reviewInvitations.status, "pending"),
              ne(reviewInvitations.id, inv.id),
            ),
          );
        await createNotifications(tx, [
          {
            recipientId: ctx.authorId,
            type: REVIEW_NOTIFY.skillsMismatch,
            payload: { ...authorPayload, reason },
          },
        ]);
      });
    } catch (e) {
      if (e instanceof InviteConflict) return NextResponse.json({ error: "На приглашение уже дан ответ." }, { status: 409 });
      return NextResponse.json({ error: "Не удалось отправить жалобу." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: "flagged" });
  }

  // ── ACCEPT ───────────────────────────────────────────────────────────────────
  // Защита от гонок: ревьюер мог дойти до full между приглашением и accept.
  const me = (
    await db
      .select({ load: users.reviewLoad, capacity: users.reviewCapacity })
      .from(users)
      .where(eq(users.handle, user.handle))
      .limit(1)
  )[0];
  if (me && me.load >= me.capacity) {
    return NextResponse.json({ error: "Вы уже загружены до предела (capacity)." }, { status: 409 });
  }

  try {
    await db.transaction(async (tx) => {
      // TOCTOU-защита: перечитываем статус в транзакции — иначе два параллельных accept дважды
      // инкрементят reviewLoad (status-проверка выше — вне транзакции).
      await assertStillPending(tx, inv.id);
      await tx
        .update(reviewInvitations)
        .set({ status: "accepted", respondedAt: now })
        .where(eq(reviewInvitations.id, inv.id));
      // Согласие наполняет chapter_reviewers — отсюда ревью реально стартует (idempotent по PK).
      await tx
        .insert(chapterReviewers)
        .values({
          chapterId: inv.chapterId,
          revisionNumber: inv.revision,
          handle: user.handle,
          isPrimary: inv.asLead,
        })
        .onConflictDoNothing();
      await tx
        .update(users)
        .set({ reviewLoad: sql`${users.reviewLoad} + 1` })
        .where(eq(users.handle, user.handle));
      await createNotifications(tx, [
        { recipientId: ctx.authorId, type: REVIEW_NOTIFY.inviteAccepted, payload: authorPayload },
      ]);
    });
  } catch (e) {
    if (e instanceof InviteConflict) return NextResponse.json({ error: "На приглашение уже дан ответ." }, { status: 409 });
    return NextResponse.json({ error: "Не удалось принять приглашение." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: "accepted" });
}
