// «Применить и закрыть» (Фаза 7) — author-only. Применяет suggestion треда к тексту блока ТЕКУЩЕЙ
// (under-review) ревизии IN-PLACE (D4 в PLAN: новая ревизия — только на «Отправить v{N+1}»), затем
// помечает тред resolved. Для треда без suggestion — просто resolve. Замена first-match suggestion.from
// → suggestion.to; при несовпадении (якорь «уплыл») текст оставляем (тред всё равно закрывается).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapterRevisions, threads } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { parseJson, stringifyJson } from "@/lib/db/json";
import { resolveReviewAccess } from "@/lib/queries/review";
import type { Block, Suggestion } from "@/types";

const ACTIVE = new Set(["under-review", "changes-requested"]);

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
        suggestion: threads.suggestion,
      })
      .from(threads)
      .where(eq(threads.id, threadId))
      .limit(1)
  )[0];
  if (!thread) return NextResponse.json({ error: "Тред не найден." }, { status: 404 });

  const access = await resolveReviewAccess(thread.chapterId);
  if (access instanceof NextResponse) return access;
  if (access.role !== "author") {
    return NextResponse.json({ error: "Применять правки может только автор." }, { status: 403 });
  }

  const rl = hitActionRate(`review-apply:${access.user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { session } = access;
  if (!ACTIVE.has(session.revision.status)) {
    return NextResponse.json({ error: "Глава не на активном ревью." }, { status: 409 });
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
