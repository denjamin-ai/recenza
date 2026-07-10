// Сериализуемые view-типы для читательского слоя (Фаза 5). Пользователи — без passwordHash.
import type { Block, Complexity } from "@/types";
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

/** Глава с контентом для ридера (последняя published-ревизия). */
export interface ReadableChapter {
  id: string;
  slug: string;
  title: string;
  order: number;
  skills: string[];
  primaryHandle: string | null;
  revisionNumber: number;
  publishedAt: number | null;
  summary: string | null;
  blocks: Block[];
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
