# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- `npm run dev` — dev server
- `npm run build` — production build (use as primary validation)
- `npm run lint` — ESLint
- `npm run seed` — seed database (`npx tsx src/lib/db/seed.ts`)
- `npm run seed:test` — seed test database
- `npm run dev:test` — start test environment (dev server + test seed)
- `npm run test:reset` — reset test DB to clean state
- `npm run test:e2e` — run Playwright E2E tests
- `npm run test:e2e:ui` — Playwright UI mode
- `npm run test:e2e:report` — open last test report (`testing/reports/playwright-html`)
- `npx drizzle-kit generate` — generate DB migrations after schema changes
- `npx drizzle-kit migrate` — apply migrations

## Stack
- Next.js 16 App Router, TypeScript, Tailwind CSS v4
- Database: `@libsql/client` via Drizzle ORM — single driver for both dev (`file:blog.db`) and prod (Turso)
- MDX: `next-mdx-remote/rsc` + `rehype-pretty-code` (Shiki dual theme: `github-dark`/`github-light`)
- Auth: `iron-session` + `bcryptjs` — session cookie 7-day TTL, cookie name `blog_session`
- Theme: `next-themes` (dark/light)
- Deployment: Vercel + Turso

## Architecture

### Database (`src/lib/db/`)
- `index.ts` — libsql client, reads `TURSO_CONNECTION_URL`/`TURSO_AUTH_TOKEN` from env, falls back to `file:blog.db`
- `schema.ts` — Drizzle schema (all tables listed below)
- `drizzle.config.ts` — dialect is `"turso"` (not `"sqlite"`)
- All timestamps are **Unix seconds** (not milliseconds). Use `Math.floor(Date.now() / 1000)`
- Tags stored as **JSON string arrays** — always `JSON.parse()` with try-catch on read
- IDs generated with `ulid()` from the `ulid` package

**Tables:**

| Table | Purpose |
|-------|---------|
| `articles` | Blog posts. `status: draft\|published\|scheduled`. Extra fields: `coverImageUrl`, `difficulty (simple\|medium\|hard)`, `scheduledAt` (unix, nullable), `ogTitle`, `ogDescription`, `ogImage` (SEO overrides), `viewCount` |
| `articleVersions` | Snapshot before every PUT; `CASCADE` delete; optional `changeNote` |
| `profile` | Single record `id="main"`, `links` as JSON object string. Extra fields: `checklistTemplate` (JSON array), `defaultOgImage` |
| `profileVersions` | Same snapshot-before-update pattern as articles |
| `users` | Created by admin (no self-registration). `role: reviewer\|reader\|author`. `isBlocked` hides all author's articles; `commentingBlocked` blocks reader comments. Author public profile: `displayName`, `bio`, `avatarUrl`, `links` (JSON), `slug` |
| `reviewSessions` | Groups one or more `reviewAssignments` for a single article version. Status: `open\|completed\|cancelled`. Enables multi-reviewer workflows + session-wide shared chat via `reviewComments.sessionId` |
| `reviewAssignments` | Links reviewer → specific article version snapshot. `sessionId` FK → `reviewSessions` (nullable for pre-migration rows). Status: `pending→accepted\|declined→completed`. Fields: `verdict (approved\|needs_work\|rejected)`, `verdictNote` |
| `reviewChecklists` | Copy of checklist template created per assignment. `items` JSON `[{text, checked}]`. One per assignment. |
| `reviewComments` | Private review thread. `isAdminComment=1` when admin writes (authorId=NULL then). `sessionId` FK → `reviewSessions` powers session-wide shared chat (nullable for pre-migration rows). Fields: `resolvedAt` (null=open), `resolvedBy` (FK→users, set null on delete), inline-review fields (see Inline Review) |
| `publicComments` | Public reader comments. `deletedAt` for soft delete; `articleVersionId` for stale detection |
| `articleChangelog` | Manual public changelog entries, curated by admin. Immutable — edit = delete + recreate |
| `notifications` | Polling-based. `isAdminRecipient=1` + `recipientId=NULL` targets admin |
| `bookmarks` | Reader article bookmarks. `uniqueIndex(userId, articleId)`. CASCADE delete on user/article. |
| `articleVotes` | Article votes (+1/-1). `uniqueIndex(userId, articleId)`. CASCADE delete on user/article. |
| `commentVotes` | Comment votes (+1/-1). `uniqueIndex(userId, commentId)`. CASCADE delete on user/comment. |
| `subscriptions` | Reader→Author subscriptions. `uniqueIndex(userId, authorId)`. CASCADE delete on both FKs. |

**Key constraints:**
- `publicComments.articleVersionId` uses `onDelete: "restrict"` — cannot delete a version that has public comments
- `reviewComments.authorId` uses `onDelete: "set null"`
- Slug uniqueness enforced at application level (not DB constraint)
- Engagement tables (`bookmarks`, `articleVotes`, `commentVotes`, `subscriptions`) enforce uniqueness via `uniqueIndex` — app logic uses `db.transaction()` for race-safe toggle (select-then-insert-or-delete)

### Auth (`src/lib/auth.ts`)

`SessionData` has three fields — mutually exclusive invariant: `isAdmin=true` and `userId` are never set simultaneously.

```ts
interface SessionData {
  isAdmin: boolean;    // admin (env-based, no DB record)
  userId?: string;     // author, reviewer, or reader (DB user)
  userRole?: "reviewer" | "reader" | "author";
}
```

- `getSession()` — raw session read, no redirect
- `requireAdmin()` — redirects to `/admin/login` if not admin
- `requireUser(role?)` — redirects to `/login` if no `userId`; throws 403 Response if role doesn't match
- `requireAuthor()` — redirects to `/login` if not author (convenience wrapper)

**Route groups by role:**
- Admin: `src/app/admin/(protected)/` — layout calls `requireAdmin()`
- Admin login: `src/app/admin/login/` — outside protected group
- Author: `src/app/author/(protected)/` — layout calls `requireAuthor()`
- Reviewer: `src/app/reviewer/(protected)/` — layout calls `requireUser("reviewer")`
- Reader (grouped): `src/app/(reader)/` — layout calls `requireUser("reader")`; contains `/bookmarks` and `/notifications`
- Reader feed: `src/app/reader/` (named segment, not a group) — subscription-filtered article feed
- Public/reader login: `src/app/login/` — sets `userId` + `userRole` in session

**Auth endpoints:**
- `POST /api/auth` — login; IP rate-limited (5 attempts / 15 min, reads `x-forwarded-for`)
- `DELETE /api/auth` — logout
- `GET /api/auth/user` — returns current session user info (client-safe, no redirect)
- CSRF protection via `isSameOrigin()` check on `origin`/`host` headers on mutating requests

### Articles
- `status: "draft" | "published" | "scheduled"` — only `published` articles appear on the public blog
- `publishedAt` is set on first status change to `"published"`
- `scheduledAt` (unix seconds) — cron publishes when `scheduledAt <= now()`. Validation: must be in the future on create/update.
- On every `PUT`, a snapshot is saved to `articleVersions` before the update
- `PUT /api/articles/[id]` accepts `saveMode: "draft" | "publish" | "schedule" | "send_for_review" | "notify_reviewer"` — `send_for_review` creates a `reviewAssignments` record and notifies reviewer (requires `reviewerId` in body; validated as existing reviewer role; returns 409 if active assignment already exists for this article+reviewer pair); `notify_reviewer` sends `article_updated` to the active reviewer
- `GET /api/reviewers?search=<query>` — reviewer search for the picker modal. Min 2 chars required. Auth: admin or author only. Returns `[{id, username, name}]` filtered to role=reviewer + not blocked. Escapes `%` and `_` in LIKE queries.
- `articles.authorId` is `null` for admin-created articles; non-null for author-created (owned by that author)
- `coverImageUrl` must start with `/uploads/` — arbitrary URLs rejected in PUT/POST handlers
- `difficulty`: `"simple" | "medium" | "hard" | null` — shown as badge on cards and article pages
- View tracking: `POST /api/articles/[id]/view` increments `articles.viewCount`; client component `view-tracker.tsx` fires on mount

**Article changelog** (`articleChangelog` table): `POST /api/articles/[id]/changelog` creates an entry; `DELETE /api/articles/[id]/changelog/[entryId]` removes it. Entries are immutable — edit = delete + recreate. Displayed publicly as an accordion on article pages.

**Admin settings**: `PUT /api/admin/settings/profile` updates the single `profile` row (`name`, `bio`, `links`, `defaultOgImage`, `checklistTemplate`). The `checklistTemplate` JSON `[{text}]` is copied into `reviewChecklists.items` when a new review assignment is created; template changes do not affect existing checklists. Settings UI is at `/admin/settings`.

**Admin users**: `/admin/users` — CRUD for all user accounts. `PATCH /api/admin/users/[id]` toggles `isBlocked` (hides all author articles) and `commentingBlocked` (blocks comments/votes). `POST /api/admin/users` creates users; no self-registration exists.

**Admin visibility toggle**: `PATCH /api/admin/articles/[id]/visibility` — quick hide/show without editing content. Body: `{ action: "hide" | "show" }`. Hide sets `status=draft` + clears `scheduledAt`; show sets `status=published`, preserves original `publishedAt`.

**MDX preview**: `POST /api/preview` — compiles MDX to HTML for the live editor preview. Auth: admin or author only. Body: `{ content: string }` (max 100KB). Returns `{ html: string }`. Uses a custom `remarkMdxDiagramsToHtml()` remark plugin that converts Mermaid/Diagram/Circuit/ArticleImage/ArticleVideo JSX nodes to placeholder HTML.

### Review workflow
- Admin sends article for review → creates `reviewAssignment` (status=`pending`) + notifies reviewer; copies `profile.checklistTemplate` into `reviewChecklists`
- Reviewer accepts/declines/completes → status transitions + notifies admin
- Review comments (`reviewComments`) are private — only admin and the assigned reviewer see them
- `isAdminComment=1` marks admin-authored comments (authorId=NULL); reviewer comments have `authorId`
- **Verdict**: required when completing (`status=completed`). Values: `approved | needs_work | rejected`. Stored in `reviewAssignment.verdict` + `verdictNote`.
- **Resolve**: author/admin mark reviewer comments resolved (`resolvedAt` timestamp, `resolvedBy` FK). Reviewer can reopen (sets `resolvedAt=null`). Both actions blocked when assignment `status=completed`.
- **Checklist**: `reviewChecklists.items` = `[{text, checked}]` JSON. Reviewer updates via `PUT /api/assignments/[id]/checklist`. Template changes don't affect existing checklists.
- **Diff**: `GET /api/reviewer/assignments/[id]/diff` — diff between assigned version snapshot and current article content. Same endpoint exists for admin (`/api/admin/assignments/[id]/diff`) and for the article author (`/api/author/assignments/[id]/diff`).
- **Review comments API**: `GET/POST /api/assignments/[id]/review-comments` — thread visible to admin + assigned reviewer only. `POST /api/review-comments/[id]/resolve` — toggle resolved state; blocked when assignment `status=completed`.

**Review sessions** (`reviewSessions` table, `src/lib/session-helpers.ts`):
- A session groups multiple `reviewAssignments` against one article version snapshot — one reviewer per assignment, multiple reviewers per session.
- `POST /api/review-sessions` — create session + child assignments in one call (admin or article author). `validateReviewerCount()` enforces per-difficulty reviewer counts.
- `GET /api/review-sessions/[id]` — session detail with all assignments.
- `GET/POST /api/sessions/[id]/review-comments` — **session-wide** shared chat (distinct from per-assignment threads). Access gated by `resolveSessionAccess()` — admin, article author, or any reviewer assigned to the session.
- `reviewComments.sessionId` non-null → shared chat; `.assignmentId` non-null → per-assignment thread.

### Inline Review (`src/components/review/`, `src/lib/anchoring.ts`)
Inline annotation system for code/text review with text selection, block comments, suggestions, and batch review workflow.

**Anchoring** (`src/lib/anchoring.ts`):
- `createAnchor(range, container)` → `AnchorData` with TextQuoteSelector + TextPositionSelector
- `resolveAnchor(anchorData, container)` → `Range | null` — cascading match (exact → fuzzy via diff-match-patch, threshold 0.4)
- `isOrphan(anchorData, container)` — true if anchor can no longer be resolved (content changed)
- `rehypeAnchorIds` (`src/lib/rehype-anchor-ids.ts`) — rehype plugin adding deterministic `data-anchor-id` to elements (SHA256 hash)

**Review comments** (`reviewComments` table fields):
- `anchorType`: `"text" | "block" | "general"` — text selection, block-level, or general comment
- `anchorData`: JSON string with `{ selectors: [...] }` — TextQuoteSelector + TextPositionSelector
- `commentType`: `"comment" | "suggestion"` — suggestions include `suggestionText` for apply
- `batchId`: non-null = pending (draft); null = published. Batch visibility: pending comments visible only to admin + comment author

**Batch review flow**:
- Reviewer creates comments with `batchId` → comments stay pending (invisible to author)
- `POST /api/assignments/[id]/submit-review` — publishes all pending comments (sets `batchId=null`), sets verdict, completes assignment atomically
- `BatchReviewBar` + `BatchReviewModal` components handle the UI

**Suggestion apply**: `PUT /api/review-comments/[id]/apply-suggestion` — admin/author only; `stripDangerousHtml()` sanitizes `suggestionText`; atomic transaction with `appliedAt` guard prevents double-apply; creates version snapshot before modifying article content

**Key components** (`src/components/review/`):
- `review-context.tsx` — React context for review state (comments, active thread, highlights)
- `inline-review-layout.tsx` — two-panel layout (article + sidebar), resizable
- `selection-popover.tsx` — popover on text selection with Comment/Suggestion buttons
- `highlight-layer.tsx` — CSS Highlight API for annotation rendering
- `review-sidebar.tsx` — sidebar listing all review threads
- `review-thread.tsx` — individual comment thread with replies
- `batch-review-bar.tsx` / `batch-review-modal.tsx` — batch submit UI
- `diff-overlay.tsx` — inline diff visualization overlay
- `review-keyboard-handler.tsx` + `use-review-keyboard.ts` — keyboard shortcuts (N/P/R/E/C/⌘↵)
- `margin-pins.tsx` — numbered comment pins in the right margin (desktop only). Resolves anchors via `resolveAnchor()`, stacks overlapping pins with 28px min gap, mutes resolved, colors per-reviewer via stable HSL hash. Click activates the thread.
- `session-review-thread.tsx` — shared session chat UI (reads `/api/sessions/[id]/review-comments`)

**Review pages per role**:
- Reviewer: `/reviewer/assignments/[id]` — full inline review interface
- Admin: `/admin/articles/[id]/review/[assignmentId]` — admin review view
- Author: `/author/articles/[id]/review/[assignmentId]` — read-only view. Can **apply suggestions** and **mark comments resolved**; cannot create new comments, replies, or suggestions. `author-review-view.tsx` + `unified-review-view.tsx` render this mode.

### Author portal (`src/app/author/(protected)/`)
Layout calls `requireAuthor()`. Authors manage only their own articles (`article.authorId === session.userId` enforced on all `/api/author/*` routes).

**Pages:** dashboard (`/author`), articles list/new/edit (`/author/articles`), preview (`/author/articles/[id]/preview`), version history (`/author/articles/[id]/history`), review thread (`/author/articles/[id]/review`), public profile editor (`/author/profile`), notifications (`/author/notifications`).

**API endpoints:**
- `GET/PUT /api/author/profile` — manage public profile (`displayName`, `bio`, `avatarUrl`, `links`, `slug`); slug uniqueness checked at API level
- `GET /api/author/assignments` — list review assignments for author's own articles
- `GET /api/author/assignments/[id]/diff` — diff between assigned version snapshot and current content
- `GET /api/author/articles/[id]/review-comments` — list published review comments across all assignments on the author's own article (pending comments with non-null `batchId` are filtered out)

### Reviewer portal (`src/app/reviewer/(protected)/`)
Layout calls `requireUser("reviewer")`. All `/api/reviewer/*` routes enforce `session.userId === assignment.reviewerId`.

**Pages:** dashboard (`/reviewer`), assignments list with status filter (`/reviewer/assignments`), review detail with diff/checklist/verdict (`/reviewer/assignments/[id]`), version history (`/reviewer/assignments/[id]/versions`), notifications (`/reviewer/notifications`).

**API endpoints:**
- `GET /api/reviewer/assignments` — list assignments for current reviewer
- `PATCH /api/reviewer/assignments/[id]` — update status (`accepted | declined | completed`); `completed` requires `verdict`
- `GET/PUT /api/reviewer/assignments/[id]/checklist` — get/update `[{text, checked}]` items
- `GET /api/reviewer/assignments/[id]/diff` — diff against current article content
- `GET /api/reviewer/assignments/[id]/versions` — article version snapshots

### Upload
- `POST /api/upload` — admin or author only; accepts `multipart/form-data` with `file` field
- MIME validated via magic bytes (`file-type` package), not client-provided type
- Size limit: 2 MB — checked via `Content-Length` header before buffering (DoS protection), then re-checked after buffering
- Files saved to `public/uploads/[ULID].[ext]`; returns `{ url: "/uploads/..." }`

### Scheduled publishing (Cron)
- `GET /api/cron/publish` — protected by `Authorization: Bearer <CRON_SECRET>` header
- Finds `status=scheduled` articles with `scheduledAt <= now()`; skips blocked authors
- Sets `status=published`, clears `scheduledAt`; batch-notifies subscribers on first publish
- Configured in `vercel.json` as a Cron Job (every minute): `{"path":"/api/cron/publish","schedule":"* * * * *"}`

### Engagement (votes, bookmarks, subscriptions)
- All toggle endpoints use `db.transaction()` for race-safe check-and-insert/delete
- Rate limiting on vote endpoints: `checkUserRateLimit(userId, 1000, 1)` — 1 req/sec per user (429 on exceed)
- `commentingBlocked=1` users cannot vote on articles or comments
- Authors cannot vote on their own articles; users cannot vote on their own comments
- Subscriptions trigger `new_article_by_subscribed_author` notifications on first publish

**Engagement endpoints:**
- `POST /api/articles/[id]/votes` — toggle +1/-1 vote on article
- `POST /api/comments/[id]/votes` — toggle +1/-1 vote on comment
- `POST /api/bookmarks` — toggle bookmark on article; body `{ articleId }`
- `GET /api/bookmarks` — list current user's bookmarks
- `GET /api/articles/[id]/bookmark-status` — returns `{ bookmarked, count }` for client-side state
- `POST /api/subscriptions` — toggle follow/unfollow author; body `{ authorId }`

**Reader feed**: `src/app/reader/` shows published articles filtered to subscribed authors only.

**Author profiles**: Authors have public pages at `/authors/[slug]`. Author-editable fields via `PUT /api/author/profile`: `displayName`, `bio`, `avatarUrl`, `links` (JSON object: GitHub/Telegram/Website), `slug`. Slug uniqueness is enforced at API level (not DB constraint) with a conflict check on save.

### Public comments
- Only `reader` role users can post (`session.userRole === "reader"` enforced in POST handler)
- Max 2 levels of nesting — enforced server-side by checking `parent.parentId !== null`
- 15-minute edit window: `Math.floor(Date.now()/1000) - comment.createdAt > 900` → 403
- Stale detection: server sets `isStale: comment.articleVersionId !== currentVersionId` on each comment in GET response
- `VersionWarning` component reads the ULID timestamp from the version ID (first 10 chars, Crockford base32) to display the version date

### Notifications
- Polling: `NotificationBadge` client component polls `GET /api/notifications?unread=1` every 30 seconds
- `isAdminRecipient=1` + `recipientId=NULL` for admin notifications; `recipientId=userId` for reviewer/reader
- `payload` is a JSON string with context IDs for deep links — always read with `JSON.parse` + try-catch
- Auto-pruning: `GET /api/notifications` deletes read notifications older than 30 days for the current recipient on each call

### SEO / Feed
- `/feed.xml` — RSS feed route (`force-dynamic`; published articles only)
- `/sitemap.ts` — Next.js `MetadataRoute.Sitemap`
- Both use `NEXT_PUBLIC_BASE_URL` for canonical URLs

### Utility functions (`src/lib/`)
- `rate-limit.ts` — `checkUserRateLimit(userId, windowMs, max)` for engagement; `checkRateLimit(ip, ...)` for admin login — in-memory `Map`, auto-cleanup
- `diff.ts` — `computeDiff()` used by diff endpoints to compare article version snapshots
- `reading-time.ts` — `estimateReadingTime(mdx)`: 200 wpm, code blocks count as 0.5 min each, minimum 1 min
- `utils.ts` — `parseTags(json)`, `mdxToPlainText(src, maxLen?)` (strips code/links/HTML+JSX tags for excerpts — use for SEO description), `parseLinks(json)`

### MDX (`src/lib/mdx.ts`)
- `compileMDX(source, { reviewMode? })` — compiles MDX string with custom component map. `reviewMode: true` swaps `Mermaid/Diagram/Circuit` for `ReviewMermaid/ReviewDiagram/ReviewCircuit` (`src/components/mdx/diagram-with-source.tsx`), which render the diagram alongside a collapsible `<details>` showing its source — used on review pages.
- `stripDangerousHtml(source)` — exported from `mdx.ts`; strips `<script>`/`<iframe>`/`<object>`/`<embed>`/`<link>`, `on*=` handlers, and `javascript:` URIs. Also used by the suggestion-apply endpoint before persisting suggestion text.
- **Registered MDX components**: `Expandable`, `Mermaid`, `Diagram`, `Circuit`, `ArticleImage`, `ArticleVideo` — all registered in `mdxComponents` (or review-variants in `mdxReviewComponents`)
- `CodeCopyButtons` (`src/components/mdx/copy-button.tsx`) is a standalone client component rendered directly in article pages; attaches copy buttons to `[data-rehype-pretty-code-figure]` elements via DOM `useEffect`
- **LaTeX math**: `remark-math` + `rehype-katex` in the MDX pipeline — use `$inline$` and `$$block$$` syntax
- **Mermaid diagrams**: client-side rendering via lazy-loaded `Mermaid` component, theme-aware (`dark`/`default`)
- **Kroki diagrams** (`Diagram`, `Circuit`): server-rendered via the cloud Kroki service — supports PlantUML, BPMN, WaveDrom, Graphviz, D2, TikZ
- **Video**: `fluent-ffmpeg` + `ffprobe` installed for server-side video processing (listed in `next.config.ts` `serverExternalPackages`)
- **Heading anchors**: `rehype-slug` adds `id` attributes to headings for deep links

### API pattern (`src/app/api/`)
- Admin routes: `await requireAdmin()` first
- Author routes (`/api/author/*`): `await requireAuthor()` + article ownership check (`article.authorId === session.userId`)
- Reviewer routes (`/api/reviewer/*`): `await requireUser("reviewer")` + `session.userId === assignment.reviewerId` ownership check
- Mixed access routes (review comments): `resolveAccess()` pattern — first check auth, then fetch resource, then check ownership
- Dynamic route params are `Promise<{...}>` in Next.js 16 — must `await params`
- Article updates save a **version snapshot before updating** (in `articleVersions`)
- Cron routes: check `Authorization: Bearer <CRON_SECRET>` as first action — no session involved

## Agent Skills (`.agents/`)
Custom Claude Code skill definitions — not application code.
- `skills/` — design, audit, critique, and Next.js best-practice prompts
- `skills/next-best-practices/` — async patterns, RSC boundaries, route handler guidance
- `skills/impeccable/` — design reference (color, typography, spatial, interaction)

## Conventions
- **Path alias**: `@/*` maps to `src/*` (tsconfig) — use `import { ... } from "@/..."` everywhere
- All DB queries go through Drizzle — no raw SQL
- API routes in `src/app/api/`, admin pages in `src/app/admin/(protected)/`
- Custom MDX components in `src/components/mdx/`, registered in `src/lib/mdx.ts`
- Pages that query the DB use `export const dynamic = "force-dynamic"`
- UI text is in Russian
- `parseTags()` utility in `src/lib/utils.ts` — use for reading `article.tags` JSON
- **Shared TypeScript types**: `src/types/index.ts` — `UserRole`, `SessionData`, `ArticleStatus`, `DifficultyLevel`, `ReviewAssignmentStatus`, `ReviewVerdict`, `ChecklistItem`, `NotificationType`, `ApiError`; import from here instead of redefining locally
- **E2E tests**: `testing/e2e/{guest,reader,author,admin,reviewer}.spec.ts` — see Testing section below
- `npm run build` is the primary correctness check

## Testing
- Test server runs on **port 3001** (`.env.test`), using separate DB `blog.test.db`
- `.env.test` has plaintext `ADMIN_PASSWORD_PLAIN` for auth setup — never commit real credentials there
- Tests run **sequentially** (`workers: 1, fullyParallel: false`) — single shared test DB
- `npm run dev:test` starts test stand (seeds DB + dev server on 3001); `npm run test:reset` resets DB between runs
- `npm run test:e2e` auto-starts `dev:test` if not already running (`reuseExistingServer: true`)
- `global-setup.ts` (`testing/e2e/global-setup.ts`) auto-generates auth state files at `testing/e2e/.auth/{admin,author,reader,reviewer}.json`
- Test utilities and DB reset scripts in `.agents/playwright-tester/`
- Config: `playwright.config.ts` — reports to `testing/reports/playwright-html`

## Design System

### Шрифты (`src/app/layout.tsx`)
- **Display**: Playfair Display — `font-display` (`--font-playfair`), h1–h3, логотип, hero
- **Body**: Manrope — `font-sans` (`--font-manrope`), body, UI
- **Mono**: system stack — `font-mono` (`--font-mono`), code blocks
- Подключены через `next/font/google`, subsets `["latin", "cyrillic"]`

### Цвета (`src/app/globals.css`)
- **Акцент**: Teal (`#0f766e` light / `#2dd4bf` dark) — все интерактивные элементы
- **Семантические**: `success`, `warning`, `danger`, `info` + `-bg`, `-border` варианты
- **Поверхности**: `background`, `foreground`, `muted`, `elevated`, `border`
- Dark mode: `#111111` фон, `#1e1e1e` / `#161616` поверхности
- Не используй raw цвета (`text-red-500` и т.п.) — только CSS-переменные через Tailwind-утилиты

### Анимации (`src/app/globals.css`)
- `.animate-in` — stagger fadeInUp через CSS custom property `--index` (0-based)
- `prefers-reduced-motion: reduce` — все анимации отключаются
- Keyframes: `fadeInUp`, `pulse-badge`, `bookmark-pop`, `spin-in`, `fade-in`, `dialog-in`
- Только `transform` и `opacity` — никогда `width`/`height`/`margin`

### Компоненты
- `ScrollProgress` (`src/components/scroll-progress.tsx`) — fixed progress bar на статье, `role="progressbar"`
- `NavMobileMenu` (`src/components/nav-mobile-menu.tsx`) — hamburger на `<768px`
- `ArticleCard` — prop `index` для stagger-анимации
- `BookmarkButton` — CSS fill-анимация `bookmark-pop`
- `NotificationBadge` — `pulse-badge` анимация
- `ThemeToggle` — `spin-in` анимация
- `TableOfContents` — клиентский компонент, парсит H2–H4 из контента статьи. Intersection Observer (60% rootMargin) подсвечивает активный заголовок. Desktop: sticky sidebar; mobile: `<details>`. Обрабатывает дубли slug-ов счётчиком.
- `ShareButton` — кнопки шаринга в Telegram, VK, X (Twitter). Диалог открывается в popup 600×400. Clipboard API проверяется после mount (избегает SSR mismatch).

### Редактор статей
- `EditorWithPreview` (`src/components/editor-with-preview.tsx`) — двухпанельный MDX-редактор. Расположение превью: `right | left | bottom | none`, сохраняется в localStorage.
- `DiagramInserter` (`src/components/diagram-inserter.tsx`) — модалка для вставки диаграмм: Mermaid (flowchart, sequence, class, state, ER, Gantt, pie, mindmap, timeline, gitgraph) и Kroki (PlantUML, BPMN, WaveDrom, Graphviz, D2, TikZ).
- `FormulaInserter` (`src/components/formula-inserter.tsx`) — модалка для LaTeX: тулбар быстрых символов, toggle inline/block, live KaTeX preview.
- `useArticleEditor` hook — управляет позицией курсора в textarea, загрузкой медиа через XHR с отслеживанием прогресса, состоянием превью медиа.
- `useLocalStorageDraft` hook — сохраняет черновики редактора в localStorage.
- `ReviewerPickerModal` (`src/components/reviewer-picker-modal.tsx`) — `<dialog>`-based modal для выбора ревьюера при отправке на ревью. Real-time поиск через `/api/reviewers`, 300ms debounce. Возвращает `{id, name, username}` через `onSelect` callback.

### Accessibility
- Skip-to-content: `<a href="#main-content">` в `layout.tsx`, `<main tabIndex={-1}>` для фокуса
- `aria-label` на всех icon-only кнопках (ThemeToggle, CopyButton, BookmarkButton, и т.д.)
- `focus-visible: ring-2 ring-offset-2` с accent-цветом

## Environment variables (`.env.local`)
Copy `.env.example` → `.env.local` and fill in values. Required at startup:
- `SESSION_SECRET` — 32+ char random string (required at startup)
- `ADMIN_PASSWORD_HASH` — bcrypt hash with `$` escaped as `\$` (dotenv-expand interprets `$`)
- `TURSO_CONNECTION_URL` — Turso DB URL (optional in dev, required in prod)
- `TURSO_AUTH_TOKEN` — Turso auth token (optional in dev, required in prod)
- `CRON_SECRET` — Bearer token for `/api/cron/publish` (required in prod; set same value in Vercel Cron config)
- `NEXT_PUBLIC_BASE_URL` — canonical base URL, e.g. `https://yourdomain.com` (used in sitemap, RSS feed, JSON-LD)

## Gotchas
- Bcrypt hashes in `.env.local` need `\$` escaping (e.g., `\$2b\$10\$...`) — dotenv-expand treats `$` as a variable reference
- MDX is compiled on every render (no cache layer)
- Seed script needs `process.exit()` because the libsql client keeps the connection alive
- `publicComments.articleVersionId` is `onDelete: "restrict"` — deleting an `articleVersion` with attached comments will fail; admin UI must warn about this
- `requireUser()` throws a `NextResponse` object (not a plain Error) when role doesn't match — callers must `return` it or it won't terminate the handler
- `coverImageUrl` is validated server-side to start with `/uploads/` — prevents storing arbitrary external URLs
- Engagement toggle endpoints (votes, bookmarks, subscriptions) use `db.transaction()` — the DB has `uniqueIndex` constraints as a safety net; a constraint violation means a bug in the toggle logic
- Author article editor: `cursorPosRef` must be initialized to `content.length` after `setContent()` in `loadArticle` — otherwise media/formula insertion defaults to position 0 (start of content) until the user clicks in the textarea
- `mdxToPlainText()` strips HTML and JSX tags (e.g. `<ArticleImage>`) — always use it for SEO meta descriptions, never raw MDX content

## Claude Code Rules (`.claude/rules/`)
- `security.md` — always-on: secrets, auth, XSS, input validation
- `next-app-router.md` — App Router conventions (globs: `src/app/**`)
- `drizzle-queries.md` — Drizzle ORM patterns (globs: `src/lib/db/**`, `src/app/api/**`)
- `mdx-components.md` — MDX component conventions (globs: `src/components/mdx/**`, `src/lib/mdx.ts`)
- `frontend-design.md` — typography, color, animation rules (globs: `src/components/**`, pages/layouts)
