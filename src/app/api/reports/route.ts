// Жалоба модератору (Фаза 15, З-51) — ПЕРВАЯ точка, где жалоба вообще может появиться.
// До этой фазы `insert(reports)` существовал ровно в одном месте — в сиде, поэтому раздел
// «Жалобы» в админке работал на единственной строке и не мог пополниться.
//
// Гейт — `requireUser()`, а НЕ возможность: жаловаться может любой аккаунт (базовый уровень).
// ⚠️ `commentingBlocked` жалобу НЕ блокирует намеренно: она приватна, адресована редакции и
// полезна ей даже от пользователя, которому закрыли публичные комментарии. Не «унифицировать»
// с `commentGate` при следующем рефакторинге.
//
// Порядок проверок такой же, как в POST /api/comments: CSRF → авторизация → rate-limit →
// валидация тела → серверный резолв цели → транзакция.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { createNotifications } from "@/lib/queries/notifications";
import { hasOpenReport, resolveReportSubject } from "@/lib/queries/reports";
import { MAX_REPORT_NOTE, isReportReason } from "@/lib/reports";
import { MODERATION_NOTIFY } from "@/lib/review-links";
import { REPORT_TARGET_TYPES, type ReportTargetType } from "@/types";
import { ulid } from "ulid";
import { and, eq } from "drizzle-orm";

export async function POST(req: Request): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireUser();
  if (session instanceof NextResponse) return session;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  // Жалоба — не массовое действие: 1 в 10 секунд на пользователя (голоса — 1/сек, заявка с
  // доски — 1/5с). Против настоящего спама работает не окно, а дедуп ниже: вторая ОТКРЫТАЯ
  // жалоба того же пользователя на ту же цель новой строки не создаёт вообще.
  const rl = hitActionRate(`report:${user.id}`, 10_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите немного." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 10) } },
    );
  }

  let targetType: ReportTargetType;
  let targetId: string;
  let reason: string;
  let note: string | null;
  let aboutHandle: string | null;
  try {
    const body = (await req.json()) as {
      targetType?: unknown;
      targetId?: unknown;
      reason?: unknown;
      note?: unknown;
      aboutHandle?: unknown;
    };
    if (!REPORT_TARGET_TYPES.includes(body.targetType as ReportTargetType)) {
      return NextResponse.json({ error: "Некорректный тип цели." }, { status: 400 });
    }
    targetType = body.targetType as ReportTargetType;

    if (typeof body.targetId !== "string" || !body.targetId.trim() || body.targetId.length > 64) {
      return NextResponse.json({ error: "Некорректная цель." }, { status: 400 });
    }
    targetId = body.targetId.trim();

    if (!isReportReason(body.reason)) {
      return NextResponse.json({ error: "Выберите причину." }, { status: 400 });
    }
    reason = body.reason;

    note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, MAX_REPORT_NOTE)
        : null;

    if (body.aboutHandle !== undefined && body.aboutHandle !== null) {
      if (typeof body.aboutHandle !== "string" || !/^[a-z0-9_-]{3,30}$/.test(body.aboutHandle)) {
        return NextResponse.json({ error: "Некорректный участник." }, { status: 400 });
      }
    }
    aboutHandle = typeof body.aboutHandle === "string" ? body.aboutHandle : null;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  // ⚠️ Единый 404 и для «цели нет», и для «жаловаться нельзя»: иначе роут превращается
  // в оракул существования скрытых блогов и удалённых комментариев.
  const subject = await resolveReportSubject(targetType, targetId, aboutHandle, {
    id: user.id,
    handle: user.handle,
  });
  if (!subject) return NextResponse.json({ error: "Цель не найдена." }, { status: 404 });

  // Дедуп: вторая открытая жалоба того же автора на ту же цель новой строки не создаёт.
  if (await hasOpenReport(user.id, subject.targetType, subject.targetId)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const now = Math.floor(Date.now() / 1000);
  const id = ulid();
  await db.transaction(async (tx) => {
    // Перепроверка внутри транзакции (анти-TOCTOU: два параллельных отправления формы).
    const existing = (
      await tx
        .select({ id: reports.id })
        .from(reports)
        .where(
          and(
            eq(reports.reporterId, user.id),
            eq(reports.targetType, subject.targetType),
            eq(reports.targetId, subject.targetId),
            eq(reports.status, "open"),
          ),
        )
        .limit(1)
    )[0];
    if (existing) return;

    await tx.insert(reports).values({
      id,
      reporterId: user.id,
      targetType: subject.targetType,
      targetId: subject.targetId,
      reason,
      note,
      aboutHandle: subject.aboutHandle,
      status: "open",
      createdAt: now,
    });

    await createNotifications(tx, [
      {
        isAdminRecipient: true,
        type: MODERATION_NOTIFY.reportFiled,
        payload: { reportId: id, targetType: subject.targetType, href: `/admin/reports/${id}` },
      },
    ]);
  });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
