# Recenza — Architecture & Handoff

Single-page React prototype of a multi-author blog platform with multi-chapter blogs and an editorial review workflow.

---

## 1. Data Model

```
Blog                          (FAKE_DATA.blogs[])
├─ id, slug, title
├─ authorSlug, tags[], cover, complexity, summary
├─ publishedAt, lastActivityAt
├─ viewCount, rating, bookmarkCount
└─ chapters: Chapter[]
    ├─ id, slug, title, order
    ├─ blocks[]            ← current revision content
    ├─ prevBlocks[]        ← last-published snapshot (for inline diff)
    ├─ revision: { number, status, summary, submittedAt, publishedAt, deadline }
    ├─ primaryHandle       ← lead reviewer
    ├─ reviewerHandles[]   ← assigned reviewers
    ├─ state: { handle → { verdict, verdictAt, online, typing } }
    ├─ threads: Thread[]
    │   ├─ id, blockId, anchor, status: 'open' | 'resolved'
    │   ├─ from, text, replies[]
    │   └─ suggestion?: { from, to }    ← apply-and-close text replacement
    ├─ chat: ChatMsg[]                  ← session chat (out-of-band of threads)
    ├─ openThreads, lastActivityAt, hasMyTurn, stalledFor
```

**Chapter status** (`chapter.revision.status`):
- `draft` — author writing, no reviewers engaged
- `under-review` — submitted, awaiting verdicts
- `changes-requested` — reviewer asked for changes
- `published` — final, visible publicly

**Block types** (rendered identically in reader + review):
`p`, `h2`, `h3`, `quote`, `list` (bullet/numbered/todo), `code`, `callout` (note/warning/info), `mermaid`, `image`, `table`, `embed`.

---

## 2. State stores

### `window.FAKE_DATA`
Static mock; treat as the read-only DB. Mutations inside the prototype
happen in-place on the live objects (e.g. publishing a chapter mutates
`chapter.revision.status` directly).

### `window.__blogData`
Pure helper layer over `FAKE_DATA`. All surfaces read through this.

**Two-layer definition — order matters.** A small *base* object is created in
`ReviewData.js` holding only `effectiveTeam` + `removedReviewerHandlesFor`
(the one method ReviewPage still calls as a defensive fallback). `blogs-data.js`
then **extends that same object additively** (`const D = window.__blogData;
if (!D) return; D.getBlogs = …`) with the chapter-aware helpers below.
ReviewData.js must load first — deleting the base breaks every chapter-aware
method (they are attached to it, not redefined). The legacy article-level views
(`getArticles`/`getArticleBySlug`/`getAuthorDrafts`/`getInFlightReviews`) were
superseded by the chapter-aware helpers and removed.

Chapter-aware methods (added by `blogs-data.js`):

| Method | Returns |
|---|---|
| `getBlogs()` | array of all blogs |
| `getBlogBySlug(slug)` | one blog |
| `getChapter(blogSlug, chapterSlug)` | one chapter |
| `getInFlightChapters()` | chapter-level projection: in-flight only, with `{blogSlug, blogTitle, chapterSlug, chapterTitle, chapterOrder, totalChapters, …}` |
| `getAuthorBlogs(handle)` | author's blogs with `buckets {drafts, onReview, published}` and `chapterCounts` |
| `effectiveChapterTeam(chapter, blogSlug)` | reviewer team with admin-removed handles dropped |
| `chapterStatus(c)` / `isChapterPublished/InFlight/Draft(c)` | classifiers |
| `getArticleBySlug(slug)` | **legacy** — single-chapter shim, kept for older callers |

### `window.__reviewStore`
Pub-sub store for admin-driven mutations that need to propagate
across surfaces (ReviewerInbox, AdminPortal, BlogDetail):

```js
{
  pcRequests: [...],           // primary-change requests
  forced: ["blogSlug#chapterSlug", ...],  // force-approved chapters
  removedReviewers: [{ blogSlug, chapterSlug, handle, by, at, reason }, ...]
}
```

Surfaces call `__reviewStore.subscribe(fn)` and `update(patch)`. After
chapter mutations (publish, submitRevision) we also `update({})` to
trigger a no-op broadcast.

### `window.__follows`
Reader subscriptions, persisted in `localStorage["devblog-follows-v1"]`.
Surfaces listen for `CustomEvent("devblog:follows-changed")`.

### `window.__reactions`
Per-reader votes + bookmarks, persisted in localStorage. Defined in
`BlogReader.jsx`. API: `{ getVote, setVote, readBookmarks, isBookmarked,
setBookmark }`.

```js
localStorage["devblog-votes-v1"]     // { blogSlug: 1 | -1 }
localStorage["devblog-bookmarks-v1"] // [blogSlug, …]
```

Mutations broadcast `CustomEvent("devblog:reactions-changed")`; cards/readers
re-render via the `useCardReactionsTick()` hook. Guests who vote/bookmark are
bounced through login and the pending intent is replayed on return (see
`App.jsx` intent handler: `bookmark` / `vote` / `comment` / `follow`).

### Notifications
No store object — the `NotificationBell` (in `Components.jsx`) derives its
list per session from real state (new chapters in followed series + review
“ваш ход” turns). Read-state only is persisted in
`localStorage["devblog-notif-read-v1"]`; the badge count is unread items.

### Comments (Фаза E)
`FAKE_DATA.comments` is a flat list; each comment is keyed to a
`blogSlug` + `chapterSlug` + `revision`, carries `editedAt` (null until
edited) and an optional `anchor: { blockId, quote }` pointing at a block id
rendered as `id="block-<id>"` in the reader. `CommentsSection`
(`Components.jsx`) filters to the open blog+chapter, splits comments left on
an **older** revision into a collapsible “прошлые версии” spoiler (badge
«к версии vN»), supports a 15-min edit window on comments **and** replies
(`withinEditWindow`), and clicking a quote scrolls to its block. New comments
inherit the current chapter + revision.

### Reviewer credit / role separation (Фаза E)
Two `__blogData` helpers added in `blogs-data.js`:
`chapterAllReviewers(chapter)` → `{ current, all }` (current = `reviewerHandles`
∪ `state`; `all` also folds in the optional `reviewerHistory: [{revision,
handles}]`), and `getReviewedChapters(handle)` → published chapters a reviewer
ever worked on (powers their public profile). The reader’s end-of-chapter
`ChapterReviewerCredit` (`BlogReader.jsx`) shows current reviewers as chips
with past-version reviewers behind a disclosure.

**Role responsibilities (binding):** readers comment everywhere; authors see /
read / comment only in their OWN blogs (other blogs are filtered out of the
feed/catalog and blocked in the reader); reviewers never comment and have no
blogs — their public profile lists what they reviewed; admins moderate.
Gating lives in `CommentsSection` (comments), `HomeScreen`/`ArticleIndexScreen`
+ `BlogReaderScreen` (author isolation), and `ProfileScreen` (role-split).

---

## 3. Screen map

```
┌─────────── Public ─────────────────────────────────────┐
│ HomeScreen / ReaderFeed (data-screen-label=Home/ReaderFeed)
│ ArticleIndex     ─→ BlogReader (wide reading column + right
│                     SeriesNav rail: chapter list w/ active
│                     chapter's ToC nested; single-chapter → ToC only)
│ BookmarksScreen  (saved-blogs grid; reads __reactions; from avatar menu)
│ NotificationBell (header popover; derived feed, not a route)
└─────────────────────────────────────────────────────────┘

┌─────────── Author ──────────────────────────────────────┐
│ AuthorPortal (blog cards; create-tile first; pinned blog sorts
│   first with an amber ring; pin toggle on each card)
│   └─ BlogDetail (per-blog chapter list; pin / preview / +chapter)
│        ├─ Editor (new chapter or edit draft)
│        └─ ReviewPage (chapter under review)
└─────────────────────────────────────────────────────────┘

Profile (`ProfileScreen`, route `profile`) is tabbed for authors:
**«Об авторе · Блоги»**. «Об авторе» is an optional portfolio (one per
author, stored via `window.__pins`/portfolio store; rendered as a mini-article;
publishes without review). If absent: visitors see only Логи; the owner sees a
«Портфолио ещё не создано» empty state. Owner enters the portfolio editor from
the profile («Изменить портфолио») or the author cabinet; visibility is a
show/hide toggle. Readers/reviewers have no portfolio tab.

┌─────────── Reviewer ────────────────────────────────────┐
│ ReviewerInbox (chapter cards)
│   └─ ReviewPage (per-chapter)
└─────────────────────────────────────────────────────────┘

┌─────────── Admin ───────────────────────────────────────┐
│ AdminPortal
│   ├─ AdminDashboard
│   ├─ AdminUsers / AdminUserDetail
│   ├─ AdminReports / AdminReportDetail
│   └─ AdminReview (chapter-level queue)
└─────────────────────────────────────────────────────────┘
```

> **⚠ Route gotcha — do not regress.** The `page === "article"`
> route in `App.jsx` **must** render `<BlogReaderScreen slug={currentSlug} … />`
> (the data-driven multi-chapter reader), **not** the retired legacy
> `ArticleReaderScreen`. `openArticle(slug)` sets `currentSlug`; the reader
> reads it. There is no `window.ArticleReaderScreen = BlogReaderScreen`
> shim — the wiring lives only in that one JSX line, so a careless
> re-sync of `App.jsx` can silently swap in a hardcoded single-article
> view (this already happened once). If opening different blogs shows
> the same content, or `document.title`/OG tags don't update, this line
> is the cause.

---

## 4. ReviewPage (Concept C — Convo Cards) architecture

This is the most complex surface. Single-page two-column layout
(article left, threads rail right; mobile becomes tabs).

```
ReviewHeaderV2
├─ Top bar: back / compound title (Blog → Chapter) / rev / status / POV select / team modal trigger
├─ Chapter strip: tablist of all chapters in blog, click switches active
└─ Presence strip: avatars with green dot for `state[handle].online`

ConvoCanvas
├─ Article column (overflow-y scroll)
│   ├─ Article meta + revision changelog
│   └─ ArticleBlock[]
│       ├─ Block content (renders per type)
│       ├─ Inline-diff via diffWords(prev.text, block.text)
│       ├─ Right gutter:
│       │   ├─ Bauble (chat icon + open count, color = derived tone)
│       │   └─ BlockVerdictStamp (clickable for reviewer, cycles approve/fix/discuss)
│       └─ Double-click → InlineEditField (author only, text-like blocks)
│
└─ ThreadsRail
    ├─ Header (open count + showResolved toggle)
    ├─ VerdictLedger (3 counters: правок/обсуждений/решено)
    ├─ ThreadCard[]
    │   ├─ Author avatar + chip (правка / решено)
    │   ├─ Anchor quote (clamped)
    │   ├─ Text + suggestion diff (if present)
    │   ├─ Replies (nested)
    │   └─ Actions: Применить и закрыть (author) / отметить решённым (reviewer)
    └─ Composer
        ├─ Teammate typing indicator (fake real-time)
        └─ Textarea + send (disabled without anchor)

ActionBar (sticky bottom)
├─ Reviewer POV: Нужны правки / Одобрить (only when chapter is under-review)
└─ Author POV: Сменить ведущего / Опубликовать (if all approve) / Отправить v{N+1}

PrimaryChangeModal + TeamSheet (mobile) + Toast (aria-live)
```

### Bidirectional click sync

```
bauble click ──► pickBauble(blockId)
                  ├─ if any thread.status === "resolved" → setShowResolved(true)
                  ├─ setActiveThreadId(target.id)   [open || last resolved]
                  ├─ setMobileTab("threads")
                  └─ flashBlock(blockId)            [smooth scroll + flash anim]

thread click ───► pickThread(t)
                  ├─ setActiveThreadId(t.id)
                  ├─ setMobileTab("article")
                  └─ flashBlock(t.blockId)

ThreadsRail useEffect on [activeThreadId, showResolved]:
                  └─ container.scrollTo({ top: computed, behavior: "smooth" })
```

### Apply-and-close

`applyAndClose(thread)` mutates `chapter.blocks[i].text = text.replace(suggestion.from, suggestion.to)`,
sets `thread.status = "resolved"`, and broadcasts via `__reviewStore.update({})`.

---

## 5. Editor v2 (Variant B — document-first)

Block-based hybrid editor (Notion + Docs + Markdown). The surface is
**writing-first**: the page is a clean document, and everything that isn't
writing is pushed to the edges or into on-demand panels.

- **Minimal top bar**: `← Кабинет` + save-state indicator on the left; on the
  right an icon cluster — save (💾, ⌘/Ctrl+S, dirty dot), full preview (👁),
  split-preview toggle (≥lg only, a single on/off toggle), chapter settings
  (⚙), and the green **«Отправить на ревью →»** button.
- **Document body**: breadcrumb (Blog · Chapter N of M · status) → wrapping,
  auto-growing title `<textarea>` (capped at 64 chars, re-measured on
  `document.fonts.ready` so serif descenders aren't clipped on first paint)
  → a dashed **settings chip row** (slug · tags · cover · ⚙ Настройки) → blocks.
- **`ChapterSettingsPopover`** (⚙ icon or chip row): publication metadata only —
  slug (auto + override), tags, cover. Edited rarely.
- **`SubmitSheet`** (large right-side drawer, opened by «Отправить на ревью»):
  the review-handoff stage — readiness checklist (gate), complexity tier,
  reviewers + lead picker, note to reviewers. Submit is disabled until the
  readiness gate passes. **No deadline field.** Portfolio («Об авторе»)
  chapters skip this entirely — they publish without review.
- **Slash menu** (`/` on empty block) → 4 groups, 14 block types.
- **Markdown shortcuts** at start of paragraph: `## `, `### `, `> `, `- `,
  `1. `, `[] `, ` ``` `, `$$`, `> note:`, `> warning:`, `> info:`, `> mermaid:`.
- **Inline format toolbar** floating on text selection: B / I / Code / Link.
- **Chapter-aware**: receives `(blogSlug, chapterSlug)` props; a new chapter
  pre-fills reviewers from the last-reviewed chapter in the blog.
- **Block gutter** (add / drag handles) lives in a fixed-width left rail so the
  hover target doesn't jump under the cursor.

> The old always-on `MetaBar` and small `SubmitModal` were replaced by the
> three pieces above. `MetaBar` still exists in `Editor3.jsx` as dead code
> behind the live path — safe to delete on a future pass.

---

## 6. Mobile breakpoints

- `< md (768px)`: single-column ReviewPage with tabs Статья/Обсуждения, bottom action bar, chapter strip scrolls horizontally
- `md..lg`: 2-column ReviewPage (article + threads), no chapter list rail in BlogReader
- `≥ lg (1024px)`: full layout with team panel, in-chapter ToC, chapter list rail

Hit targets ≥ 36/44px throughout. Filter chips and chapter strips use `overflow-x-auto` with hidden scrollbar.

---

## 7. Inlining model

`ui_kits/blog/index.html` is the canonical artifact. Each source `.jsx` /
`.js` file is inlined as a `<script>` block with a marker comment:

```html
<!-- Foo.jsx (inlined from ui_kits/blog/Foo.jsx) -->
<script type="text/babel">
…
</script>
```

The marker is the contract — re-syncing source → inline happens by
finding the marker and replacing the next `<script>…</script>` body.
Babel transpiles in-browser; no build step.

**Each babel block has its own scope** at the source level, but Babel-standalone
transpiles each block to ES5 (`const`/`let` → `var`, top-level `function`
declarations) so names land on the **global object**. Practically: every
top-level `function`/`const` is reachable from sibling blocks by bare name,
and the **last block to load wins** for any duplicated name. Components are
still exposed deliberately via `window.Foo = Foo` / `Object.assign(window,
{ Foo, Bar })` so the contract is explicit.

**Canonical names (post-refactor).** The old “V1 defines → later block sets
`window.X = XV2`” duplication has been collapsed. Each live screen is now
defined once under its canonical name and the retired v1 blocks are gone:

| Removed / merged | Lives now in |
|---|---|
| `Author.jsx` (v1 portal + legacy editor) | `Author-v2.jsx` (`AuthorPortal`); `ReviewStatusPill` + RU helpers moved to `Components.jsx` |
| `Editor.jsx` (helpers/`Editable`/`InlineToolbar`/`SlashMenu`) | merged into `Editor2.jsx`; main screen is `Editor3.jsx` (`EditorScreen`) |
| `ArticleCard.jsx` (unused) | index uses `BlogIndexCard` (`Index-v2.jsx`) |
| dead `HomeScreen`/`ArticleIndexScreen`/`ProfileScreen` in `Screens.jsx` | `Index-v2.jsx` (now defines them under canonical names; `Screens.jsx` keeps only `LoginScreen`) |
| dead `AdminReview`/`ReviewQueueRow` in `admin-screens.jsx` | `Admin-v3.jsx` (`AdminReview` + `ChapterQueueRow`) |

**Cross-block dependencies are real — grep before deleting.** The active
ReviewPage (Concept C, `Review-v2*.jsx`) self-hosts `diffWords` and
`PrimaryChangeModal`. `window.__blogData` is built in two layers
(`ReviewData.js` base + `blogs-data.js` extension) — see §2; the base is NOT
dead even though `blogs-data.js` looks authoritative. Before deleting any
block, grep the whole tree for every name in its closing
`Object.assign(window, …)` / `window.X = …` — a later block may borrow a
global (or extend an object) from an otherwise-quiet one.

---

## 8. Migration sketch (FAKE_DATA → real DB)

```sql
-- Drizzle / Postgres pseudocode

CREATE TABLE blogs (
  id        TEXT PRIMARY KEY,
  slug      TEXT UNIQUE NOT NULL,
  title     TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id),
  cover_url TEXT,
  tags      TEXT[],
  complexity TEXT CHECK (complexity IN ('simple','medium','complex')),
  summary   TEXT,
  published_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ
);

CREATE TABLE chapters (
  id        TEXT PRIMARY KEY,
  blog_id   TEXT NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  slug      TEXT NOT NULL,
  title     TEXT NOT NULL,
  "order"   INT NOT NULL,
  primary_handle TEXT REFERENCES users(handle),
  UNIQUE (blog_id, slug)
);

CREATE TABLE chapter_revisions (
  id          TEXT PRIMARY KEY,
  chapter_id  TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  number      INT NOT NULL,
  status      TEXT CHECK (status IN ('draft','under-review','changes-requested','published')),
  summary     TEXT,
  blocks      JSONB,           -- current content
  prev_blocks JSONB,           -- snapshot of last published revision
  submitted_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  deadline    TIMESTAMPTZ,
  UNIQUE (chapter_id, number)
);

CREATE TABLE chapter_reviewers (
  chapter_id  TEXT NOT NULL REFERENCES chapters(id),
  handle      TEXT NOT NULL REFERENCES users(handle),
  verdict     TEXT CHECK (verdict IN ('approve','request-changes')),
  verdict_at  TIMESTAMPTZ,
  PRIMARY KEY (chapter_id, handle)
);

CREATE TABLE threads (
  id          TEXT PRIMARY KEY,
  chapter_id  TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  block_id    TEXT NOT NULL,
  anchor      TEXT NOT NULL,
  status      TEXT CHECK (status IN ('open','resolved')) DEFAULT 'open',
  from_handle TEXT NOT NULL REFERENCES users(handle),
  text        TEXT NOT NULL,
  suggestion  JSONB,            -- { from, to } or null
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE thread_replies (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  from_handle TEXT NOT NULL REFERENCES users(handle),
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE follows (
  user_handle TEXT NOT NULL REFERENCES users(handle),
  blog_id     TEXT NOT NULL REFERENCES blogs(id),
  PRIMARY KEY (user_handle, blog_id)
);
```

---

## 9. Known gaps for production

| # | Gap | Mitigation in prototype |
|---|---|---|
| 1 | Mermaid is a hand-drawn SVG placeholder | Wire mermaid-js in production |
| 2 | LaTeX block has no rendered preview | Wire KaTeX |
| 3 | Image / embed blocks don't actually upload | Local file-input + S3 in prod |
| 4 | `__reviewStore` is in-memory only | Move to server-side w/ websocket |
| 5 | Presence + typing are fake | Real-time via `state.online` + ws |
| 6 | Auth is hardcoded demo accounts | Replace LoginScreen with iron-session flow |
| 7 | `chapter.publishedAt` not tracked per-revision | Add `chapter_revisions.published_at` |
| 8 | Admin force-approve doesn't notify author | Add notification table + email |

---

## 10. Accessibility status

- Chapter strip in ReviewHeaderV2 uses `role="tablist"` + `role="tab"` + `aria-selected`
- Toast notifications use `role="status"` + `aria-live="polite"`
- Long titles use `title=` attribute for native tooltip on hover
- All actionable elements ≥ 36px (≥ 44px on key flows)
- Color is not the only signifier — every status pill has text label
- Focus rings are CSS `outline` (preserved by browser defaults)

**Outstanding**:
- Focus management on chapter switch (auto-focus h1 of new chapter)
- Skip-to-content link visible on focus
- High-contrast mode review
- Keyboard-only navigation through baubles and threads
