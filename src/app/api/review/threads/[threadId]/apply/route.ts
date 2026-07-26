// «Применить и закрыть» (Фаза 7) — author-only. Применяет suggestion треда к тексту блока ТЕКУЩЕЙ
// (under-review) ревизии IN-PLACE (D4 в PLAN: новая ревизия — только на «Отправить v{N+1}»), затем
// помечает тред resolved. Для треда без suggestion — просто resolve. Замена first-match suggestion.from
// → suggestion.to; при несовпадении (якорь «уплыл») текст оставляем (тред всё равно закрывается).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapterRevisions, threads } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { parseJson, stringifyJson } from "@/lib/db/json";
import { resolveReviewAccess } from "@/lib/queries/review";
import { isReviewOpen } from "@/lib/review-status";
import type { Block, Suggestion } from "@/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { threadId } = await params;
  const thread = (
    await db
      .select({
        id: threads.id,
        chapterId: threads.chapterId,
        blockId: threads.blockId,
        status: threads.status,
        suggestion: threads.suggestion,
      })
      .from(threads)
      .where(eq(threads.id, threadId))
      .limit(1)
  )[0];
  // Гард ДО раскрытия существования треда (аудит ИБ 2026-07-26) — см. resolve/route.ts.
  if (!thread) {
    const gate = await requireUser();
    if (gate instanceof NextResponse) return gate;
    return NextResponse.json({ error: "Тред не найден." }, { status: 404 });
  }

  const access = await resolveReviewAccess(thread.chapterId);
  if (access instanceof NextResponse) return access;
  if (access.role !== "author") {
    return NextResponse.json({ error: "Применять правки может только автор." }, { status: 403 });
  }

  // Идемпотентность: повторное «применить» закрытого треда снова заменило бы текст (второй replace
  // найдёт следующее вхождение) — запрещаем.
  if (thread.status !== "open") return NextResponse.json({ error: "Тред уже закрыт." }, { status: 409 });

  const rl = hitActionRate(`review-apply:${access.user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { session } = access;
  if (!isReviewOpen(session.revision.reviewStatus, session.revision.reviewClosedAt)) {
    return NextResponse.json({ error: "Глава не на активном ревью." }, { status: 409 });
  }
  // ⚠️ Ф14, находка security-ревью (HIGH). Apply-and-close правит блоки ревизии IN-PLACE. До Ф14
  // это было безопасно по построению: `isReviewOpen` возвращал false для published, и роут просто
  // не мог сюда дойти. Теперь ревью опубликованной главы — штатный сценарий, и без этой проверки
  // автор мог бы подменить текст ЖИВОЙ опубликованной версии, минуя версионирование, — и, что хуже,
  // подменить уже одобренный текст до закрытия сессии, получив бейдж на то, чего ревьюеры не видели.
  // Путь для правок опубликованной главы один: редактор заводит ревизию-черновик поверх (PATCH).
  if (session.revision.status === "published") {
    return NextResponse.json(
      { error: "Нельзя править опубликованную версию. Отредактируйте главу — правки уйдут в новую версию." },
      { status: 409 },
    );
  }

  const suggestion = parseJson<Suggestion | null>(thread.suggestion, null);
  let appliedText = false;
  let nextBlocks: Block[] | null = null;

  if (suggestion && suggestion.from) {
    const blocks = session.revision.blocks;
    const idx = blocks.findIndex((b) => b.id === thread.blockId);
    if (idx >= 0) {
      const cur = blocks[idx].text ?? "";
      const next = cur.includes(suggestion.from) ? cur.replace(suggestion.from, suggestion.to ?? "") : cur;
      if (next !== cur) {
        nextBlocks = blocks.map((b, i) => (i === idx ? { ...b, text: next } : b));
        appliedText = true;
      }
    }
  }

  try {
    await db.transaction(async (tx) => {
      if (nextBlocks) {
        await tx
          .update(chapterRevisions)
          .set({ blocks: stringifyJson(nextBlocks) })
          .where(eq(chapterRevisions.id, session.revision.id));
      }
      await tx.update(threads).set({ status: "resolved" }).where(eq(threads.id, threadId));
    });
  } catch {
    return NextResponse.json({ error: "Не удалось применить правку." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, appliedText });
}
