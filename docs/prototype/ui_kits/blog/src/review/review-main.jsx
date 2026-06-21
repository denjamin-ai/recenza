// ReviewPage v2 — main entry. Wires up real data + Concept C UI.
// Exports window.ReviewPage (override).

const { useState, useEffect, useRef, useMemo, useCallback } = React;
const {
  InlineDiff, MermaidBlock, Bauble, ArticleBlock, ThreadCard,
  ThreadsRail, Composer, ReviewHeaderV2, Avatar, ActionBar,
  SelectionToolbar, TeamSheet, TONE, pickTone, wdiff,
} = window.__reviewV2;

function ReviewPage({ session, blogSlug, chapterSlug, onBack, onOpenAuthor, onOpenAdmin, onOpenProfile }) {
  const users = window.FAKE_DATA.users || {};

  // ─── Resolve blog + chapter ───────────────────────────────────
  // Modern signature: (blogSlug, chapterSlug). When chapterSlug is null,
  // pick the first in-flight chapter; otherwise the first chapter.
  // Falls back to the first blog that has an in-flight chapter, useful for
  // direct /review nav in demos.
  const D = window.__blogData;
  const blog =
       (blogSlug && D.getBlogBySlug(blogSlug))
    || (() => {
         const inFlight = D.getInFlightChapters()[0];
         return inFlight ? D.getBlogBySlug(inFlight.blogSlug) : null;
       })()
    || D.getBlogBySlug("next-16-boundary-patterns");

  if (!blog) {
    return <div className="p-10 text-[var(--muted-foreground)]" data-screen-label="ReviewPage">Нет данных ревью.</div>;
  }

  const resolvedChapter =
       (chapterSlug && blog.chapters.find(c => c.slug === chapterSlug))
    || blog.chapters.find(c => D.isChapterInFlight(c))
    || blog.chapters[0];

  if (!resolvedChapter) {
    return <div className="p-10 text-[var(--muted-foreground)]" data-screen-label="ReviewPage">Глава не найдена.</div>;
  }

  // Local switching between chapters of the SAME blog (no full re-route).
  const [activeChapterSlug, setActiveChapterSlug] = useState(resolvedChapter.slug);
  const chapter = blog.chapters.find(c => c.slug === activeChapterSlug) || resolvedChapter;

  // The rest of the component treats `chapter` as the canonical "article"
  // (the shapes are compatible because the auto-wrap mirrors article fields).
  const sourceArticle = { ...chapter, slug: blog.slug, authorSlug: blog.authorSlug, title: chapter.title };

  // ─── State ────────────────────────────────────────────────────
  // article/team/threads are re-seeded when active chapter changes.
  const [article, setArticle] = useState(() => structuredClone(sourceArticle));
  const [team, setTeam] = useState(() => {
    const eff = window.__blogData.effectiveChapterTeam
      ? window.__blogData.effectiveChapterTeam(sourceArticle, blog.slug)
      : window.__blogData.effectiveTeam(sourceArticle);
    return structuredClone({
      primaryHandle: eff.primaryHandle,
      reviewerHandles: eff.reviewerHandles,
      state: sourceArticle.state || {},
    });
  });
  // Threads are cross-pane synced through __reviewStore: every mutation is
  // broadcast under "blogSlug#chapterSlug", and incoming updates from other
  // panes (e.g. a parallel reviewer window) flow back into local state.
  const threadsKey = `${blog.slug}#${activeChapterSlug}`;
  const lastSentThreadsRef = useRef(null);
  const [threads, setThreadsLocal] = useState(() => {
    const stored = window.__reviewStore.get().chapterThreads?.[threadsKey];
    return stored ? structuredClone(stored) : structuredClone(sourceArticle.threads || []);
  });
  const setThreads = useCallback((updater) => {
    setThreadsLocal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      lastSentThreadsRef.current = next;
      window.__reviewStore.update(s => ({
        chapterThreads: { ...(s.chapterThreads || {}), [threadsKey]: next },
      }));
      return next;
    });
  }, [threadsKey]);
  // Subscribe to external thread updates for the active chapter.
  useEffect(() => {
    return window.__reviewStore.subscribe(s => {
      const stored = s.chapterThreads?.[threadsKey];
      if (!stored || stored === lastSentThreadsRef.current) return;
      setThreadsLocal(stored);
    });
  }, [threadsKey]);

  // Re-seed local state when the user switches to a different chapter.
  useEffect(() => {
    setArticle(structuredClone(sourceArticle));
    const eff = window.__blogData.effectiveChapterTeam
      ? window.__blogData.effectiveChapterTeam(sourceArticle, blog.slug)
      : window.__blogData.effectiveTeam(sourceArticle);
    setTeam(structuredClone({
      primaryHandle: eff.primaryHandle,
      reviewerHandles: eff.reviewerHandles,
      state: sourceArticle.state || {},
    }));
    const stored = window.__reviewStore.get().chapterThreads?.[threadsKey];
    const seedThreads = stored ? structuredClone(stored) : structuredClone(sourceArticle.threads || []);
    lastSentThreadsRef.current = null;
    setThreadsLocal(seedThreads);
    setActiveThreadId(null);
    setSelection(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapterSlug]);

  // Primary-change requests from the shared store.
  const [pcRequests, setPcRequestsLocal] = useState(() => window.__reviewStore.get().pcRequests);
  useEffect(() => window.__reviewStore.subscribe(s => setPcRequestsLocal(s.pcRequests)), []);
  const setPcRequests = (next) => window.__reviewStore.update({
    pcRequests: typeof next === "function" ? next(window.__reviewStore.get().pcRequests) : next,
  });

  // POV — taken from session role / nav hint, default author.
  const [pov, setPov] = useState(() => {
    const hint = window.__nextReviewPov;
    delete window.__nextReviewPov;
    if (hint === "author") return "author";
    if (hint && team.reviewerHandles.includes(hint)) return hint;
    // Heuristic from session
    if (session?.handle === article.authorSlug) return "author";
    if (session?.handle && team.reviewerHandles.includes(session.handle)) return session.handle;
    return "author";
  });

  // UI state
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const [mobileTab, setMobileTab] = useState("article");          // article | threads
  const [openTeamMobile, setOpenTeamMobile] = useState(false);
  const [primaryChangeOpen, setPrimaryChangeOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [blockVerdicts, setBlockVerdicts] = useState({});  // blockId → 'approve' | 'fix' | 'discuss'
  const [editingBlockId, setEditingBlockId] = useState(null);
  const startEdit  = (id) => setEditingBlockId(id);
  const cancelEdit = ()    => setEditingBlockId(null);
  const saveEdit   = (id, text) => {
    const idx = chapter.blocks.findIndex(b => b.id === id);
    if (idx >= 0) {
      chapter.blocks[idx] = { ...chapter.blocks[idx], text };
      setArticle(a => ({ ...a, blocks: chapter.blocks.slice() }));
      setToast({ kind: "ok", text: "Блок обновлён." });
    }
    setEditingBlockId(null);
  };
  const cycleVerdict = (blockId) => {
    const order = [undefined, "approve", "fix", "discuss"];
    setBlockVerdicts(v => {
      const cur = v[blockId];
      const i = order.indexOf(cur);
      const next = order[(i + 1) % order.length];
      const out = { ...v };
      if (next === undefined) delete out[blockId];
      else out[blockId] = next;
      return out;
    });
  };
  // Reset stamps when switching chapters.
  useEffect(() => { setBlockVerdicts({}); }, [activeChapterSlug]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(t);
  }, [toast]);

  // Selection (for floating toolbar)
  const articleRef = useRef(null);
  const rootRef    = useRef(null);
  const [selection, setSelection] = useState(null);
  useEffect(() => {
    function captureSelection(e) {
      // Ignore pointer/touch releases that land on the selection toolbar itself —
      // otherwise tapping «Прокомментировать» collapses the selection before the
      // click registers (the core mobile/virtual-keyboard bug).
      if (e?.target?.closest?.("[data-selection-toolbar]")) return;
      const sel = window.getSelection();
      const insideArticle = !!articleRef.current?.contains(e?.target);
      if (!sel || sel.isCollapsed) {
        // Collapsed selection. Only DROP a pending anchor if the user clicked
        // back inside the article prose (a deliberate deselect). A click into
        // the composer/rail to type the comment must NOT wipe the pending
        // anchor — otherwise the comment loses its target block and falls
        // through to the previously-active thread.
        if (insideArticle) setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const node = range.startContainer.parentElement?.closest("[data-block-id]");
      if (!node || !articleRef.current?.contains(node)) { if (insideArticle) setSelection(null); return; }
      const blockId = node.dataset.blockId;
      const text = sel.toString();
      if (!text.trim()) { return; }
      const blk = article.blocks.find(b => b.id === blockId);
      if (!blk) { return; }
      const rect = range.getBoundingClientRect();
      setSelection({ blockId, quote: text, rect });
      // A fresh selection begins a NEW comment — release any active thread so
      // the composer unambiguously targets the new anchor. Without this the
      // post landed in the previously-selected thread ("тред не отжимается").
      setActiveThreadId(null);
    }
    document.addEventListener("mouseup", captureSelection);
    document.addEventListener("touchend", captureSelection);
    return () => {
      document.removeEventListener("mouseup", captureSelection);
      document.removeEventListener("touchend", captureSelection);
    };
  }, [article]);

  // Esc releases any pending selection and active thread (clean reset).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setSelection(null);
      setActiveThreadId(null);
      window.getSelection()?.removeAllRanges();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ─── Derived ──────────────────────────────────────────────────
  const prevById = useMemo(() => {
    const m = {};
    for (const p of (article.prevBlocks || [])) m[p.id] = p;
    return m;
  }, [article]);

  const threadsByBlock = useMemo(() => {
    const m = {};
    for (const t of threads) (m[t.blockId] ||= []).push(t);
    return m;
  }, [threads]);

  const visibleThreads = useMemo(() => {
    return showResolved ? threads : threads.filter(t => t.status === "open");
  }, [threads, showResolved]);

  const activeThread  = threads.find(t => t.id === activeThreadId);
  const activeBlockId = activeThread?.blockId;

  // ─── Block / thread sync ──────────────────────────────────────
  const flashBlock = (blockId) => {
    const el = articleRef.current?.querySelector(`[data-block-id="${blockId}"]`);
    if (!el) return;
    el.classList.remove("blog-fragment-flash");
    void el.offsetWidth;
    el.classList.add("blog-fragment-flash");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  const pickThread = (t) => {
    // Clicking the already-active thread again releases it.
    if (activeThreadId === t.id && !selection) { setActiveThreadId(null); return; }
    setSelection(null);            // thread ↔ selection are mutually exclusive
    setActiveThreadId(t.id);
    setMobileTab("article");
    setTimeout(() => flashBlock(t.blockId), 60);
  };
  const pickBauble = (blockId) => {
    const blockThreads = threadsByBlock[blockId] || [];
    if (blockThreads.length === 0) return;
    // If the block has ANY resolved thread, surface them in the rail
    // pre-emptively (so the user can see history immediately, even before
    // the active card is determined).
    const hasResolved = blockThreads.some(t => t.status === "resolved");
    if (hasResolved) setShowResolved(true);
    // Prefer an open thread; fall back to the most recently resolved one so
    // green baubles still surface their history.
    const target = blockThreads.find(t => t.status === "open") || blockThreads[blockThreads.length - 1];
    setActiveThreadId(target.id);
    setMobileTab("threads");
    // Also flash + scroll the block — symmetric with the thread→block path.
    setTimeout(() => flashBlock(blockId), 60);
  };

  // ─── Thread mutations ─────────────────────────────────────────
  const postComment = (text, opts = {}) => {
    if (!selection && !activeThread) return;
    if (selection) {
      const isSuggest = !!opts.suggest;
      const newThread = {
        id: `t-${Date.now()}`,
        blockId: selection.blockId,
        anchor: selection.quote,
        status: "open",
        from: pov === "author" ? article.authorSlug : pov,
        text: isSuggest ? "Предложена правка фрагмента." : text,
        replies: [],
        ...(isSuggest ? { suggestion: { from: selection.quote, to: text } } : {}),
      };
      setThreads(arr => [...arr, newThread]);
      setActiveThreadId(newThread.id);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    } else if (activeThread) {
      setThreads(arr => arr.map(t => t.id === activeThread.id
        ? { ...t, replies: [...(t.replies || []), { from: pov === "author" ? article.authorSlug : pov, text }] }
        : t));
    }
  };
  const applyAndClose = (t) => {
    // If the thread carries a suggestion, mutate the target block's text by
    // replacing suggestion.from with suggestion.to. Author-only action;
    // reviewer's "отметить решённым" path leaves text alone.
    if (t.suggestion && t.suggestion.from && pov === "author") {
      const fromStr = String(t.suggestion.from);
      const toStr   = String(t.suggestion.to || "");
      const idx = chapter.blocks.findIndex(b => b.id === t.blockId);
      if (idx >= 0) {
        const blk = chapter.blocks[idx];
        const curText = blk.text || "";
        const next = curText.includes(fromStr)
          ? curText.replace(fromStr, toStr)
          : curText; // fallback: no exact match (anchor drifted) — leave text
        chapter.blocks[idx] = { ...blk, text: next };
        setArticle(a => ({ ...a, blocks: chapter.blocks.slice() }));
      }
      setToast({ kind: "ok", text: "Правка применена, тред закрыт." });
    } else {
      setToast({ kind: "ok", text: "Тред отмечен решённым." });
    }
    setThreads(arr => arr.map(x => x.id === t.id ? { ...x, status: "resolved" } : x));
    if (activeThreadId === t.id) setActiveThreadId(null);
  };

  // ─── Verdict actions ──────────────────────────────────────────
  const setMyVerdict = (verdict) => {
    const at = Math.floor(Date.now() / 1000);
    // Persist to the canonical chapter object so other screens (inbox, author
    // detail, admin queue) reflect it, then broadcast.
    if (chapter) {
      chapter.state = { ...(chapter.state || {}), [pov]: { ...(chapter.state?.[pov] || {}), verdict, verdictAt: at } };
      // A chapter where every reviewer approved is "ready"; flip the author's
      // turn flag off. If anyone requested changes, it's the author's turn.
      const team0 = window.__blogData.effectiveChapterTeam ? window.__blogData.effectiveChapterTeam(chapter, blog?.slug) : { reviewerHandles: chapter.reviewerHandles || [] };
      const handles = team0.reviewerHandles || chapter.reviewerHandles || [];
      const verdicts = handles.map(h => chapter.state?.[h]?.verdict);
      if (verdict === "request-changes") chapter.hasMyTurn = true;
      else if (handles.length && verdicts.every(v => v === "approve")) chapter.hasMyTurn = false;
    }
    setTeam(t => ({ ...t, state: { ...t.state, [pov]: { ...t.state[pov], verdict, verdictAt: at } } }));
    window.__reviewStore.update({}); // broadcast → inbox / author / admin
  };
  const submitRevision = () => {
    // Local-only mutation: bump revision number, flip status back to under-review,
    // clear verdicts. In production this would be a server roundtrip with a
    // new threads pane and a fresh prev-blocks snapshot.
    chapter.revision = {
      ...(chapter.revision || {}),
      number: (chapter.revision?.number || 1) + 1,
      status: "under-review",
      submittedAt: Math.floor(Date.now() / 1000),
    };
    chapter.state = {};
    for (const h of team.reviewerHandles) chapter.state[h] = { verdict: null, verdictAt: null };
    setTeam(t => {
      const cleared = {};
      for (const h of t.reviewerHandles) cleared[h] = { ...t.state[h], verdict: null, verdictAt: null };
      return { ...t, state: cleared };
    });
    setArticle(a => ({ ...a, revision: { ...chapter.revision } }));
    window.__reviewStore.update({}); // broadcast for inbox/admin
    setToast({ kind: "ok", text: `Отправлено как ревизия v${chapter.revision.number}. Ревьюеры получили уведомление.` });
  };
  const publish = () => {
    // Real mutation — flips chapter to "published" so it disappears from
    // in-flight queues and the public reader shows it in "Весь блог" mode.
    chapter.revision = {
      ...(chapter.revision || {}),
      status: "published",
      publishedAt: Math.floor(Date.now() / 1000),
    };
    setArticle(a => ({ ...a, revision: { ...chapter.revision } }));
    window.__reviewStore.update({}); // broadcast → inbox + admin queue refresh
    setToast({ kind: "ok", text: `Глава «${chapter.title}» опубликована.`, action: () => onBack?.() });
  };
  const requestPrimaryChange = (proposed, reason) => {
    setPcRequests(r => [...r, {
      id: `pc-${Date.now()}`,
      articleSlug: article.slug,
      revisionNumber: article.revision?.number || 1,
      currentPrimary: team.primaryHandle,
      proposedPrimary: proposed,
      requestedBy: pov === "author" ? article.authorSlug : pov,
      requestedAt: Math.floor(Date.now()/1000),
      status: "pending",
      reason,
    }]);
    setPrimaryChangeOpen(false);
  };

  // ─── Anchor preview for composer ──────────────────────────────
  const anchorPreview = selection
    ? `«${(selection.quote || "").slice(0, 40)}${(selection.quote || "").length > 40 ? "…" : ""}»`
    : activeThread
    ? `тред @${activeThread.from} · «${(activeThread.anchor || "").slice(0, 30)}…»`
    : null;

  // ─── Render ───────────────────────────────────────────────────
  const PrimaryChangeModal = window.PrimaryChangeModal;

  return (
    <div ref={rootRef} className="relative flex flex-col h-[calc(100vh-56px)] bg-[var(--background)] text-[var(--foreground)] overflow-hidden" data-screen-label="ReviewPage">
      <ReviewHeaderV2
        article={article}
        blog={blog}
        chapter={chapter}
        activeChapterSlug={activeChapterSlug}
        onSwitchChapter={setActiveChapterSlug}
        onOpenWholeBlog={() => { onBack?.(); /* simplified: caller can re-route */ }}
        team={team}
        users={users}
        pov={pov}
        setPov={setPov}
        onBack={onBack}
        onOpenAuthor={onOpenAuthor}
        onOpenAdmin={onOpenAdmin}
        openTeamMobile={openTeamMobile}
        setOpenTeamMobile={setOpenTeamMobile}
      />

      {/* Mobile tabs */}
      <div className="md:hidden flex border-b border-[var(--border)] text-[12.5px]">
        <button
          type="button"
          onClick={() => setMobileTab("article")}
          className={`flex-1 py-2.5 min-h-[44px] ${mobileTab === "article" ? "font-semibold text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px" : "text-[var(--muted-foreground)]"}`}
        >Статья</button>
        <button
          type="button"
          onClick={() => setMobileTab("threads")}
          className={`flex-1 py-2.5 min-h-[44px] ${mobileTab === "threads" ? "font-semibold text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px" : "text-[var(--muted-foreground)]"}`}
        >Обсуждения <span className="text-[var(--accent)] font-semibold">{threads.filter(t => t.status === "open").length}</span></button>
      </div>

      {/* Main grid */}
      <div className="flex-1 grid md:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] min-h-0 relative">
        {/* Article column */}
        <div
          ref={articleRef}
          className={`overflow-y-auto px-4 sm:px-6 py-6 bg-[var(--background)] relative ${mobileTab === "article" ? "" : "hidden md:block"}`}
        >
          <article className="max-w-[720px] mx-auto">
            {/* Article meta */}
            <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)] mb-4 flex-wrap">
              <Avatar handle={article.authorSlug} name={users[article.authorSlug]?.name} size={20} />
              <span>{users[article.authorSlug]?.name || article.authorSlug}</span>
              <span>·</span>
              <span>ревизия {article.revision?.number || 1}</span>
              {article.revision?.deadline && <><span>·</span><span>срок: {new Date(article.revision.deadline * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</span></>}
            </div>

            {/* Revision changelog */}
            {article.revision?.summary && (
              <div className="mb-6 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                <p className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5">Что нового в v{article.revision.number}</p>
                <p className="text-[13px] leading-relaxed">{article.revision.summary}</p>
              </div>
            )}

            {/* Blocks with right-edge baubles */}
            <div className="flex flex-col gap-0">
              {article.blocks.map(b => (
                <ArticleBlock
                  key={b.id}
                  block={b}
                  prev={prevById[b.id]}
                  threads={threadsByBlock[b.id] || []}
                  active={activeBlockId === b.id}
                  isSelected={selection?.blockId === b.id}
                  onClickBauble={() => pickBauble(b.id)}
                  verdict={blockVerdicts[b.id]}
                  onCycleVerdict={() => cycleVerdict(b.id)}
                  canStamp={pov !== "author"}
                  canEdit={pov === "author"}
                  isEditing={editingBlockId === b.id}
                  onStartEdit={startEdit}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                />
              ))}
            </div>
          </article>

          {/* Selection toolbar — fixed-positioned so it follows the cursor
              regardless of the article column's scroll offset. */}
          <SelectionToolbar
            selection={selection}
            onComment={() => setMobileTab("threads")}
          />
        </div>

        {/* Threads rail */}
        <div className={`min-h-0 ${mobileTab === "threads" ? "flex" : "hidden md:flex"} flex-col`}>
          <ThreadsRail
            threads={threads}
            users={users}
            pov={pov}
            activeThreadId={activeThreadId}
            onPickThread={pickThread}
            showResolved={showResolved}
            setShowResolved={setShowResolved}
            onApply={applyAndClose}
            anchorPreview={anchorPreview}
            suggestFrom={selection ? selection.quote : null}
            onPost={postComment}
          />
        </div>
      </div>

      {/* Bottom action bar (role-aware) */}
      <ActionBar
        pov={pov}
        team={team}
        article={article}
        threads={threads}
        onApprove={setMyVerdict.bind(null, "approve")}
        onRequestChanges={setMyVerdict.bind(null, "request-changes")}
        onSubmitRevision={submitRevision}
        onPublish={publish}
        onRequestPrimaryChange={() => setPrimaryChangeOpen(true)}
      />

      {/* Mobile team sheet */}
      {openTeamMobile && (
        <TeamSheet
          team={team}
          users={users}
          pov={pov}
          onClose={() => setOpenTeamMobile(false)}
          onRequestPrimaryChange={() => { setOpenTeamMobile(false); setPrimaryChangeOpen(true); }}
        />
      )}

      {/* Primary-change modal (reused from legacy) */}
      {primaryChangeOpen && PrimaryChangeModal && (
        <PrimaryChangeModal
          team={team}
          users={users}
          onClose={() => setPrimaryChangeOpen(false)}
          onSubmit={requestPrimaryChange}
        />
      )}

      {/* Toast (success / publish notice) — aria-live so screen readers announce */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-2">
          <p className="text-[13.5px] font-medium leading-snug">✓ {toast.text}</p>
          <div className="flex items-center justify-end gap-3">
            {toast.action && (
              <button type="button" onClick={() => { toast.action(); setToast(null); }} className="text-[12px] font-medium text-[var(--accent)] hover:underline">К списку →</button>
            )}
            <button type="button" onClick={() => setToast(null)} className="text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Override the legacy ReviewPage.
window.ReviewPage = ReviewPage;
