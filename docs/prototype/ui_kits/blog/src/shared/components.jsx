// Shared primitive UI components for the blog kit. Globals on window.
const { useState, useEffect, useRef, useMemo } = React;

// -----------------------------------------------------------------------------
// Icons (mirror the codebase exactly where it rolls its own)
// -----------------------------------------------------------------------------
const Icon = {
  Sun: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  Moon: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  Bookmark: ({ filled, ...p }) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  ChevUp: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
  ChevDown: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Bell: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  Rss: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <circle cx="6.18" cy="17.82" r="2.18" /><path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83c0-8.59-6.97-15.56-15.56-15.56zm0 5.66v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83c0-5.47-4.43-9.9-9.9-9.9z" />
    </svg>
  ),
  ArrowLeft: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  BookOpen: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  CornerUpLeft: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  ),
  ArrowUpRight: (p) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 17 17 7" />
      <polyline points="8 7 17 7 17 16" />
    </svg>
  ),
  MessageCircle: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
    </svg>
  ),
  Telegram: (p) => (
    // Paper-plane glyph; single-path so it tints with currentColor.
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M21.86 3.37 2.6 10.79c-1.07.41-1.07 1.02-.2 1.3l4.91 1.53 1.9 5.83c.23.63.12.88.77.88.5 0 .72-.23 1-.5l2.39-2.33 4.97 3.67c.91.5 1.57.24 1.8-.85l3.27-15.39c.34-1.33-.5-1.94-1.55-1.56ZM7.78 13.17l10.73-6.77c.5-.31.96-.14.58.2l-8.95 8.08-.35 3.73z" />
    </svg>
  ),
};

// -----------------------------------------------------------------------------
// Theme toggle — mirrors blog/src/components/theme-toggle.tsx
// -----------------------------------------------------------------------------
function ThemeToggle({ theme, setTheme }) {
  const isDark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors text-[var(--foreground)]"
      aria-label={isDark ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
      title={isDark ? "Светлая тема" : "Тёмная тема"}
    >
      {isDark ? <Icon.Sun key="s" className="animate-[spin-in_0.3s_ease-out]" /> : <Icon.Moon key="m" className="animate-[spin-in_0.3s_ease-out]" />}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Nav — mirrors blog/src/components/nav.tsx
// -----------------------------------------------------------------------------
const ROLE_RU = { reader: "Читатель", author: "Автор", reviewer: "Ревьюер", admin: "Администратор" };

// ─── Notifications (A5) ────────────────────────────────────────
// Derived per session from real state: new chapters in followed series,
// and "ваш ход" review turns. Read-state persisted in localStorage.
const NOTIF_READ_KEY = "devblog-notif-read-v1";
function readNotifRead() { try { return JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || "[]"); } catch { return []; } }
function markNotifRead(ids) {
  const cur = new Set(readNotifRead());
  ids.forEach(id => cur.add(id));
  try { localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...cur])); } catch {}
  window.dispatchEvent(new CustomEvent("devblog:notif-changed"));
}
function buildNotifications(session) {
  if (!session) return [];
  const D = window.__blogData;
  const out = [];
  const fmtAgo = (ts) => window.formatRelativeTime ? window.formatRelativeTime(ts) : "";
  // Reviewer/author: "ваш ход" review turns.
  if (session.role === "author" || session.role === "reviewer") {
    const blogs = D.getBlogs() || [];
    for (const b of blogs) {
      for (const c of (b.chapters || [])) {
        const mine = session.role === "author"
          ? b.authorSlug === session.handle
          : (c.reviewerHandles || []).includes(session.handle);
        if (mine && c.hasMyTurn) {
          out.push({
            id: `turn-${b.slug}-${c.slug}`,
            kind: "review",
            title: session.role === "author" ? "Нужны ваши правки" : "Ожидает вашего ревью",
            body: `${b.title}${(b.chapters || []).length > 1 ? " · " + c.title : ""}`,
            at: c.lastActivityAt || 0,
            blogSlug: b.slug,
            chapterSlug: c.slug,
          });
        }
      }
    }
  }
  // Reader/author: new published chapters in followed series.
  if (session.role === "reader" || session.role === "author") {
    const follows = window.__follows?.readFollows?.() || [];
    for (const slug of follows) {
      const b = D.getBlogBySlug(slug);
      if (!b) continue;
      const pub = (b.chapters || []).filter(c => D.isChapterPublished(c));
      const latest = pub[pub.length - 1];
      if (latest) {
        out.push({
          id: `chap-${b.slug}-${latest.slug}`,
          kind: "chapter",
          title: "Новая глава в подписке",
          body: `${b.title} · ${latest.title}`,
          at: latest.revision?.publishedAt || b.lastActivityAt || 0,
          blogSlug: b.slug,
        });
      }
    }
  }
  out.sort((a, b) => (b.at || 0) - (a.at || 0));
  return out;
}

function NotificationBell({ session, onOpenItem }) {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const h = () => force(n => n + 1);
    window.addEventListener("devblog:notif-changed", h);
    window.addEventListener("devblog:follows-changed", h);
    return () => { window.removeEventListener("devblog:notif-changed", h); window.removeEventListener("devblog:follows-changed", h); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const items = buildNotifications(session);
  const readSet = new Set(readNotifRead());
  const unread = items.filter(i => !readSet.has(i.id));

  const openItem = (it) => {
    markNotifRead([it.id]);
    setOpen(false);
    onOpenItem?.(it);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); }}
        className="relative w-9 h-9 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        aria-label="Уведомления"
        aria-expanded={open}
        title="Уведомления"
      >
        <Icon.Bell />
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-[9px] font-bold leading-[15px] text-center tabular-nums">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-40 w-[320px] max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--border)]">
            <span className="text-[13px] font-semibold">Уведомления</span>
            {unread.length > 0 && (
              <button onClick={() => markNotifRead(items.map(i => i.id))} className="text-[11.5px] text-[var(--accent)] hover:underline">Прочитать все</button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3.5 py-8 text-center text-[12.5px] text-[var(--muted-foreground)]">Пока нет уведомлений.</p>
            ) : items.map(it => {
              const isUnread = !readSet.has(it.id);
              return (
                <button
                  key={it.id}
                  onClick={() => openItem(it)}
                  className={`w-full text-left px-3.5 py-2.5 flex gap-2.5 border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/40 transition-colors ${isUnread ? "bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]" : ""}`}
                >
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${isUnread ? "bg-[var(--accent)]" : "bg-transparent"}`} />
                  <span className="min-w-0">
                    <span className={`block text-[12.5px] ${isUnread ? "font-semibold text-[var(--foreground)]" : "font-medium text-[var(--muted-foreground)]"}`}>{it.title}</span>
                    <span className="block text-[12px] text-[var(--muted-foreground)] title-clamp-2 mt-0.5">{it.body}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Nav({ theme, setTheme, session, onNavigate, currentPage, onLogout, onLogin, onOpenGuide, onOpenProfile, onOpenReviewer, onOpenAdmin, onOpenAuthor, onOpenBookmarks, onOpenNotification }) {
  const isLoggedIn = !!session;
  const [mobileOpen, setMobileOpen] = useState(false);
  const blogActive = currentPage === "blog" || currentPage === "article" || currentPage === "home";

  // Active-state per role for the mobile menu. A portal entry is only
  // highlighted when we're actually on one of that role's pages.
  const portalPages = session?.role === "author"   ? ["author", "blogdetail", "editor"]
                    : session?.role === "reviewer" ? ["reviewer", "review"]
                    : session?.role === "admin"    ? ["admin"]
                    : [];
  const portalActive   = portalPages.includes(currentPage);
  const profileActive  = currentPage === "profile";
  const bookmarksActive = currentPage === "bookmarks";
  const mItem = (active) => `text-left px-2 py-2.5 rounded-md text-[15px] min-h-[44px] transition-colors ${
    active ? "text-[var(--foreground)] font-medium bg-[var(--muted)]/50" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/40"
  }`;

  // Role-aware portal entry for the mobile sheet.
  const portal = !session ? null
    : session.role === "admin"    ? { label: "Кабинет администратора", fn: onOpenAdmin }
    : session.role === "reviewer" ? { label: "Кабинет ревьюера", fn: onOpenReviewer }
    : session.role === "author"   ? { label: "Кабинет автора", fn: onOpenAuthor }
    : null;

  return (
    <nav
      className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_80%,transparent)] backdrop-blur-md"
      data-screen-label="Nav"
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); onNavigate("home"); }}
          className="font-[var(--font-display)] hover:opacity-80 transition-opacity inline-flex items-baseline gap-1.5"
          aria-label="Recenza — главная"
        >
          <span className="font-extrabold text-xl leading-none tracking-tight">Recenza</span>
        </a>

        {/* Desktop cluster */}
        <div className="hidden sm:flex items-center gap-5">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onNavigate("blog"); }}
            className={`text-sm transition-colors ${blogActive ? "text-[var(--foreground)] font-medium" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
          >
            Лента
          </a>
          <button
            onClick={() => onOpenGuide?.()}
            className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-label="Руководство"
            title="Руководство"
          >
            <Icon.BookOpen />
          </button>
          <ThemeToggle theme={theme} setTheme={setTheme} />
          {isLoggedIn ? (
            <>
              <NotificationBell session={session} onOpenItem={onOpenNotification} />
              <AvatarMenu session={session} onLogout={onLogout} onOpenProfile={onOpenProfile} onOpenReviewer={onOpenReviewer} onOpenAdmin={onOpenAdmin} onOpenAuthor={onOpenAuthor} onOpenBookmarks={onOpenBookmarks} />
            </>
          ) : (
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); onNavigate("login"); }}
              className="text-sm font-medium px-3 py-1.5 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
            >
              Войти
            </a>
          )}
        </div>

        {/* Mobile: notifications + theme toggle + hamburger (avatar stays reachable too) */}
        <div className="flex sm:hidden items-center gap-1">
          {isLoggedIn && <NotificationBell session={session} onOpenItem={onOpenNotification} />}
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors text-[var(--foreground)]"
            aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
          >
            {mobileOpen ? (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {mobileOpen && (
        <div id="mobile-nav-panel" className="sm:hidden border-t border-[var(--border)] bg-[var(--background)] px-4 py-3 flex flex-col gap-1">
          {isLoggedIn && (
            <div className="flex items-center gap-3 px-1 py-2 mb-1 border-b border-[var(--border)]">
              <span className="w-9 h-9 rounded-full bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center text-xs font-semibold text-[var(--muted-foreground)]">
                {(session.name || "?").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{session.name}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{ROLE_RU[session.role] || "Читатель"}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => { setMobileOpen(false); onNavigate("blog"); }}
            className={mItem(blogActive)}
          >Лента</button>
          {isLoggedIn ? (
            <>
              {/* Primary: role workspace right after the feed */}
              {portal && (
                <button
                  onClick={() => { setMobileOpen(false); portal.fn?.(); }}
                  className={mItem(portalActive)}
                >{portal.label}</button>
              )}
              <button
                onClick={() => { setMobileOpen(false); onOpenProfile?.(session.handle); }}
                className={mItem(profileActive)}
              >Мой профиль</button>
              {session.role === "reader" && (
                <button
                  onClick={() => { setMobileOpen(false); onOpenBookmarks?.(); }}
                  className={mItem(bookmarksActive)}
                >Закладки</button>
              )}

              {/* Secondary group */}
              <div className="my-1 border-t border-[var(--border)]" />
              <button
                onClick={() => { setMobileOpen(false); onOpenGuide?.(); }}
                className={mItem(false)}
              >Руководство</button>
              <button
                onClick={() => { setMobileOpen(false); onLogout?.(); }}
                className={mItem(false)}
              >Выйти</button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setMobileOpen(false); onOpenGuide?.(); }}
                className={mItem(false)}
              >Руководство</button>
              <button
                onClick={() => { setMobileOpen(false); onNavigate("login"); }}
                className="text-center mt-1 px-3 py-2.5 rounded-md text-[15px] font-medium min-h-[44px] bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
              >Войти</button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

// -----------------------------------------------------------------------------
// AvatarMenu — avatar chip on the right of the nav; click opens profile menu.
// Replaces the previous inline name + "Выйти" text pattern.
// -----------------------------------------------------------------------------
function AvatarMenu({ session, onLogout, onOpenProfile, onOpenReviewer, onOpenAdmin, onOpenAuthor, onOpenBookmarks }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const initials = (session.name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
        aria-label={`Меню профиля — ${session.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initials}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 min-w-[200px] rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] shadow-lg py-1 z-50"
        >
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <div className="text-sm font-medium text-[var(--foreground)]">{session.name}</div>
            <div className="text-xs text-[var(--muted-foreground)]">{ROLE_RU[session.role] || "Читатель"}</div>
          </div>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onOpenProfile?.(session.handle); }}
            className="w-full text-left px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Мой профиль
          </button>
          {session.role === "reader" && (
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onOpenBookmarks?.(); }}
              className="w-full text-left px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Закладки
            </button>
          )}
          {(session.role === "author" || session.role === "admin") && (
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onOpenAuthor?.(); }}
              className="w-full text-left px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Кабинет автора
            </button>
          )}
          {session.role === "reviewer" && (
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onOpenReviewer?.(); }}
              className="w-full text-left px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Кабинет ревьюера
            </button>
          )}
          {session.role === "admin" && (
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onOpenAdmin?.(); }}
              className="w-full text-left px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Кабинет администратора
            </button>
          )}
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onLogout?.(); }}
            className="w-full text-left px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Footer — mirrors blog/src/components/footer.tsx
// -----------------------------------------------------------------------------
function Footer() {
  return (
    <footer className="border-t border-[var(--border)] mt-auto">
      <div className="max-w-4xl mx-auto px-4 py-8 flex items-center justify-between gap-4 text-sm text-[var(--muted-foreground)]">
        <p>&copy; 2026 Recenza</p>
        <a
          href="#"
          className="inline-flex items-center gap-2 hover:text-[var(--foreground)] transition-colors"
          aria-label="Telegram-канал"
        >
          <Icon.Telegram />
          <span>Telegram</span>
        </a>
      </div>
    </footer>
  );
}

// -----------------------------------------------------------------------------
// DifficultyBadge — monochrome ramp. Dot count signals level; no traffic-light
// color coding (red/yellow/green carries unearned semantics for a reader).
// -----------------------------------------------------------------------------
const DIFFICULTY_MAP = {
  simple: { label: "Простой", dots: 1 },
  medium: { label: "Средний", dots: 2 },
  hard:   { label: "Сложный", dots: 3 },
};
function DifficultyBadge({ difficulty }) {
  const entry = DIFFICULTY_MAP[difficulty];
  if (!entry) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)]"
      aria-label={`Сложность: ${entry.label}`}
    >
      <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${i < entry.dots ? "bg-[var(--foreground)]" : "bg-[var(--border)]"}`}
          />
        ))}
      </span>
      <span>{entry.label}</span>
    </span>
  );
}

// -----------------------------------------------------------------------------
// BookmarkButton — mirrors blog/src/components/bookmark-button.tsx
// -----------------------------------------------------------------------------
function BookmarkButton({ articleId, initialBookmarked = false, initialCount = 0, session, onLoginRequired }) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [count, setCount] = useState(initialCount);
  const [pop, setPop] = useState(false);
  const prev = useRef(initialBookmarked);

  useEffect(() => {
    if (bookmarked && !prev.current) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 300);
      return () => clearTimeout(t);
    }
    prev.current = bookmarked;
  }, [bookmarked]);

  if (!session && bookmarked === "notAuthed") {
    return (
      <a href="#" onClick={(e) => { e.preventDefault(); onLoginRequired?.(); }}
         className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
        Войдите, чтобы добавить в закладки
      </a>
    );
  }

  const handleClick = () => {
    if (!session) {
      onLoginRequired?.();
      return;
    }
    const next = !bookmarked;
    setBookmarked(next);
    setCount((c) => c + (next ? 1 : -1));
  };

  return (
    <button
      onClick={handleClick}
      title={bookmarked ? "Убрать из закладок" : "В закладки"}
      aria-label={bookmarked ? "Убрать из закладок" : "В закладки"}
      className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
    >
      <Icon.Bookmark
        filled={bookmarked}
        className={pop ? "animate-[bookmark-pop_0.3s_ease-out]" : ""}
      />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}

// -----------------------------------------------------------------------------
// ArticleVoting — mirrors blog/src/components/article-voting.tsx
// -----------------------------------------------------------------------------
function ArticleVoting({ articleId, initialRating, session, onLoginRequired }) {
  const [rating, setRating] = useState(initialRating);
  const [userVote, setUserVote] = useState(null);

  const vote = (v) => {
    if (!session) { onLoginRequired?.(); return; }
    if (userVote === v) {
      setRating((r) => r - v);
      setUserVote(null);
    } else {
      setRating((r) => r - (userVote ?? 0) + v);
      setUserVote(v);
    }
  };

  const btn = "flex items-center justify-center w-7 h-7 rounded transition-colors";
  const idle = "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]";
  const activeUp = "text-[var(--success)] bg-[var(--success-bg)]";
  const activeDown = "text-[var(--danger)] bg-[var(--danger-bg)]";
  return (
    <div className="inline-flex items-center gap-1">
      <button className={`${btn} ${userVote === 1 ? activeUp : idle}`} onClick={() => vote(1)} aria-label="Нравится"><Icon.ChevUp /></button>
      <span className="text-sm font-medium tabular-nums w-6 text-center">{rating > 0 ? `+${rating}` : rating}</span>
      <button className={`${btn} ${userVote === -1 ? activeDown : idle}`} onClick={() => vote(-1)} aria-label="Не нравится"><Icon.ChevDown /></button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ShareButton — mirrors blog/src/components/share-button.tsx
// -----------------------------------------------------------------------------
function ShareRow({ title }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const btn = "share-btn";
  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      <span className="text-xs text-[var(--muted-foreground)] mr-1">Поделиться:</span>
      <button className={btn}>Telegram</button>
      <button className={btn}>ВКонтакте</button>
      <button className={btn}>X</button>
      <button className={btn} onClick={copy}>{copied ? "✓ Скопировано" : "Копировать ссылку"}</button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ScrollProgress — mirrors blog/src/components/scroll-progress.tsx
// Scoped to the article content column (kit runs inside an iframe-style layout).
// -----------------------------------------------------------------------------
function ScrollProgress({ targetRef }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      const scrollHeight = el.scrollHeight - el.clientHeight;
      if (scrollHeight > 0) setProgress((el.scrollTop / scrollHeight) * 100);
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    el.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [targetRef]);
  return (
    <div
      className="absolute top-0 left-0 h-[3px] bg-[var(--accent)] z-20 transition-[width] duration-100 ease-linear pointer-events-none"
      style={{ width: `${progress}%` }}
      role="progressbar"
    />
  );
}

// -----------------------------------------------------------------------------
// CoverPlaceholder — simple colored gradient as a stand-in for real images.
// We don't have the blog's actual article cover images.
// -----------------------------------------------------------------------------
function CoverPlaceholder({ seed, className = "" }) {
  // Two hashable gradients from accent + neutrals, chosen deterministically by seed
  const gradients = [
    "linear-gradient(135deg, #0f766e 0%, #334155 100%)",
    "linear-gradient(135deg, #1e293b 0%, #0f766e 100%)",
    "linear-gradient(135deg, #334155 0%, #111827 100%)",
    "linear-gradient(135deg, #0f766e 0%, #064e3b 100%)",
    "linear-gradient(135deg, #111827 0%, #4b5563 100%)",
    "linear-gradient(135deg, #115e59 0%, #1e293b 100%)",
  ];
  const hash = [...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return <div className={className} style={{ backgroundImage: gradients[hash % gradients.length] }} aria-hidden="true" />;
}

// -----------------------------------------------------------------------------
// Avatar — initials on a deterministic muted hue. Used everywhere a user
// appears (comments, profile header, reviewer dashboard, mention chips).
// -----------------------------------------------------------------------------
function Avatar({ handle, name, size = 32, className = "" }) {
  const initials = (name || handle || "?")
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map(s => s[0].toUpperCase()).join("");
  // Deterministic hue from handle so the same user is always the same colour.
  const seed = (handle || name || "?");
  const hash = [...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = hash * 47 % 360;
  return (
    <div
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full font-medium select-none shrink-0 ${className}`}
      style={{
        width: size, height: size,
        fontSize: Math.max(11, Math.round(size * 0.4)),
        background: `oklch(0.92 0.04 ${hue})`,
        color: `oklch(0.32 0.06 ${hue})`,
      }}
    >{initials}</div>
  );
}

// -----------------------------------------------------------------------------
// formatRelativeTime — "2 ч назад", "вчера", "13 мая". Russian locale.
// -----------------------------------------------------------------------------
function formatRelativeTime(unixSeconds) {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - unixSeconds);
  if (diff < 60)        return "только что";
  if (diff < 3600)      return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400)     return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 86400 * 2) return "вчера";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} дн назад`;
  return new Date(unixSeconds * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

// -----------------------------------------------------------------------------
// CommentsSection — threaded comments with optional fragment-anchor support.
// Renders below the article body. 2-level nesting: comment → replies.
// A comment can carry an `anchor` quoting a fragment from the article;
// clicking "↑ к фрагменту" scrolls the article column to that block and
// briefly highlights it.
// -----------------------------------------------------------------------------
// 15-minute edit window for a comment/reply, measured from createdAt (unix s).
const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000;
function withinEditWindow(createdAtUnix) {
  return Date.now() - (createdAtUnix || 0) * 1000 < COMMENT_EDIT_WINDOW_MS;
}

function CommentsSection({ scrollRef, session, blogSlug, chapterSlug, chapterRevision, blocks, chapters, blogAuthorHandle, pendingAnchor, onClearAnchor, onLoginRequired, onOpenProfile }) {
  const seed = window.FAKE_DATA.comments || [];
  const users = window.FAKE_DATA.users || {};
  const [comments, setComments] = useState(seed);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [editing, setEditing] = useState(null);     // id of comment/reply being edited
  const [editDraft, setEditDraft] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [reporting, setReporting] = useState(null); // target object for ReportDialog

  // Whole-blog mode: chapterSlug is null but a `chapters` array is provided —
  // we then show every chapter's comments and resolve each one's chapter for
  // revision + fragment-anchor handling.
  const wholeMode = chapterSlug == null && Array.isArray(chapters) && chapters.length > 0;
  const chapterOf = (c) => (chapters || []).find(ch => ch.slug === c.chapterSlug) || null;

  // Only the comments tied to THIS blog (+ chapter when in chapter mode).
  const scoped = comments.filter(c =>
    c.blogSlug === blogSlug &&
    (chapterSlug == null || c.chapterSlug == null || c.chapterSlug === chapterSlug)
  );
  // Split current-revision comments from those left on an older revision.
  const isOld = (c) => {
    if (c.revision == null) return false;
    const rev = wholeMode ? (chapterOf(c)?.revision?.number) : chapterRevision;
    return rev != null && c.revision < rev;
  };
  const current = scoped.filter(c => !isOld(c));
  const older = scoped.filter(isOld);
  const total = scoped.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

  const me = session
    ? (users[session.handle] || { handle: session.handle, name: session.name || session.handle, role: "reader" })
    : null;

  // Responsibility split:
  //   • readers comment everywhere;
  //   • authors only inside their OWN blog (and reply there);
  //   • reviewers and admins never comment on the public side.
  const isOwnBlog = !blogAuthorHandle || session?.handle === blogAuthorHandle;
  const canComment = !session
    || session.role === "reader"
    || (session.role === "author" && isOwnBlog);
  const blockedByRole = !!session && !canComment;
  const blockedMsg = !session ? "" :
    session.role === "reviewer" ? "Ревьюеры не участвуют в публичных обсуждениях — комментарии оставляют читатели и авторы." :
    session.role === "admin"    ? "Администраторы не комментируют публичные статьи." :
    session.role === "author"   ? "Авторы комментируют и отвечают только в своих блогах." :
    "";

  // Resolve a comment's fragment-anchor DOM id + whether its block still exists.
  // Chapter mode → id="block-<id>"; whole-blog mode → id="block-<chapterSlug>-<id>".
  const anchorIdFor = (c) => {
    if (!c.anchor) return null;
    return wholeMode ? `block-${c.chapterSlug}-${c.anchor.blockId}` : `block-${c.anchor.blockId}`;
  };
  const blockExistsFor = (c) => {
    if (!c.anchor) return false;
    const chBlocks = wholeMode ? (chapterOf(c)?.blocks) : blocks;
    return !chBlocks || chBlocks.some(b => b.id === c.anchor.blockId);
  };

  const jumpToBlock = (domId) => {
    const root = scrollRef?.current;
    if (!root || !domId) return;
    const el = root.querySelector(`[id="${domId}"]`);
    if (!el) return;
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 24;
    root.scrollTo({ top, behavior: "smooth" });
    el.classList.add("blog-fragment-flash");
    setTimeout(() => el.classList.remove("blog-fragment-flash"), 1600);
  };

  const submitTop = (e) => {
    e.preventDefault();
    if (!session) { onLoginRequired?.(); return; }
    if (!draft.trim()) return;
    // Attach the fragment anchor the reader handed us, if any.
    const anchor = pendingAnchor
      ? { blockId: pendingAnchor.blockId, quote: pendingAnchor.quote }
      : null;
    const ch = pendingAnchor?.chapterSlug || chapterSlug;
    const rev = pendingAnchor?.chapterSlug
      ? ((chapters || []).find(c => c.slug === pendingAnchor.chapterSlug)?.revision?.number ?? null)
      : (chapterRevision ?? null);
    setComments([...comments, {
      id: `c-${Date.now()}`,
      blogSlug, chapterSlug: ch ?? null, revision: rev,
      authorHandle: session.handle,
      createdAt: Date.now() / 1000,
      editedAt: null,
      anchor,
      body: draft.trim(),
      replies: [],
    }]);
    setDraft("");
    onClearAnchor?.();
  };

  const submitReply = (e, parentId) => {
    e.preventDefault();
    if (!session) { onLoginRequired?.(); return; }
    if (!replyDraft.trim()) return;
    setComments(comments.map(c => c.id === parentId
      ? { ...c, replies: [...(c.replies || []), {
          id: `c-${Date.now()}`,
          authorHandle: session.handle,
          createdAt: Date.now() / 1000,
          editedAt: null,
          body: replyDraft.trim(),
        }]}
      : c));
    setReplyDraft("");
    setReplyTo(null);
  };

  // Save an edit to a top-level comment OR a nested reply (by id), stamping editedAt.
  const saveEdit = (id) => {
    const body = editDraft.trim();
    if (!body) return;
    const now = Date.now() / 1000;
    setComments(comments.map(c => {
      if (c.id === id) return { ...c, body, editedAt: now };
      if (c.replies?.some(r => r.id === id)) {
        return { ...c, replies: c.replies.map(r => r.id === id ? { ...r, body, editedAt: now } : r) };
      }
      return c;
    }));
    setEditing(null);
    setEditDraft("");
  };

  const startEdit = (item) => { setEditing(item.id); setEditDraft(item.body); setReplyTo(null); };
  const canEditItem = (item) => session && item.authorHandle === session.handle && withinEditWindow(item.createdAt);
  const canReportItem = (item) => session && session.role !== "admin" && session.handle !== item.authorHandle;
  const reportComment = (item) => setReporting({
    kind: "comment",
    targetCommentId: item.id,
    targetAuthorHandle: item.authorHandle,
    targetArticleSlug: blogSlug,
    targetBody: item.body,
  });

  const renderAuthor = (handle) => {
    const u = users[handle] || { handle, name: handle, role: "reader" };
    return (
      <button
        onClick={() => onOpenProfile?.(handle)}
        className="inline-flex items-center gap-2 group"
      >
        <Avatar handle={u.handle} name={u.name} size={28} />
        <span className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">{u.name}</span>
          <span className="text-[12px] text-[var(--muted-foreground)]">@{u.handle}</span>
          {u.role === "author"   && <RoleTag tone="accent">автор</RoleTag>}
          {u.role === "reviewer" && <RoleTag tone="amber">ревьюер</RoleTag>}
          {u.role === "admin"    && <RoleTag tone="slate">админ</RoleTag>}
        </span>
      </button>
    );
  };

  return (
    <section id="comments" className="mt-16 pt-10 border-t border-[var(--border)]">
      <header className="flex items-baseline justify-between mb-8">
        <h2 className="font-[var(--font-display)] font-semibold text-2xl tracking-tight">
          Комментарии <span className="text-[var(--muted-foreground)] font-normal">{total}</span>
        </h2>
      </header>

      {/* New top-level comment */}
      {blockedByRole ? (
        <div className="mb-10 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3.5">
          <p className="text-[13px] text-[var(--muted-foreground)] leading-relaxed">
            {blockedMsg}
          </p>
        </div>
      ) : (
      <form onSubmit={submitTop} className="mb-10" id="comment-form">
        <div className="flex gap-3">
          {me
            ? <Avatar handle={me.handle} name={me.name} size={32} />
            : <div className="w-8 h-8 rounded-full bg-[var(--muted)] shrink-0" aria-hidden="true" />}
          <div className="flex-1">
            {pendingAnchor && (
              <div className="mb-2 flex items-start gap-2 pl-3 py-1.5 pr-2 border-l-2 border-[var(--accent)] bg-[var(--muted)]/40 rounded-r">
                <span className="text-[12px] text-[var(--muted-foreground)] italic line-clamp-2 flex-1">«{pendingAnchor.quote}»</span>
                <button type="button" onClick={() => onClearAnchor?.()} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-[14px] leading-none shrink-0" aria-label="Убрать цитату">×</button>
              </div>
            )}
            <textarea
              ref={(el) => { if (el && pendingAnchor) el.focus(); }}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onFocus={() => { if (!session) { window.dispatchEvent(new CustomEvent("devblog:login-intent", { detail: { kind: "comment", blogSlug } })); onLoginRequired?.(); } }}
              placeholder={session ? (pendingAnchor ? "Комментарий к выделенному фрагменту…" : "Написать комментарий…") : "Войдите, чтобы оставить комментарий"}
              rows={3}
              className="w-full resize-none bg-transparent border border-[var(--border)] rounded-lg px-3 py-2.5 text-[14px] leading-relaxed placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
            <div className="flex items-center justify-end mt-2">
              <button
                type="submit"
                disabled={!draft.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >Отправить</button>
            </div>
          </div>
        </div>
      </form>
      )}

      {/* Thread (current revision) */}
      {current.length === 0 && older.length === 0 ? (
        <p className="text-[13.5px] text-[var(--muted-foreground)] py-6">Пока нет комментариев. Будьте первым.</p>
      ) : null}

      <ol className="space-y-8">
        {current.map((c) => renderComment(c, false))}
      </ol>

      {/* Comments left on earlier revisions — collapsed under a spoiler. */}
      {older.length > 0 && (
        <div className="mt-10 pt-6 border-t border-dashed border-[var(--border)]">
          <button
            type="button"
            onClick={() => setShowOld(v => !v)}
            className="inline-flex items-center gap-2 text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            aria-expanded={showOld}
          >
            <span className={`inline-block transition-transform ${showOld ? "rotate-90" : ""}`}>›</span>
            Комментарии к прошлым версиям
            <span className="tabular-nums px-1.5 py-px rounded bg-[var(--muted)] text-[11px]">{older.length}</span>
          </button>
          {showOld && (
            <ol className="space-y-8 mt-6 opacity-90">
              {older.map((c) => renderComment(c, true))}
            </ol>
          )}
        </div>
      )}
      {reporting && (
        <ReportDialog
          target={reporting}
          session={session}
          onClose={() => setReporting(null)}
          onDone={() => { try { window.dispatchEvent(new CustomEvent("devblog:toast", { detail: { text: "Жалоба отправлена модератору" } })); } catch (e) {} }}
        />
      )}
    </section>
  );

  // ── Render one comment (top-level) + its replies. `old` adds a version badge. ──
  function renderComment(c, old) {
    const anchorActive = c.anchor && blockExistsFor(c) && !old;
    const chTitle = wholeMode ? (chapterOf(c)?.title) : null;
    return (
      <li key={c.id} className="space-y-4">
        <article>
          {chTitle && (
            <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5">{chTitle}</p>
          )}
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="inline-flex items-center gap-2 flex-wrap">
              {renderAuthor(c.authorHandle)}
              {old && (
                <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-px rounded bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning-border)]" title="Комментарий оставлен к предыдущей версии главы">
                  к версии v{c.revision}
                </span>
              )}
            </span>
            <time className="text-[12px] text-[var(--muted-foreground)] tabular-nums shrink-0">
              {formatRelativeTime(c.createdAt)}{c.editedAt ? " · изменено" : ""}
            </time>
          </div>

          {c.anchor && (
            anchorActive ? (
              <button
                onClick={() => jumpToBlock(anchorIdFor(c))}
                className="group flex items-start gap-2 mb-3 pl-3 py-1.5 pr-2.5 border-l-2 border-[var(--accent)] bg-[var(--muted)]/40 hover:bg-[var(--muted)] rounded-r text-left transition-colors max-w-full"
              >
                <span className="text-[12px] text-[var(--muted-foreground)] italic line-clamp-2 flex-1">«{c.anchor.quote}»</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] font-medium shrink-0 mt-0.5">
                  <Icon.ArrowUpRight />к&nbsp;фрагменту
                </span>
              </button>
            ) : (
              <div className="flex items-start gap-2 mb-3 pl-3 py-1.5 pr-2.5 border-l-2 border-[var(--border)] bg-[var(--muted)]/30 rounded-r max-w-full" title="Фрагмент относится к другой версии главы">
                <span className="text-[12px] text-[var(--muted-foreground)] italic line-clamp-2 flex-1">«{c.anchor.quote}»</span>
              </div>
            )
          )}

          {editing === c.id ? (
            <EditForm item={c} editDraft={editDraft} setEditDraft={setEditDraft} onSave={() => saveEdit(c.id)} onCancel={() => setEditing(null)} />
          ) : (
            <p className="text-[14px] leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">{c.body}</p>
          )}

          <div className="flex items-center gap-4 mt-2 text-[12px] text-[var(--muted-foreground)]">
            <button className="hover:text-[var(--foreground)] transition-colors inline-flex items-center gap-1">
              ▲ <span className="tabular-nums">{(c.id.length * 3) % 17}</span>
            </button>
            {!old && canComment && (
              <button
                onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyDraft(""); }}
                className="hover:text-[var(--foreground)] transition-colors inline-flex items-center gap-1"
              >
                <Icon.CornerUpLeft /> Ответить
              </button>
            )}
            {canEditItem(c) && editing !== c.id && (
              <button onClick={() => startEdit(c)} className="hover:text-[var(--foreground)] transition-colors">
                Изменить
              </button>
            )}
            {!old && canReportItem(c) && (
              <button onClick={() => reportComment(c)} className="hover:text-[var(--danger)] transition-colors">
                Пожаловаться
              </button>
            )}
          </div>
        </article>

        {/* Replies */}
        {(c.replies?.length > 0 || replyTo === c.id) && (
          <ol className="pl-11 space-y-4 border-l border-[var(--border)] ml-3.5">
            {c.replies?.map((r) => (
              <li key={r.id} className="pl-4">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  {renderAuthor(r.authorHandle)}
                  <time className="text-[12px] text-[var(--muted-foreground)] tabular-nums shrink-0">
                    {formatRelativeTime(r.createdAt)}{r.editedAt ? " · изменено" : ""}
                  </time>
                </div>
                {editing === r.id ? (
                  <EditForm item={r} editDraft={editDraft} setEditDraft={setEditDraft} onSave={() => saveEdit(r.id)} onCancel={() => setEditing(null)} />
                ) : (
                  <p className="text-[14px] leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">{r.body}</p>
                )}
                {canEditItem(r) && editing !== r.id && (
                  <button onClick={() => startEdit(r)} className="mt-1 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                    Изменить
                  </button>
                )}
                {canReportItem(r) && (
                  <button onClick={() => reportComment(r)} className="mt-1 ml-3 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--danger)] transition-colors">
                    Пожаловаться
                  </button>
                )}
              </li>
            ))}

            {replyTo === c.id && (
              <li className="pl-4">
                <form onSubmit={(e) => submitReply(e, c.id)} className="flex gap-3">
                  {me
                    ? <Avatar handle={me.handle} name={me.name} size={28} />
                    : <div className="w-7 h-7 rounded-full bg-[var(--muted)] shrink-0" aria-hidden="true" />}
                  <div className="flex-1">
                    <textarea
                      autoFocus
                      value={replyDraft}
                      onChange={e => setReplyDraft(e.target.value)}
                      placeholder={`Ответить @${c.authorHandle}…`}
                      rows={2}
                      className="w-full resize-none bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] leading-relaxed placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                    />
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        type="submit"
                        disabled={!replyDraft.trim()}
                        className="px-3 py-1 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                      >Ответить</button>
                      <button
                        type="button"
                        onClick={() => { setReplyTo(null); setReplyDraft(""); }}
                        className="px-2 py-1 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                      >Отмена</button>
                    </div>
                  </div>
                </form>
              </li>
            )}
          </ol>
        )}
      </li>
    );
  }
}

// Inline edit textarea reused for comments and replies.
function EditForm({ item, editDraft, setEditDraft, onSave, onCancel }) {
  return (
    <div className="mt-1">
      <textarea
        autoFocus
        value={editDraft}
        onChange={e => setEditDraft(e.target.value)}
        rows={3}
        className="w-full resize-none bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 text-[14px] leading-relaxed focus:outline-none focus:border-[var(--accent)] transition-colors"
      />
      <div className="flex items-center gap-2 mt-1.5">
        <button
          type="button"
          onClick={onSave}
          disabled={!editDraft.trim()}
          className="px-3 py-1 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >Сохранить</button>
        <button type="button" onClick={onCancel} className="px-2 py-1 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">Отмена</button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ReportDialog — modal for filing a moderation report on a comment OR a blog.
// Pushes into window.__reports; the admin portal reads/resolves from the same
// store. `target` carries { kind, targetCommentId?, targetAuthorHandle,
// targetArticleSlug, targetBody }.
// -----------------------------------------------------------------------------
function ReportDialog({ target, session, onClose, onDone }) {
  const reasons = window.REPORT_REASONS || [];
  const [reason, setReason] = useState(reasons[0]?.id || "spam");
  const [note, setNote] = useState("");
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const submit = () => {
    window.__reports?.add({
      ...target,
      reason,
      note: note.trim() || undefined,
      reporterHandle: session?.handle || "anon",
    });
    onDone?.();
    onClose();
  };
  const isBlog = target.kind === "blog";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background)]" onClick={e => e.stopPropagation()} style={{ boxShadow: "0 16px 40px rgba(0,0,0,0.2)" }}>
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
          <h2 className="font-[var(--font-display)] font-bold text-[18px] tracking-tight">{isBlog ? "Пожаловаться на блог" : "Пожаловаться на комментарий"}</h2>
          <button onClick={onClose} className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors" aria-label="Закрыть">×</button>
        </header>
        <div className="p-5 flex flex-col gap-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/25 px-3.5 py-2.5">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">{isBlog ? "Блог" : "Комментарий"}</p>
            <p className="text-[13px] text-[var(--foreground)] line-clamp-2 leading-relaxed">«{target.targetBody}»</p>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-2">Причина</label>
            <div className="flex flex-col gap-1.5">
              {reasons.map(r => (
                <label key={r.id} className="flex items-center gap-2.5 cursor-pointer px-2 py-1.5 -mx-2 rounded hover:bg-[var(--muted)]/40 transition-colors">
                  <input type="radio" name="report-reason" className="accent-[var(--accent)]" checked={reason === r.id} onChange={() => setReason(r.id)} />
                  <span className="text-[13.5px]">{r.text}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5" htmlFor="report-note">Комментарий модератору <span className="normal-case font-normal text-[var(--muted-foreground)]">— необязательно</span></label>
            <textarea id="report-note" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Что не так?" className="w-full resize-none bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] leading-relaxed focus:outline-none focus:border-[var(--accent)] transition-colors" />
          </div>
        </div>
        <footer className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--border)]">
          <button onClick={onClose} className="px-3.5 py-2 rounded-md text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">Отмена</button>
          <button onClick={submit} className="px-4 py-2 rounded-md bg-[var(--danger)] text-white text-[13px] font-medium hover:opacity-90 transition-opacity">Отправить жалобу</button>
        </footer>
      </div>
    </div>
  );
}

// Tiny role chip used inline next to a username.
function RoleTag({ children, tone }) {
  const tones = {
    accent: "bg-[var(--accent)]/10 text-[var(--accent)]",
    amber:  "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    slate:  "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-px rounded ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

// -----------------------------------------------------------------------------
// GuideModal — role-aware onboarding shown when the user clicks the BookOpen
// icon in the nav. One screen per role; for anonymous visitors we describe
// reader capabilities + how to get more rights.
// Closes on Esc, overlay click, or × button.
// -----------------------------------------------------------------------------
const GUIDE_CONTENT = {
  reader: {
    title: "Гид читателя",
    intro: "Что вы можете делать на этом блоге как читатель.",
    accent: "from-emerald-500/15 to-teal-500/5",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    ),
    capabilities: [
      { glyph: "★", title: "Голосуйте за статьи",   text: "Поднимайте полезные тексты в топ. Один голос на статью, его можно отозвать." },
      { glyph: "❑", title: "Закладки",              text: "Сохраняйте материалы в личную коллекцию. Доступна со страницы профиля." },
      { glyph: "✎", title: "Комментарии и ответы",  text: "Цепочка из двух уровней. Цитируйте фрагмент статьи — ссылка вернёт к нему любого читателя." },
      { glyph: "@", title: "Свой профиль",          text: "Каждый комментатор виден другим. Аватарка, био, история активности." },
    ],
    cta: { label: "Стать автором → написать админу" },
  },
  author: {
    title: "Гид автора",
    intro: "Дополнительно к возможностям читателя у вас есть редактор и черновики.",
    accent: "from-[var(--accent)]/20 to-[var(--accent)]/5",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
    ),
    capabilities: [
      { glyph: "▢", title: "Редактор статей",      text: "Полнофункциональный markdown-редактор: подсветка кода, превью, автосохранение черновиков." },
      { glyph: "↑", title: "Отправка на ревью",    text: "Готовый черновик отправляется ревьюеру. Вы видите статус: assigned · in review · approved · changes requested." },
      { glyph: "✚", title: "Свои публикации",      text: "Все ваши статьи в одном списке: черновики, на ревью, опубликованные, отклонённые." },
      { glyph: "◷", title: "История изменений",    text: "Версионирование — каждая правка ревьюера и каждая ваша итерация сохраняется." },
    ],
    cta: { label: "Создать статью" },
  },
  reviewer: {
    title: "Гид ревьюера",
    intro: "У вас своё рабочее место — кабинет ревьюера. Это не «версия редактора», а отдельное окружение для проверки чужих статей.",
    accent: "from-amber-500/15 to-amber-500/5",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    ),
    capabilities: [
      { glyph: "≡", title: "Дашборд назначений",  text: "Очередь статей, ожидающих вашего ревью. Сортировка по сроку, статусу, автору." },
      { glyph: "❝", title: "Замечания на фрагменты", text: "Выделите кусок статьи мышью — появится «Добавить замечание». Привязка к строке сохраняется в треде." },
      { glyph: "✓", title: "Вердикт",             text: "Принять / Доработать / Отклонить. Каждый вердикт виден автору и админу." },
      { glyph: "⌘", title: "Только чтение",       text: "Вы не можете редактировать чужой текст. Только комментировать и ставить вердикт." },
    ],
    cta: { label: "Открыть мои назначения" },
  },
  admin: {
    title: "Гид администратора",
    intro: "Вы видите всё. Управляете людьми, статьями и потоком публикаций.",
    accent: "from-slate-500/15 to-slate-500/5",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6z"/></svg>
    ),
    capabilities: [
      { glyph: "♟", title: "Очередь публикаций",   text: "Принятые ревьюером статьи ждут вашей публикации. Можно вернуть на доработку." },
      { glyph: "👥", title: "Пользователи",         text: "Назначайте роли: автор, ревьюер, админ. Блокируйте за нарушения." },
      { glyph: "↻", title: "Назначение ревью",     text: "Привязываете статью к ревьюеру. Один автор → один ревьюер на статью." },
      { glyph: "▤", title: "Модерация комментариев", text: "Скрытие, бан комментатора, разблокировка. История действий логируется." },
    ],
    cta: { label: "Открыть админ-панель" },
  },
};

function GuideModal({ open, onClose, role = "reader", onCta }) {
  // Esc closes the modal; lock body scroll while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const content = GUIDE_CONTENT[role] || GUIDE_CONTENT.reader;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fade-in-up_.2s_ease-out]"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-[var(--background)] border border-[var(--border)] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-[fade-in-up_.25s_ease-out]">
        {/* Grab handle (mobile sheet affordance) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <span className="w-9 h-1 rounded-full bg-[var(--border)]" aria-hidden="true" />
        </div>

        {/* Header strip with subtle role-tinted gradient */}
        <div className={`bg-gradient-to-br ${content.accent} px-5 sm:px-7 pt-4 sm:pt-6 pb-5 border-b border-[var(--border)] shrink-0`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] shrink-0">
                {content.icon}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">
                  Тип пользователя · {role === "admin" ? "администратор" : role === "reviewer" ? "ревьюер" : role === "author" ? "автор" : "читатель"}
                </p>
                <h2 id="guide-title" className="font-[var(--font-display)] font-extrabold text-xl sm:text-2xl tracking-tight mt-0.5">
                  {content.title}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="w-9 h-9 rounded-md hover:bg-[var(--background)]/60 transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center justify-center shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <p className="text-[13.5px] sm:text-[14px] text-[var(--muted-foreground)] mt-3 max-w-lg leading-relaxed">
            {content.intro}
          </p>
        </div>

        {/* Capabilities (scrolls if tall) */}
        <div className="px-5 sm:px-7 py-5 sm:py-6 overflow-y-auto flex-1 min-h-0">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 sm:gap-y-5">
            {content.capabilities.map((c, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="w-7 h-7 rounded-md border border-[var(--border)] bg-[var(--muted)]/50 text-[var(--accent)] flex items-center justify-center text-sm font-semibold shrink-0 mt-0.5"
                >{c.glyph}</span>
                <div>
                  <p className="text-[13px] font-semibold leading-snug">{c.title}</p>
                  <p className="text-[12.5px] text-[var(--muted-foreground)] leading-relaxed mt-0.5">{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer / CTA — stacks on mobile, inline on sm+. */}
        <div className="px-5 sm:px-7 py-4 border-t border-[var(--border)] bg-[var(--muted)]/30 shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
          <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-3 py-2.5 sm:py-1.5 text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors min-h-[44px] sm:min-h-0"
            >Понятно</button>
            <button
              onClick={() => { onClose?.(); onCta?.(); }}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-1.5 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] text-[13px] font-medium hover:opacity-90 transition-opacity min-h-[44px] sm:min-h-0 text-center"
            >
              <span className="title-clamp-1">{content.cta.label}</span> <Icon.ArrowUpRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { GuideModal });

// -----------------------------------------------------------------------------
// Review status pill + RU helpers (moved here from the retired legacy Author portal;
// ReviewStatusPill is consumed by Review.jsx's header).
// -----------------------------------------------------------------------------
const REVIEW_STATUS_LABEL = {
  "draft":             "Черновик",
  "under-review":      "На ревью",
  "changes-requested": "Правки",
  "approved":          "Одобрено",
  "published":         "Опубликовано",
};
const REVIEW_STATUS_TONE = {
  "draft":             "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]",
  "under-review":      "bg-[var(--info-bg)] text-[var(--info)] border-[var(--info-border)]",
  "changes-requested": "bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]",
  "approved":          "bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]",
  "published":         "bg-[var(--muted)] text-[var(--foreground)] border-[var(--border)]",
};
function ReviewStatusPill({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${REVIEW_STATUS_TONE[status] || REVIEW_STATUS_TONE.draft}`}>
      {REVIEW_STATUS_LABEL[status] || status}
    </span>
  );
}
function pluralizeRu(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
function fmtDateAuthor(unix) {
  return new Date((unix || 0) * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

Object.assign(window, {
  Icon, ThemeToggle, Nav, Footer,
  DifficultyBadge, BookmarkButton, ArticleVoting, ShareRow,
  ScrollProgress, CoverPlaceholder,
  Avatar, CommentsSection, formatRelativeTime,
  ReviewStatusPill, pluralizeRu, fmtDateAuthor,
  ReportDialog,
});
