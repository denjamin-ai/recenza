// Входящие приглашения ревьюера (Фаза 9). Только pending и только для ТЕКУЩЕЙ ревизии главы
// (устаревшие — после новой ревизии — не показываем). match% считаем против компетенций ревьюера.
// Листинг — RSC; мутации (accept/decline/flag) — в /api/reviewer/invitations/[id].

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterRevisions, chapters, reviewInvitations, users } from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import { skillMatch } from "@/lib/reviewer-match";

export interface ReviewerInvitationItem {
  id: string;
  chapterId: string;
  chapterTitle: string;
  blogTitle: string;
  revision: number;
  asLead: boolean;
  note: string | null;
  matchPct: number;
  matched: string[]; // навыки статьи, покрытые компетенциями (для чипов)
  skills: string[]; // все навыки статьи
  invitedAt: number;
}

export async function getReviewerInbox(handle: string): Promise<ReviewerInvitationItem[]> {
  const rows = await db
    .select({
      id: reviewInvitations.id,
      chapterId: reviewInvitations.chapterId,
      revision: reviewInvitations.revision,
      asLead: reviewInvitations.asLead,
      note: reviewInvitations.note,
      invitedAt: reviewInvitations.invitedAt,
      chapterTitle: chapters.title,
      chapterSkills: chapters.skills,
      blogTitle: blogs.title,
    })
    .from(reviewInvitations)
    .innerJoin(chapters, eq(chapters.id, reviewInvitations.chapterId))
    .innerJoin(blogs, eq(blogs.id, chapters.blogId))
    .where(and(eq(reviewInvitations.toHandle, handle), eq(reviewInvitations.status, "pending")))
    .orderBy(desc(reviewInvitations.invitedAt));
  if (rows.length === 0) return [];

  // Последняя ревизия каждой главы — чтобы отсеять устаревшие приглашения.
  const chapterIds = [...new Set(rows.map((r) => r.chapterId))];
  const revRows = await db
    .select({ chapterId: chapterRevisions.chapterId, number: chapterRevisions.number })
    .from(chapterRevisions)
    .where(inArray(chapterRevisions.chapterId, chapterIds));
  const latestByChapter = new Map<string, number>();
  for (const r of revRows) {
    const prev = latestByChapter.get(r.chapterId);
    if (prev == null || r.number > prev) latestByChapter.set(r.chapterId, r.number);
  }

  // Компетенции ревьюера (для match%).
  const me = (
    await db.select({ competencies: users.competencies }).from(users).where(eq(users.handle, handle)).limit(1)
  )[0];
  const competencies = parseJson<string[]>(me?.competencies, []);

  return rows
    .filter((r) => latestByChapter.get(r.chapterId) === r.revision)
    .map((r) => {
      const skills = parseJson<string[]>(r.chapterSkills, []);
      const m = skillMatch(competencies, skills);
      return {
        id: r.id,
        chapterId: r.chapterId,
        chapterTitle: r.chapterTitle,
        blogTitle: r.blogTitle,
        revision: r.revision,
        asLead: r.asLead,
        note: r.note,
        matchPct: m.pct,
        matched: m.matched,
        skills,
        invitedAt: r.invitedAt,
      };
    });
}
