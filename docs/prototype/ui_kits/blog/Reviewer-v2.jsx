// ReviewerInbox v2 (chapter-aware) — "Variant B": rich cards with a team-verdict
// progress block, plus status filter + sort. Overrides window.ReviewerInbox.
// Status (reviewer POV): "turn" (ваш ход) · "waiting" (ждёт коллег) ·
// "author" (правки у автора). Cards surface the whole review state so the
// reviewer never has to open a chapter just to learn where it stands.

const { useState, useEffect } = React;

const REV_STATUS_META = {
  turn:    { label: "Ваш ход",         tone: "accent"  },
  waiting: { label: "Ждёт коллег",      tone: "muted"   },
  author:  { label: "Правки у автора",  tone: "warning" },
};

function RevStatusPill({ status }) {
  const { label, tone } = REV_STATUS_META[status];
  const cls = tone === "accent"
    ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)] border-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
    : tone === "warning"
    ? "bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]"
    : "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wider whitespace-nowrap text-[10.5px] px-2 py-0.5 ${cls}`}>
      {tone === "accent" && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
      {label}
    </span>
  );
}

// Reviewer avatar with a verdict ring (✓ approve / ✎ request-changes / dashed pending)
// and a ♦ marker for the lead.
function ReviewerDot({ user, verdict, isLead, size = 28 }) {
  const ring = verdict === "approve" ? "var(--success)" : verdict === "request-changes" ? "var(--warning)" : "var(--border)";
  const dashed = verdict == null;
  const title = `${user.name}${isLead ? " · ведущий" : ""} · ${verdict === "approve" ? "одобрил" : verdict === "request-changes" ? "просит правки" : "ждём решения"}`;
  return (
    <span className="relative inline-flex" title={title}>
      <span
        className="inline-flex items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--muted-foreground)] font-semibold font-[var(--font-display)] overflow-hidden"
        style={{ width: size, height: size, fontSize: size * 0.42, border: `2px ${dashed ? "dashed" : "solid"} ${ring}` }}
      >
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : (user.name || "?").slice(0, 1)}
      </span>
      {verdict === "approve" && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--success)] text-white inline-flex items-center justify-center" style={{ fontSize: 8 }}>✓</span>}
      {verdict === "request-changes" && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--warning)] text-black inline-flex items-center justify-center" style={{ fontSize: 8 }}>✎</span>}
      {isLead && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[var(--accent)] leading-none" style={{ fontSize: 10 }}>♦</span>}
    </span>
  );
}

function ReviewerInbox({ session, onOpenReview, onBack }) {
  const handle = session?.handle;
  const users  = window.FAKE_DATA.users || {};
  const [tick, setTick] = useState(0);
  useEffect(() => window.__reviewStore?.subscribe(() => setTick(t => t + 1)), []);

  const inFlight = window.__blogData.getInFlightChapters();

  // Only chapters where I'm a reviewer, enriched with team verdicts + status.
  const mine = inFlight
    .filter(r => r.reviewerHandles.includes(handle))
    .map(r => {
      const chapter = window.__blogData.getChapter(r.blogSlug, r.chapterSlug);
      const state = chapter?.state || {};
      const team = r.reviewerHandles.map(h => ({
        h, user: users[h] || { name: h, handle: h },
        verdict: state[h]?.verdict || null,
        isLead: r.primaryHandle === h,
      }));
      const myVerdict = state[handle]?.verdict || null;
      const anyFix = team.some(t => t.verdict === "request-changes");
      const status = anyFix ? "author" : (myVerdict == null ? "turn" : "waiting");
      const approved = team.filter(t => t.verdict === "approve").length;
      return { ...r, team, myVerdict, status, approved, total: team.length, amLead: r.primaryHandle === handle };
    });

  // Status filter.
  const [filter, setFilter] = useState("all");
  const counts = {
    all:     mine.length,
    turn:    mine.filter(r => r.status === "turn").length,
    waiting: mine.filter(r => r.status === "waiting").length,
    author:  mine.filter(r => r.status === "author").length,
  };
  const order = { turn: 0, author: 1, waiting: 2 };
  const visible = mine
    .filter(r => filter === "all" || r.status === filter)
    .sort((a, b) => (order[a.status] - order[b.status]) || (b.stalledFor - a.stalledFor) || (b.openThreads - a.openThreads));

  const filterChips = [
    { id: "all",     label: "Все" },
    { id: "turn",    label: "Ваш ход" },
    { id: "author",  label: "Правки у автора" },
    { id: "waiting", label: "Ждёт коллег" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12" data-screen-label="ReviewerInbox">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-5 min-h-[44px] -ml-1 px-1"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 18 5 12 11 6"/></svg>
        К блогу
      </button>

      <header className="mb-5 sm:mb-6">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Кабинет ревьюера</p>
        <h1 className="font-[var(--font-display)] font-extrabold text-3xl sm:text-4xl tracking-tight mb-2 title-clamp-2">Главы на ревью</h1>
        <p className="text-[14px] text-[var(--muted-foreground)] max-w-xl leading-relaxed">
          Карточка показывает, кто из команды уже высказался и чей сейчас ход — «♦» отмечает ведущего.
        </p>
      </header>

      {/* Status filter */}
      <div className="sticky top-14 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-[var(--background)]/95 backdrop-blur border-b border-[var(--border)] mb-5 flex items-center gap-1 overflow-x-auto">
        {filterChips.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors min-h-[36px] inline-flex items-center gap-1.5 ${
              filter === f.id
                ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-[var(--accent)]"
                : "bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]"
            }`}
          >
            {f.label}
            <span className={`text-[10.5px] tabular-nums ${filter === f.id ? "opacity-80" : "opacity-60"}`}>{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-[14px] text-[var(--muted-foreground)] py-12 text-center border border-dashed border-[var(--border)] rounded-lg">
          {filter === "turn"    ? "Сейчас ваш ход нигде не ждут — всё передано дальше." :
           filter === "author"  ? "Нет глав, где автор вносит правки." :
           filter === "waiting" ? "Нет глав в ожидании коллег." :
                                  "Назначений на ревью нет."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visible.map(r => {
            const author = users[r.authorHandle] || { name: r.authorHandle, handle: r.authorHandle };
            const stalled = r.stalledFor >= 48;
            return (
              <li key={`${r.blogSlug}#${r.chapterSlug}`}>
                <button
                  onClick={() => onOpenReview?.(r.blogSlug, r.chapterSlug)}
                  className={`w-full h-full text-left rounded-xl border bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 transition-all hover:-translate-y-0.5 ${
                    r.status === "turn"
                      ? "border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] ring-1 ring-[color-mix(in_srgb,var(--accent)_22%,transparent)]"
                      : "border-[var(--border)] hover:border-[var(--foreground)]/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <RevStatusPill status={r.status} />
                    {stalled && (
                      <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-[var(--danger)] font-medium">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                        застряло {Math.round(r.stalledFor / 24)} дн
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    {r.totalChapters > 1 && (
                      <p className="text-[11.5px] text-[var(--muted-foreground)] mb-0.5 title-clamp-1" title={r.blogTitle}>
                        {r.blogTitle} · глава {r.chapterOrder + 1}/{r.totalChapters}
                      </p>
                    )}
                    <h3 className="font-[var(--font-display)] font-bold text-[17px] leading-snug title-clamp-2" title={r.chapterTitle}>{r.chapterTitle}</h3>
                  </div>

                  {/* Team verdict block */}
                  <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] px-3 py-2.5 mt-auto">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Решения команды</span>
                      <span className="text-[11px] tabular-nums text-[var(--muted-foreground)]">{r.approved}/{r.total} одобрили</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5">
                        {r.team.map(t => <ReviewerDot key={t.h} user={t.user} verdict={t.verdict} isLead={t.isLead} />)}
                      </span>
                      <span className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--accent)] inline-flex items-center gap-1 shrink-0">
                        {r.amLead && <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="none"><path d="M3 7l4 5 5-7 5 7 4-5v11H3z"/></svg>}
                        {r.amLead ? "вы ведущий" : "вы ревьюер"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[12px] text-[var(--muted-foreground)] tabular-nums">
                    <span className="inline-flex items-center gap-3">
                      {r.openThreads > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          {r.openThreads} тред.
                        </span>
                      )}
                      <span>ревизия {r.revisionNumber}</span>
                    </span>
                    <span className="truncate">@{author.handle}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

window.ReviewerInbox = ReviewerInbox;
