// P10.3 — Author Portal v2 (blog-grouped) + BlogDetail screen.
// Overrides window.AuthorPortal with a blog-card view that drills into
// per-blog chapter management. Adds window.BlogDetailScreen.

const { useState, useEffect, useMemo, useRef } = React;

// ─────────────────────────────────────────────────────────────────
// Status pill helper (reused for blog/chapter status badges)
// ─────────────────────────────────────────────────────────────────
function ChapterStatusPill({ status }) {
  const map = {
    draft:              { label: "Черновик",     cls: "bg-[var(--muted)] text-[var(--muted-foreground)]" },
    "under-review":     { label: "На ревью",     cls: "bg-[color-mix(in_srgb,var(--info)_15%,transparent)] text-[var(--info)]" },
    "changes-requested":{ label: "Нужны правки", cls: "bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning)]" },
    published:          { label: "Опубликовано", cls: "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]" },
  };
  const e = map[status] || map.draft;
  return <span className={`text-[10.5px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded shrink-0 ${e.cls}`}>{e.label}</span>;
}

// Mini progress dot strip for a blog: filled = published, half = on-review, empty = draft.
function ChapterDots({ blog }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`${blog.chapterCounts.published}/${blog.chapterCounts.total} опубликовано`}>
      {blog.chapters.map(c => {
        const s = window.__blogData.chapterStatus(c);
        const color = s === "published" ? "var(--success)"
                    : s === "draft" ? "var(--muted-foreground)"
                    : "var(--warning)";
        const filled = s === "published";
        return (
          <span
            key={c.slug}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: filled ? color : "transparent", border: `1.5px solid ${color}` }}
          />
        );
      })}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// AuthorPortal — blog-grouped feed.
// ─────────────────────────────────────────────────────────────────
// Recruit-request status: the verdict on an author's «привлеките ревьюеров»
// request (pending / approved / rejected + reason) — mirrors the editor's
// «Запросить у админа» action. Read-only here.
function RecruitStatus({ me, onOpenBlogDetail }) {
  const [, setTick] = useState(0);
  useEffect(() => window.__reviewerFlow?.subscribe(() => setTick(t => t + 1)), []);
  const reqs = window.__reviewerFlow?.recruitFor(me) || [];
  if (!reqs.length) return null;
  const META = {
    pending:  { tone: "var(--warning)", bg: "var(--warning-bg)", label: "На рассмотрении", body: "Запрос отправлен админу. Блог нельзя опубликовать, пока нет подходящих ревьюеров." },
    approved: { tone: "var(--success)", bg: "var(--success-bg)", label: "Одобрен", body: "Админ ищет ревьюеров по вашим навыкам — направление добавлено на доску «Ищем ревьюеров»." },
    rejected: { tone: "var(--danger)", bg: "var(--danger-bg)", label: "Отклонён", body: null },
  };
  return (
    <div className="mb-7">
      <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-2.5">Запросы ревьюеров</h2>
      <div className="flex flex-col gap-2.5">
        {reqs.map(r => {
          const m = META[r.status] || META.pending;
          return (
            <div key={r.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden">
              <div className="px-3 py-2 flex items-center gap-2 border-b border-[var(--border)]" style={{ background: m.bg }}>
                <span className="text-[12px] font-semibold" style={{ color: m.tone }}>{m.label}</span>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[12px] font-medium leading-snug mb-1 title-clamp-1">{r.chapterTitle || r.blogTitle}</p>
                <p className="text-[11.5px] text-[var(--muted-foreground)] leading-relaxed">{r.status === "rejected" ? `«${r.reason || "Навыки указаны слишком общо или не относятся к теме."}»` : m.body}</p>
                {r.status === "rejected" && <button onClick={() => onOpenBlogDetail?.(r.blogSlug)} className="mt-2 text-[11.5px] px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--foreground)]/30">Изменить навыки</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Interactive 1–5 star input.
function AuthorStarInput({ value, onChange, size = 24 }) {
  const [hover, setHover] = useState(0);
  const show = hover || value;
  const star = "M12 2l3 6.5 7 .8-5.2 4.7 1.5 6.9L12 17.8 5.2 20.9l1.5-6.9L1.5 9.3l7-.8z";
  return (
    <span className="inline-flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onMouseEnter={() => setHover(i)} onClick={() => onChange(i)}
          className="transition-transform hover:scale-110" style={{ color: i <= show ? "#d4a017" : "var(--border)", lineHeight: 0 }}>
          <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor"><path d={star} /></svg>
        </button>
      ))}
    </span>
  );
}

// Rating modal — author rates each reviewer of a published chapter (1–5,
// private). Feeds the aggregate behind the reviewer's Top score.
function RatingModal({ blog, chapter, onClose }) {
  const users = window.FAKE_DATA.users || {};
  const handles = chapter.reviewerHandles || [];
  const [vals, setVals] = useState(() => Object.fromEntries(handles.map(h => [h, 0])));
  const labels = { 1: "Слабо", 2: "Ниже среднего", 3: "Нормально", 4: "Хорошо", 5: "Отлично" };
  const save = () => {
    const key = blog.slug + "#" + chapter.slug;
    const entries = handles.filter(h => vals[h] > 0).map(h => ({ handle: h, stars: vals[h] }));
    window.__reviewerFlow?.rateChapter(key, entries);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-start justify-center p-4 pt-16" onClick={onClose} role="dialog" aria-modal="true">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px] rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden" style={{ boxShadow: "0 16px 40px rgba(0,0,0,0.2)" }}>
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[var(--font-display)] font-bold text-[18px] tracking-tight">Оцените работу ревьюеров</h2>
            <p className="text-[12px] text-[var(--muted-foreground)] mt-1 title-clamp-1">«{chapter.title}»</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--muted)] shrink-0">×</button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          {handles.map(h => {
            const u = users[h] || { name: h, handle: h };
            const isLead = chapter.primaryHandle === h;
            return (
              <div key={h} className="rounded-xl border border-[var(--border)] p-3.5">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-8 h-8 rounded-full bg-[var(--muted)] inline-flex items-center justify-center text-[12px] font-semibold text-[var(--muted-foreground)] font-[var(--font-display)]">{(u.name || "?").slice(0, 1)}</span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold leading-tight truncate">{u.name}</p>
                    {isLead && <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--accent)]">ведущий</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <AuthorStarInput value={vals[h]} onChange={(v) => setVals(s => ({ ...s, [h]: v }))} />
                  <span className="text-[12px] font-medium" style={{ color: vals[h] ? "var(--foreground)" : "var(--muted-foreground)" }}>{vals[h] ? labels[vals[h]] : "Поставьте оценку"}</span>
                </div>
              </div>
            );
          })}
          <p className="text-[11.5px] text-[var(--muted-foreground)] leading-relaxed px-0.5">Оценка приватная — её видит только ревьюер и админ. В рейтинг попадает усреднённый балл.</p>
        </div>
        <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded text-[12.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Позже</button>
          <button onClick={save} disabled={!handles.some(h => vals[h] > 0)} className="px-4 py-2 rounded text-[12.5px] font-medium bg-[var(--accent)] text-[var(--accent-foreground)] disabled:opacity-50 hover:bg-[var(--accent-hover)]">Сохранить оценки</button>
        </div>
      </div>
    </div>
  );
}

// Lists the author's published chapters whose reviewers haven't been rated yet.
function AuthorRatingPanel({ me }) {
  const [, setTick] = useState(0);
  useEffect(() => window.__reviewerFlow?.subscribe(() => setTick(t => t + 1)), []);
  const [rating, setRating] = useState(null);
  const flow = window.__reviewerFlow;
  const blogs = (window.FAKE_DATA.blogs || []).filter(b => b.authorSlug === me);
  const items = [];
  blogs.forEach(b => (b.chapters || []).forEach(c => {
    const published = c.revision?.status === "published";
    const hasTeam = (c.reviewerHandles || []).length > 0;
    const key = b.slug + "#" + c.slug;
    if (published && hasTeam && !flow?.isRated(key)) items.push({ blog: b, chapter: c, key });
  }));
  if (!items.length) return null;
  return (
    <div className="mb-7">
      <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-2.5">Оцените ревьюеров <span className="tabular-nums">· {items.length}</span></h2>
      <div className="flex flex-col gap-2">
        {items.slice(0, 4).map(({ blog, chapter, key }) => (
          <div key={key} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
            <p className="text-[12.5px] font-medium leading-snug title-clamp-1 mb-2">{chapter.title}</p>
            <button onClick={() => setRating({ blog, chapter })} className="w-full text-[12px] px-3 py-1.5 rounded font-medium bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]">★ Оценить</button>
          </div>
        ))}
      </div>
      {rating && <RatingModal blog={rating.blog} chapter={rating.chapter} onClose={() => setRating(null)} />}
    </div>
  );
}

// Reviewer flagged a skills-mismatch → chapter pulled from review; author sees
// the verdict and is asked to fix the skills.
function ComplaintNotice({ me, onOpenBlogDetail }) {
  const [, setTick] = useState(0);
  useEffect(() => window.__reviewerFlow?.subscribe(() => setTick(t => t + 1)), []);
  const flagged = window.__reviewerFlow?.flaggedFor(me) || [];
  if (!flagged.length) return null;
  return (
    <div className="mb-7">
      <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-2.5">Снято с ревью</h2>
      <div className="flex flex-col gap-2.5">
        {flagged.map(inv => (
          <div key={inv.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden">
            <div className="px-3 py-2 flex items-center gap-2 border-b border-[var(--border)]" style={{ background: "var(--warning-bg)" }}>
              <span className="text-[12px] font-semibold" style={{ color: "var(--warning)" }}>Глава снята с ревью</span>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[12px] font-medium leading-snug mb-1 title-clamp-1">{inv.chapterTitle}</p>
              <p className="text-[11.5px] text-[var(--muted-foreground)] leading-relaxed mb-2">Ревьюер сообщил: навыки статьи не соответствуют содержанию. Обновите ключевые навыки и отправьте снова.</p>
              <span className="inline-flex items-center gap-1 flex-wrap">{(inv.skills || []).slice(0, 4).map(s => <span key={s} className="text-[10.5px] px-1.5 py-0.5 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--muted-foreground)]">{s}</span>)}</span>
              {inv.blogSlug && <button onClick={() => onOpenBlogDetail?.(inv.blogSlug)} className="mt-2.5 w-full text-[11.5px] px-2.5 py-1.5 rounded font-medium bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]">Исправить навыки</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthorPortal({ session, onOpenBlogDetail, onOpenArticle, onBack, onOpenEditor, onOpenPortfolioEditor }) {
  const me = session?.handle || "alex";
  const [, setTick] = useState(0);
  useEffect(() => window.__reviewStore?.subscribe(() => setTick(t => t + 1)), []);
  useEffect(() => {
    const h = () => setTick(t => t + 1);
    window.addEventListener("devblog:pins-changed", h);
    window.addEventListener("devblog:portfolio-changed", h);
    return () => {
      window.removeEventListener("devblog:pins-changed", h);
      window.removeEventListener("devblog:portfolio-changed", h);
    };
  }, []);
  const blogs = window.__blogData.getAuthorBlogs(me);

  // Pinned (portfolio) blog sorts first; all cards share the same component.
  const pinnedSlug = window.__pins?.get(me);
  const ordered = [...blogs].sort((a, b) =>
    (a.slug === pinnedSlug ? -1 : 0) - (b.slug === pinnedSlug ? -1 : 0)
  );

  const events = authorEventsV2();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10" data-screen-label="AuthorPortal">
      <header className="mb-6 sm:mb-8">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Кабинет автора</p>
        <h1 className="font-[var(--font-display)] font-extrabold text-3xl sm:text-4xl md:text-5xl tracking-tight title-clamp-2">Мои блоги</h1>
        <p className="text-[14px] text-[var(--muted-foreground)] mt-2 max-w-xl leading-relaxed">
          Каждый блог — это набор глав. Откройте блог, чтобы добавить главу или посмотреть статус существующих.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 lg:gap-10">
        {/* Blog cards — one uniform grid, create-tile + pinned first */}
        <div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <li>
              <button
                type="button"
                onClick={() => onOpenEditor?.(null, null)}
                className="w-full h-full min-h-[120px] rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] transition-colors flex flex-col items-center justify-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--accent)] p-4"
              >
                <span className="w-9 h-9 rounded-full border border-current inline-flex items-center justify-center text-[20px] leading-none">＋</span>
                <span className="text-[13px] font-medium">Новый блог</span>
              </button>
            </li>
            {ordered.map(b => (
              <li key={b.slug}>
                <BlogCard
                  blog={b}
                  pinned={window.__pins?.isPinned(me, b.slug)}
                  onOpen={() => onOpenBlogDetail?.(b.slug)}
                  onAddChapter={() => onOpenEditor?.(b.slug, null)}
                  onTogglePin={() => window.__pins?.set(me, b.slug)}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Aside: portfolio + events */}
        <aside className="lg:border-l lg:border-[var(--border)] lg:pl-8">
          <ComplaintNotice me={me} onOpenBlogDetail={onOpenBlogDetail} />
          <AuthorRatingPanel me={me} />
          <RecruitStatus me={me} onOpenBlogDetail={onOpenBlogDetail} />
          {/* «Об авторе» (portfolio) management */}
          {(() => {
            const pf = window.__portfolio?.get(me);
            const visible = window.__portfolio?.isVisible(me);
            return (
              <div className="mb-7 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Об авторе</p>
                </div>
                {pf ? (
                  <>
                    <p className="text-[13px] text-[var(--foreground)] leading-snug mb-1 title-clamp-2">{pf.title || "Без заголовка"}</p>
                    <p className="text-[11.5px] text-[var(--muted-foreground)] mb-3">
                      {visible ? "Опубликовано · видно всем" : "Скрыто от читателей"}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onOpenPortfolioEditor?.()}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12.5px] font-medium text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] transition-colors min-h-[38px]"
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        Изменить
                      </button>
                      <button
                        onClick={() => window.__portfolio.setVisible(me, !visible)}
                        title={visible ? "Скрыть от читателей" : "Показать читателям"}
                        aria-label={visible ? "Скрыть" : "Показать"}
                        aria-pressed={visible}
                        className={`shrink-0 w-[38px] h-[38px] inline-flex items-center justify-center rounded-md border transition-colors ${visible ? "text-[var(--success)] border-[var(--success-border)] bg-[var(--success-bg)]" : "text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]"}`}
                      >
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          {visible
                            ? <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></>
                            : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>}
                        </svg>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[11.5px] text-[var(--muted-foreground)] leading-relaxed mb-3">Расширенное «Обо мне» — публикуется сразу, без ревью.</p>
                    <button
                      onClick={() => onOpenPortfolioEditor?.()}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12.5px] font-medium bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity min-h-[38px]"
                    >＋ Создать</button>
                  </>
                )}
              </div>
            );
          })()}

          <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-3">События</p>
          <ul className="space-y-3.5">
            {events.map(e => (
              <li key={e.id} className="text-[13px] leading-snug">
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${e.tone === "accent" ? "bg-[var(--accent)]" : e.tone === "warning" ? "bg-[var(--warning)]" : "bg-[var(--muted-foreground)]"}`} />
                  <div className="min-w-0">
                    <p className="text-[var(--foreground)]">{e.text}</p>
                    <p className="text-[11.5px] text-[var(--muted-foreground)] mt-0.5">{e.when}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

// Status badge — readable in both themes (uses *-bg/*-border tokens, never
// bare colored text on the card surface).
function ChapterStatusCount({ tone, children }) {
  const map = {
    info:    "bg-[var(--info-bg)] text-[var(--info)] border-[var(--info-border)]",
    muted:   "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border ${map[tone] || map.muted}`}>
      {children}
    </span>
  );
}

// Unified author blog card: body (opens detail) + a footer action panel
// shared by EVERY card — primary "＋ Глава" and a pin toggle. The pinned
// card gets an amber ring + "Закреплён" chip.
function BlogCard({ blog, onOpen, onAddChapter, pinned, onTogglePin }) {
  const cc = blog.chapterCounts;
  const myTurnChapter = blog.chapters.find(c => c.hasMyTurn);
  return (
    <div className={`relative w-full rounded-lg border bg-[var(--bg-elevated)] transition-all hover:-translate-y-0.5 flex flex-col h-full ${
      pinned
        ? "border-[var(--pin-border)] ring-1 ring-[var(--pin-ring)]"
        : "border-[var(--border)] hover:border-[var(--foreground)]/20"
    }`}>
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left p-4 pb-3 flex flex-col gap-3 flex-1"
      >
        <div className="flex items-center justify-between gap-2">
          <ChapterDots blog={blog} />
          <div className="flex items-center gap-2 shrink-0">
            {pinned && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-[var(--pin-bg)] text-[var(--pin)] border border-[var(--pin-border)]">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M5 17h14l-1.4-4.2a2 2 0 0 1-.1-.6V5a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2v7.2a2 2 0 0 1-.1.6z"/><rect x="11" y="17" width="2" height="5" rx="1"/></svg>
                Закреплён
              </span>
            )}
            {myTurnChapter && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--accent)] uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> ваш ход
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-[var(--font-display)] font-bold text-[18px] leading-snug title-clamp-2 mb-1.5" title={blog.title}>
            {blog.title}
          </h3>
          <p className="text-[12.5px] text-[var(--muted-foreground)] leading-relaxed title-clamp-2">
            {blog.summary || "Без описания."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[11.5px] tabular-nums text-[var(--muted-foreground)]">
          <span>{cc.total} {cc.total === 1 ? "глава" : cc.total < 5 ? "главы" : "глав"} · {cc.published} опубл.</span>
          {cc.onReview > 0 && <ChapterStatusCount tone="info">{cc.onReview} на ревью</ChapterStatusCount>}
          {cc.drafts > 0 && <ChapterStatusCount tone="muted">{cc.drafts} черн.</ChapterStatusCount>}
        </div>
      </button>

      {/* Shared action panel */}
      <div className="flex items-stretch gap-1.5 px-3 py-2.5 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onAddChapter}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12.5px] font-medium text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] transition-colors min-h-[38px]"
        >
          <span aria-hidden="true">＋</span> Глава
        </button>
        {onTogglePin && (
          <button
            type="button"
            onClick={onTogglePin}
            title={pinned ? "Открепить блог" : "Закрепить как портфолио"}
            aria-label={pinned ? "Открепить блог" : "Закрепить блог"}
            aria-pressed={pinned}
            className={`shrink-0 w-[38px] inline-flex items-center justify-center rounded-md border transition-colors ${
              pinned
                ? "text-[var(--pin)] border-[var(--pin-border)] bg-[var(--pin-bg)]"
                : "text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20"
            }`}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.4-4.2a2 2 0 0 1-.1-.6V5a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2v7.2a2 2 0 0 1-.1.6z"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}

function authorEventsV2() {
  return [
    { id: "e1", tone: "accent",  text: "Дмитрий К. запросил правки в главе «Server Actions»",                   when: "2 ч назад" },
    { id: "e2", tone: "default", text: "Костя одобрил главу «Server Actions» в блоге Next.js 16",              when: "сегодня, 11:08" },
    { id: "e3", tone: "default", text: "Ирина М. подтвердила готовность ревьюить «Drizzle для SQLite»",         when: "вчера" },
    { id: "e4", tone: "warning", text: "Срок ревью «Drizzle для SQLite» истекает завтра",                       when: "вчера" },
    { id: "e5", tone: "default", text: "Принята правка от Кости в «Next.js 16: паттерны границ»",               when: "13 мая" },
    { id: "e6", tone: "default", text: "Глава 1 «Границы между server и client» опубликована модератором",      when: "9 мая" },
  ];
}

// ─────────────────────────────────────────────────────────────────
// BlogDetailScreen — drill-in: chapter list + add chapter + edit blog meta.
// ─────────────────────────────────────────────────────────────────
function BlogDetailScreen({ session, blogSlug, onBack, onOpenChapter, onOpenReview, onOpenEditor, onPreview }) {
  const [, setTick] = useState(0);
  useEffect(() => window.__reviewStore?.subscribe(() => setTick(t => t + 1)), []);
  const blog = window.__blogData.getBlogBySlug(blogSlug);
  if (!blog) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10" data-screen-label="BlogDetail">
        <button onClick={onBack} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-1.5 mb-5 min-h-[44px] -ml-1 px-1">
          ← Кабинет
        </button>
        <p className="text-[var(--muted-foreground)]">Блог не найден.</p>
      </div>
    );
  }
  const isMine = session?.handle === blog.authorSlug;
  const isPinned = window.__pins?.isPinned(blog.authorSlug, blog.slug);
  const author = window.FAKE_DATA.users?.[blog.authorSlug];

  // Tabs / filter
  const [filter, setFilter] = useState("all");

  // Local, mutable chapter order + blog title — persisted back to the live
  // __blogData singleton so navigating away and back keeps the change.
  const [chapters, setChapters] = useState(blog.chapters);
  const [title, setTitle] = useState(blog.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef(null);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  const commitTitle = () => {
    const next = title.trim() || blog.title;
    setTitle(next);
    blog.title = next; // persist to live store
    setEditingTitle(false);
  };
  const cancelTitle = () => { setTitle(blog.title); setEditingTitle(false); };

  // Drag-reorder (only meaningful in the "all" view).
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const reorder = (from, to) => {
    if (from == null || to == null || from === to) return;
    const next = [...chapters];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    next.forEach((c, i) => { c.order = i; });
    setChapters(next);
    blog.chapters = next; // persist to live store
  };

  const visibleChapters = filter === "all"
    ? chapters
    : chapters.filter(c => window.__blogData.chapterStatus(c) === filter || (filter === "review" && window.__blogData.isChapterInFlight(c)));
  const dragEnabled = filter === "all";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10" data-screen-label="BlogDetail">
      <button onClick={onBack} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-1.5 mb-4 min-h-[44px] -ml-1 px-1">
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 18 5 12 11 6"/></svg>
        К списку блогов
      </button>

      {/* Blog header */}
      <header className="mb-6 sm:mb-8 pb-6 border-b border-[var(--border)]">
        <div className="mb-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5">
              {chapters.length} {chapters.length === 1 ? "глава" : chapters.length < 5 ? "главы" : "глав"}
            </p>
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={title}
                maxLength={64}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
                  else if (e.key === "Escape") { e.preventDefault(); cancelTitle(); }
                }}
                className="font-[var(--font-display)] font-extrabold text-3xl sm:text-4xl tracking-tight mb-2 w-full bg-transparent border-b-2 border-[var(--accent)] outline-none"
                aria-label="Название блога"
              />
            ) : (
              <h1
                className="font-[var(--font-display)] font-extrabold text-3xl sm:text-4xl tracking-tight title-clamp-3 mb-2 cursor-text rounded hover:bg-[var(--muted)]/40 -mx-1 px-1 transition-colors"
                title="Двойной клик — переименовать"
                onDoubleClick={() => setEditingTitle(true)}
              >
                {title}
              </h1>
            )}
            {blog.summary && (
              <p className="text-[14px] text-[var(--muted-foreground)] max-w-2xl leading-relaxed mb-3">{blog.summary}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-[var(--muted-foreground)]">
              {author && <span>@{author.handle} · {author.name}</span>}
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
          </div>
        </div>

        {/* Action row — consistent button panel */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenEditor?.(blog.slug, null)}
            className="px-3.5 py-2 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] text-[12.5px] font-medium hover:bg-[var(--accent-hover)] transition-colors inline-flex items-center justify-center gap-1.5 min-h-[40px] whitespace-nowrap"
          >＋ Новая глава</button>
          <button
            type="button"
            onClick={() => onPreview?.(blog.slug)}
            className="px-3 py-2 rounded-md border border-[var(--border)] hover:border-[var(--foreground)]/20 text-[12.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors min-h-[40px] whitespace-nowrap"
          >Открыть как читатель →</button>
          {isMine && (
            <button
              type="button"
              onClick={() => { window.__pins?.set(blog.authorSlug, blog.slug); setTick(t => t + 1); }}
              title={isPinned ? "Открепить блог" : "Закрепить как портфолио"}
              aria-pressed={isPinned}
              className={`px-3 py-2 rounded-md border text-[12.5px] font-medium transition-colors min-h-[40px] whitespace-nowrap inline-flex items-center justify-center gap-1.5 ${
                isPinned
                  ? "text-[var(--pin)] border-[var(--pin-border)] bg-[var(--pin-bg)]"
                  : "text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20"
              }`}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.4-4.2a2 2 0 0 1-.1-.6V5a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2v7.2a2 2 0 0 1-.1.6z"/></svg>
              {isPinned ? "Закреплён" : "Закрепить"}
            </button>
          )}
        </div>
      </header>

      {/* Chapter filter chips */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-4">
        {[
          { id: "all",       label: "Все",        n: chapters.length },
          { id: "draft",     label: "Черновики",  n: chapters.filter(c => window.__blogData.isChapterDraft(c)).length },
          { id: "review",    label: "На ревью",   n: chapters.filter(c => window.__blogData.isChapterInFlight(c)).length },
          { id: "published", label: "Опубликовано", n: chapters.filter(c => window.__blogData.isChapterPublished(c)).length },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors min-h-[36px] inline-flex items-center gap-1.5 ${
              filter === f.id
                ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] border-[var(--accent)]"
                : "bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]"
            }`}
          >{f.label} <span className="text-[10.5px] tabular-nums opacity-70">{f.n}</span></button>
        ))}
      </div>

      {/* Chapter list */}
      {visibleChapters.length === 0 ? (
        <p className="text-[14px] text-[var(--muted-foreground)] py-12 text-center border border-dashed border-[var(--border)] rounded-lg">
          По этому фильтру глав нет.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {dragEnabled && chapters.length > 1 && (
            <li className="text-[11px] text-[var(--muted-foreground)] -mb-0.5 px-1">
              Перетащите за ₠, чтобы изменить порядок глав
            </li>
          )}
          {visibleChapters.map((c, i) => (
            <li
              key={c.slug}
              className="relative"
              onDragOver={dragEnabled ? (e) => { e.preventDefault(); setOverIdx(i); } : undefined}
              onDrop={dragEnabled ? (e) => { e.preventDefault(); reorder(dragIdx, i); setDragIdx(null); setOverIdx(null); } : undefined}
            >
              {/* Drop indicator — accent bar above the hovered row */}
              {dragEnabled && overIdx === i && dragIdx !== null && dragIdx !== i && (
                <span className="absolute -top-1 left-0 right-0 h-0.5 bg-[var(--accent)] rounded-full z-10" aria-hidden="true" />
              )}
              <div className={`flex items-stretch gap-2 ${dragIdx === i ? "opacity-40" : ""}`}>
                {dragEnabled && (
                  <div
                    draggable
                    onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                    className="shrink-0 flex items-center justify-center w-7 cursor-grab active:cursor-grabbing text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded hover:bg-[var(--muted)]/50 transition-colors touch-none"
                    title="Перетащить главу"
                    role="button"
                    aria-label={`Перетащить главу «${c.title}»`}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <ChapterRow
                    blog={blog}
                    chapter={c}
                    onOpen={() => {
                      const status = window.__blogData.chapterStatus(c);
                      if (status === "draft") onOpenEditor?.(blog.slug, c.slug);
                      else if (window.__blogData.isChapterInFlight(c)) onOpenReview?.(blog.slug, c.slug);
                      else if (status === "published") onOpenChapter?.(blog.slug, c.slug);
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChapterRow({ blog, chapter, onOpen }) {
  const status = window.__blogData.chapterStatus(chapter);
  const users = window.FAKE_DATA.users || {};
  const team = window.__blogData.effectiveChapterTeam(chapter, blog.slug);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-lg border border-[var(--border)] hover:border-[var(--foreground)]/20 hover:-translate-y-0.5 transition-all p-4 bg-[var(--bg-elevated)]"
    >
      <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12px] tabular-nums font-medium text-[var(--muted-foreground)] shrink-0">
            {String(chapter.order + 1).padStart(2, "0")}
          </span>
          <ChapterStatusPill status={status} />
          {chapter.revision?.number > 1 && (
            <span className="text-[11px] tabular-nums text-[var(--muted-foreground)] shrink-0">rev {chapter.revision.number}</span>
          )}
          {chapter.hasMyTurn && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> ваш ход
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11.5px] text-[var(--muted-foreground)] tabular-nums shrink-0">
          {chapter.openThreads > 0 && (
            <span className="inline-flex items-center gap-1">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              {chapter.openThreads}
            </span>
          )}
          {chapter.lastActivityAt > 0 && (
            <span>{new Date(chapter.lastActivityAt * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
          )}
        </div>
      </div>
      <h3 className="font-[var(--font-display)] font-bold text-[18px] leading-snug title-clamp-2 mb-2" title={chapter.title}>
        {chapter.title}
      </h3>
      {team.reviewerHandles.length > 0 ? (
        <div className="flex items-center gap-1.5 flex-wrap text-[11.5px] text-[var(--muted-foreground)]">
          <span>Команда:</span>
          {team.reviewerHandles.slice(0, 4).map(h => {
            const u = users[h] || { handle: h, name: h };
            const verdict = chapter.state?.[h]?.verdict;
            return (
              <span key={h} className="inline-flex items-center gap-1" title={`@${u.handle}${h === team.primaryHandle ? " · ведущий" : ""}${verdict ? ` · ${verdict === "approve" ? "одобрил" : "правки"}` : ""}`}>
                <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[9.5px] uppercase font-semibold ${h === team.primaryHandle ? "ring-1 ring-[var(--accent)]" : ""} bg-[var(--muted)] text-[var(--muted-foreground)]`}>
                  {u.name?.slice(0, 1)}
                </span>
                {verdict === "approve" && <span className="text-[var(--success)]">✓</span>}
                {verdict === "request-changes" && <span className="text-[var(--warning)]">~</span>}
              </span>
            );
          })}
        </div>
      ) : (
        status === "draft" && (
          <p className="text-[11.5px] text-[var(--muted-foreground)]">Без ревьюеров. Откройте редактор, чтобы назначить и отправить.</p>
        )
      )}
    </button>
  );
}

window.AuthorPortal = AuthorPortal;
window.BlogDetailScreen = BlogDetailScreen;
window.ChapterStatusPill = ChapterStatusPill;
