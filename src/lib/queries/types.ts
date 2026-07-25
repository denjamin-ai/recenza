// Сериализуемые view-типы для читательского слоя (Фаза 5). Пользователи — без passwordHash.
import type { Block, Complexity, VerifiedTier } from "@/types";
import type { ChapterReviewerCredit } from "./reviewer-credit";

export interface AuthorView {
  id: string;
  handle: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Карточка блога для каталога/закладок. */
export interface BlogCardView {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  tags: string[];
  complexity: Complexity;
  summary: string | null;
  rating: number;
  bookmarkCount: number;
  lastActivityAt: number | null;
  publishedAt: number | null;
  author: AuthorView;
  chapterCount: number;
  /**
   * Бейдж блога (Ф14) — денормализованный агрегат `blogs.verified_*`, ИСТОРИЧЕСКИЙ факт
   * «блог проходил ревью» (правка главы его не гасит). Опциональны намеренно: поверхности,
   * которым бейдж не нужен (закладки), карточку строят без этих колонок.
   */
  verifiedTier?: VerifiedTier | null;
  verifiedAt?: number | null;
}

/** Строка ленты глав (последняя published-ревизия главы). */
export interface FeedItemView {
  blogSlug: string;
  blogTitle: string;
  chapterSlug: string;
  chapterTitle: string;
  skills: string[];
  publishedAt: number | null;
  summary: string | null;
  author: AuthorView;
}

/**
 * Глава с контентом для ридера (по умолчанию — последняя published-ревизия; в режиме `?v=N` —
 * конкретная published-ревизия). ⚠️ Ф14: `title`/`skills` — СНАПШОТ выбранной ревизии
 * (`chapter_revisions.title/skills` с fallback на рабочее значение автора в `chapters.*`),
 * а не текущее значение автора: бейдж «проверена версия N» обязан указывать на метаданные
 * той самой версии.
 */
export interface ReadableChapter {
  id: string;
  slug: string;
  title: string;
  order: number;
  skills: string[];
  revisionNumber: number;
  publishedAt: number | null;
  summary: string | null;
  blocks: Block[];
  /**
   * Бейдж ПОСЛЕДНЕЙ проверенной published-ревизии главы (может быть старше отображаемой —
   * тогда бейдж рисуется приглушённым и ведёт на `?v={verifiedRevision}`). null — ревью не было.
   */
  verifiedTier: VerifiedTier | null;
  verifiedAt: number | null;
  verifiedRevision: number | null;
}

/** Полный блог для ридера: блог + автор + published-главы (по order). */
export interface ReadableBlog {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  tags: string[];
  complexity: Complexity;
  summary: string | null;
  publishedAt: number | null;
  bookmarkCount: number;
  author: AuthorView;
  chapters: ReadableChapter[];
}

export interface FeedFilter {
  tag?: string;
  complexity?: Complexity;
  /**
   * Ролевая изоляция автора (binding, CLAUDE.md): если задан — показываем ТОЛЬКО блоги этого автора.
   * Пейджи передают viewer.id, когда роль зрителя = author (чужие блоги фильтруются из ленты/каталога).
   */
  restrictAuthorId?: string;
}

/** Глава ридера вместе с кредитом ревьюеров (ui-feedback-5: engagement — блоговый, один на страницу). */
export interface ReaderSection {
  chapter: ReadableChapter;
  credit: ChapterReviewerCredit;
}
