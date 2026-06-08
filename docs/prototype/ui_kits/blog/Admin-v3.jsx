// P11.3 — AdminReview v2: chapter-aware moderation queue.
// Overrides window.AdminReview. Uses getInFlightChapters() instead of legacy
// getInFlightReviews(). Force-approve and remove-reviewer keyed by
// (blogSlug, chapterSlug). All other admin sections unchanged.

const { useState } = React;

function AdminReview({ session, pushLog, onOpenReview }) {
  const [tick, setTick] = useState(0);
  React.useEffect(() => window.__reviewStore.subscribe(() => setTick(t => t + 1)), []);
  const store = window.__reviewStore.get();
  const users = window.FAKE_DATA.users || {};
  const D = window.__blogData;

  const pending  = store.pcRequests.filter(r => r.status === "pending");
  const closed   = store.pcRequests.filter(r => r.status !== "pending");

  // Forced is keyed by "blogSlug#chapterSlug" composite for chapter-level granularity.
  const isForced = (blogSlug, chapterSlug) => store.forced.includes(`${blogSlug}#${chapterSlug}`);
  const inFlight = D.getInFlightChapters().filter(r => !isForced(r.blogSlug, r.chapterSlug));

  const decidePc = (id, decision) => {
    window.__reviewStore.update(s => ({
      pcRequests: s.pcRequests.map(r => r.id === id
        ? { ...r, status: decision, decidedAt: Math.floor(Date.now() / 1000), decidedBy: session?.handle || "moderator" }
        : r),
    }));
    const r = store.pcRequests.find(x => x.id === id);
    if (!r) return;
    pushLog(decision === "approved" ? "review.primary.approve" : "review.primary.reject",
      `${r.articleSlug} · @${r.requestedBy}`,
      decision === "approved"
        ? `@${r.currentPrimary} → @${r.proposedPrimary}`
        : "Запрос отклонён");
  };

  const forceApprove = (blogSlug, chapterSlug, reason) => {
    window.__reviewStore.update(s => ({ forced: [...s.forced, `${blogSlug}#${chapterSlug}`] }));
    pushLog("review.force-approve", `${blogSlug}/${chapterSlug}`, reason || "Принудительное одобрение модератором");
  };

  const removeReviewer = (blogSlug, chapterSlug, handle, reason) => {
    window.__reviewStore.update(s => ({
      removedReviewers: [...s.removedReviewers, { blogSlug, chapterSlug, handle, by: session?.handle || "moderator", at: Math.floor(Date.now() / 1000), reason }],
    }));
    pushLog("review.reviewer.remove", `${blogSlug}/${chapterSlug} · @${handle}`, reason || "Снят модератором");
  };

  return (
    <div className="px-6 sm:px-10 py-8 sm:py-10 max-w-5xl">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Ревью</p>
        <h2 className="font-[var(--font-display)] font-extrabold text-3xl md:text-4xl tracking-tight mb-2">Очередь редакции</h2>
        <p className="text-[14px] text-[var(--muted-foreground)] max-w-xl">
          Запросы на смену основного ревьюера и зависшие главы. Модератор вмешивается, когда команда не может договориться сама.
        </p>
      </header>

      {/* Pending PC requests */}
      <section className="mb-10">
        <h3 className="text-[13px] font-semibold mb-3">
          Запросы на смену основного <span className="text-[var(--muted-foreground)] font-normal">{pending.length}</span>
        </h3>
        {pending.length === 0 ? (
          <p className="text-[13px] text-[var(--muted-foreground)] py-6 text-center border border-dashed border-[var(--border)] rounded-md">
            Нет открытых запросов.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {pending.map(r => {
              const cur = users[r.currentPrimary]  || { name: r.currentPrimary,  handle: r.currentPrimary };
              const nxt = users[r.proposedPrimary] || { name: r.proposedPrimary, handle: r.proposedPrimary };
              const reqBy = users[r.requestedBy]   || { name: r.requestedBy,    handle: r.requestedBy };
              return (
                <li key={r.id} className="rounded-lg border border-[var(--border)] p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-300">Смена ведущего</span>
                    <span className="text-[12px] text-[var(--muted-foreground)]">· @{reqBy.handle}</span>
                  </div>
                  <button
                    onClick={() => onOpenReview?.(r.articleSlug)}
                    className="text-left text-[14.5px] font-medium hover:text-[var(--accent)] transition-colors mb-2 title-clamp-2"
                  >
                    {D.getBlogBySlug(r.articleSlug)?.title || r.articleSlug} <span className="text-[var(--muted-foreground)] font-normal">· ревизия {r.revisionNumber}</span>
                  </button>
                  <div className="flex items-center gap-3 mb-3 flex-wrap text-[12px]">
                    <span>@{cur.handle}</span><span className="text-[var(--muted-foreground)]">→</span><span>@{nxt.handle}</span>
                  </div>
                  {r.reason && (
                    <p className="text-[13px] text-[var(--foreground)] bg-[var(--muted)]/30 rounded-md px-3 py-2 mb-3 leading-relaxed">«{r.reason}»</p>
                  )}
                  <div className="flex items-center gap-2">
                    <button onClick={() => decidePc(r.id, "approved")} className="text-[12.5px] font-medium px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 transition-colors">Одобрить смену</button>
                    <button onClick={() => decidePc(r.id, "rejected")} className="text-[12.5px] px-3 py-1.5 rounded border border-[var(--border)] hover:border-rose-500/40 hover:text-rose-600 transition-colors">Отклонить</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* In-flight CHAPTERS — chapter-level queue */}
      <section className="mb-10">
        <h3 className="text-[13px] font-semibold mb-3">
          Главы на ревью <span className="text-[var(--muted-foreground)] font-normal">{inFlight.length}</span>
        </h3>
        {inFlight.length === 0 ? (
          <p className="text-[13px] text-[var(--muted-foreground)] py-6 text-center border border-dashed border-[var(--border)] rounded-md">
            Нет глав на ревью.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {inFlight.map(r => (
              <ChapterQueueRow
                key={`${r.blogSlug}#${r.chapterSlug}`}
                review={r}
                users={users}
                onOpenReview={onOpenReview}
                onForceApprove={forceApprove}
                onRemoveReviewer={removeReviewer}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Closed PC requests */}
      {closed.length > 0 && (
        <section>
          <h3 className="text-[13px] font-semibold mb-3">
            Закрытые запросы <span className="text-[var(--muted-foreground)] font-normal">{closed.length}</span>
          </h3>
          <ul className="space-y-1 text-[12.5px] text-[var(--muted-foreground)]">
            {closed.map(r => (
              <li key={r.id} className="flex items-center gap-3 py-1.5">
                <span className={`text-[10.5px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${r.status === "approved" ? "bg-emerald-500/14 text-emerald-700 dark:text-emerald-400" : "bg-slate-500/14 text-slate-700 dark:text-slate-300"}`}>
                  {r.status === "approved" ? "approved" : "rejected"}
                </span>
                <span className="truncate">{r.articleSlug} <span className="text-[var(--muted-foreground)]">— @{r.currentPrimary} → @{r.proposedPrimary}</span></span>
                <span className="text-[11.5px] text-[var(--muted-foreground)] shrink-0">@{r.decidedBy}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ChapterQueueRow({ review, users, onOpenReview, onForceApprove, onRemoveReviewer }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [reason, setReason] = useState("");

  const author = users[review.authorHandle] || { handle: review.authorHandle, name: review.authorHandle };
  const stalled = review.stalledFor >= 48;
  const isMulti = review.totalChapters > 1;

  return (
    <li className="py-3 px-2 -mx-2">
      <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] items-center gap-3 sm:gap-4">
        <button onClick={() => setOpen(o => !o)} className="text-left min-w-0">
          {isMulti && (
            <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5 title-clamp-1" title={review.blogTitle}>
              Блог: {review.blogTitle} · Глава {review.chapterOrder + 1}/{review.totalChapters}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-medium title-clamp-1" title={review.chapterTitle}>{review.chapterTitle}</span>
            {stalled && (
              <span className="text-[10.5px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-rose-500/14 text-rose-700 dark:text-rose-300">
                висит {Math.floor(review.stalledFor / 24)} дн.
              </span>
            )}
          </div>
          <p className="text-[12px] text-[var(--muted-foreground)] truncate mt-0.5">
            ревизия {review.revisionNumber} · @{author.handle}
          </p>
        </button>
        <div className="hidden sm:inline-flex items-center gap-1 shrink-0">
          {review.reviewerHandles.slice(0, 4).map(h => {
            const u = users[h] || { handle: h, name: h };
            const isPrimary = h === review.primaryHandle;
            return (
              <span key={h} className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] uppercase font-semibold ${isPrimary ? "ring-1 ring-[var(--accent)]" : ""} bg-[var(--muted)] text-[var(--muted-foreground)]`} title={`@${u.handle}${isPrimary ? " · ведущий" : ""}`}>
                {u.name?.slice(0, 1)}
              </span>
            );
          })}
        </div>
        <span className="hidden sm:inline-flex text-[12px] text-[var(--muted-foreground)] tabular-nums shrink-0 items-center gap-1">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          {review.openThreads}
        </span>
        <button
          onClick={() => onOpenReview?.(review.blogSlug, review.chapterSlug)}
          className="text-[12px] text-[var(--accent)] hover:underline shrink-0 min-h-[36px] px-1"
        >Открыть →</button>
      </div>

      {open && (
        <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
          <p className="text-[11.5px] text-[var(--muted-foreground)] mb-2">Действия модератора по этой главе:</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {review.reviewerHandles.map(h => {
              const u = users[h] || { handle: h, name: h };
              const isConfirm = confirming === `remove:${h}`;
              if (isConfirm) {
                return (
                  <div key={h} className="flex items-center gap-1.5 px-2 py-1 rounded border border-rose-500/40 bg-rose-500/10 text-[11.5px]">
                    <span>Снять @{u.handle}?</span>
                    <input
                      value={reason}
                      autoFocus
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Причина…"
                      className="bg-[var(--background)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[11.5px] focus:outline-none focus:border-[var(--accent)] w-32"
                    />
                    <button
                      onClick={() => { onRemoveReviewer(review.blogSlug, review.chapterSlug, h, reason || "Без указания причины"); setConfirming(null); setReason(""); }}
                      className="text-[11.5px] font-medium px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-500 min-h-[28px]"
                    >OK</button>
                    <button onClick={() => { setConfirming(null); setReason(""); }} className="text-[11.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] min-h-[28px]">×</button>
                  </div>
                );
              }
              return (
                <button
                  key={h}
                  onClick={() => setConfirming(`remove:${h}`)}
                  className="text-[11.5px] px-2 py-1 rounded border border-[var(--border)] hover:border-rose-500/40 hover:text-rose-600 transition-colors min-h-[28px]"
                >Снять @{u.handle}</button>
              );
            })}
          </div>
          {confirming === "force" ? (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <input
                value={reason}
                autoFocus
                onChange={(e) => setReason(e.target.value)}
                placeholder="Причина принудительного одобрения…"
                className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)] min-w-[160px]"
              />
              <button
                onClick={() => { onForceApprove(review.blogSlug, review.chapterSlug, reason || "Без указания причины"); setConfirming(null); setReason(""); }}
                className="text-[12.5px] font-medium px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-500 min-h-[36px]"
              >Принудительно одобрить</button>
              <button onClick={() => { setConfirming(null); setReason(""); }} className="text-[12.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] min-h-[36px] px-2">Отмена</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming("force")}
              className="text-[12px] px-3 py-1.5 rounded border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 transition-colors min-h-[36px]"
            >Принудительно одобрить главу →</button>
          )}
        </div>
      )}
    </li>
  );
}

window.AdminReview = AdminReview;
window.ChapterQueueRow = ChapterQueueRow;
