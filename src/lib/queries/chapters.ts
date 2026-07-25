// Контент для ридера. getReadableBlog — ЯКОРЬ регресс-ловушки: контент полностью выводится из
// (blogSlug[, chapterSlug]); разные блоги → разный контент; generateMetadata зовёт ту же функцию.
// Видимость: автор не заблокирован + только published-ревизии (последняя по number на главу).
//
// Ф14: метаданные главы ВЕРСИОНИРОВАНЫ — читатель видит `chapter_revisions.title/skills`
// (снапшот на момент ревизии) с fallback на `chapters.*`. Плюс бейдж проверки: у каждой главы
// известна последняя ПРОВЕРЕННАЯ published-ревизия (может быть старше отображаемой).

import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogs, chapterRevisions, chapters, users } from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";
import type { Block, Complexity, VerifiedTier } from "@/types";
import type { ReadableBlog, ReadableChapter } from "./types";

/** Колонки главы+ревизии, из которых собирается ReadableChapter (общие для обоих селекторов). */
const chapterColumns = {
  chapterId: chapters.id,
  chapterSlug: chapters.slug,
  chapterTitle: chapters.title,
  chapterOrder: chapters.order,
  chapterSkills: chapters.skills,
  revNumber: chapterRevisions.number,
  revTitle: chapterRevisions.title,
  revSkills: chapterRevisions.skills,
  revPublishedAt: chapterRevisions.publishedAt,
  revSummary: chapterRevisions.summary,
  revVerifiedAt: chapterRevisions.verifiedAt,
  revVerifiedTier: chapterRevisions.verifiedTier,
  blocks: chapterRevisions.blocks,
} as const;

type ChapterRow = {
  chapterId: string;
  chapterSlug: string;
  chapterTitle: string;
  chapterOrder: number;
  chapterSkills: string | null;
  revNumber: number;
  revTitle: string | null;
  revSkills: string | null;
  revPublishedAt: number | null;
  revSummary: string | null;
  revVerifiedAt: number | null;
  revVerifiedTier: VerifiedTier | null;
  blocks: string | null;
};

/**
 * Сборка view-главы из строки ревизии. `verified` — строка ПОСЛЕДНЕЙ проверенной ревизии главы
 * (может совпадать с `row` или быть старше; null — проверок не было).
 */
function toReadableChapter(row: ChapterRow, verified: ChapterRow | null): ReadableChapter {
  return {
    id: row.chapterId,
    slug: row.chapterSlug,
    // Ф14: снапшот метаданных ревизии; fallback — рабочее значение автора (строки до бэкфилла).
    title: row.revTitle ?? row.chapterTitle,
    order: row.chapterOrder,
    skills: parseJson<string[]>(row.revSkills ?? row.chapterSkills, []),
    revisionNumber: row.revNumber,
    publishedAt: row.revPublishedAt,
    summary: row.revSummary,
    blocks: parseJson<Block[]>(row.blocks, []),
    verifiedTier: verified?.revVerifiedTier ?? null,
    verifiedAt: verified?.revVerifiedAt ?? null,
    verifiedRevision: verified ? verified.revNumber : null,
  };
}

/** Видимый блог + автор + published-главы (по order) с контентом. null — скрыт/нет публикаций. */
export const getReadableBlog = cache(async (slug: string): Promise<ReadableBlog | null> => {
  const blogRow = (
    await db
      .select({
        id: blogs.id,
        slug: blogs.slug,
        title: blogs.title,
        coverUrl: blogs.coverUrl,
        tags: blogs.tags,
        complexity: blogs.complexity,
        summary: blogs.summary,
        publishedAt: blogs.publishedAt,
        bookmarkCount: blogs.bookmarkCount,
        authorId: users.id,
        authorHandle: users.handle,
        authorSlug: users.slug,
        authorName: users.displayName,
        authorAvatar: users.avatarUrl,
      })
      .from(blogs)
      .innerJoin(users, eq(blogs.authorId, users.id))
      // Фаза 10: скрытый блог → 404 в ридере. Ф13-hotfix: снятый `can_author` — тоже 404
      // (иначе блог оставался бы доступен по прямой ссылке в обход каталога).
      .where(
        and(
          eq(blogs.slug, slug),
          eq(users.isBlocked, false),
          eq(users.canAuthor, true),
          eq(blogs.hidden, false),
        ),
      )
      .limit(1)
  )[0];

  if (!blogRow) return null;

  const revRows = (await db
    .select(chapterColumns)
    .from(chapters)
    .innerJoin(chapterRevisions, eq(chapterRevisions.chapterId, chapters.id))
    .where(
      and(eq(chapters.blogId, blogRow.id), eq(chapterRevisions.status, "published")),
    )) as ChapterRow[];

  // По каждой главе — ревизия с наибольшим number + отдельно последняя ПРОВЕРЕННАЯ ревизия
  // (бейдж иммутабелен и переживает публикацию новых версий — тогда он рисуется приглушённым).
  const latest = new Map<string, ChapterRow>();
  const verified = new Map<string, ChapterRow>();
  for (const r of revRows) {
    const prev = latest.get(r.chapterId);
    if (!prev || r.revNumber > prev.revNumber) latest.set(r.chapterId, r);
    if (r.revVerifiedAt !== null) {
      const prevV = verified.get(r.chapterId);
      if (!prevV || r.revNumber > prevV.revNumber) verified.set(r.chapterId, r);
    }
  }
  if (latest.size === 0) return null; // нет публичного контента

  const chaptersView: ReadableChapter[] = [...latest.values()]
    .sort((a, b) => a.chapterOrder - b.chapterOrder)
    .map((r) => toReadableChapter(r, verified.get(r.chapterId) ?? null));

  return {
    id: blogRow.id,
    slug: blogRow.slug,
    title: blogRow.title,
    coverUrl: blogRow.coverUrl,
    tags: parseJson<string[]>(blogRow.tags, []),
    complexity: blogRow.complexity as Complexity,
    summary: blogRow.summary,
    publishedAt: blogRow.publishedAt,
    bookmarkCount: blogRow.bookmarkCount,
    author: {
      id: blogRow.authorId,
      handle: blogRow.authorHandle,
      slug: blogRow.authorSlug,
      displayName: blogRow.authorName,
      avatarUrl: blogRow.authorAvatar,
    },
    chapters: chaptersView,
  };
});

/**
 * Ф14 — чтение КОНКРЕТНОЙ версии главы (`/blog/[slug]/[chapter]?v=N`): «проверенная версия»
 * остаётся доступной после того, как автор опубликовал правку.
 *
 * ⚠️ Гейт, а не удобство: отдаём только `status='published'` ревизию (черновики и версии на ревью
 * читать нельзя) и только у видимого блога — те же фильтры `isBlocked`/`canAuthor`/`hidden`,
 * что в `getReadableBlog`. Иначе `?v=` стал бы обходом видимости.
 */
export const getReadableChapterRevision = cache(
  async (
    blogSlug: string,
    chapterSlug: string,
    revisionNumber: number,
  ): Promise<ReadableChapter | null> => {
    if (!Number.isInteger(revisionNumber) || revisionNumber < 1) return null;

    const row = (
      await db
        .select(chapterColumns)
        .from(chapterRevisions)
        .innerJoin(chapters, eq(chapterRevisions.chapterId, chapters.id))
        .innerJoin(blogs, eq(chapters.blogId, blogs.id))
        .innerJoin(users, eq(blogs.authorId, users.id))
        .where(
          and(
            eq(blogs.slug, blogSlug),
            eq(chapters.slug, chapterSlug),
            eq(chapterRevisions.number, revisionNumber),
            eq(chapterRevisions.status, "published"),
            eq(users.isBlocked, false),
            eq(users.canAuthor, true),
            eq(blogs.hidden, false),
          ),
        )
        .limit(1)
    )[0] as ChapterRow | undefined;

    if (!row) return null;
    // Архивный режим показывает бейдж САМОЙ этой версии (иначе «проверена версия N» указывала бы
    // на другую версию, чем та, которую читают).
    return toReadableChapter(row, row.revVerifiedAt !== null ? row : null);
  },
);
