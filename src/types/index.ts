// Общие типы Recenza. Импортировать ТОЛЬКО отсюда (CLAUDE.md §конвенции).
// Union-типы выводятся из enum-массивов схемы (единый источник — src/lib/db/schema.ts).
import * as schema from "@/lib/db/schema";

// --- re-export enum-массивов (рантайм-значения для валидации/итераций UI) ---
export {
  ROLES,
  REVISION_STATUSES,
  VERDICTS,
  THREAD_STATUSES,
  REPORT_STATUSES,
  COMPLEXITIES,
  INVITATION_STATUSES,
  RECRUIT_STATUSES,
  APPLICATION_STATUSES,
  BANNER_ACTIONS,
  DONATION_TYPES,
} from "@/lib/db/schema";

// --- union-типы перечислений ---
export type Role = (typeof schema.ROLES)[number];
export type RevisionStatus = (typeof schema.REVISION_STATUSES)[number];
export type Verdict = (typeof schema.VERDICTS)[number];
export type ThreadStatus = (typeof schema.THREAD_STATUSES)[number];
export type ReportStatus = (typeof schema.REPORT_STATUSES)[number];
export type Complexity = (typeof schema.COMPLEXITIES)[number];
export type InvitationStatus = (typeof schema.INVITATION_STATUSES)[number];
export type RecruitStatus = (typeof schema.RECRUIT_STATUSES)[number];
export type ApplicationStatus = (typeof schema.APPLICATION_STATUSES)[number];
export type BannerAction = (typeof schema.BANNER_ACTIONS)[number];
export type DonationType = (typeof schema.DONATION_TYPES)[number];

// block.type — перечисление без отдельной колонки (блоки хранятся как JSON), живёт здесь.
export const BLOCK_TYPES = [
  "p",
  "h2",
  "h3",
  "quote",
  "list",
  "code",
  "callout",
  "mermaid",
  "image",
  "table",
  "embed",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

// --- формы JSON-полей (хранятся как text, читаются через parseJson) ---
export interface Block {
  id: string;
  type: BlockType;
  text?: string;
  [key: string]: unknown; // тип-специфичные поля (lang, items, src, alt, …)
}

export interface CommentAnchor {
  blockId: string;
  quote?: string;
}

export interface Suggestion {
  from: string;
  to: string;
}

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

export interface LinkItem {
  label: string;
  url: string;
}

export type NotificationPayload = Record<string, unknown>;

// --- типы строк таблиц (Select / Insert) ---
export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;
/**
 * Безопасная проекция пользователя для сериализации в API/RSC — БЕЗ `passwordHash`.
 * Полный `User` наружу не отдавать (Phase 2 backlog P2). Строить через `toPublicUser()` (src/lib/auth.ts).
 */
export type PublicUser = Omit<User, "passwordHash">;

/**
 * Данные сессии iron-session (cookie `blog_session`).
 * Инвариант (binding): `isAdmin` и `userId` НИКОГДА не заданы одновременно
 *   — админ аутентифицируется по env-паролю и не имеет строки `users`;
 *   — пользователь (reader/author/reviewer) имеет `userId` + `userRole`, `isAdmin: false`.
 * Канонический источник типа — здесь (общие типы импортируются из @/types). Логика — в src/lib/auth.ts.
 */
export interface SessionData {
  isAdmin: boolean;
  userId?: string;
  userRole?: Role;
}
export type AppSetting = typeof schema.appSettings.$inferSelect;
export type NewAppSetting = typeof schema.appSettings.$inferInsert;
export type Blog = typeof schema.blogs.$inferSelect;
export type NewBlog = typeof schema.blogs.$inferInsert;
export type Chapter = typeof schema.chapters.$inferSelect;
export type NewChapter = typeof schema.chapters.$inferInsert;
export type ChapterRevision = typeof schema.chapterRevisions.$inferSelect;
export type NewChapterRevision = typeof schema.chapterRevisions.$inferInsert;
export type ChapterReviewer = typeof schema.chapterReviewers.$inferSelect;
export type NewChapterReviewer = typeof schema.chapterReviewers.$inferInsert;
export type ReviewerHistory = typeof schema.reviewerHistory.$inferSelect;
export type NewReviewerHistory = typeof schema.reviewerHistory.$inferInsert;
export type Thread = typeof schema.threads.$inferSelect;
export type NewThread = typeof schema.threads.$inferInsert;
export type ThreadReply = typeof schema.threadReplies.$inferSelect;
export type NewThreadReply = typeof schema.threadReplies.$inferInsert;
export type ReviewChatMessage = typeof schema.reviewChat.$inferSelect;
export type NewReviewChatMessage = typeof schema.reviewChat.$inferInsert;
export type ReviewChecklist = typeof schema.reviewChecklists.$inferSelect;
export type NewReviewChecklist = typeof schema.reviewChecklists.$inferInsert;
export type PublicComment = typeof schema.publicComments.$inferSelect;
export type NewPublicComment = typeof schema.publicComments.$inferInsert;
export type CommentVote = typeof schema.commentVotes.$inferSelect;
export type NewCommentVote = typeof schema.commentVotes.$inferInsert;
export type ChapterVote = typeof schema.chapterVotes.$inferSelect;
export type NewChapterVote = typeof schema.chapterVotes.$inferInsert;
export type Bookmark = typeof schema.bookmarks.$inferSelect;
export type NewBookmark = typeof schema.bookmarks.$inferInsert;
export type Follow = typeof schema.follows.$inferSelect;
export type NewFollow = typeof schema.follows.$inferInsert;
export type Notification = typeof schema.notifications.$inferSelect;
export type NewNotification = typeof schema.notifications.$inferInsert;
export type Portfolio = typeof schema.portfolios.$inferSelect;
export type NewPortfolio = typeof schema.portfolios.$inferInsert;
export type Report = typeof schema.reports.$inferSelect;
export type NewReport = typeof schema.reports.$inferInsert;
export type PrimaryChangeRequest = typeof schema.primaryChangeRequests.$inferSelect;
export type NewPrimaryChangeRequest = typeof schema.primaryChangeRequests.$inferInsert;
export type RemovedReviewer = typeof schema.removedReviewers.$inferSelect;
export type NewRemovedReviewer = typeof schema.removedReviewers.$inferInsert;
export type ReviewInvitation = typeof schema.reviewInvitations.$inferSelect;
export type NewReviewInvitation = typeof schema.reviewInvitations.$inferInsert;
export type ReviewerRating = typeof schema.reviewerRatings.$inferSelect;
export type NewReviewerRating = typeof schema.reviewerRatings.$inferInsert;
export type RecruitRequest = typeof schema.recruitRequests.$inferSelect;
export type NewRecruitRequest = typeof schema.recruitRequests.$inferInsert;
export type BoardCall = typeof schema.boardCalls.$inferSelect;
export type NewBoardCall = typeof schema.boardCalls.$inferInsert;
export type ReviewerApplication = typeof schema.reviewerApplications.$inferSelect;
export type NewReviewerApplication = typeof schema.reviewerApplications.$inferInsert;
export type PromoBanner = typeof schema.promoBanners.$inferSelect;
export type NewPromoBanner = typeof schema.promoBanners.$inferInsert;
export type DonationMethod = typeof schema.donationMethods.$inferSelect;
export type NewDonationMethod = typeof schema.donationMethods.$inferInsert;
