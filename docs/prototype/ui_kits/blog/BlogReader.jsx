// BlogReader — public reader for multi-chapter blogs.
//
// Replaces ArticleReader on the "article" route. Data-driven from
// window.__blogData.getBlogBySlug — works for single-chapter (auto-wrapped
// legacy) and multi-chapter blogs alike.
//
// Modes:
//   • "chapter" (default) — read one chapter at a time; prev/next nav; in-chapter ToC
//   • "all"               — concatenated read of all published chapters with anchored headers
//
// Persistence: last opened chapter is saved to localStorage per blog slug.
//
// Exports window.BlogReaderScreen — App.jsx uses it for `page === "article"`.

const { useState, useEffect, useMemo, useRef } = React;

// Storage key for last-opened chapter per blog.
const lastChapterKey = (blogSlug) => `devblog-reader-chapter:${blogSlug}`;

// ─── Follow state (P16.2) ──────────────────────────────────────
// Stored as a list of blog slugs in localStorage. Surfaces:
//   • BlogReader hero — "Подписаться" toggle
//   • ReaderFeed — followed series promoted to top
const FOLLOWS_KEY = "devblog-follows-v1";
function readFollows() {
  try { return JSON.parse(localStorage.getItem(FOLLOWS_KEY) || "[]"); } catch { return []; }
}
function isFollowed(slug) { return readFollows().includes(slug); }
function setFollow(slug, follow) {
  const cur = new Set(readFollows());
  if (follow) cur.add(slug); else cur.delete(slug);
  try { localStorage.setItem(FOLLOWS_KEY, JSON.stringify([...cur])); } catch {}
  // Broadcast to any subscribed surface.
  window.dispatchEvent(new CustomEvent("devblog:follows-changed"));
}
window.__follows = { readFollows, isFollowed, setFollow };

// ─── Reactions store (A1 votes + A2 bookmarks) ─────────────────
// Per-blog engagement persisted in localStorage. Surfaces:
//   • BlogEngagementBar (reader) — vote ±1, bookmark toggle, share
//   • BlogIndexCard — bookmark chip
//   • BookmarksScreen — saved list
const VOTES_KEY = "devblog-votes-v1";       // { blogSlug: 1 | -1 }
const BOOKMARKS_KEY = "devblog-bookmarks-v1"; // [blogSlug, …]
function readVotes() { try { return JSON.parse(localStorage.getItem(VOTES_KEY) || "{}"); } catch { return {}; } }
function getVote(slug) { return readVotes()[slug] || 0; }
function setVote(slug, v) {
  const all = readVotes();
  if (v === 0) delete all[slug]; else all[slug] = v;
  try { localStorage.setItem(VOTES_KEY, JSON.stringify(all)); } catch {}
  window.dispatchEvent(new CustomEvent("devblog:reactions-changed"));
}
function readBookmarks() { try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "[]"); } catch { return []; } }
function isBookmarked(slug) { return readBookmarks().includes(slug); }
function setBookmark(slug, on) {
  const cur = new Set(readBookmarks());
  if (on) cur.add(slug); else cur.delete(slug);
  try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...cur])); } catch {}
  window.dispatchEvent(new CustomEvent("devblog:reactions-changed"));
}
window.__reactions = { getVote, setVote, readBookmarks, isBookmarked, setBookmark };

// Hook: subscribe to reactions changes and re-render.
function useReactionsTick() {
  const [, force] = useState(0);
  useEffect(() => {
    const h = () => force(n => n + 1);
    window.addEventListener("devblog:reactions-changed", h);
    return () => window.removeEventListener("devblog:reactions-changed", h);
  }, []);
}

// ─── BlogEngagementBar — vote + bookmark + share for a blog ─────
function BlogEngagementBar({ blog, session, onLoginRequired, onOpenProfile }) {
  useReactionsTick();
  const intent = (kind, value) => {
    window.dispatchEvent(new CustomEvent("devblog:login-intent", { detail: { kind, blogSlug: blog.slug, value } }));
    onLoginRequired?.();
  };
  const myVote = getVote(blog.slug);
  const displayedRating = (blog.rating || 0) + myVote;
  const bookmarked = isBookmarked(blog.slug);
  const bookmarkCount = (blog.bookmarkCount || 0) + (bookmarked ? 1 : 0);

  const vote = (v) => session ? setVote(blog.slug, myVote === v ? 0 : v) : intent("vote", v);
  const toggleBookmark = () => session ? setBookmark(blog.slug, !bookmarked) : intent("bookmark");
  const [reporting, setReporting] = useState(false);
  const canReportBlog = session && session.role !== "admin" && session.handle !== blog.authorSlug;

  return (
    <>
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Vote */}
      <div className="inline-flex items-center gap-0.5 border border-[var(--border)] rounded-lg p-0.5 bg-[var(--bg-secondary)]">
        <button
          type="button" onClick={() => vote(1)} aria-label="Полезно" aria-pressed={myVote === 1}
          className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${myVote === 1 ? "text-[var(--success)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill={myVote === 1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11v8H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zM7 11l4-7a2 2 0 0 1 2 2v3h5.5a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 17 20H7"/></svg>
        </button>
        <span className={`text-[13px] font-semibold tabular-nums min-w-[2.2ch] text-center ${myVote ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>
          {displayedRating > 0 ? `+${displayedRating}` : displayedRating}
        </span>
        <button
          type="button" onClick={() => vote(-1)} aria-label="Не полезно" aria-pressed={myVote === -1}
          className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${myVote === -1 ? "text-[var(--danger)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill={myVote === -1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 13V5h3a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1zM17 13l-4 7a2 2 0 0 1-2-2v-3H5.5a2 2 0 0 1-2-2.3l1.4-7A2 2 0 0 1 7 4h10"/></svg>
        </button>
      </div>

      {/* Bookmark */}
      <button
        type="button" onClick={toggleBookmark} aria-pressed={bookmarked}
        title={bookmarked ? "Убрать из закладок" : "В закладки"}
        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border transition-colors text-[13px] font-medium ${bookmarked ? "border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" : "border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        <span className="tabular-nums">{bookmarkCount}</span>
      </button>

      {/* Share */}
      <ShareMenu blog={blog} />

      {/* Report (icon + tooltip) */}
      {canReportBlog && (
        <button
          type="button"
          onClick={() => setReporting(true)}
          aria-label="Пожаловаться на блог"
          title="Пожаловаться на блог"
          className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--muted-foreground)] hover:text-[var(--danger)] hover:border-[color-mix(in_srgb,var(--danger)_40%,transparent)] transition-colors"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
        </button>
      )}
    </div>
    {reporting && window.ReportDialog && (
      <window.ReportDialog
        target={{ kind: "blog", targetAuthorHandle: blog.authorSlug, targetArticleSlug: blog.slug, targetBody: blog.title }}
        session={session}
        onClose={() => setReporting(false)}
        onDone={() => { try { window.dispatchEvent(new CustomEvent("devblog:toast", { detail: { text: "Жалоба на блог отправлена модератору" } })); } catch (e) {} }}
      />
    )}
    </>
  );
}

// ─── ShareMenu — real clipboard copy + social links ────────────
function ShareMenu({ blog }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Canonical-ish URL for this blog within the prototype.
  const url = `${location.origin}${location.pathname}?blog=${encodeURIComponent(blog.slug)}`;
  const title = blog.title || "Recenza";

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else { const ta = document.createElement("textarea"); ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  };
  const openShare = (href) => { window.open(href, "_blank", "noopener,noreferrer"); setOpen(false); };
  const socials = [
    { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
    { label: "ВКонтакте", href: `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="Поделиться"
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors text-[13px] font-medium"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        <span className="hidden sm:inline">Поделиться</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 min-w-[190px] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-1 shadow-lg">
          <button onClick={copy} className="w-full text-left px-3 py-2 text-[13px] flex items-center justify-between gap-2 text-[var(--foreground)] hover:bg-[var(--muted)]/50 transition-colors">
            {copied ? <span className="text-[var(--success)]">✓ Скопировано</span> : "Копировать ссылку"}
          </button>
          <div className="my-1 border-t border-[var(--border)]" />
          {socials.map(s => (
            <button key={s.label} onClick={() => openShare(s.href)} className="w-full text-left px-3 py-2 text-[13px] text-[var(--foreground)] hover:bg-[var(--muted)]/50 transition-colors">{s.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function FollowButton({ blogSlug, session, onLoginRequired, compact = false }) {
  // Guests can't subscribe yet — clicking takes them to login with an
  // intent to follow this series, and they're returned here afterwards.
  if (!session) {
    return (
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new CustomEvent("devblog:follow-intent", { detail: { blogSlug } }));
          onLoginRequired?.();
        }}
        className={`inline-flex items-center gap-1.5 transition-colors whitespace-nowrap text-[var(--accent)] border border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] bg-transparent ${compact ? "min-h-[30px] rounded-md px-2 py-1 text-[11.5px]" : "h-9 rounded-lg px-3 text-[12.5px] font-medium"}`}
        title="Войдите — и мы вернём вас сюда, уже подписанными"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span className="hidden sm:inline">Войти и подписаться</span>
        <span className="sm:hidden">Подписаться</span>
      </button>
    );
  }
  const [following, setFollowing] = useState(() => isFollowed(blogSlug));
  useEffect(() => {
    const onChange = () => setFollowing(isFollowed(blogSlug));
    window.addEventListener("devblog:follows-changed", onChange);
    return () => window.removeEventListener("devblog:follows-changed", onChange);
  }, [blogSlug]);
  const toggle = (e) => {
    e?.stopPropagation?.();
    setFollow(blogSlug, !following);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${compact ? "min-h-[30px] rounded-md px-2 py-1 text-[11.5px]" : "h-9 rounded-lg px-3 text-[12.5px] font-medium"} ${
        following
          ? "bg-[var(--bg-elevated)] border border-[var(--accent)] text-[var(--accent)]"
          : "bg-[var(--accent)] text-[var(--accent-foreground)] border border-[var(--accent)] hover:opacity-90"
      }`}
      title={following ? "Вы подписаны — новые главы появятся в ленте" : "Получать новые главы в ленте"}
    >
      <svg viewBox="0 0 24 24" width="12" height="12" fill={following ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {following ? "Подписаны" : "Подписаться"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Read-only block renderer for the reader. Supports all 11 block
// types from the editor + cover. No edit affordances.
// ─────────────────────────────────────────────────────────────────
function ReaderBlock({ block, anchor }) {
  const id = anchor || `block-${block.id}`;
  const scrollMt = "scroll-mt-20";

  if (block.type === "h2") {
    return (
      <h2 id={id} className={`font-[var(--font-display)] font-semibold text-2xl tracking-tight pt-6 mb-3 ${scrollMt}`}>
        {block.text}
      </h2>
    );
  }
  if (block.type === "h3") {
    return (
      <h3 id={id} className={`font-[var(--font-display)] font-semibold text-xl tracking-tight pt-4 mb-2 ${scrollMt}`}>
        {block.text}
      </h3>
    );
  }
  if (block.type === "p") {
    return (
      <p id={id} className={`text-[var(--foreground)] mb-4 leading-[1.75] ${scrollMt}`}>
        {block.text}
      </p>
    );
  }
  if (block.type === "quote") {
    return (
      <blockquote id={id} className={`border-l-2 border-[var(--accent)] pl-4 my-4 italic text-[var(--muted-foreground)] leading-[1.7] ${scrollMt}`}>
        {block.text}
      </blockquote>
    );
  }
  if (block.type === "list") {
    const items = block.items || [];
    if (block.subtype === "numbered") {
      return (
        <ol id={id} className={`list-decimal pl-6 mb-4 space-y-1 ${scrollMt}`}>
          {items.map(it => <li key={it.id} className="leading-[1.7]">{it.text}</li>)}
        </ol>
      );
    }
    if (block.subtype === "todo") {
      return (
        <ul id={id} className={`pl-1 mb-4 space-y-1 ${scrollMt}`}>
          {items.map(it => (
            <li key={it.id} className="flex items-baseline gap-2">
              <input type="checkbox" defaultChecked={!!it.done} disabled className="accent-[var(--accent)] translate-y-[1px]" />
              <span className={`leading-[1.7] ${it.done ? "line-through opacity-60" : ""}`}>{it.text}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <ul id={id} className={`list-disc pl-6 mb-4 space-y-1 ${scrollMt}`}>
        {items.map(it => <li key={it.id} className="leading-[1.7]">{it.text}</li>)}
      </ul>
    );
  }
  if (block.type === "code") {
    return (
      <div id={id} className={`my-5 rounded-lg border border-[var(--border)] bg-[var(--code-bg)] overflow-hidden ${scrollMt}`}>
        <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] border-b border-[var(--border)] bg-[var(--bg-elevated)]">
          {block.lang || "code"}
        </div>
        <pre className="text-[13px] leading-[1.65] font-mono px-4 py-3 whitespace-pre overflow-x-auto"><code>{block.text}</code></pre>
      </div>
    );
  }
  if (block.type === "callout") {
    const t = block.tone || "note";
    // Solid bg via color-mix so both light & dark themes keep readable
    // contrast against --foreground text (previously the semi-transparent
    // --*-bg tokens washed out white text in dark mode).
    const styles = {
      note:    { bg: "color-mix(in srgb, var(--info) 14%, var(--background))",    bd: "color-mix(in srgb, var(--info) 35%, var(--border))",    fg: "var(--info)" },
      warning: { bg: "color-mix(in srgb, var(--warning) 14%, var(--background))", bd: "color-mix(in srgb, var(--warning) 35%, var(--border))", fg: "var(--warning)" },
      info:    { bg: "color-mix(in srgb, var(--success) 12%, var(--background))", bd: "color-mix(in srgb, var(--success) 35%, var(--border))", fg: "var(--success)" },
    }[t] || { bg: "var(--muted)", bd: "var(--border)", fg: "var(--muted-foreground)" };
    return (
      <div id={id} className={`rounded-md border px-4 py-3 my-4 ${scrollMt}`} style={{ background: styles.bg, borderColor: styles.bd }}>
        <p className="text-[10.5px] uppercase tracking-wider font-semibold mb-1" style={{ color: styles.fg }}>{t}</p>
        <p className="text-[14.5px] leading-relaxed text-[var(--foreground)]">{block.text}</p>
      </div>
    );
  }
  if (block.type === "mermaid") return <ReaderMermaid id={id} source={block.text} caption={block.caption} />;
  if (block.type === "image") {
    return (
      <figure id={id} className={`my-5 ${scrollMt}`}>
        {block.src ? (
          <img src={block.src} alt={block.caption || ""} className="w-full rounded-lg border border-[var(--border)]" />
        ) : (
          <div className="aspect-[16/9] rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center text-[12px] text-[var(--muted-foreground)]">[изображение]</div>
        )}
        {block.caption && <figcaption className="mt-2 text-[12.5px] text-center text-[var(--muted-foreground)]">{block.caption}</figcaption>}
      </figure>
    );
  }
  if (block.type === "table") {
    const rows = block.rows || [[]];
    return (
      <div id={id} className={`my-4 overflow-x-auto ${scrollMt}`}>
        <table className="w-full border-collapse text-[14px]">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? "bg-[var(--bg-elevated)] font-medium" : ""}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border border-[var(--border)] px-3 py-2">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.type === "embed") {
    return (
      <div id={id} className={`my-4 aspect-video rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center text-[12.5px] text-[var(--muted-foreground)] ${scrollMt}`}>
        {block.url ? <span>embed: {block.url}</span> : <span>embed (URL не указан)</span>}
      </div>
    );
  }
  return <p className="text-rose-600 text-[12px]">Unknown block: {block.type}</p>;
}

function ReaderMermaid({ id, source, caption }) {
  const [open, setOpen] = useState(false);
  return (
    <figure id={id} className="my-5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden scroll-mt-20">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] inline-flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="3" width="6" height="6" rx="1" />
            <rect x="9" y="15" width="6" height="6" rx="1" />
            <line x1="9" y1="6" x2="15" y2="6" /><line x1="6" y1="9" x2="9" y2="15" /><line x1="18" y1="9" x2="15" y2="15" />
          </svg>
          Схема · Mermaid
        </span>
        <button type="button" onClick={() => setOpen(o => !o)} className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--accent)] inline-flex items-center gap-1 px-1.5 py-1 rounded hover:bg-[var(--muted)] min-h-[28px]">
          {open ? "Скрыть код" : "Показать код"}
        </button>
      </div>
      <div className="bg-[var(--background)] flex items-center justify-center px-4 py-8 min-h-[160px]">
        <svg viewBox="0 0 360 100" width="100%" height="120" style={{ maxWidth: 480 }}>
          <defs>
            <marker id={`rd-arr-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--muted-foreground)" />
            </marker>
          </defs>
          <g fontFamily="var(--font-sans)" fontSize="11" textAnchor="middle">
            <rect x="10"  y="35" width="70"  height="30" rx="4" fill="var(--bg-elevated)" stroke="var(--border)" />
            <text x="45"  y="54" fill="var(--foreground)">Browser</text>
            <rect x="130" y="35" width="100" height="30" rx="4" fill="var(--bg-elevated)" stroke="var(--accent)" strokeWidth="1.5" />
            <text x="180" y="54" fill="var(--accent)">Server&nbsp;Component</text>
            <rect x="280" y="10" width="70"  height="28" rx="14" fill="var(--bg-elevated)" stroke="var(--border)" />
            <text x="315" y="28" fill="var(--foreground)">Database</text>
            <rect x="280" y="62" width="70"  height="28" rx="4"  fill="var(--bg-elevated)" stroke="var(--border)" strokeDasharray="3 2" />
            <text x="315" y="80" fill="var(--muted-foreground)">Client</text>
          </g>
          <g fill="none" stroke="var(--muted-foreground)" strokeWidth="1.2">
            <line x1="80"  y1="50" x2="128" y2="50" markerEnd={`url(#rd-arr-${id})`} />
            <line x1="230" y1="44" x2="278" y2="28" markerEnd={`url(#rd-arr-${id})`} />
            <line x1="230" y1="58" x2="278" y2="76" strokeDasharray="3 2" markerEnd={`url(#rd-arr-${id})`} />
          </g>
        </svg>
      </div>
      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--code-bg)]">
          <pre className="text-[11.5px] leading-[1.6] font-mono px-3 py-2 whitespace-pre overflow-x-auto"><code>{source}</code></pre>
        </div>
      )}
      {caption && <figcaption className="px-3 py-2 text-[12.5px] text-center text-[var(--muted-foreground)] border-t border-[var(--border)]">{caption}</figcaption>}
    </figure>
  );
}

// ─────────────────────────────────────────────────────────────────
// ChapterList — left rail (desktop) / bottom-sheet (mobile).
// ─────────────────────────────────────────────────────────────────
function ChapterList({ chapters, activeSlug, onPick, mode, onSetMode, isOwner }) {
  const publishedCount = chapters.filter(c => window.__blogData.isChapterPublished(c)).length;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--foreground)]">Главы · {chapters.length}</p>
        <div className="inline-flex items-center gap-0 border border-[var(--border)] rounded-md p-0.5 text-[10.5px]">
          <button
            onClick={() => onSetMode("chapter")}
            className={`px-2 py-1 rounded ${mode === "chapter" ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-medium" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"} min-h-[28px]`}
          >Глава</button>
          <button
            onClick={() => onSetMode("all")}
            className={`px-2 py-1 rounded ${mode === "all" ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-medium" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"} min-h-[28px]`}
            title={`${publishedCount} опубликованных глав подряд`}
          >Весь блог</button>
        </div>
      </div>
      <ol className="flex flex-col gap-1">
        {chapters.map((c, i) => {
          const isActive = c.slug === activeSlug && mode === "chapter";
          const status = window.__blogData.chapterStatus(c);
          const pubLabel = !isOwner ? null
                          : status === "published" ? "опубликовано"
                          : status === "draft" ? "черновик"
                          : status === "under-review" ? "на ревью"
                          : status === "changes-requested" ? "правки" : null;
          const pubTone = status === "published" ? "text-[var(--success)]"
                          : status === "draft" ? "text-[var(--muted-foreground)]"
                          : "text-[var(--info)]";
          return (
            <li key={c.slug}>
              <button
                onClick={() => onPick(c.slug)}
                className={`w-full text-left rounded-md px-2.5 py-2 transition-colors min-h-[44px] flex items-start gap-2 ${
                  isActive
                    ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] border border-[var(--accent)]/50"
                    : "border border-transparent hover:bg-[var(--muted)]/40"
                }`}
                title={c.title}
              >
                <span className={`text-[11px] tabular-nums font-semibold pt-0.5 ${isActive ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13.5px] leading-snug title-clamp-2 ${isActive ? "text-[var(--accent)] font-semibold" : "text-[var(--foreground)] font-medium"}`}>
                    {c.title}
                  </p>
                  {pubLabel && (
                    <p className={`text-[11px] mt-0.5 ${pubTone} font-medium`}>{pubLabel}</p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ChapterToc — in-chapter heading nav (h2/h3). Tracks the top-most
// heading via IntersectionObserver and smooth-scrolls on click.
// Used standalone (single-chapter rail) and nested inside SeriesNav.
// ─────────────────────────────────────────────────────────────────
function ChapterToc({ chapter, scrollRef, nested = false, anchorPrefix = null }) {
  const mkAnchor = (id) => anchorPrefix ? `block-${anchorPrefix}-${id}` : `block-${id}`;
  const toc = useMemo(() => chapter.blocks
    .filter(b => b.type === "h2" || b.type === "h3")
    .map(b => ({ slug: mkAnchor(b.id), text: b.text, level: b.type === "h2" ? 2 : 3 })), [chapter.slug, anchorPrefix]);

  const [activeAnchor, setActiveAnchor] = useState(toc[0]?.slug);
  useEffect(() => { setActiveAnchor(toc[0]?.slug); }, [chapter.slug, anchorPrefix]);

  // Scroll-driven active heading: the last heading whose top has passed the
  // reading line (~120px below the scroll-container top). Deterministic —
  // avoids the IntersectionObserver "band" ambiguity.
  useEffect(() => {
    const root = scrollRef?.current;
    if (!root || !toc.length) return;
    const onScroll = () => {
      const y = root.scrollTop + 120;
      let cur = toc[0]?.slug;
      for (const t of toc) {
        const el = root.querySelector(`#${CSS.escape(t.slug)}`);
        if (el && el.offsetTop <= y) cur = t.slug; else if (el) break;
      }
      setActiveAnchor(cur);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [chapter.slug, anchorPrefix]);

  const jump = (slug) => {
    setActiveAnchor(slug);
    const root = scrollRef?.current;
    const el = root?.querySelector(`#${CSS.escape(slug)}`);
    if (el) root.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" });
  };

  if (toc.length === 0) {
    return nested ? null : <p className="text-[11.5px] text-[var(--muted-foreground)]">Подзаголовков нет.</p>;
  }
  return (
    <ul className={nested ? "mt-1.5 mb-1 space-y-0.5 border-l border-[var(--border)] ml-3.5 pl-2" : "space-y-0.5"}>
      {toc.map(t => (
        <li key={t.slug} className={t.level === 3 ? "ml-3" : ""}>
          <button
            onClick={() => jump(t.slug)}
            className={`text-left w-full text-[12px] leading-snug py-1 pl-2.5 border-l-2 -ml-px transition-colors ${
              activeAnchor === t.slug
                ? "text-[var(--accent)] font-medium border-[var(--accent)]"
                : "text-[var(--muted-foreground)] border-transparent hover:text-[var(--foreground)] hover:border-[var(--border)]"
            }`}
          >
            {t.text}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────
// SeriesNav — unified right-hand rail for multi-chapter blogs.
// Combines the series chapter list with the active chapter's heading
// nav (the active chapter expands to reveal its ToC, docs-style).
// In "all" mode, picking a chapter scrolls to its section in-page.
// ─────────────────────────────────────────────────────────────────
function SeriesNav({ chapters, activeSlug, mode, onSetMode, onPick, onJump, isOwner, activeChapter, scrollRef }) {
  const publishedCount = chapters.filter(c => window.__blogData.isChapterPublished(c)).length;

  // In "all" (whole-blog) mode the rail is the single position indicator:
  // track which chapter section the reader has scrolled into (last section
  // whose top passed the reading line) so we can highlight it + reveal its ToC.
  const [allActiveSlug, setAllActiveSlug] = useState(activeSlug);
  const navRef = useRef(null);
  useEffect(() => {
    if (mode !== "all") return;
    const root = scrollRef?.current;
    if (!root) return;
    const onScroll = () => {
      const y = root.scrollTop + 120;
      let cur = chapters[0]?.slug;
      for (const c of chapters) {
        const el = root.querySelector(`#chapter-${c.slug}`);
        if (el && el.offsetTop <= y) cur = c.slug; else if (el) break;
      }
      setAllActiveSlug(cur);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [mode, chapters.map(c => c.slug).join("|"), scrollRef]);

  const effectiveActive = mode === "all" ? allActiveSlug : activeSlug;

  // Keep the active chapter row visible inside the (independently scrollable)
  // rail when the list is long — scroll only the rail, never the page.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const el = nav.querySelector('[aria-current="true"]');
    if (!el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < nav.scrollTop + 8) nav.scrollTop = top - 8;
    else if (bottom > nav.scrollTop + nav.clientHeight - 8) nav.scrollTop = bottom - nav.clientHeight + 8;
  }, [effectiveActive]);

  return (
    <nav ref={navRef} className="sticky top-20 flex flex-col gap-3 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1 -mr-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--foreground)]">Главы · {chapters.length}</p>
        <div className="inline-flex items-center border border-[var(--border)] rounded-md p-0.5 text-[10.5px] shrink-0">
          <button
            onClick={() => onSetMode("chapter")}
            className={`px-2 py-1 rounded ${mode === "chapter" ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-medium" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"} min-h-[28px]`}
          >Глава</button>
          <button
            onClick={() => onSetMode("all")}
            className={`px-2 py-1 rounded ${mode === "all" ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-medium" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"} min-h-[28px]`}
            title={`${publishedCount} опубликованных глав подряд`}
          >Весь блог</button>
        </div>
      </div>

      <ol className="flex flex-col gap-0.5">
        {chapters.map((c, i) => {
          const isActive = c.slug === effectiveActive;
          const status = window.__blogData.chapterStatus(c);
          const pubLabel = !isOwner ? null
                          : status === "published" ? "опубликовано"
                          : status === "draft" ? "черновик"
                          : status === "under-review" ? "на ревью"
                          : status === "changes-requested" ? "правки" : null;
          const pubTone = status === "published" ? "text-[var(--success)]"
                          : status === "draft" ? "text-[var(--muted-foreground)]"
                          : "text-[var(--info)]";
          return (
            <li key={c.slug}>
              <button
                onClick={() => mode === "all" ? onJump?.(c.slug) : onPick(c.slug)}
                className={`w-full text-left rounded-md px-2.5 py-2 transition-colors min-h-[40px] flex items-start gap-2 ${
                  isActive
                    ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                    : "hover:bg-[var(--muted)]/40"
                }`}
                title={c.title}
                aria-current={isActive ? "true" : undefined}
              >
                <span className={`text-[11px] tabular-nums font-semibold pt-0.5 ${isActive ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] leading-snug title-clamp-2 ${isActive ? "text-[var(--accent)] font-semibold" : "text-[var(--foreground)] font-medium"}`}>
                    {c.title}
                  </p>
                  {pubLabel && <p className={`text-[10.5px] mt-0.5 ${pubTone} font-medium`}>{pubLabel}</p>}
                </div>
              </button>
              {/* Active chapter reveals its in-chapter heading nav, docs-style.
                  In "all" mode the headings live under chapter-prefixed anchors. */}
              {isActive && <ChapterToc chapter={c} scrollRef={scrollRef} nested anchorPrefix={mode === "all" ? c.slug : null} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────
// Fragment commenting — select text in the reader prose to attach a
// comment to that block. Resolves the selection to { chapterSlug, blockId,
// quote } and shows a floating "Прокомментировать" button.
// ─────────────────────────────────────────────────────────────────
function resolveSelectionAnchor(root, opts) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !root) return null;
  if (!root.contains(sel.anchorNode)) return null;
  const quote = sel.toString().trim();
  if (quote.length < 3) return null;
  let el = sel.anchorNode;
  if (el && el.nodeType === 3) el = el.parentElement;
  while (el && el !== root && !(el.id && el.id.indexOf("block-") === 0)) el = el.parentElement;
  if (!el || !el.id) return null;
  const id = el.id;
  if (opts.chapterSlug) {
    return { chapterSlug: opts.chapterSlug, blockId: id.replace(/^block-/, ""), quote };
  }
  for (const ch of (opts.chapters || [])) {
    const p = `block-${ch.slug}-`;
    if (id.indexOf(p) === 0) return { chapterSlug: ch.slug, blockId: id.slice(p.length), quote };
  }
  return null;
}

function FragmentCommentButton({ scrollRef, enabled, resolve, onPick }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    const root = scrollRef?.current;
    if (!root) return;
    const onUp = () => setTimeout(() => {
      const a = resolve();
      if (!a) { setPos(null); return; }
      const r = window.getSelection().getRangeAt(0).getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top, anchor: a });
    }, 10);
    const onDown = (e) => { if (!e.target.closest?.("[data-frag-btn]")) setPos(null); };
    document.addEventListener("mouseup", onUp);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("mouseup", onUp); document.removeEventListener("mousedown", onDown); };
  }, [scrollRef, enabled, resolve]);
  if (!pos) return null;
  return (
    <button
      data-frag-btn
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => { onPick(pos.anchor); setPos(null); window.getSelection()?.removeAllRanges(); }}
      style={{ position: "fixed", left: pos.x, top: Math.max(8, pos.y - 46), transform: "translateX(-50%)", zIndex: 50 }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--foreground)] text-[var(--background)] text-[12.5px] font-medium shadow-lg whitespace-nowrap"
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      Прокомментировать
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// ChapterReviewerCredit — end-of-chapter credit card (Фаза E, вариант B).
// Shows the chapter's CURRENT reviewers as chips (primary tagged «ведущий»);
// everyone who also worked on earlier revisions is tucked behind an
// expandable disclosure so the list never grows unwieldy.
// ─────────────────────────────────────────────────────────────────
function ChapterReviewerCredit({ blog, chapter, onOpenProfile }) {
  const users = window.FAKE_DATA.users || {};
  const [open, setOpen] = useState(false);
  const { reviewerHandles, primaryHandle } = window.__blogData.effectiveChapterTeam(chapter, blog.slug);
  const { all } = window.__blogData.chapterAllReviewers(chapter);
  const current = reviewerHandles || [];
  if (current.length === 0) return null; // classic blogs without a review team
  const pastOnly = (all || []).filter(h => !current.includes(h));
  const nameOf = (h) => users[h]?.name || h;

  const Person = ({ h }) => (
    <button
      onClick={() => onOpenProfile?.(h)}
      className="inline-flex items-center gap-2 group/rev"
      title={`Профиль @${h}`}
    >
      <Avatar handle={h} name={nameOf(h)} size={26} />
      <span className="text-[13.5px] font-medium text-[var(--foreground)] group-hover/rev:text-[var(--accent)] transition-colors">{nameOf(h)}</span>
    </button>
  );

  return (
    <section className="mt-12 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-5 sm:p-6">
      <p className="flex items-center gap-2 text-[12px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-4">
        <span className="w-4 h-4 rounded-full bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success)] inline-flex items-center justify-center text-[10px] leading-none">✓</span>
        Главу ревьюили
      </p>

      <ul className="flex flex-wrap gap-2.5">
        {current.map(h => (
          <li key={h} className="inline-flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-elevated)] rounded-full pl-1.5 pr-3.5 py-1">
            <Person h={h} />
            {h === primaryHandle && <span className="text-[11px] text-[var(--muted-foreground)]">· ведущий</span>}
          </li>
        ))}
      </ul>

      {pastOnly.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            aria-expanded={open}
          >
            <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>›</span>
            {open ? "Скрыть остальных ревьюеров" : `Все, кто участвовал в ревью · ещё ${pastOnly.length}`}
          </button>
          {open && (
            <ul className="mt-3 flex flex-wrap gap-2.5 pl-3 border-l border-[var(--border)]">
              {pastOnly.map(h => (
                <li key={h} className="inline-flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-elevated)] rounded-full pl-1.5 pr-3.5 py-1">
                  <Person h={h} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// BlogReviewerCredit — aggregated credit card for "Весь блог" mode.
// One card for the whole blog: current reviewers across all published
// chapters as chips; everyone else who ever reviewed is behind a disclosure,
// each annotated with the chapter(s) they worked on in parentheses.
// ─────────────────────────────────────────────────────────────────
function BlogReviewerCredit({ blog, chapters, onOpenProfile }) {
  const users = window.FAKE_DATA.users || {};
  const D = window.__blogData;
  const [open, setOpen] = useState(false);
  const currentSet = new Set();
  const primarySet = new Set();
  const involvedChapters = {}; // handle -> Set(chapter titles)
  for (const ch of (chapters || [])) {
    if (!D.isChapterPublished(ch)) continue;
    const team = D.effectiveChapterTeam(ch, blog.slug);
    const { all } = D.chapterAllReviewers(ch);
    (team.reviewerHandles || []).forEach(h => currentSet.add(h));
    if (team.primaryHandle) primarySet.add(team.primaryHandle);
    (all || []).forEach(h => { (involvedChapters[h] = involvedChapters[h] || new Set()).add(ch.title); });
  }
  const current = [...currentSet];
  if (current.length === 0) return null;
  const others = Object.keys(involvedChapters).filter(h => !currentSet.has(h));
  const nameOf = (h) => users[h]?.name || h;

  const Person = ({ h }) => (
    <button onClick={() => onOpenProfile?.(h)} className="inline-flex items-center gap-2 group/rev" title={`Профиль @${h}`}>
      <Avatar handle={h} name={nameOf(h)} size={26} />
      <span className="text-[13.5px] font-medium text-[var(--foreground)] group-hover/rev:text-[var(--accent)] transition-colors">{nameOf(h)}</span>
    </button>
  );

  return (
    <section className="mt-12 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-5 sm:p-6">
      <p className="flex items-center gap-2 text-[12px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-4">
        <span className="w-4 h-4 rounded-full bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success)] inline-flex items-center justify-center text-[10px] leading-none">✓</span>
        Блог ревьюили
      </p>
      <ul className="flex flex-wrap gap-2.5">
        {current.map(h => (
          <li key={h} className="inline-flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-elevated)] rounded-full pl-1.5 pr-3.5 py-1">
            <Person h={h} />
            {primarySet.has(h) && <span className="text-[11px] text-[var(--muted-foreground)]">· ведущий</span>}
          </li>
        ))}
      </ul>
      {others.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            aria-expanded={open}
          >
            <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>›</span>
            {open ? "Скрыть остальных ревьюеров" : `Все, кто участвовал в ревью · ещё ${others.length}`}
          </button>
          {open && (
            <ul className="mt-3 flex flex-wrap gap-2.5 pl-3 border-l border-[var(--border)]">
              {others.map(h => (
                <li key={h} className="inline-flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-elevated)] rounded-full pl-1.5 pr-3.5 py-1">
                  <Person h={h} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// ChapterReader — single chapter view with prev/next.
// ─────────────────────────────────────────────────────────────────
function ChapterReader({ blog, chapter, prevChapter, nextChapter, onPick, session, onLoginRequired, scrollRef, onOpenProfile, isMulti, author, totalVisibleChapters, visibleOrder }) {
  const headingRef = useRef(null);
  const mountedRef = useRef(false);

  // Focus management: move focus to the new chapter's h1 when the reader
  // switches chapters (skip the very first mount so we don't steal focus
  // on page load).
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    headingRef.current?.focus?.({ preventScroll: true });
  }, [chapter.slug]);

  // Reading time (rough): 200 wpm over total text length.
  const wordCount = chapter.blocks.reduce((n, b) => n + (b.text || "").split(/\s+/).filter(Boolean).length, 0);
  const readingMin = Math.max(1, Math.round(wordCount / 200));

  const [pendingAnchor, setPendingAnchor] = useState(null);
  const canCommentHere = !!session && (session.role === "reader" || (session.role === "author" && blog.authorSlug === session.handle));
  const pickAnchor = (a) => {
    setPendingAnchor(a);
    setTimeout(() => {
      const root = scrollRef?.current;
      const form = root?.querySelector("#comment-form");
      if (form && root) root.scrollTo({ top: form.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 80, behavior: "smooth" });
    }, 30);
  };

  return (
    <article className="min-w-0">
      <FragmentCommentButton
        scrollRef={scrollRef}
        enabled={canCommentHere}
        resolve={() => resolveSelectionAnchor(scrollRef?.current, { chapterSlug: chapter.slug })}
        onPick={pickAnchor}
      />
      {/* Chapter title + meta */}
      {isMulti && (
        <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-2 tabular-nums">
          Глава {(visibleOrder ?? chapter.order) + 1} из {totalVisibleChapters || blog.chapters.length}
        </p>
      )}
      <h1 ref={headingRef} tabIndex={-1} className="font-[var(--font-display)] font-extrabold text-3xl md:text-5xl leading-[1.1] tracking-tight mb-4 title-clamp-3 focus:outline-none" title={chapter.title}>
        {chapter.title}
      </h1>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-[var(--muted-foreground)] mb-8">
        {author && (
          <button
            type="button"
            onClick={() => onOpenProfile?.(author.handle)}
            className="inline-flex items-center gap-1.5 px-1.5 py-1 -ml-1.5 rounded hover:bg-[var(--muted)]/40 transition-colors group/auth min-h-[32px]"
            title={`Перейти к профилю @${author.handle}`}
          >
            <span className="w-5 h-5 rounded-full bg-[var(--muted)] inline-flex items-center justify-center text-[10px] uppercase font-semibold text-[var(--muted-foreground)]">{author.name?.slice(0, 1)}</span>
            <span className="text-[var(--foreground)] group-hover/auth:text-[var(--accent)] transition-colors font-medium">{author.name}</span>
          </button>
        )}
        {chapter.revision?.publishedAt && (
          <>
            <span>·</span>
            <span>{new Date(chapter.revision.publishedAt * 1000).toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" })}</span>
          </>
        )}
        <span>·</span>
        <span>{readingMin} мин чтения</span>
      </div>

      {/* Engagement for single-chapter blogs (multi shows it in the hero). */}
      {!isMulti && (
        <div className="mb-8 pb-6 border-b border-[var(--border)]">
          <BlogEngagementBar blog={blog} session={session} onLoginRequired={onLoginRequired} />
        </div>
      )}

      <div className="reader-prose text-[16px]">
        {chapter.blocks.map(b => <ReaderBlock key={b.id} block={b} anchor={`block-${b.id}`} />)}
      </div>

      {/* End-of-chapter reviewer credit (Фаза E, вариант B) */}
      <ChapterReviewerCredit blog={blog} chapter={chapter} onOpenProfile={onOpenProfile} />

      {/* Prev / next chapter nav */}
      <nav className="mt-12 pt-6 border-t border-[var(--border)] flex items-stretch gap-3">
        <button
          type="button"
          disabled={!prevChapter}
          onClick={() => prevChapter && onPick(prevChapter.slug)}
          className="flex-1 text-left px-4 py-3 rounded-lg border border-[var(--border)] hover:border-[var(--foreground)]/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-h-[64px]"
        >
          <p className="text-[10.5px] uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">← Предыдущая</p>
          <p className="text-[13.5px] font-medium title-clamp-1">{prevChapter ? prevChapter.title : "—"}</p>
        </button>
        <button
          type="button"
          disabled={!nextChapter}
          onClick={() => nextChapter && onPick(nextChapter.slug)}
          className="flex-1 text-right px-4 py-3 rounded-lg border border-[var(--border)] hover:border-[var(--foreground)]/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-h-[64px]"
        >
          <p className="text-[10.5px] uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">Следующая →</p>
          <p className="text-[13.5px] font-medium title-clamp-1">{nextChapter ? nextChapter.title : "—"}</p>
        </button>
      </nav>

      {/* Public discussion — readers & authors only (gated inside). */}
      <CommentsSection
        scrollRef={scrollRef}
        session={session}
        blogSlug={blog.slug}
        chapterSlug={chapter.slug}
        chapterRevision={chapter.revision?.number}
        blocks={chapter.blocks}
        blogAuthorHandle={blog.authorSlug}
        pendingAnchor={pendingAnchor}
        onClearAnchor={() => setPendingAnchor(null)}
        onLoginRequired={onLoginRequired}
        onOpenProfile={onOpenProfile}
      />
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────
// WholeBlogReader — concatenated render of all chapters.
// Public reader: only PUBLISHED chapters; the chapter rail still lists
// drafts/under-review with a status pill so the reader sees what's
// coming. (Author/admin contexts skip this filter.)
// ─────────────────────────────────────────────────────────────────
function WholeBlogReader({ blog, scrollRef, allowUnpublished, onOpenProfile, session, onLoginRequired }) {
  const visibleChapters = allowUnpublished
    ? blog.chapters
    : blog.chapters.filter(c => window.__blogData.isChapterPublished(c));
  const publishedChapters = blog.chapters.filter(c => window.__blogData.isChapterPublished(c));

  const [pendingAnchor, setPendingAnchor] = useState(null);
  const canCommentHere = !!session && (session.role === "reader" || (session.role === "author" && blog.authorSlug === session.handle));
  const pickAnchor = (a) => {
    setPendingAnchor(a);
    setTimeout(() => {
      const root = scrollRef?.current;
      const form = root?.querySelector("#comment-form");
      if (form && root) root.scrollTo({ top: form.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 80, behavior: "smooth" });
    }, 30);
  };

  return (
    <div className="min-w-0">
      <FragmentCommentButton
        scrollRef={scrollRef}
        enabled={canCommentHere}
        resolve={() => resolveSelectionAnchor(scrollRef?.current, { chapters: visibleChapters })}
        onPick={pickAnchor}
      />
      <article className="reader-prose">
        {visibleChapters.length === 0 ? (
          <p className="text-[14px] text-[var(--muted-foreground)] py-16 text-center">В этом блоге пока нет опубликованных глав.</p>
        ) : visibleChapters.map((chapter, idx) => {
          const status = window.__blogData.chapterStatus(chapter);
          const isPublished = status === "published";
          return (
            <section key={chapter.slug} id={`chapter-${chapter.slug}`} className={`mb-16 scroll-mt-20 ${!isPublished ? "opacity-70" : ""}`}>
              <div className="mb-6 pb-4 border-b border-[var(--border)]">
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] tabular-nums">
                    Глава {idx + 1}
                  </p>
                  {!isPublished && (
                    <span className="text-[10.5px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--info)_15%,transparent)] text-[var(--info)]">
                      {status === "draft" ? "Черновик автора" : "На ревью"}
                    </span>
                  )}
                </div>
                <h1 className="font-[var(--font-display)] font-extrabold text-3xl md:text-4xl leading-[1.1] tracking-tight title-clamp-3" title={chapter.title}>
                  {chapter.title}
                </h1>
              </div>
              {isPublished ? (
                <div className="text-[16px]">
                  {chapter.blocks.map(b => <ReaderBlock key={b.id} block={b} anchor={`block-${chapter.slug}-${b.id}`} />)}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] p-6 text-center">
                  <p className="text-[13.5px] text-[var(--muted-foreground)] leading-relaxed">
                    Эта глава ещё не опубликована. Автор работает над ней
                    {status === "under-review" ? " и сейчас она на ревью у команды редакторов." : "."}
                  </p>
                </div>
              )}
            </section>
          );
        })}
      </article>

      {/* One aggregated reviewer card for the whole blog */}
      <BlogReviewerCredit blog={blog} chapters={publishedChapters} onOpenProfile={onOpenProfile} />

      {/* One comments section for the whole blog (all chapters) */}
      <CommentsSection
        scrollRef={scrollRef}
        session={session}
        blogSlug={blog.slug}
        chapters={visibleChapters}
        blogAuthorHandle={blog.authorSlug}
        pendingAnchor={pendingAnchor}
        onClearAnchor={() => setPendingAnchor(null)}
        onLoginRequired={onLoginRequired}
        onOpenProfile={onOpenProfile}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Mobile chapter sheet (bottom-sheet modal for picking a chapter).
// ─────────────────────────────────────────────────────────────────
function ChapterSheet({ chapters, activeSlug, mode, isOwner, onPick, onSetMode, onClose }) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef(null);

  const onTouchStart = (e) => {
    startRef.current = e.touches[0].clientY;
    setDragging(true);
  };
  const onTouchMove = (e) => {
    if (startRef.current == null) return;
    const dy = e.touches[0].clientY - startRef.current;
    setDragY(Math.max(0, dy)); // only allow downward drag
  };
  const onTouchEnd = () => {
    setDragging(false);
    if (dragY > 90) { onClose(); return; } // past threshold → dismiss
    setDragY(0); // snap back
    startRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-[var(--background)] border-t border-[var(--border)] rounded-t-2xl max-h-[80vh] overflow-y-auto p-4 will-change-transform"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragging ? "none" : "transform 200ms ease-out",
        }}
      >
        {/* Drag handle — swipe down to dismiss */}
        <div
          className="flex justify-center -mt-1 mb-2 pt-1 pb-2 cursor-grab touch-none select-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          role="presentation"
          aria-hidden="true"
        >
          <span className="block w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-[var(--font-display)] font-bold text-lg">Главы</h3>
          <button type="button" onClick={onClose} className="text-[var(--muted-foreground)] text-[24px] leading-none px-2 min-h-[44px]">×</button>
        </div>
        <ChapterList
          chapters={chapters}
          activeSlug={activeSlug}
          mode={mode}
          isOwner={isOwner}
          onPick={(slug) => { onPick(slug); onClose(); }}
          onSetMode={(m) => { onSetMode(m); onClose(); }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// BlogReaderScreen — main entry.
// ─────────────────────────────────────────────────────────────────
function BlogReaderScreen({ session, slug, onLoginRequired, scrollRef, onBack, onOpenProfile }) {
  const blog = (slug && window.__blogData.getBlogBySlug(slug))
    || window.__blogData.getBlogBySlug("nextjs-16-series")
    || window.__blogData.getBlogs()[0];

  if (!blog) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12" data-screen-label="BlogReader">
        <p className="text-[14px] text-[var(--muted-foreground)]">Блог не найден.</p>
      </div>
    );
  }

  // Role separation: authors don't read other authors' blogs — their surface
  // is their own cabinet. Gently redirect rather than show foreign content.
  if (session?.role === "author" && blog.authorSlug !== session.handle) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center" data-screen-label="BlogReader">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-3">Только свои блоги</p>
        <h1 className="font-[var(--font-display)] font-extrabold text-3xl tracking-tight mb-3">Это блог другого автора</h1>
        <p className="text-[14.5px] text-[var(--muted-foreground)] leading-relaxed mb-7 max-w-md mx-auto">
          В роли автора вы работаете в своём кабинете — чужие блоги здесь не открываются.
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] text-[13.5px] font-medium hover:opacity-90 transition-opacity"
        >
          ← Назад
        </button>
      </div>
    );
  }

  // Author / admin / reviewer-on-this-chapter can see in-progress chapters.
  // Public readers and guests only see published.
  const isOwner = session?.handle === blog.authorSlug || session?.role === "admin";
  const visibleChapters = isOwner
    ? blog.chapters
    : blog.chapters.filter(c => window.__blogData.isChapterPublished(c));

  const isMulti = visibleChapters.length > 1;
  const publishedChapters = blog.chapters.filter(c => window.__blogData.isChapterPublished(c));

  // Mode + active chapter, persisted per blog.
  const [mode, setMode] = useState("chapter");
  const [activeChapterSlug, setActiveChapterSlug] = useState(() => {
    try {
      const saved = localStorage.getItem(lastChapterKey(blog.slug));
      if (saved && blog.chapters.find(c => c.slug === saved)) return saved;
    } catch {}
    return (publishedChapters[0] || blog.chapters[0]).slug;
  });
  useEffect(() => {
    try { localStorage.setItem(lastChapterKey(blog.slug), activeChapterSlug); } catch {}
  }, [blog.slug, activeChapterSlug]);

  const activeChapter = visibleChapters.find(c => c.slug === activeChapterSlug) || visibleChapters[0] || blog.chapters[0];
  const idx = visibleChapters.indexOf(activeChapter);
  const prevChapter = visibleChapters[idx - 1] || null;
  const nextChapter = visibleChapters[idx + 1] || null;

  const [chapterSheetOpen, setChapterSheetOpen] = useState(false);
  const author = window.FAKE_DATA.users?.[blog.authorSlug];

  // SEO / Open Graph — update per blog + active chapter (chapter mode) or
  // per blog (whole-blog mode). Reset to site defaults on unmount.
  useEffect(() => {
    if (!window.__setOG) return;
    const inChapter = mode === "chapter" && isMulti;
    const title = inChapter
      ? `${activeChapter?.title} — ${blog.title}`
      : blog.title;
    const description = (inChapter ? null : blog.summary)
      || activeChapter?.blocks?.find(b => b.type === "p")?.text
      || blog.summary || "";
    window.__setOG({
      type: "article",
      title,
      description: description.slice(0, 200),
      image: blog.cover || activeChapter?.cover || "",
      url: `${location.origin}/blog/${blog.slug}${inChapter ? "#" + activeChapter?.slug : ""}`,
    });
    return () => window.__resetOG?.();
  }, [blog.slug, activeChapterSlug, mode, isMulti]);

  const totalWords = blog.chapters.filter(c => window.__blogData.isChapterPublished(c))
    .reduce((n, c) => n + c.blocks.reduce((m, b) => m + (b.text || "").split(/\s+/).filter(Boolean).length, 0), 0);
  const totalReadingMin = Math.max(1, Math.round(totalWords / 200));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10" data-screen-label="BlogReader">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-5 sm:mb-6 min-h-[44px] -ml-1 px-1"
      >
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 18 5 12 11 6"/></svg>
        Назад к статьям
      </button>

      {/* Blog header (only shown for multi-chapter blogs — single-chapter
          articles get their title as the chapter h1, which is what readers
          of the legacy public articles expect). */}
      {isMulti && (
        <header className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-[var(--border)]">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-2">{visibleChapters.length} {visibleChapters.length === 1 ? "глава" : visibleChapters.length < 5 ? "главы" : "глав"}</p>
          <div className="mb-3">
            <h1 className="font-[var(--font-display)] font-extrabold text-3xl sm:text-4xl md:text-5xl leading-[1.05] tracking-tight title-clamp-3 min-w-0" title={blog.title}>
              {blog.title}
            </h1>
          </div>
          {blog.summary && (
            <p className="text-[15px] sm:text-[16px] text-[var(--muted-foreground)] leading-relaxed mb-4 max-w-2xl">
              {blog.summary}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-[var(--muted-foreground)]">
            {author && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenProfile?.(author.handle); }}
                className="inline-flex items-center gap-1.5 px-1.5 py-1 -ml-1.5 rounded hover:bg-[var(--muted)]/40 transition-colors group/auth min-h-[32px]"
                title={`Перейти к профилю @${author.handle}`}
              >
                <span className="w-5 h-5 rounded-full bg-[var(--muted)] inline-flex items-center justify-center text-[10px] uppercase font-semibold text-[var(--muted-foreground)]">{author.name?.slice(0, 1)}</span>
                <span className="text-[var(--foreground)] group-hover/auth:text-[var(--accent)] transition-colors font-medium">{author.name}</span>
                <span className="text-[var(--muted-foreground)] text-[11px]">@{author.handle}</span>
              </button>
            )}
            <span>·</span>
            {isOwner ? (
              <span>{publishedChapters.length} из {blog.chapters.length} опубликовано</span>
            ) : (
              <span>{publishedChapters.length} {publishedChapters.length === 1 ? "глава" : publishedChapters.length < 5 ? "главы" : "глав"}</span>
            )}
            <span>·</span>
            <span>{totalReadingMin} мин на весь блог</span>
            {blog.tags?.length > 0 && (
              <>
                <span>·</span>
                <div className="flex flex-wrap gap-1">
                  {blog.tags.map(t => (
                    <span key={t} className="text-[11.5px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">{t}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Engagement: vote · bookmark · share · report · follow */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <BlogEngagementBar blog={blog} session={session} onLoginRequired={onLoginRequired} />
            <FollowButton blogSlug={blog.slug} session={session} onLoginRequired={onLoginRequired} />
          </div>

          {/* Mobile chapter switcher */}
          <button
            type="button"
            onClick={() => setChapterSheetOpen(true)}
            className="lg:hidden mt-5 w-full inline-flex items-center justify-between gap-2 px-3 py-2.5 rounded-md border border-[var(--border)] hover:border-[var(--accent)] transition-colors min-h-[44px] text-[13px]"
          >
            <span className="text-[var(--muted-foreground)] uppercase tracking-wider text-[10px] font-semibold">{mode === "all" ? "Весь блог" : `Глава ${visibleChapters.indexOf(activeChapter) + 1}/${visibleChapters.length}`}</span>
            <span className="font-medium title-clamp-1 flex-1 text-left">{mode === "all" ? blog.title : activeChapter.title}</span>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--muted-foreground)]"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </header>
      )}

      <div className={`grid grid-cols-1 ${isMulti ? "lg:grid-cols-[1fr_256px]" : "lg:grid-cols-[1fr_220px]"} gap-8 lg:gap-12`}>
        {/* Reading column — now the primary, wide column on the left */}
        <div className="min-w-0">
          {mode === "all" && isMulti ? (
            <WholeBlogReader blog={blog} scrollRef={scrollRef} allowUnpublished={isOwner} onOpenProfile={onOpenProfile} session={session} onLoginRequired={onLoginRequired} />
          ) : (
            <ChapterReader
              blog={blog}
              chapter={activeChapter}
              prevChapter={prevChapter}
              nextChapter={nextChapter}
              onPick={(s) => { setActiveChapterSlug(s); setMode("chapter"); }}
              session={session}
              onLoginRequired={onLoginRequired}
              scrollRef={scrollRef}
              onOpenProfile={onOpenProfile}
              isMulti={isMulti}
              author={author}
              totalVisibleChapters={visibleChapters.length}
              visibleOrder={visibleChapters.indexOf(activeChapter)}
            />
          )}
        </div>

        {/* Right rail: series + chapter nav (multi) or in-chapter ToC (single) */}
        <aside className="hidden lg:block">
          {isMulti ? (
            <SeriesNav
              chapters={visibleChapters}
              activeSlug={activeChapterSlug}
              mode={mode}
              onSetMode={setMode}
              onPick={(s) => { setActiveChapterSlug(s); setMode("chapter"); }}
              onJump={(s) => {
                const el = scrollRef?.current?.querySelector(`#chapter-${s}`);
                if (el) scrollRef.current.scrollTo({ top: el.offsetTop - 20, behavior: "smooth" });
              }}
              isOwner={isOwner}
              activeChapter={activeChapter}
              scrollRef={scrollRef}
            />
          ) : (
            <div className="sticky top-20">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">В этой статье</p>
              <ChapterToc chapter={activeChapter} scrollRef={scrollRef} />
            </div>
          )}
        </aside>
      </div>

      {/* Mobile chapter sheet */}
      {chapterSheetOpen && (
        <ChapterSheet
          chapters={visibleChapters}
          activeSlug={activeChapterSlug}
          isOwner={isOwner}
          mode={mode}
          onPick={(s) => { setActiveChapterSlug(s); setMode("chapter"); }}
          onSetMode={setMode}
          onClose={() => setChapterSheetOpen(false)}
        />
      )}
    </div>
  );
}

Object.assign(window, { BlogReaderScreen, ReaderBlock });
