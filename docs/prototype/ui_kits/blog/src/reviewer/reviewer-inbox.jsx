// ReviewerInbox v2 (chapter-aware) — "Variant B": dashboard summary + incoming
// invitations (accept/decline/flag, author notified instantly) + active-review
// cards with a team-verdict progress block. Overrides window.ReviewerInbox.
// Status (reviewer POV): "turn" (ваш ход) · "waiting" (ждёт коллег) ·
// "author" (правки у автора).

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

// ── Small atoms reused by the invitation queue ────────────────────────
function RevStars({ value, size = 12, showNum, n }) {
  const full = Math.floor(value), frac = value - full;
  const star = "M12 2l3 6.5 7 .8-5.2 4.7 1.5 6.9L12 17.8 5.2 20.9l1.5-6.9L1.5 9.3l7-.8z";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center" style={{ gap: 1 }}>
        {[0, 1, 2, 3, 4].map(i => {
          const pct = i < full ? 100 : i === full ? Math.round(frac * 100) : 0;
          return (
            <span key={i} className="relative inline-flex" style={{ width: size, height: size }}>
              <span className="absolute inset-0 text-[var(--border)]"><svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor"><path d={star} /></svg></span>
              <span className="absolute inset-0 overflow-hidden" style={{ width: pct + "%", color: "#d4a017" }}><svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor"><path d={star} /></svg></span>
            </span>
          );
        })}
      </span>
      {showNum && <span className="text-[11.5px] tabular-nums font-medium">{value.toFixed(1)}{n != null && <span className="text-[var(--muted-foreground)] font-normal"> · {n}</span>}</span>}
    </span>
  );
}

function RevSkill({ label, matched }) {
  return matched
    ? <span className="inline-flex items-center gap-1 rounded-full border text-[10.5px] px-2 py-0.5 font-medium whitespace-nowrap" style={{ background: "color-mix(in srgb,var(--accent) 12%,transparent)", color: "var(--accent)", borderColor: "color-mix(in srgb,var(--accent) 35%,transparent)" }}><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>{label}</span>
    : <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--muted-foreground)] text-[10.5px] px-2 py-0.5 whitespace-nowrap">{label}</span>;
}

function revAge(h) { return h < 24 ? `${h} ч назад` : `${Math.round(h / 24)} дн назад`; }

// Accept / decline / flag controls — local decided-state shows the
// "автор уведомлён" feedback. Flag (навыки не совпадают) only when match < 50%.
function RevDecision({ inv, lowMatch, onChange }) {
  const [state, setState] = useState(inv.status === "pending" ? null : inv.status);
  const set = (s) => { setState(s); window.__reviewerFlow?.respond(inv.id, s); onChange && onChange(s); };
  if (state === "accepted") return <div className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--success)]"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>Принято — автор уведомлён</div>;
  if (state === "declined") return <div className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--muted-foreground)]">Отклонено — автор уведомлён</div>;
  if (state === "flagged") return <div className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--warning)]">Жалоба отправлена — глава снята с ревью</div>;
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => set("accepted")} className="inline-flex items-center gap-1.5 rounded-lg text-[12px] px-3 py-1.5 font-medium bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-colors"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>Принять</button>
      <button onClick={() => set("declined")} className="rounded-lg text-[12px] px-3 py-1.5 font-medium bg-[var(--bg-elevated)] text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--foreground)]/30 transition-colors">Отклонить</button>
      {lowMatch && <button onClick={() => set("flagged")} title="Навыки статьи не соответствуют — глава вернётся автору на доработку через админа" className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--warning)] inline-flex items-center gap-1"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 2 18a1.7 1.7 0 0 0 1.5 2.6h17A1.7 1.7 0 0 0 22 18L13.7 3.9a1.7 1.7 0 0 0-3 0z" /></svg>навыки не совпадают</button>}
    </div>
  );
}

function ReviewerInbox({ session, onOpenReview, onBack }) {
  const handle = session?.handle;
  const users  = window.FAKE_DATA.users || {};
  const me = users[handle] || {};
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const a = window.__reviewStore?.subscribe(() => setTick(t => t + 1));
    const b = window.__reviewerFlow?.subscribe(() => setTick(t => t + 1));
    return () => { a && a(); b && b(); };
  }, []);

  const M = window.__reviewerMatch;
  const flow = window.__reviewerFlow;
  // Keep an invite visible (with its «автор уведомлён» feedback) right after a
  // decision, even though it leaves the pending set.
  const [decided, setDecided] = useState({});
  const invites = (flow?.invitesFor(handle) || []).filter(i => i.status === "pending" || decided[i.id]);
  const pendingCount = (flow?.invitesFor(handle, "pending") || []).length;

  const inFlight = window.__blogData.getInFlightChapters();
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
  const order = { turn: 0, author: 1, waiting: 2 };
  const visible = mine.sort((a, b) => (order[a.status] - order[b.status]) || (b.stalledFor - a.stalledFor) || (b.openThreads - a.openThreads));

  const tiles = [
    { n: pendingCount, label: "Приглашения", tone: "accent" },
    { n: mine.filter(r => r.status === "turn").length, label: "Ваш ход", tone: "warning" },
    { n: mine.length, label: "Активные ревью", tone: "muted" },
    { n: (me.rating != null ? me.rating.toFixed(1) : "—"), label: "Ваш рейтинг", tone: "star" },
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
        <h1 className="font-[var(--font-display)] font-extrabold text-3xl sm:text-4xl tracking-tight mb-2 title-clamp-2">Приглашения и ревью</h1>
        <p className="text-[14px] text-[var(--muted-foreground)] max-w-xl leading-relaxed">
          Соглашайтесь или отклоняйте приглашения — автор узнаёт результат сразу. Под каждым видно, по каким навыкам вас предложили.
        </p>
      </header>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
        {tiles.map((t, i) => {
          const c = t.tone === "accent" ? "var(--accent)" : t.tone === "warning" ? "var(--warning)" : t.tone === "star" ? "#d4a017" : "var(--muted-foreground)";
          return (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <p className="font-[var(--font-display)] font-extrabold text-[28px] leading-none tabular-nums mb-1.5" style={{ color: c }}>{t.n}</p>
              <p className="text-[11.5px] text-[var(--muted-foreground)]">{t.label}</p>
            </div>
          );
        })}
      </div>

      {/* Incoming invitations */}
      {invites.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-2.5">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Входящие приглашения</h2>
            <span className="text-[11px] tabular-nums text-[var(--muted-foreground)] bg-[var(--muted)] rounded-full px-1.5 leading-5">{invites.length}</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {invites.map(inv => {
              const m = M ? M.match(handle, inv.skills) : { pct: 0, matched: [], covered: [] };
              const author = users[inv.author] || { name: inv.author, handle: inv.author };
              const low = m.pct < 50;
              return (
                <div key={inv.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="sm:w-[56px] shrink-0 flex sm:flex-col items-center gap-2 sm:gap-1">
                    <span className="font-[var(--font-display)] font-bold text-[22px] tabular-nums leading-none" style={{ color: m.pct >= 50 ? "var(--accent)" : "var(--muted-foreground)" }}>{m.pct}%</span>
                    <span className="text-[9.5px] uppercase tracking-wide text-[var(--muted-foreground)]">совпадение</span>
                  </div>
                  <div className="min-w-0 flex-1 sm:border-l sm:border-[var(--border)] sm:pl-4">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[11.5px] text-[var(--muted-foreground)] truncate">{inv.blogTitle} · глава {inv.chN}/{inv.chTotal}</p>
                      {inv.asLead && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-[var(--accent)] shrink-0"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M3 7l4 5 5-7 5 7 4-5v11H3z"/></svg>ведущий</span>}
                    </div>
                    <h3 className="font-[var(--font-display)] font-bold text-[16px] leading-snug">{inv.chapterTitle}</h3>
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {inv.skills.map(s => <RevSkill key={s} label={s} matched={m.matched.includes(s) || m.covered.includes(s)} />)}
                    </div>
                    {inv.note && <p className="text-[12px] text-[var(--muted-foreground)] mt-2 leading-relaxed">«{inv.note}» — {author.name}</p>}
                    {low && <p className="mt-1.5 text-[11.5px] text-[var(--warning)] flex items-center gap-1.5"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 2 18a1.7 1.7 0 0 0 1.5 2.6h17A1.7 1.7 0 0 0 22 18L13.7 3.9a1.7 1.7 0 0 0-3 0z" /></svg>Слабое совпадение — можно отклонить или сообщить о несоответствии.</p>}
                  </div>
                  <div className="shrink-0 flex flex-col items-start sm:items-end gap-2 sm:border-l sm:border-[var(--border)] sm:pl-4 self-stretch sm:justify-center">
                    <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums inline-flex items-center gap-1"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>ответить за {inv.deadlineH}ч</span>
                    <RevDecision inv={inv} lowMatch={low} onChange={(s) => setDecided(d => ({ ...d, [inv.id]: s }))} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Active reviews */}
      <section>
        <div className="flex items-center gap-2 mb-2.5">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Активные ревью</h2>
          <span className="text-[11px] tabular-nums text-[var(--muted-foreground)] bg-[var(--muted)] rounded-full px-1.5 leading-5">{visible.length}</span>
        </div>
        {visible.length === 0 ? (
          <p className="text-[14px] text-[var(--muted-foreground)] py-12 text-center border border-dashed border-[var(--border)] rounded-lg">Активных ревью нет — примите приглашение, чтобы начать.</p>
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
      </section>
    </div>
  );
}

window.ReviewerInbox = ReviewerInbox;
