// P11.2 — Public index from blogs.
// Overrides window.ArticleIndexScreen to render FAKE_DATA.blogs instead of
// articles[]. Every blog card shows its chapter count (no "series" concept).

const { useState, useMemo, useRef, useEffect } = React;

function readingTimeForBlog(blog) {
  const D = window.__blogData;
  const words = (blog.chapters || []).filter(c => D.isChapterPublished(c))
    .reduce((n, c) => n + (c.blocks || []).reduce((m, b) => m + (b.text || "").split(/\s+/).filter(Boolean).length, 0), 0);
  return Math.max(1, Math.round(words / 200));
}

function ArticleIndexScreen({ session, onOpenArticle, onOpenProfile, onLoginRequired }) {
  const D = window.__blogData;
  const allBlogs = D.getBlogs();
  const users = window.FAKE_DATA.users || {};
  // Show blogs that have at least one published chapter.
  const publicBlogs = allBlogs
    .filter(b => (b.chapters || []).some(c => D.isChapterPublished(c)))
    .filter(b => session?.role === "author" ? b.authorSlug === session.handle : true)
    .sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);
  useEffect(() => {
    if (!sortOpen) return;
    const onDoc = (e) => { if (!sortRef.current?.contains(e.target)) setSortOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [sortOpen]);

  const seriesCount = publicBlogs.filter(b => b.chapters.length > 1).length;

  const visible = publicBlogs.filter(b => {
    // Query filter — match title / summary / chapter titles / author
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const author = users[b.authorSlug] || {};
      const inTitle   = b.title?.toLowerCase().includes(q);
      const inSummary = b.summary?.toLowerCase().includes(q);
      const inChapter = (b.chapters || []).some(c => c.title?.toLowerCase().includes(q));
      const inAuthor  = author.name?.toLowerCase().includes(q) || b.authorSlug?.toLowerCase().includes(q);
      if (!inTitle && !inSummary && !inChapter && !inAuthor) return false;
    }
    return true;
  });

  // Sort the filtered set.
  const sortFns = {
    recent:  (a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0),
    popular: (a, b) => (b.viewCount || 0) - (a.viewCount || 0),
    title:   (a, b) => (a.title || "").localeCompare(b.title || "", "ru"),
  };
  const sorted = [...visible].sort(sortFns[sort] || sortFns.recent);

  const SORT_OPTS = [
    { id: "recent",  label: "Сначала свежие" },
    { id: "popular", label: "Популярные" },
    { id: "title",   label: "По алфавиту" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16" data-screen-label="ArticleIndex">
      <h1 className="font-[var(--font-display)] font-extrabold text-4xl md:text-5xl tracking-tight mb-3">
        Все блоги
      </h1>
      <p className="text-[var(--muted-foreground)] mb-6">
        {publicBlogs.length} {publicBlogs.length === 1 ? "публикация" : publicBlogs.length < 5 ? "публикации" : "публикаций"}
      </p>

      {/* ── Controls: search + compact sort ── */}
      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию, описанию, главам, автору…"
            className="block w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg pl-10 pr-9 py-2.5 text-[14px] focus:outline-none focus:border-[var(--accent)] focus:bg-[var(--background)] transition-colors min-h-[44px]"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Очистить поиск" className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] text-[17px] leading-none">×</button>
          )}
        </div>

        {/* Compact sort — icon button + popover */}
        <div className="relative shrink-0" ref={sortRef}>
          <button
            type="button"
            onClick={() => setSortOpen(o => !o)}
            aria-label="Сортировка"
            aria-expanded={sortOpen}
            title={`Сортировка: ${SORT_OPTS.find(o => o.id === sort)?.label}`}
            className={`w-11 h-11 flex items-center justify-center rounded-lg border transition-colors ${sortOpen ? "border-[var(--accent)] text-[var(--foreground)]" : "border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="14" y2="6"/><line x1="4" y1="12" x2="11" y2="12"/><line x1="4" y1="18" x2="8" y2="18"/><polyline points="17 8 20 5 23 8"/><line x1="20" y1="5" x2="20" y2="19"/></svg>
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[180px] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-1 shadow-lg">
              <p className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Сортировка</p>
              {SORT_OPTS.map(o => (
                <button
                  key={o.id}
                  onClick={() => { setSort(o.id); setSortOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-[13px] flex items-center justify-between gap-2 transition-colors ${sort === o.id ? "text-[var(--accent)] font-medium" : "text-[var(--foreground)] hover:bg-[var(--muted)]/50"}`}
                >
                  {o.label}
                  {sort === o.id && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[var(--border)] rounded-lg">
          <p className="text-[14px] text-[var(--foreground)] mb-1">Ничего не нашлось</p>
          <p className="text-[13px] text-[var(--muted-foreground)] mb-4">Попробуйте изменить поисковый запрос.</p>
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-[13px] font-medium text-[var(--accent)] hover:underline underline-offset-2"
            >Очистить поиск</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {sorted.map((b, i) => (
            <BlogIndexCard
              key={b.id}
              blog={b}
              index={i}
              session={session}
              onOpen={onOpenArticle}
              onOpenProfile={onOpenProfile}
              onLoginRequired={onLoginRequired}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Card variant — author-prominent. For public index + reader feed.
// Local reactions-tick (BlogReader defines its own; Index-v2 is inlined earlier
// so we keep an independent copy here).
function useCardReactionsTick() {
  const [, force] = useState(0);
  useEffect(() => {
    const h = () => force(n => n + 1);
    window.addEventListener("devblog:reactions-changed", h);
    return () => window.removeEventListener("devblog:reactions-changed", h);
  }, []);
}
function CardBookmarkChip({ slug, session, onLoginRequired }) {
  useCardReactionsTick();
  const on = window.__reactions?.isBookmarked(slug);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (!session) { onLoginRequired?.(); return; } window.__reactions.setBookmark(slug, !on); }}
      aria-pressed={on}
      title={on ? "Убрать из закладок" : "В закладки"}
      className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-md flex items-center justify-center backdrop-blur-sm border transition-all ${on ? "opacity-100 border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_srgb,var(--bg-elevated)_85%,transparent)]" : "opacity-0 group-hover:opacity-100 border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] bg-[color-mix(in_srgb,var(--bg-elevated)_85%,transparent)]"}`}
    >
      <svg viewBox="0 0 24 24" width="15" height="15" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
    </button>
  );
}

function BlogIndexCard({ blog, index, session, onOpen, onOpenProfile, onLoginRequired }) {
  useCardReactionsTick();
  const D = window.__blogData;
  const publishedCount = (blog.chapters || []).filter(c => D.isChapterPublished(c)).length;
  const isSeries = (blog.chapters || []).length > 1;
  const users = window.FAKE_DATA.users || {};
  const author = users[blog.authorSlug];
  const tags = Array.isArray(blog.tags) ? blog.tags : (typeof blog.tags === "string" ? blog.tags.split(",").map(t => t.trim()).filter(Boolean) : []);
  return (
    <article
      className="animate-in group relative flex flex-col rounded-lg border border-[var(--border)] hover:border-[color-mix(in_srgb,var(--foreground)_15%,transparent)] hover:-translate-y-0.5 transition-all duration-200 overflow-hidden bg-[var(--bg-elevated)]"
      style={{ "--index": index }}
    >
      {/* Cover (no overlay badge — series info lives in the meta row instead) */}
      <button
        type="button"
        onClick={() => onOpen?.(blog.slug)}
        className="relative aspect-video w-full overflow-hidden text-left"
      >
        {window.CoverPlaceholder && <window.CoverPlaceholder seed={blog.slug} className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.02]" />}
      </button>

      {/* Bookmark chip — top-right, appears on hover (or stays if saved) */}
      {window.__reactions && (
        <CardBookmarkChip slug={blog.slug} session={session} onLoginRequired={onLoginRequired} />
      )}

      <div className="p-5 flex flex-col flex-1">
        {/* Eyebrow row — chapter count, shown for every blog */}
        <p className="text-[10.5px] uppercase tracking-wider font-bold text-[var(--accent)] mb-1.5 inline-flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          {publishedCount} {publishedCount === 1 ? "глава" : publishedCount < 5 ? "главы" : "глав"}
        </p>
        <button type="button" onClick={() => onOpen?.(blog.slug)} className="text-left">
          <h3 className="font-[var(--font-display)] font-semibold text-[19px] leading-snug mb-2 group-hover:text-[var(--accent)] transition-colors title-clamp-2" title={blog.title}>
            {blog.title}
          </h3>
        </button>

        {blog.summary && (
          <p className="text-[var(--muted-foreground)] text-sm title-clamp-3 mb-3 leading-relaxed">
            {blog.summary}
          </p>
        )}

        <div className="flex-1" />

        {/* Author lock-up — clickable to open profile */}
        {author && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenProfile?.(author.handle); }}
            className="flex items-center gap-2 mt-2 -ml-1 px-1 py-1 rounded hover:bg-[var(--muted)]/40 transition-colors group/auth"
          >
            <span className="w-6 h-6 rounded-full bg-[var(--muted)] inline-flex items-center justify-center text-[11px] uppercase font-semibold text-[var(--muted-foreground)] shrink-0">
              {author.name?.slice(0, 1)}
            </span>
            <span className="text-[13px] text-[var(--foreground)] group-hover/auth:text-[var(--accent)] transition-colors truncate">{author.name}</span>
            <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums shrink-0">
              · {blog.publishedAt ? new Date(blog.publishedAt * 1000).toLocaleDateString("ru-RU", { month: "short", year: "numeric" }) : "—"}
            </span>
          </button>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.slice(0, 4).map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full bg-[var(--muted)] text-[11.5px] text-[var(--muted-foreground)]">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

// ============================================================
// P12.2 — HomeScreen v2: drive from blogs, not articles.
// Override window.HomeScreen at the bottom of this script.
// For readers we already render ReaderFeed inline; for guests we now
// show a series-aware editorial hero + a "Series spotlight" rail.
// ============================================================
function HomeScreen({ session, onOpenArticle, onOpenBlog, onOpenProfile }) {
  const D = window.__blogData;
  const isReader = session?.role === "reader";
  // ReaderFeed is reader-only. App routes guests + other roles to the public
  // catalog (ArticleIndexScreen); this guard makes sure the retired
  // single-author editorial hero can never render.
  if (!isReader) return null;

  // Pick public blogs (have ≥1 published chapter), sorted by lastActivity.
  const publicBlogs = D.getBlogs()
    .filter(b => (b.chapters || []).some(c => D.isChapterPublished(c)))
    .sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));

  // Role separation: an author's public surface is scoped to their OWN blogs —
  // they don't browse or read other authors. Readers and guests see everything.
  const isAuthor = session?.role === "author";
  const scopedBlogs = isAuthor ? publicBlogs.filter(b => b.authorSlug === session.handle) : publicBlogs;

  // Featured = most recent blog overall (multi-chapter preferred if equally recent).
  const featured = scopedBlogs.slice().sort((a, b) => {
    const aSeries = a.chapters.length > 1 ? 1 : 0;
    const bSeries = b.chapters.length > 1 ? 1 : 0;
    if (aSeries !== bSeries) return bSeries - aSeries;
    return (b.lastActivityAt || 0) - (a.lastActivityAt || 0);
  })[0];
  const rest = scopedBlogs.filter(b => b.slug !== featured?.slug);

  if (isReader) {
    const follows = window.__follows?.readFollows?.() || [];
    const followedBlogs = publicBlogs.filter(b => follows.includes(b.slug));
    const otherBlogs = publicBlogs.filter(b => !follows.includes(b.slug));
    // Track follows changes so the feed re-renders.
    const [, force] = React.useReducer(x => x + 1, 0);
    React.useEffect(() => {
      const h = () => force();
      window.addEventListener("devblog:follows-changed", h);
      return () => window.removeEventListener("devblog:follows-changed", h);
    }, []);
    return (
      <div className="max-w-4xl mx-auto px-4" data-screen-label="ReaderFeed">
        <section className="py-12 md:py-16">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-2">
                @{session?.handle || "you"}
              </p>
              <h1 className="font-[var(--font-display)] font-extrabold text-4xl md:text-5xl leading-[1.05] tracking-tight mb-3 title-clamp-2">
                Ваша лента
              </h1>
              <p className="text-[15px] text-[var(--muted-foreground)] max-w-xl leading-relaxed">
                {follows.length > 0
                  ? "Свежие главы из блогов, на которые вы подписаны."
                  : "Подпишитесь на блог, чтобы получать новые главы здесь."}
              </p>
            </div>
            <a href="#" onClick={(e) => { e.preventDefault(); onOpenBlog?.(); }} className="text-[12.5px] text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors shrink-0 min-h-[44px] inline-flex items-center">Все блоги →</a>
          </div>
        </section>
        <hr className="border-[var(--border)]" />
        {followedBlogs.length > 0 && (
          <section className="py-10">
            <h2 className="text-[13px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-4">Подписки</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {followedBlogs.map((b, i) => <BlogIndexCard key={b.id} blog={b} index={i} session={session} onOpen={onOpenArticle} onOpenProfile={onOpenProfile} />)}
            </div>
          </section>
        )}
        {follows.length === 0 && (
          <section className="py-12 text-center">
            <p className="text-[14px] text-[var(--muted-foreground)] mb-4">У вас пока нет подписок.</p>
            <a href="#" onClick={(e) => { e.preventDefault(); onOpenBlog?.(); }} className="text-[var(--accent)] font-medium hover:underline underline-offset-4">Найти блоги в каталоге →</a>
          </section>
        )}
        {otherBlogs.length > 0 && (
          <section className="py-10 border-t border-[var(--border)]">
            <h2 className="text-[13px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-4">{follows.length === 0 ? "Свежее" : "Ещё интересное"}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {otherBlogs.slice(0, 4).map((b, i) => <BlogIndexCard key={b.id} blog={b} index={i} session={session} onOpen={onOpenArticle} onOpenProfile={onOpenProfile} />)}
            </div>
          </section>
        )}
      </div>
    );
  }
}

window.HomeScreen = HomeScreen;
window.ArticleIndexScreen = ArticleIndexScreen;
window.BlogIndexCard = BlogIndexCard;

// ============================================================
// BookmarksScreen — saved blogs grid (A3). Reads __reactions store.
// ============================================================
function BookmarksScreen({ session, onOpenArticle, onOpenProfile, onBack, onLoginRequired }) {
  useCardReactionsTick();
  const D = window.__blogData;
  const saved = (window.__reactions?.readBookmarks() || []);
  const blogs = saved
    .map(slug => D.getBlogBySlug(slug))
    .filter(b => b && (b.chapters || []).some(c => D.isChapterPublished(c)));

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16" data-screen-label="Bookmarks">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-5 min-h-[44px] -ml-1 px-1"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 18 5 12 11 6"/></svg>
        К ленте
      </button>
      <h1 className="font-[var(--font-display)] font-extrabold text-4xl md:text-5xl tracking-tight mb-3">Закладки</h1>
      <p className="text-[var(--muted-foreground)] mb-8">
        {blogs.length === 0 ? "Здесь появятся сохранённые публикации." : `${blogs.length} ${blogs.length === 1 ? "сохранённая публикация" : blogs.length < 5 ? "сохранённые публикации" : "сохранённых публикаций"}`}
      </p>

      {blogs.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[var(--border)] rounded-lg">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-[var(--muted-foreground)] opacity-50"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          <p className="text-[14px] text-[var(--foreground)] mb-1">Пока пусто</p>
          <p className="text-[13px] text-[var(--muted-foreground)] mb-4">Нажмите на иконку закладки на любой публикации, чтобы сохранить её сюда.</p>
          <button onClick={onBack} className="text-[13px] font-medium text-[var(--accent)] hover:underline underline-offset-2">Перейти к ленте →</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {blogs.map((b, i) => (
            <BlogIndexCard key={b.id} blog={b} index={i} session={session} onOpen={onOpenArticle} onOpenProfile={onOpenProfile} onLoginRequired={onLoginRequired} />
          ))}
        </div>
      )}
    </div>
  );
}
window.BookmarksScreen = BookmarksScreen;

// ============================================================
// ProfileScreen v2 — public author profile.
// Shows the author's blogs as cards (with chapter dots / summary /
// click-through to BlogReader). Each card opens the blog reader.
// ============================================================
function ProfileScreen({ handle, session, onOpenArticle, onBack, onNavigate, onOpenLogin, onOpenProfile, onOpenPortfolioEditor }) {
  const D = window.__blogData;
  const users = window.FAKE_DATA.users || {};
  const user = users[handle] || users.alex;
  const isMe = session?.handle === user.handle;
  const [editingProfile, setEditingProfile] = React.useState(false);
  const [profileTab, setProfileTab] = React.useState(null); // "about" | "blogs" | null(=auto)
  const [, forceProfileTick] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const h = () => forceProfileTick();
    window.addEventListener("devblog:profile-changed", h);
    window.addEventListener("devblog:portfolio-changed", h);
    return () => {
      window.removeEventListener("devblog:profile-changed", h);
      window.removeEventListener("devblog:portfolio-changed", h);
    };
  }, []);
  // Author's blogs — for non-authors return empty (we still render the header).
  const blogs = (D.getBlogs() || [])
    .filter(b => b.authorSlug === user.handle)
    .filter(b => isMe || (b.chapters || []).some(c => D.isChapterPublished(c)))
    .sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));

  // Profile stats.
  const publishedChapters = blogs.reduce((n, b) => n + (b.chapters || []).filter(c => D.isChapterPublished(c)).length, 0);
  const totalViews = blogs.reduce((n, b) => n + (b.viewCount || 0), 0);
  const totalBookmarks = blogs.reduce((n, b) => n + (b.bookmarkCount || 0), 0);
  const memberSince = user.joinedAt ? new Date(user.joinedAt * 1000).toLocaleDateString("ru-RU", { month: "long", year: "numeric" }) : null;
  const roleLabel = { author: "Автор", reviewer: "Ревьюер", admin: "Администратор", reader: "Читатель" }[user.role] || null;
  const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "") + "k" : String(n);
  const isAuthorProfile = user.role === "author" || blogs.length > 0;

  // Role-scoped sections (Фаза E):
  //   • reviewer → public list of chapters they reviewed (no verdicts);
  //   • reader (own profile) → «Полка» of followed blogs.
  const reviewed = user.role === "reviewer" ? (D.getReviewedChapters?.(user.handle) || []) : [];
  const shelfFollows = (isMe && user.role === "reader") ? (window.__follows?.readFollows?.() || []) : [];
  const shelfBlogs = shelfFollows
    .map(s => D.getBlogBySlug(s))
    .filter(b => b && (b.chapters || []).some(c => D.isChapterPublished(c)))
    .sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
  const links = user.links || {};
  const linkDefs = [
    links.github && { href: links.github, label: "GitHub", icon: <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /> },
    links.telegram && { href: links.telegram, label: "Telegram", icon: <path d="M21.5 4.5 2.5 12.5l5.5 1.5m13-9.5-3 15-7-5.5m10-9.5-10 9.5m0 0L8 20.5l1-6.5" /> },
    links.website && { href: links.website, label: "Сайт", icon: <><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" /></> },
  ].filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:py-12" data-screen-label="Profile">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-6 min-h-[44px] -ml-1 px-1"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 18 5 12 11 6"/></svg>
        Назад
      </button>

      <header className="relative mb-8 sm:mb-10 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 sm:p-7">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-4 sm:gap-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] overflow-hidden inline-flex items-center justify-center text-[30px] sm:text-[34px] font-semibold text-[var(--muted-foreground)] uppercase shrink-0 font-[var(--font-display)]">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : user.name?.slice(0, 1)}
          </div>
          <div className="min-w-0 w-full">
            <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap mb-1 sm:pr-40">
              <h1 className="font-[var(--font-display)] font-extrabold text-[26px] sm:text-4xl tracking-tight title-clamp-2 leading-[1.1]">{user.name}</h1>
              {roleLabel && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10.5px] uppercase tracking-wider font-semibold bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)]">
                  {roleLabel}
                </span>
              )}
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-[12.5px] text-[var(--muted-foreground)] mb-3 flex-wrap">
              <span className="font-mono">@{user.handle}</span>
              {memberSince && <><span>·</span><span>на платформе с {memberSince}</span></>}
            </div>
            {user.bio && !isAuthorProfile && (
              <p className="text-[14.5px] text-[var(--foreground)] max-w-xl mx-auto sm:mx-0 leading-relaxed mb-4">{user.bio}</p>
            )}

            {/* Social links */}
            {linkDefs.length > 0 && (
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-5">
                {linkDefs.map(l => (
                  <a
                    key={l.label}
                    href={l.href}
                    onClick={(e) => e.preventDefault()}
                    title={l.label}
                    aria-label={l.label}
                    className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] transition-colors"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{l.icon}</svg>
                  </a>
                ))}
              </div>
            )}

            {/* Stat row — bordered cells on mobile (2-col grid), inline with
                hairline dividers on sm+. Stats differ by role. */}
            {isAuthorProfile ? (
              <dl className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:gap-x-7 sm:gap-y-3">
                {[
                  { k: blogs.length === 1 ? "Блог" : "Блогов", v: blogs.length },
                  { k: "Глав",        v: publishedChapters },
                  { k: "Просмотров",  v: fmt(totalViews) },
                  { k: "В закладках", v: fmt(totalBookmarks) },
                ].map((s, i) => (
                  <div
                    key={s.k}
                    className={`rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-left sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 ${i > 0 ? "sm:border-l sm:border-[var(--border)] sm:pl-7" : ""}`}
                  >
                    <dt className="text-[10.5px] uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">{s.k}</dt>
                    <dd className="text-[20px] sm:text-[19px] font-semibold tabular-nums text-[var(--foreground)] font-[var(--font-display)]">{s.v}</dd>
                  </div>
                ))}
              </dl>
            ) : user.role === "reviewer" ? (
              <dl className="flex flex-wrap gap-x-7 gap-y-3">
                <div>
                  <dt className="text-[10.5px] uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">Отрецензировано</dt>
                  <dd className="text-[19px] font-semibold tabular-nums text-[var(--foreground)] font-[var(--font-display)]">{reviewed.length}</dd>
                </div>
              </dl>
            ) : (isMe && user.role === "reader") ? (
              <dl className="flex flex-wrap gap-x-7 gap-y-3">
                <div>
                  <dt className="text-[10.5px] uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">В полке</dt>
                  <dd className="text-[19px] font-semibold tabular-nums text-[var(--foreground)] font-[var(--font-display)]">{shelfBlogs.length}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-[13px] text-[var(--muted-foreground)]">Читатель блога.</p>
            )}
          </div>
        </div>
        {isMe && (
          <button
            onClick={() => setEditingProfile(true)}
            className="mt-5 w-full justify-center min-h-[44px] sm:mt-0 sm:w-auto sm:min-h-0 sm:absolute sm:top-7 sm:right-7 inline-flex items-center gap-1.5 text-[13px] sm:text-[12.5px] font-medium px-3 py-2 sm:py-1 rounded-lg sm:rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] sm:bg-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] transition-colors"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            Изменить профиль
          </button>
        )}
      </header>

      {user.role === "reviewer" ? (
        <>
          <h2 className="text-[13px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-4">
            Отрецензированные статьи
          </h2>
          {reviewed.length === 0 ? (
            <p className="text-[14px] text-[var(--muted-foreground)] py-12 text-center border border-dashed border-[var(--border)] rounded-lg">
              Пока нет завершённых ревью.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {reviewed.map((r) => (
                <li key={r.blogSlug + "#" + r.chapterSlug}>
                  <button
                    onClick={() => onOpenArticle?.(r.blogSlug)}
                    className="w-full text-left rounded-lg border border-[var(--border)] hover:border-[var(--foreground)]/20 transition-colors p-4 bg-[var(--bg-elevated)]"
                  >
                    {r.isSeries && (
                      <p className="text-[11px] text-[var(--muted-foreground)] mb-1 title-clamp-1">{r.blogTitle}</p>
                    )}
                    <p className="font-[var(--font-display)] font-semibold text-[15.5px] leading-snug title-clamp-2 mb-1.5" title={r.chapterTitle}>{r.chapterTitle}</p>
                    <p className="text-[12px] text-[var(--muted-foreground)]">
                      ревьюил{r.publishedAt ? " · " + new Date(r.publishedAt * 1000).toLocaleDateString("ru-RU", { month: "long", year: "numeric" }) : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (isMe && user.role === "reader") ? (
        <>
          <h2 className="text-[13px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-4">
            Полка
          </h2>
          {shelfBlogs.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-[var(--border)] rounded-lg">
              <p className="text-[14px] text-[var(--foreground)] mb-1">Полка пуста</p>
              <p className="text-[13px] text-[var(--muted-foreground)] mb-4">Подпишитесь на блог, и он появится здесь.</p>
              <button onClick={() => (onNavigate ? onNavigate("blog") : onOpenArticle?.())} className="text-[13px] font-medium text-[var(--accent)] hover:underline underline-offset-2">К ленте →</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {shelfBlogs.map((b, i) => (
                <BlogIndexCard key={b.id} blog={b} index={i} session={session} onOpen={onOpenArticle} onOpenProfile={onOpenProfile} />
              ))}
            </div>
          )}
        </>
      ) : isAuthorProfile ? (
        (() => {
          const portfolio = window.__portfolio?.get(user.handle);
          const portfolioVisible = window.__portfolio?.isVisible(user.handle);
          const hasReadablePortfolio = portfolio && portfolioVisible;
          const showTabs = isMe || hasReadablePortfolio;
          const activeTab = profileTab || (showTabs ? "about" : "blogs");

          const blogsView = (() => {
            const pinnedSlug = window.__pins?.get(user.handle);
            const pinned = pinnedSlug ? blogs.find(b => b.slug === pinnedSlug) : null;
            const rest = pinned ? blogs.filter(b => b.slug !== pinnedSlug) : blogs;
            return (
              <>
                {pinned && (
                  <section className="mb-8">
                    <h2 className="flex items-center gap-1.5 text-[13px] uppercase tracking-wider font-semibold text-[var(--accent)] mb-4">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.4-4.2a2 2 0 0 1-.1-.6V5a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2v7.2a2 2 0 0 1-.1.6z"/></svg>
                      {isMe ? "Закреплённый блог" : "Рекомендует автор"}
                    </h2>
                    <BlogIndexCard blog={pinned} index={0} session={session} onOpen={onOpenArticle} onOpenProfile={onOpenProfile} />
                  </section>
                )}
                {!showTabs && (
                  <h2 className="text-[13px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-4">
                    {pinned ? "Остальные блоги" : (isMe ? "Мои блоги" : "Блоги автора")}
                  </h2>
                )}
                {pinned && showTabs && (
                  <h2 className="text-[13px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-4">Остальные блоги</h2>
                )}
                {rest.length === 0 ? (
                  <p className="text-[14px] text-[var(--muted-foreground)] py-12 text-center border border-dashed border-[var(--border)] rounded-lg">
                    {pinned ? "Других блогов пока нет." : (isMe ? "У вас пока нет блогов." : "У этого пользователя пока нет публичных блогов.")}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {rest.map((b, i) => (
                      <BlogIndexCard key={b.id} blog={b} index={i} session={session} onOpen={onOpenArticle} onOpenProfile={onOpenProfile} />
                    ))}
                  </div>
                )}
              </>
            );
          })();

          // No tabs (visitor, no readable portfolio) → blogs only, as before.
          if (!showTabs) return <div>{blogsView}</div>;

          return (
            <div>
              {/* Tab bar — «Об авторе · Блоги» */}
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] mb-7">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setProfileTab("about")}
                    className={`relative px-1 pb-2.5 text-[14px] min-h-[40px] whitespace-nowrap transition-colors ${activeTab === "about" ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                  >
                    Об авторе
                    {activeTab === "about" && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[var(--accent)]" />}
                  </button>
                  <button
                    onClick={() => setProfileTab("blogs")}
                    className={`relative px-3 pb-2.5 text-[14px] min-h-[40px] whitespace-nowrap transition-colors ${activeTab === "blogs" ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                  >
                    Блоги <span className="text-[12px] opacity-70 tabular-nums">{blogs.length}</span>
                    {activeTab === "blogs" && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[var(--accent)]" />}
                  </button>
                </div>
                {isMe && activeTab === "about" && portfolio && (
                  <div className="flex items-center gap-2 pb-2 shrink-0">
                    <button
                      onClick={() => window.__portfolio.setVisible(user.handle, !portfolioVisible)}
                      className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-full border transition-colors ${portfolioVisible ? "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]" : "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]"}`}
                      title={portfolioVisible ? "Видно всем — нажмите, чтобы скрыть" : "Скрыто — нажмите, чтобы показать"}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        {portfolioVisible
                          ? <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></>
                          : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>}
                      </svg>
                      {portfolioVisible ? "Видно всем" : "Скрыто"}
                    </button>
                    <button
                      onClick={() => onOpenPortfolioEditor?.()}
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-md border border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] transition-colors"
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                      Изменить
                    </button>
                  </div>
                )}
              </div>

              {activeTab === "blogs" ? blogsView : (
                portfolio ? (
                  <article className="max-w-2xl">
                    {isMe && !portfolioVisible && (
                      <div className="mb-5 flex items-center gap-2 text-[12.5px] text-[var(--muted-foreground)] rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        Этот раздел скрыт от читателей. Его видите только вы.
                      </div>
                    )}
                    {portfolio.title && (
                      <h2 className="font-[var(--font-display)] font-extrabold text-[28px] tracking-tight leading-[1.15] mb-5">{portfolio.title}</h2>
                    )}
                    {(portfolio.blocks || []).map(b => <ReaderBlock key={b.id} block={b} />)}
                  </article>
                ) : (
                  /* Owner, no portfolio yet — create state */
                  <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] p-8 sm:p-10 text-center max-w-2xl mx-auto">
                    <span className="w-12 h-12 rounded-xl bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)] inline-flex items-center justify-center mb-3">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    </span>
                    <h3 className="font-[var(--font-display)] font-bold text-[19px] mb-1.5">Расскажите о себе</h3>
                    <p className="text-[13.5px] text-[var(--muted-foreground)] max-w-md mx-auto mb-5 leading-relaxed">
                      «Об авторе» — расширенная страница о вас: открывается как статья, но публикуется сразу, без ревью. У автора она одна.
                    </p>
                    <button
                      onClick={() => onOpenPortfolioEditor?.()}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium px-4 py-2.5 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity min-h-[44px]"
                    >
                      ＋ Создать «Об авторе»
                    </button>
                  </div>
                )
              )}
            </div>
          );
        })()
      ) : null}

      {editingProfile && (
        <ProfileEditModal user={user} onClose={() => setEditingProfile(false)} />
      )}
    </div>
  );
}

// ============================================================
// ProfileEditModal — edit own profile (name / bio / links). Persists via
// window.__profiles (in-memory + localStorage), broadcasts a change event.
// ============================================================
function ProfileEditModal({ user, onClose }) {
  const [name, setName] = React.useState(user.name || "");
  const [bio, setBio] = React.useState(user.bio || "");
  const [github, setGithub] = React.useState(user.links?.github || "");
  const [telegram, setTelegram] = React.useState(user.links?.telegram || "");
  const [website, setWebsite] = React.useState(user.links?.website || "");
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const save = () => {
    window.__profiles?.save(user.handle, {
      name: name.trim() || user.name,
      bio: bio.trim(),
      links: { github: github.trim(), telegram: telegram.trim(), website: website.trim() },
    });
    onClose();
  };
  const field = "w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:border-[var(--accent)] transition-colors";
  const label = "block text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} style={{ boxShadow: "0 16px 40px rgba(0,0,0,0.2)" }}>
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] sticky top-0 bg-[var(--background)]">
          <h2 className="font-[var(--font-display)] font-bold text-[18px] tracking-tight">Редактировать профиль</h2>
          <button onClick={onClose} className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors" aria-label="Закрыть">×</button>
        </header>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className={label} htmlFor="pe-name">Имя</label>
            <input id="pe-name" className={field} value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя" />
          </div>
          <div>
            <label className={label} htmlFor="pe-bio">О себе</label>
            <textarea id="pe-bio" rows={3} className={`${field} resize-none leading-relaxed`} value={bio} onChange={e => setBio(e.target.value)} placeholder="Коротко о себе" />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={label} htmlFor="pe-gh">GitHub</label>
              <input id="pe-gh" className={field} value={github} onChange={e => setGithub(e.target.value)} placeholder="https://github.com/…" />
            </div>
            <div>
              <label className={label} htmlFor="pe-tg">Telegram</label>
              <input id="pe-tg" className={field} value={telegram} onChange={e => setTelegram(e.target.value)} placeholder="https://t.me/…" />
            </div>
            <div>
              <label className={label} htmlFor="pe-web">Сайт</label>
              <input id="pe-web" className={field} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://…" />
            </div>
          </div>
        </div>
        <footer className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--border)] sticky bottom-0 bg-[var(--background)]">
          <button onClick={onClose} className="px-3.5 py-2 rounded-md text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">Отмена</button>
          <button onClick={save} className="px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] text-[13px] font-medium hover:opacity-90 transition-opacity">Сохранить</button>
        </footer>
      </div>
    </div>
  );
}

