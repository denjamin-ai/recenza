// Root App — routes between screens with simple in-memory state.
// Provides theme + session + navigation to every screen.
const { useState, useEffect, useRef } = React;
// ─────────────────────────────────────────────────────────────────
// KitTweaksPanel — host-protocol Tweaks panel for the blog kit.
// The in-page header has its own light/dark switcher; this panel
// is the *kit-wide* control surface (theme, sample author, demo POV)
// that the host's "Tweaks" toolbar toggle reveals.
// ─────────────────────────────────────────────────────────────────
const KIT_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "demoRole": "alex",
  "showAdminBadges": true
}/*EDITMODE-END*/;

// ─────────────────────────────────────────────────────────────────
// MobilePreviewOverlay — renders the SAME page inside a device-sized
// iframe so Tailwind's sm:/lg: breakpoints resolve at the device's
// real viewport width (a shrunk container would NOT trigger them).
// Auto-scales the bezel to fit the available viewport.
// ─────────────────────────────────────────────────────────────────
const PREVIEW_DEVICES = {
  iphone:  { label: "iPhone 14",  w: 390, h: 844,  bezel: 14, radius: 46, notch: true },
  android: { label: "Pixel 7",    w: 412, h: 915,  bezel: 13, radius: 34, notch: false },
  tablet:  { label: "iPad mini",  w: 768, h: 1024, bezel: 18, radius: 30, notch: false },
};

function MobilePreviewOverlay({ device, setDevice, onClose }) {
  const d = PREVIEW_DEVICES[device] || PREVIEW_DEVICES.iphone;
  const outerW = d.w + d.bezel * 2;
  const outerH = d.h + d.bezel * 2;
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const recompute = () => {
      const availH = window.innerHeight - 132; // top bar + margins
      const availW = window.innerWidth - 48;
      setScale(Math.min(1, availH / outerH, availW / outerW));
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [outerW, outerH]);

  // Esc closes.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const src = `${location.pathname}?preview=mobile`;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center" style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(3px)" }}>
      {/* Top control bar */}
      <div className="w-full flex items-center justify-center gap-3 px-4 py-3 shrink-0">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-white/15 bg-white/10 p-0.5 backdrop-blur-sm">
          {Object.entries(PREVIEW_DEVICES).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setDevice(k)}
              className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors min-h-[34px] ${device === k ? "bg-white text-black" : "text-white/80 hover:text-white"}`}
            >{v.label}</button>
          ))}
        </div>
        <span className="text-[12px] tabular-nums text-white/55 hidden sm:inline">{d.w} × {d.h}</span>
        <button
          onClick={onClose}
          className="ml-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium text-white/85 border border-white/15 bg-white/10 hover:bg-white/20 transition-colors min-h-[34px]"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Закрыть
        </button>
      </div>

      {/* Scaled device frame */}
      <div className="flex-1 min-h-0 flex items-center justify-center pb-4" onClick={onClose}>
        <div style={{ width: outerW * scale, height: outerH * scale }} onClick={(e) => e.stopPropagation()}>
          <div
            style={{
              width: outerW, height: outerH, transform: `scale(${scale})`, transformOrigin: "top left",
              background: "#0a0a0a", borderRadius: d.radius, padding: d.bezel,
              boxShadow: "0 24px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
              position: "relative",
            }}
          >
            <iframe
              key={device}
              src={src}
              title={`Превью — ${d.label}`}
              style={{ width: d.w, height: d.h, border: "none", borderRadius: Math.max(8, d.radius - d.bezel), background: "#fff", display: "block" }}
            />
            {d.notch && (
              <div style={{ position: "absolute", top: d.bezel + 9, left: "50%", transform: "translateX(-50%)", width: 116, height: 30, background: "#0a0a0a", borderRadius: 16, pointerEvents: "none" }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KitTweaksPanel({ theme, setTheme }) {
  const [open, setOpen] = useState(false);
  const [tweaks, setTweaksState] = useState(KIT_TWEAK_DEFAULTS);
  const [device, setDevice] = useState(null);

  // Listen for host protocol — keep the listener registered BEFORE
  // we announce ourselves available.
  useEffect(() => {
    const onMsg = (e) => {
      const t = e.data?.type;
      if (t === "__activate_edit_mode")   setOpen(true);
      if (t === "__deactivate_edit_mode") setOpen(false);
    };
    window.addEventListener("message", onMsg);
    window.parent?.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Sync theme ↔ tweaks.theme. A ref tracks the last value we wrote to either side
  // so the effects don't ping-pong on each other's update.
  const lastSyncedRef = useRef(theme);
  useEffect(() => {
    if (tweaks.theme && tweaks.theme !== lastSyncedRef.current) {
      lastSyncedRef.current = tweaks.theme;
      if (tweaks.theme !== theme) setTheme(tweaks.theme);
    }
  }, [tweaks.theme]);
  useEffect(() => {
    if (theme !== lastSyncedRef.current) {
      lastSyncedRef.current = theme;
      if (theme !== tweaks.theme) setTweaksState(t => ({ ...t, theme }));
    }
  }, [theme]);

  const setTweak = (key, value) => {
    const patch = typeof key === "object" ? key : { [key]: value };
    setTweaksState(t => ({ ...t, ...patch }));
    window.parent?.postMessage({ type: "__edit_mode_set_keys", edits: patch }, "*");
  };

  const dismiss = () => {
    setOpen(false);
    window.parent?.postMessage({ type: "__edit_mode_dismissed" }, "*");
  };

  // Device-preview is meaningless inside the preview iframe itself.
  const isPreviewChild = typeof location !== "undefined" && new URLSearchParams(location.search).has("preview");

  const panel = !open ? null : (
    <div className="fixed bottom-5 right-5 z-50 w-[260px] rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl"
         style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.16)" }}>
      <header className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Tweaks</span>
        <button onClick={dismiss} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-[14px] leading-none w-5 h-5 inline-flex items-center justify-center rounded hover:bg-[var(--muted)]" aria-label="Закрыть">×</button>
      </header>
      <div className="p-3 space-y-3.5">
        <div>
          <label className="block text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5">Тема</label>
          <div className="grid grid-cols-2 gap-1 rounded-md border border-[var(--border)] p-0.5 bg-[var(--muted)]/40">
            {[["light", "Светлая"], ["dark", "Тёмная"]].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setTweak("theme", v)}
                className={`text-[12.5px] py-1.5 rounded transition-colors ${tweaks.theme === v ? "bg-[var(--background)] font-medium border border-[var(--border)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
              >{l}</button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5 leading-relaxed">В отличие от переключателя в шапке — тут стейт сохраняется в файл проекта.</p>
        </div>

        {!isPreviewChild && (
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5">Превью устройства</label>
            <div className="grid grid-cols-2 gap-1">
              {[["iphone", "iPhone"], ["android", "Android"], ["tablet", "Планшет"], [null, "Десктоп"]].map(([v, l]) => {
                const on = device === v;
                return (
                  <button
                    key={l}
                    onClick={() => setDevice(v)}
                    className={`text-[12px] py-1.5 rounded border transition-colors ${on ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-[var(--accent)] font-medium" : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                  >{l}</button>
                );
              })}
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5 leading-relaxed">Открывает тот же интерфейс в рамке устройства — медиазапросы резолвятся как на реальном экране.</p>
          </div>
        )}

        <div>
          <label className="block text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5">Стартовый аккаунт</label>
          <select
            value={tweaks.demoRole}
            onChange={(e) => setTweak("demoRole", e.target.value)}
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-md px-2 py-1.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="alex">Автор · @alex</option>
            <option value="dm.k">Ведущий ревьюер · @dm.k</option>
            <option value="kostya">Ревьюер · @kostya</option>
            <option value="moderator">Админ · @moderator</option>
          </select>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5 leading-relaxed">Подсказка для скриншотов: на /login кликните карточку этой роли.</p>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" className="mt-0.5 accent-[var(--accent)]"
            checked={!!tweaks.showAdminBadges}
            onChange={(e) => setTweak("showAdminBadges", e.target.checked)} />
          <span className="text-[12.5px] leading-relaxed">
            Показывать ярлыки ролей <span className="text-[var(--muted-foreground)] block text-[11px]">(админ, ревьюер) рядом с именами в комментах и в журнале</span>
          </span>
        </label>
      </div>
    </div>
  );

  const launcher = (open || isPreviewChild) ? null : (
    <button
      onClick={() => setOpen(true)}
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-[12px] font-medium transition-colors"
      style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.16)" }}
      title="Открыть Tweaks"
      aria-label="Открыть панель Tweaks"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      Tweaks
    </button>
  );

  return (
    <>
      {launcher}
      {panel}
      {!isPreviewChild && device && (
        <MobilePreviewOverlay device={device} setDevice={setDevice} onClose={() => setDevice(null)} />
      )}
    </>
  );
}

function App() {
  const [theme, setThemeRaw] = useState(() => {
    try { return localStorage.getItem("devblog-kit-theme") || "light"; } catch { return "light"; }
  });
  const setTheme = (t) => {
    setThemeRaw(t);
    try { localStorage.setItem("devblog-kit-theme", t); } catch {}
  };
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Role-based home routing. Each role lands in their own portal on login /
  // logo-click / logout. Guest lands on the public feed.
  // One role per account — admin changes roles, see brief.
  const ROLE_HOME = { author: "author", reviewer: "reviewer", admin: "admin", reader: "home" };
  // Guest (no session) → public blog index. Reader → home (ReaderFeed). Others → their portal.
  const roleHomeFor = (s) => s?.role ? (ROLE_HOME[s.role] || "blog") : "blog";
  // Pages that require a session. If saved-page is one of these and we have
  // no session on mount, fall back to "home" instead of showing a broken view.
  const PRIVILEGED = new Set(["author", "admin", "reviewer", "editor", "review"]);

  const [session, setSession] = useState(null);
  const [page, setPage] = useState(() => {
    try {
      const saved = localStorage.getItem("devblog-kit-page");
      // No session yet on first mount → can't enter a privileged route directly.
      // "home" (ReaderFeed) needs a reader session, which we never have on
      // first mount (session is in-memory) — so guests start on the public catalog.
      if (saved && !PRIVILEGED.has(saved) && saved !== "home") return saved;
      return "blog";
    } catch { return "blog"; }
  });
  const [currentSlug, setCurrentSlug] = useState(null);

  // Pending "subscribe after login" intent + a snapshot of where to return.
  const loginReturnRef = useRef(null);
  const pageRef = useRef(page);
  const slugRef = useRef(currentSlug);
  pageRef.current = page;
  slugRef.current = currentSlug;

  const scrollRef = useRef(null);

  const navigate = (p) => {
    setPage(p);
    try { localStorage.setItem("devblog-kit-page", p); } catch {}
  };

  // Reset scroll + move focus into the main region AFTER the new page commits.
  // (Doing it inside navigate's rAF reset the OLD page; scroll-anchoring then
  // restored the prior position once React swapped content in.)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    if (page !== "login") {
      const m = document.getElementById("main-content");
      const heading = m?.querySelector("h1");
      (heading || m)?.focus?.({ preventScroll: true });
    }
  }, [page]);
  // Expose `navigate` on window so the ?smoke=1 harness (and any external
  // tooling) can drive the app. Assigned on every render so it always
  // closes over the latest setPage.
  window.__nav = navigate;

  const openArticle = (slug) => { setCurrentSlug(slug); navigate("article"); };
  const openBlog    = () => navigate("blog");
  const openLogin   = () => navigate("login");
  // "Home" is role-aware now — Reviewer→Inbox, Author→Portal, Admin→Admin,
  // Reader→public feed, Guest→public feed.
  const goHome      = () => navigate(roleHomeFor(session));
  const logout      = () => { setSession(null); navigate(roleHomeFor(null)); };

  const [profileHandle, setProfileHandle] = useState(null);
  const openProfile = (handle) => { setProfileHandle(handle); navigate("profile"); };

  const [reviewSlug, setReviewSlug] = useState(null);
  const [reviewChapterSlug, setReviewChapterSlug] = useState(null);
  const [editorBlogSlug, setEditorBlogSlug] = useState(null);
  const [editorChapterSlug, setEditorChapterSlug] = useState(null);
  const [editorPortfolio, setEditorPortfolio] = useState(false);
  const openEditor = (blogSlug, chapterSlug) => {
    setEditorPortfolio(false);
    setEditorBlogSlug(blogSlug || null);
    setEditorChapterSlug(chapterSlug || null);
    navigate("editor");
  };
  const openPortfolioEditor = () => {
    setEditorPortfolio(true);
    setEditorBlogSlug(null);
    setEditorChapterSlug(null);
    navigate("editor");
  };
  const openAuthorPortal = () => navigate("author");
  const [blogDetailSlug, setBlogDetailSlug] = useState(null);
  const openBlogDetail = (blogSlug) => { setBlogDetailSlug(blogSlug); navigate("blogdetail"); };
  const openReviewerInbox = () => navigate("reviewer");
  // Reviewer Inbox row click → ReviewPage. Pre-set pov hint via a transient flag
  // so ReviewPage opens with the current user's perspective by default.
  const openReviewPage   = (blogSlug, chapterSlug = null, opts = {}) => {
    setReviewSlug(blogSlug);
    setReviewChapterSlug(typeof chapterSlug === "string" ? chapterSlug : null);
    if (opts.povHandle) window.__nextReviewPov = opts.povHandle;
    navigate("review");
  };

  // Listen for global open-profile events (dispatched from comments etc.)
  useEffect(() => {
    const onOpen = (e) => openProfile(e.detail.handle);
    window.addEventListener("blog:open-profile", onOpen);
    return () => window.removeEventListener("blog:open-profile", onOpen);
  }, []);

  // Bridge from AdminReview → ReviewPage
  useEffect(() => {
    const onOpenReview = (e) => { setReviewSlug(e.detail.slug || e.detail.blogSlug); setReviewChapterSlug(e.detail.chapterSlug || null); navigate("review"); };
    window.addEventListener("blog:open-review", onOpenReview);
    return () => window.removeEventListener("blog:open-review", onOpenReview);
  }, []);

  // Guest "subscribe" intent: remember the series + where the guest was, so
  // login can return them here already subscribed.
  useEffect(() => {
    const onIntent = (e) => {
      loginReturnRef.current = {
        kind: e.detail?.kind || "follow",
        blogSlug: e.detail?.blogSlug,
        value: e.detail?.value,
        returnPage: pageRef.current,
        returnSlug: slugRef.current,
      };
    };
    window.addEventListener("devblog:follow-intent", onIntent);
    window.addEventListener("devblog:login-intent", onIntent);
    return () => { window.removeEventListener("devblog:follow-intent", onIntent); window.removeEventListener("devblog:login-intent", onIntent); };
  }, []);

  // Called by LoginScreen on success. Applies a pending follow intent and
  // returns the user to where they were; otherwise routes to role home.
  const completeLogin = (u) => {
    setSession(u);
    const intent = loginReturnRef.current;
    loginReturnRef.current = null;
    if (intent?.blogSlug) {
      // Apply the pending guest action now that we're authenticated.
      const s = intent.blogSlug;
      if (intent.kind === "bookmark")      window.__reactions?.setBookmark(s, true);
      else if (intent.kind === "vote")     window.__reactions?.setVote(s, intent.value || 1);
      else if (intent.kind === "comment")  { /* nothing to apply — form is now usable */ }
      else                                 window.__follows?.setFollow(s, true);
      if (intent.returnSlug) setCurrentSlug(intent.returnSlug);
      navigate(intent.returnPage && intent.returnPage !== "login" ? intent.returnPage : "article");
    } else {
      navigate(roleHomeFor(u));
    }
  };

  // Guide modal — role-aware, shown when the user clicks the BookOpen
  // icon in the nav. Anonymous users see the reader guide.
  const [guideOpen, setGuideOpen] = useState(false);
  const guideRole = session?.role || "reader";

  return (
    <div className="flex flex-col h-full min-h-0" data-screen-label={`Page:${page}`} style={{ ['--kit-density']: 'regular' }}>
      {/* Skip-to-content — visible only on keyboard focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-[var(--accent)] focus:text-[var(--accent-foreground)] focus:text-[13px] focus:font-medium focus:outline-none"
        onClick={(e) => {
          e.preventDefault();
          const m = document.getElementById("main-content");
          if (m) { m.focus(); m.scrollTo?.({ top: 0 }); }
        }}
      >К основному содержимому</a>
      <KitTweaksPanel theme={theme} setTheme={setTheme} />
      <Nav
        theme={theme} setTheme={setTheme}
        session={session}
        currentPage={page}
        onNavigate={(p) => {
          if (p === "blog") navigate("blog");
          else if (p === "home") goHome();
          else if (p === "login") openLogin();
        }}
        onLogout={logout}
        onLogin={openLogin}
        onOpenGuide={() => setGuideOpen(true)}
        onOpenProfile={openProfile}
        onOpenReviewer={openReviewerInbox}
        onOpenAdmin={() => navigate("admin")}
        onOpenAuthor={openAuthorPortal}
        onOpenBookmarks={() => navigate("bookmarks")}
        onOpenNotification={(it) => { if (it?.blogSlug) { if (session?.role === "author" || session?.role === "reviewer") { openReviewPage(it.blogSlug, it.chapterSlug || null, { povHandle: session?.handle }); } else { openArticle(it.blogSlug); } } }}
      />

      <GuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        role={guideRole}
        onCta={() => {
          if (guideRole === "author") navigate("blog");
          else if (guideRole === "reviewer") openReviewerInbox();
        }}
      />

      {/* Scroll container — the real scroller. Nav stays fixed above it;
          all reader/ToC observers + scrollTo target this element. */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto relative">
        {page === "article" && <ScrollProgress targetRef={scrollRef} />}

        <main id="main-content" className="flex-1 focus:outline-none" tabIndex={-1}>
          {page === "home"    && (session?.role === "reader"
            ? <HomeScreen           session={session} onOpenArticle={openArticle} onOpenBlog={openBlog} onOpenProfile={openProfile} />
            : <ArticleIndexScreen   session={session} onOpenArticle={openArticle} onOpenProfile={openProfile} onLoginRequired={openLogin} />)}
          {page === "blog"    && <ArticleIndexScreen   session={session} onOpenArticle={openArticle} onOpenProfile={openProfile} onLoginRequired={openLogin} />}
          {page === "bookmarks" && <BookmarksScreen     session={session} onOpenArticle={openArticle} onOpenProfile={openProfile} onBack={openBlog} onLoginRequired={openLogin} />}
          {page === "article" && <BlogReaderScreen     session={session} slug={currentSlug} scrollRef={scrollRef} onLoginRequired={openLogin} onBack={openBlog} onOpenProfile={openProfile} />}
          {page === "profile" && <ProfileScreen         handle={profileHandle || session?.handle || "alex"} session={session} onOpenArticle={openArticle} onBack={openBlog} onNavigate={navigate} onOpenLogin={openLogin} onOpenProfile={openProfile} onOpenPortfolioEditor={openPortfolioEditor} />}
          {page === "reviewer" && <ReviewerInbox session={session} onOpenReview={(b, c) => openReviewPage(b, c, { povHandle: session?.handle })} onBack={openBlog} />}
          {page === "admin"   && <AdminPortal               session={session} onBack={openBlog} onOpenProfile={openProfile} />}
          {page === "author"  && <AuthorPortal              session={session} onOpenBlogDetail={openBlogDetail} onOpenReview={openReviewPage} onOpenArticle={openArticle} onOpenEditor={openEditor} onOpenPortfolioEditor={openPortfolioEditor} onBack={openBlog} />}
          {page === "blogdetail" && <BlogDetailScreen        session={session} blogSlug={blogDetailSlug} onBack={openAuthorPortal} onOpenChapter={(b) => openArticle(b)} onOpenReview={openReviewPage} onOpenEditor={openEditor} onPreview={(b) => openArticle(b)} />}
          {page === "editor"  && <EditorScreen              session={session} blogSlug={editorBlogSlug} chapterSlug={editorChapterSlug} portfolioMode={editorPortfolio} onBack={editorPortfolio ? (() => openProfile(session?.handle)) : openAuthorPortal} onOpenReview={openReviewPage} />}
          {page === "review"  && <ReviewPage                session={session} blogSlug={reviewSlug} chapterSlug={reviewChapterSlug} onOpenAuthor={openAuthorPortal} onOpenAdmin={() => navigate("admin")} onOpenProfile={openProfile} onBack={openBlog} />}
          {page === "login"   && <LoginScreen          onLogin={completeLogin} returnNote={loginReturnRef.current?.blogSlug ? (window.__blogData?.getBlogBySlug(loginReturnRef.current.blogSlug)?.title || null) : null} />}
        </main>

        <Footer />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

// ─── Smoke test (run with ?smoke=1) ───────────────────────────
// Walks every data-screen-label by driving window.__nav, counting
// React errors. Reports pass/fail to console + window.__smokeResult.
if (new URLSearchParams(location.search).get("smoke") === "1") {
  setTimeout(() => {
    const seen = new Set();
    const errors = [];
    const origErr = console.error;
    console.error = (...a) => { errors.push(a.join(" ")); origErr(...a); };

    const labels = () => [...document.querySelectorAll("[data-screen-label]")]
      .map(el => el.getAttribute("data-screen-label"));

    const targets = [
      ["Home",            () => window.__nav?.("home")],
      ["Blog",            () => window.__nav?.("blog")],
      ["Article",         () => window.__nav?.("article")],
      ["Login",           () => window.__nav?.("login")],
      ["AuthorPortal",    () => window.__nav?.("author")],
      ["Editor",          () => window.__nav?.("editor")],
      ["ReviewerInbox",   () => window.__nav?.("reviewer")],
      ["ReviewPage",      () => window.__nav?.("review")],
      ["AdminPortal",     () => window.__nav?.("admin")],
    ];

    let i = 0;
    const tick = () => {
      if (i >= targets.length) {
        console.error = origErr;
        const found = [...seen];
        const result = {
          pass: errors.length === 0 && found.length >= 6,
          screensSeen: found,
          errors,
        };
        window.__smokeResult = result;
        console.log("[smoke]", result.pass ? "PASS" : "FAIL", result);
        document.title = (result.pass ? "✓ " : "✗ ") + document.title;
        return;
      }
      const [name, fn] = targets[i++];
      try { fn(); } catch (e) { errors.push("[nav " + name + "] " + e.message); }
      setTimeout(() => {
        labels().forEach(l => seen.add(l));
        tick();
      }, 250);
    };
    tick();
  }, 500);
}
