// Сохранение главы автором. Поля маршрутизируются по таблицам (PLAN §R6):
// title/skills → chapters (рабочее значение автора) + СНАПШОТ в chapter_revisions (Ф14),
// blocks/summary → revision.
//
// Ф14: `chapter_revisions.title/skills` — версионированные метаданные, которые видит читатель.
// Пишем их в ту же ревизию, в которую ушли блоки: и при правке черновика in place, и при
// заведении черновика поверх опубликованной. Иначе бейдж «проверена версия N» указывал бы на
// заголовок/навыки, которых в версии N не было.
//
// Фаза 13 — жизнь после публикации. Куда пишем, решает состояние последней ревизии:
//   • draft + review_status none|changes-requested → правим ревизию IN PLACE (поведение Фазы 6);
//   • published                                    → заводим ревизию-ЧЕРНОВИК поверх (number+1,
//     review_status='none', prev_blocks = блоки опубликованной). Читатель продолжает видеть
//     опубликованную, пока автор не опубликует новую — ридер-селекторы фильтруют
//     status='published' ДО max(number), поэтому черновик поверх не протекает;
//   • ревью читает ревизию прямо сейчас (requested|in-review) → 409, как и раньше.

import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterRevisions, chapters } from "@/lib/db/schema";
import { requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";
import { stringifyJson } from "@/lib/db/json";
import { MAX_SKILLS, validateBlocks } from "@/lib/blocks/validate";
import { resolveAuthorChapter } from "@/lib/queries/author";
import { isRevisionEditable } from "@/lib/review-status";
import { createNotifications } from "@/lib/queries/notifications";
import { REVIEW_NOTIFY, authorReviewHref } from "@/lib/review-links";

/** Патч ревизии: контент + снапшот метаданных (Ф14). */
type RevisionPatch = {
  blocks?: string;
  summary?: string | null;
  title?: string | null;
  skills?: string | null;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const session = await requireAuthor();
  if (session instanceof NextResponse) return session;
  const userId = session.userId;
  if (!userId) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`author-save:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { chapterId } = await params;

  // Тело: все поля опциональны; валидируем по присутствию.
  let body: { title?: unknown; skills?: unknown; blocks?: unknown; summary?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const set: { title?: string; skills?: string } = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string") return NextResponse.json({ error: "Некорректный title." }, { status: 400 });
    set.title = body.title.trim().slice(0, 200);
  }
  if (body.skills !== undefined) {
    if (!Array.isArray(body.skills) || body.skills.some((s) => typeof s !== "string")) {
      return NextResponse.json({ error: "Некорректные навыки." }, { status: 400 });
    }
    const skills = (body.skills as string[]).map((s) => s.trim()).filter(Boolean).slice(0, MAX_SKILLS);
    set.skills = stringifyJson(skills);
  }

  let blocksJson: string | undefined;
  if (body.blocks !== undefined) {
    const v = validateBlocks(body.blocks);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    blocksJson = stringifyJson(v.blocks);
  }

  let summary: string | null | undefined;
  if (body.summary !== undefined) {
    if (body.summary === null) summary = null;
    else if (typeof body.summary === "string") summary = body.summary.trim().slice(0, 2000);
    else return NextResponse.json({ error: "Некорректный summary." }, { status: 400 });
  }

  // Ownership + последняя ревизия одним резолвером; чужая глава → 404 (не раскрываем существование).
  const target = await resolveAuthorChapter(chapterId, userId);
  if (!target) return NextResponse.json({ error: "Глава не найдена." }, { status: 404 });

  const rev = target.revision;
  // Ревью читает эту ревизию прямо сейчас — править нельзя (ход за ревьюерами).
  if (!isRevisionEditable(rev.status, rev.reviewStatus)) {
    return NextResponse.json(
      { error: "Главу нельзя редактировать, пока идёт ревью." },
      { status: 409 },
    );
  }

  // ⚠️ Ф14, находка code-review (P2): раньше пустой PATCH был no-op, потому что набор полей ревизии
  // мог оказаться пустым. Теперь снапшот `title`/`skills` пишется ВСЕГДА, и пустой автосейв на
  // опубликованной ревизии заводил бы черновик-форк без единого изменения — засоряя историю версий
  // и «занимая» номер, на который потом сошлётся заявка на ревью. Пустое тело отсекаем до транзакции.
  const touchesContent =
    blocksJson !== undefined || summary !== undefined || set.title !== undefined || set.skills !== undefined;
  if (!touchesContent) {
    return NextResponse.json({ ok: true, revisionNumber: rev.number, savedAt: null, forked: false });
  }

  // Правка опубликованной заводит НОВУЮ ревизию поверх; правка черновика идёт in place.
  const forkFromPublished = rev.status === "published";
  const now = Math.floor(Date.now() / 1000);
  let revisionNumber = rev.number;

  try {
    await db.transaction(async (tx) => {
      // Ф14: снапшот метаданных = «что будет у главы после этого сохранения». Текущее значение
      // читаем ВНУТРИ транзакции (а не из resolveAuthorChapter) — оно могло измениться соседним
      // автосейвом; поля, которых нет в теле запроса, снапшотим как есть.
      const cur = (
        await tx
          .select({ title: chapters.title, skills: chapters.skills })
          .from(chapters)
          .where(eq(chapters.id, chapterId))
          .limit(1)
      )[0];
      if (!cur) throw new Error("chapter-vanished");
      const snapTitle = set.title ?? cur.title;
      const snapSkills = set.skills ?? cur.skills;

      if (forkFromPublished) {
        // Race-safe: номер следующей ревизии перечитываем ВНУТРИ транзакции — параллельный
        // автосейв не должен воткнуть второй черновик и словить unique(chapter_id, number).
        const latest = (
          await tx
            .select({ number: chapterRevisions.number, status: chapterRevisions.status })
            .from(chapterRevisions)
            .where(eq(chapterRevisions.chapterId, chapterId))
            .orderBy(desc(chapterRevisions.number))
            .limit(1)
        )[0];
        if (!latest) throw new Error("revision-vanished");

        if (latest.status === "published") {
          revisionNumber = latest.number + 1;
          // План отложенной публикации предыдущей ревизии (если был) гасим: поверх неё уже
          // лежит черновик, публиковать старую версию по расписанию нельзя.
          const dropped = await tx
            .update(chapterRevisions)
            .set({ scheduledAt: null })
            .where(and(eq(chapterRevisions.id, rev.id), isNotNull(chapterRevisions.scheduledAt)))
            .returning({ id: chapterRevisions.id });
          // ⚠️ Ф15.1 (backlog Ф13 P3): раньше план снимался МОЛЧА — автор, поставивший публикацию
          // на дату, узнавал об отмене только по её отсутствию. Уведомляем, и только когда план
          // действительно был (`returning` пуст, если `scheduled_at` уже null).
          if (dropped.length > 0) {
            await createNotifications(tx, [
              {
                recipientId: userId,
                type: REVIEW_NOTIFY.scheduledPublishFailed,
                payload: {
                  chapterTitle: target.chapterTitle,
                  href: authorReviewHref(target.blogSlug, target.chapterSlug),
                  reason: "revision-superseded",
                },
              },
            ]);
          }
          await tx.insert(chapterRevisions).values({
            chapterId,
            number: revisionNumber,
            status: "draft",
            reviewStatus: "none",
            summary: summary !== undefined ? summary : rev.summary,
            blocks: blocksJson !== undefined ? blocksJson : rev.blocks,
            prevBlocks: rev.blocks, // снапшот опубликованного — для инлайн-диффа
            title: snapTitle,
            skills: snapSkills,
          });
        } else {
          // Черновик поверх уже успел появиться (параллельный запрос) — пишем в него.
          revisionNumber = latest.number;
          const revSet: RevisionPatch = { title: snapTitle, skills: snapSkills };
          if (blocksJson !== undefined) revSet.blocks = blocksJson;
          if (summary !== undefined) revSet.summary = summary;
          await tx
            .update(chapterRevisions)
            .set(revSet)
            .where(
              and(
                eq(chapterRevisions.chapterId, chapterId),
                eq(chapterRevisions.number, latest.number),
              ),
            );
        }
      } else {
        const revSet: RevisionPatch = { title: snapTitle, skills: snapSkills };
        if (blocksJson !== undefined) revSet.blocks = blocksJson;
        if (summary !== undefined) revSet.summary = summary;
        await tx.update(chapterRevisions).set(revSet).where(eq(chapterRevisions.id, rev.id));
      }

      if (Object.keys(set).length > 0) {
        await tx.update(chapters).set(set).where(eq(chapters.id, chapterId));
      }
      await tx.update(blogs).set({ lastActivityAt: now }).where(eq(blogs.id, target.blogId));
    });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить, попробуйте ещё раз." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, revisionNumber, savedAt: now, forked: forkFromPublished });
}
