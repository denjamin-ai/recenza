// Presence-heartbeat ревьюера (Фаза 12). ReviewScreen шлёт POST каждые ~30с (и на mount);
// онлайн-статус — деривация last_seen_at >= now−90с в getReviewSession. Отдельный POST, а не
// сайд-эффект поллинга: 30с-поллинг — это router.refresh() (RSC-рендер, писать в БД из него нельзя).
// Автор heartbeat не шлёт (presence показывает ревьюеров).
// ⚠️ Аудит ИБ 2026-07-26: «идемпотентен → лимит не нужен» — неверный вывод. Каждый вызов делает
// resolveReviewAccess (несколько чтений) + безусловный UPDATE, а писатель в SQLite один: назначенный
// ревьюер мог гнать неограниченный поток записей. Идемпотентность защищает данные, но не ресурс.
//
// Троттлинг сделан УСЛОВНЫМ UPDATE, а не hitActionRate, намеренно: in-memory лимит «пропустил бы»
// запись молча, и presence разъезжался бы с реальностью (поймано e2e REV-PRESENCE — reseed
// откатывает last_seen_at в БД, а память процесса о недавней записи остаётся). Здесь порог живёт
// в самих данных: пишем, только если прошлая отметка старше HEARTBEAT_MIN_GAP_S. Флуд схлопывается
// в ≤1 запись за окно, а свежесть last_seen_at гарантирована с точностью до этого окна —
// оно на порядок меньше окна presence (90с), поэтому онлайн-статус не страдает.

import { NextResponse } from "next/server";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapterReviewers } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { resolveReviewAccess } from "@/lib/queries/review";

// Клиент шлёт раз в ~30с; 5с — с запасом на ретраи и повторные монтирования.
const HEARTBEAT_MIN_GAP_S = 5;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { chapterId } = await params;
  const access = await resolveReviewAccess(chapterId);
  if (access instanceof NextResponse) return access;
  if (access.role !== "reviewer") return NextResponse.json({ ok: true });

  const now = Math.floor(Date.now() / 1000);
  await db
    .update(chapterReviewers)
    .set({ lastSeenAt: now })
    .where(
      and(
        eq(chapterReviewers.chapterId, chapterId),
        eq(chapterReviewers.revisionNumber, access.session.revision.number),
        eq(chapterReviewers.handle, access.user.handle),
        // Троттлинг в данных: частые повторы не доходят до записи (см. шапку файла).
        // ⚠️ IS NULL — обязательная ветка: у только что взявшего заявку ревьюера отметки ещё нет,
        // а `NULL < x` в SQL даёт NULL (не TRUE), и первый heartbeat не записался бы никогда.
        or(
          isNull(chapterReviewers.lastSeenAt),
          lt(chapterReviewers.lastSeenAt, now - HEARTBEAT_MIN_GAP_S),
        ),
      ),
    );

  return NextResponse.json({ ok: true });
}
