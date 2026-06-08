// ReviewPage v2 — Concept C ("Convo Cards") applied to the real blog data.
// Replaces the legacy 3-column ReviewPage by overriding window.ReviewPage.
//
// Layout
//   Desktop (≥ lg)  : top bar + chapter strip + [article col | threads rail]
//   Tablet  (md..lg): same 2-column layout, threads rail narrower
//   Mobile  (< md)  : tabs "Статья / Обсуждения" + bottom action bar
//
// Real-data integration: __blogData, __reviewStore, FAKE_DATA.users, plus
// the existing window.{PrimaryChangeModal, ReviewStatusPill, diffWords}.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─────────────────────────────────────────────────────────────────
// diffWords — word-level LCS diff (relocated here from the retired
// legacy review trio; v2's wdiff + InlineDiff depend on it).
// Returns array of { type: "eq"|"ins"|"del", text }. Exposed as
// window.diffWords via the top-level function declaration.
// ─────────────────────────────────────────────────────────────────
function diffWords(a, b) {
  const tokenize = (s) => s.match(/\s+|[^\s]+/g) || [];
  const A = tokenize(a || "");
  const B = tokenize(b || "");
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { pushEq(out, A[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { pushDel(out, A[i]); i++; }
    else { pushIns(out, B[j]); j++; }
  }
  while (i < n) { pushDel(out, A[i++]); }
  while (j < m) { pushIns(out, B[j++]); }
  return out;
}
function pushEq(out, t)  { const last = out[out.length - 1]; if (last && last.type === "eq")  last.text += t; else out.push({ type: "eq",  text: t }); }
function pushIns(out, t) { const last = out[out.length - 1]; if (last && last.type === "ins") last.text += t; else out.push({ type: "ins", text: t }); }
function pushDel(out, t) { const last = out[out.length - 1]; if (last && last.type === "del") last.text += t; else out.push({ type: "del", text: t }); }

// ─────────────────────────────────────────────────────────────────
// Word-level diff fallback (uses window.diffWords if available)
// ─────────────────────────────────────────────────────────────────
const wdiff = (a, b) => (window.diffWords ? window.diffWords(a || "", b || "") : [{ type: "eq", text: a || "" }]);

// Render text with `ins` parts wrapped as diff-add. Drops `del`.
function InlineDiff({ text, prev }) {
  if (!prev) return text;
  const parts = wdiff(prev, text);
  return parts
    .filter(p => p.type !== "del")
    .map((p, i) => p.type === "ins"
      ? <span key={i} className="diff-edit">{p.text}</span>
      : <span key={i}>{p.text}</span>);
}

// ─────────────────────────────────────────────────────────────────
// Mermaid block with expand/collapse code preview.
// Renders a hand-drawn SVG fallback so the artboard stays readable.
// ─────────────────────────────────────────────────────────────────
function MermaidBlock({ source, status }) {
  const [open, setOpen] = useState(false);
  const stripeCls = status === "added" ? "diff-stripe-add" : status === "edited" ? "diff-stripe-edit" : "";
  return (
    <div className={`my-3 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden ${stripeCls}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] inline-flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="3" width="6" height="6" rx="1" />
            <rect x="9" y="15" width="6" height="6" rx="1" />
            <line x1="9" y1="6" x2="15" y2="6" /><line x1="6" y1="9" x2="9" y2="15" /><line x1="18" y1="9" x2="15" y2="15" />
          </svg>
          Схема · Mermaid
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
          className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--accent)] inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--muted)] min-h-[28px]"
        >
          {open ? "Скрыть код" : "Показать код"}
          <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            {open ? <polyline points="6 15 12 9 18 15" /> : <polyline points="6 9 12 15 18 9" />}
          </svg>
        </button>
      </div>
      <div className="bg-[var(--background)] flex items-center justify-center px-4 py-6 min-h-[140px]">
        <svg viewBox="0 0 360 100" width="100%" height="100" style={{ maxWidth: 460 }}>
          <defs>
            <marker id="rv2-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
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
            <line x1="80"  y1="50" x2="128" y2="50" markerEnd="url(#rv2-arr)" />
            <line x1="230" y1="44" x2="278" y2="28" markerEnd="url(#rv2-arr)" />
            <line x1="230" y1="58" x2="278" y2="76" strokeDasharray="3 2" markerEnd="url(#rv2-arr)" />
          </g>
        </svg>
      </div>
      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--code-bg)]">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] border-b border-[var(--border)] flex justify-between">
            <span>исходник</span>
            <button type="button" className="hover:text-[var(--foreground)]" onClick={() => navigator.clipboard?.writeText(source).catch(() => {})}>копировать</button>
          </div>
          <pre className="text-[11.5px] leading-[1.6] font-mono px-3 py-2 whitespace-pre overflow-x-auto"><code>{source}</code></pre>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bauble — right-edge marker next to a block.
//   tone derives from open vs resolved vs has-suggestion.
// ─────────────────────────────────────────────────────────────────
const TONE = {
  fix:     { color: "var(--danger)",  label: "правка предложена" },
  discuss: { color: "var(--info)",    label: "обсуждение" },
  ok:      { color: "var(--success)", label: "решено" },
};
function pickTone(threads) {
  const open = threads.filter(t => t.status === "open");
  if (open.some(t => t.suggestion)) return "fix";
  if (open.length) return "discuss";
  if (threads.length) return "ok";
  return null;
}

function Bauble({ threads, active, onClick }) {
  const tone = pickTone(threads);
  if (!tone) return null;
  const v = TONE[tone];
  const openCount = threads.filter(t => t.status === "open").length;
  const label = openCount > 0 ? openCount : threads.length;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${v.label} · ${threads.length} ${threads.length === 1 ? "тред" : "треда"}`}
      className={`inline-flex items-center justify-center gap-1 rounded-full px-2 py-1 border-2 text-[10.5px] font-bold transition-all min-h-[28px] ${active ? "ring-2 ring-[var(--accent)] scale-[1.08]" : "hover:scale-[1.05]"}`}
      style={{ background: "var(--background)", borderColor: v.color, color: v.color, lineHeight: 1 }}
    >
      <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span className="tabular-nums">{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// One article block. Inline-diff for edited paragraphs; mermaid; code;
// callout; headings. Bauble on the right gutter.
// ─────────────────────────────────────────────────────────────────
function ArticleBlock({ block, prev, threads, active, onClickBauble, isSelected, verdict, onCycleVerdict, canStamp, canEdit, isEditing, onStartEdit, onSaveEdit, onCancelEdit }) {
  const isEdited = !!prev && prev.text !== block.text;
  const stripeCls = block.status === "added"
    ? "diff-stripe-add"
    : (isEdited && block.type !== "code" && block.type !== "mermaid")
    ? "diff-stripe-edit"
    : "";

  let inner;
  // ── Inline edit (author POV, text-like blocks) ──
  if (isEditing && (block.type === "p" || block.type === "h2" || block.type === "h3" || block.type === "quote")) {
    inner = (
      <InlineEditField
        block={block}
        onSave={onSaveEdit}
        onCancel={onCancelEdit}
      />
    );
  } else if (block.type === "h2") {
    inner = (
      <h2 className="font-[var(--font-display)] font-bold text-[22px] leading-snug mt-5 mb-2">
        {block.text}
      </h2>
    );
  } else if (block.type === "h3") {
    inner = (
      <h3 className="font-[var(--font-display)] font-semibold text-[17px] leading-snug mt-4 mb-1.5">
        {block.text}
      </h3>
    );
  } else if (block.type === "code") {
    const tone = block.status === "added" ? "diff-stripe-add" : isEdited ? "diff-stripe-edit" : "";
    inner = (
      <div className={`rounded-md border border-[var(--border)] bg-[var(--code-bg)] my-2 overflow-hidden ${tone}`}>
        <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] border-b border-[var(--border)] bg-[var(--bg-elevated)] flex justify-between">
          <span>{block.lang || "code"}{isEdited ? " · ~ edited" : block.status === "added" ? " · + added" : ""}</span>
        </div>
        <pre className="text-[12.5px] leading-[1.6] font-mono px-3 py-2 whitespace-pre overflow-x-auto"><code>{block.text}</code></pre>
      </div>
    );
  } else if (block.type === "mermaid") {
    inner = <MermaidBlock source={block.text} status={block.status} />;
  } else if (block.type === "callout") {
    const t = block.tone || "note";
    const styles = {
      note:    { bg: "color-mix(in srgb, var(--info) 14%, var(--background))",    bd: "color-mix(in srgb, var(--info) 35%, var(--border))",    fg: "var(--info)" },
      warning: { bg: "color-mix(in srgb, var(--warning) 14%, var(--background))", bd: "color-mix(in srgb, var(--warning) 35%, var(--border))", fg: "var(--warning)" },
      info:    { bg: "color-mix(in srgb, var(--success) 12%, var(--background))", bd: "color-mix(in srgb, var(--success) 35%, var(--border))", fg: "var(--success)" },
    }[t];
    inner = (
      <div className="rounded-md border px-3 py-2.5 my-2" style={{ background: styles.bg, borderColor: styles.bd }}>
        <p className="text-[10.5px] uppercase tracking-wider font-semibold mb-1" style={{ color: styles.fg }}>{t}</p>
        <p className="text-[14px] leading-relaxed text-[var(--foreground)]">{block.text}</p>
      </div>
    );
  } else {
    // paragraph or quote
    const content = isEdited
      ? <InlineDiff text={block.text} prev={prev.text} />
      : block.status === "added"
      ? <span className="diff-add">{block.text}</span>
      : block.text;
    if (block.type === "quote") {
      inner = (
        <blockquote className="border-l-2 border-[var(--accent)] pl-3 my-2 italic text-[14.5px] leading-[1.7] text-[var(--muted-foreground)]">
          {content}
        </blockquote>
      );
    } else {
      inner = <p className="text-[15px] leading-[1.75] mb-3">{content}</p>;
    }
  }

  return (
    <div
      data-block-id={block.id}
      onDoubleClick={() => { if (canEdit && !isEditing && (block.type === "p" || block.type === "h2" || block.type === "h3" || block.type === "quote")) onStartEdit?.(block.id); }}
      className={`grid grid-cols-[1fr_44px] gap-3 items-start transition-colors ${active ? "bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] -mx-3 px-3 rounded-md" : ""} ${isSelected ? "outline outline-2 outline-[var(--accent)] -outline-offset-2 rounded-md" : ""} ${isEditing ? "outline outline-2 outline-[var(--accent)] -outline-offset-2 rounded-md" : ""} ${canEdit && !isEditing ? "cursor-text" : ""}`}
    >
      <div className={`${stripeCls} min-w-0`}>{inner}</div>
      <div className="pt-2 flex flex-col items-center gap-1.5">
        <Bauble threads={threads} active={active} onClick={onClickBauble} />
        {(canStamp || verdict) && (
          <BlockVerdictStamp verdict={verdict} canStamp={canStamp} onClick={onCycleVerdict} />
        )}
        {canEdit && !isEditing && (
          <span title="Двойной клик — редактировать блок" className="text-[10px] text-[var(--muted-foreground)] opacity-0 hover:opacity-100">⌨</span>
        )}
      </div>
    </div>
  );
}

// Inline edit field — textarea that grows with content; cmd+Enter saves, Esc cancels.
function InlineEditField({ block, onSave, onCancel }) {
  const [text, setText] = React.useState(block.text || "");
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = "auto"; el.style.height = el.scrollHeight + "px";
  }, []);
  const onChange = (e) => {
    setText(e.target.value);
    e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px";
  };
  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); onSave?.(block.id, text); }
    else if (e.key === "Escape") { e.preventDefault(); onCancel?.(); }
  };
  const isHeading = block.type === "h2" || block.type === "h3";
  const tone = isHeading
    ? `font-[var(--font-display)] font-bold ${block.type === "h2" ? "text-[22px]" : "text-[17px]"} leading-snug`
    : block.type === "quote"
    ? "italic text-[var(--muted-foreground)] text-[15px] border-l-2 border-[var(--accent)] pl-3"
    : "text-[15px] leading-[1.75]";
  return (
    <div className="my-1">
      <textarea
        ref={ref}
        value={text}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className={`w-full bg-[color-mix(in_srgb,var(--accent)_4%,transparent)] border-none focus:outline-none resize-none p-1 -m-1 rounded ${tone}`}
        rows={1}
      />
      <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
        <span>⌘+Enter — сохранить · Esc — отмена</span>
        <button type="button" onClick={() => onSave?.(block.id, text)} className="ml-auto px-2 py-1 rounded bg-[var(--accent)] text-[var(--accent-foreground)] text-[11px] font-medium min-h-[28px]">Сохранить</button>
        <button type="button" onClick={onCancel} className="px-2 py-1 rounded border border-[var(--border)] text-[11px] min-h-[28px]">Отмена</button>
      </div>
    </div>
  );
}

// Per-block verdict stamp — reviewer clicks to cycle through
// none → approve → fix → discuss → none. Tooltip on hover.
function BlockVerdictStamp({ verdict, canStamp, onClick }) {
  const VARIANT = {
    approve: { color: "var(--success)", label: "одобряю" },
    fix:     { color: "var(--danger)",  label: "нужны правки" },
    discuss: { color: "var(--info)",    label: "обсудить" },
  };
  const v = verdict ? VARIANT[verdict] : null;
  if (!canStamp && !v) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canStamp}
      title={v ? `Вердикт по блоку: ${v.label} (клик — следующий)` : "Поставить вердикт"}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full transition-all ${canStamp ? "hover:scale-110 cursor-pointer" : "cursor-default"}`}
      style={{
        background: v ? v.color : "transparent",
        border: v ? "none" : "1.5px dashed var(--border)",
      }}
    >
      {v && (
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {verdict === "approve" && <polyline points="4 12 10 18 20 6" />}
          {verdict === "fix"     && <><line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" /></>}
          {verdict === "discuss" && <><circle cx="12" cy="12" r="0.5" /><circle cx="7"  cy="12" r="0.5" /><circle cx="17" cy="12" r="0.5" /></>}
        </svg>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Thread card (right rail). Clickable → focuses block.
// ─────────────────────────────────────────────────────────────────
function ThreadCard({ thread, users, pov, active, onClick, onApply, onReply }) {
  const u = users[thread.from] || { handle: thread.from, name: thread.from };
  const isAuthor = pov === "author";
  return (
    <div
      data-thread-id={thread.id}
      onClick={onClick}
      className={`rounded-md border bg-[var(--background)] p-2.5 cursor-pointer transition-colors ${active ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--accent)]/40"}`}
    >
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar handle={u.handle} name={u.name} size={20} />
          <span className="text-[12px] font-medium truncate">@{u.handle}</span>
          {thread.suggestion && <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--warning-bg)] text-[var(--warning)]">правка</span>}
          {thread.status === "resolved" && <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--success-bg)] text-[var(--success)]">решено</span>}
        </div>
        <span className="text-[10.5px] text-[var(--accent)] shrink-0 inline-flex items-center gap-0.5">
          → блок
        </span>
      </div>
      <blockquote className="text-[11.5px] text-[var(--muted-foreground)] italic mb-1.5 title-clamp-1 anchor-hi pl-2" title={thread.anchor || ""}>«{thread.anchor || "—"}»</blockquote>
      <p className="text-[13px] leading-[1.55] mb-1.5">{thread.text}</p>
      {thread.suggestion && (
        <div className="rounded border border-[var(--border)] bg-[var(--code-bg)] text-[11px] font-mono p-2 mb-1.5 overflow-hidden">
          <div className="opacity-60 line-through whitespace-pre title-clamp-2">{thread.suggestion.from || ""}</div>
          <div className="text-[var(--success)] whitespace-pre title-clamp-2">{thread.suggestion.to || ""}</div>
        </div>
      )}
      {(thread.replies || []).map((r, i) => (
        <div key={i} className="border-l-2 border-[var(--border)] pl-2 mt-1.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Avatar handle={r.from} size={14} />
            <span className="text-[10.5px] text-[var(--muted-foreground)]">@{r.from}</span>
          </div>
          <p className="text-[12px] leading-[1.5]">{r.text}</p>
        </div>
      ))}
      {thread.status === "open" && (
        <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
          {isAuthor
            ? <button type="button" onClick={() => onApply?.(thread)} className="text-[10.5px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-[var(--accent)] text-[var(--accent-foreground)] min-h-[28px]">Применить и закрыть</button>
            : <button type="button" onClick={() => onApply?.(thread)} className="text-[10.5px] font-semibold uppercase tracking-wider px-2 py-1 rounded border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] min-h-[28px]">отметить решённым</button>
          }
          <button type="button" onClick={() => onReply?.(thread)} className="text-[10.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-1 min-h-[28px]">ответить</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Threads rail — verdict ledger + filters + cards + composer.
// ─────────────────────────────────────────────────────────────────
function ThreadsRail({ threads, users, pov, activeThreadId, onPickThread, showResolved, setShowResolved, onApply, anchorPreview, suggestFrom, onPost }) {
  const open  = threads.filter(t => t.status === "open");
  const list  = showResolved ? threads : open;
  // When the active thread changes (e.g. user clicked a bauble in the
  // article), scroll the matching card into view in the rail. Direct
  // scrollTop math is more reliable than scrollIntoView when the rail
  // is itself nested inside the page's scroll containers.
  const railListRef = useRef(null);
  useEffect(() => {
    if (!activeThreadId) return;
    const id = requestAnimationFrame(() => {
      const container = railListRef.current;
      if (!container) return;
      const card = container.querySelector(`[data-thread-id="${activeThreadId}"]`);
      if (!card) return;
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const offsetWithin = cardRect.top - containerRect.top + container.scrollTop;
      const targetTop = Math.max(0, offsetWithin - container.clientHeight / 2 + cardRect.height / 2);
      container.scrollTo({ top: targetTop, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [activeThreadId, showResolved]);
  const counters = [
    { tone: "fix",     label: "правок",   color: TONE.fix.color,     n: threads.filter(t => t.status === "open" && t.suggestion).length },
    { tone: "discuss", label: "обсуждений", color: TONE.discuss.color, n: open.length - open.filter(t => t.suggestion).length },
    { tone: "ok",      label: "решено",   color: TONE.ok.color,      n: threads.filter(t => t.status === "resolved").length },
  ];
  return (
    <aside className="flex flex-col min-h-0 bg-[var(--bg-secondary)] border-l border-[var(--border)]">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Обсуждения</span>
          <span className="text-[10.5px] text-[var(--muted-foreground)] tabular-nums">{open.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowResolved(v => !v)}
          className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-1"
        >{showResolved ? "скрыть решённые" : "показать решённые"}</button>
      </div>

      <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--background)] flex items-center gap-3 flex-wrap text-[11.5px]">
        {counters.map(c => (
          <span key={c.tone} className="inline-flex items-center gap-1.5">
            <span className="stamp-dot" style={{ background: c.color }} />
            <span className="tabular-nums font-medium">{c.n}</span>
            <span className="text-[var(--muted-foreground)]">{c.label}</span>
          </span>
        ))}
      </div>

      <div ref={railListRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {list.length === 0 ? (
          <p className="text-[12.5px] text-[var(--muted-foreground)] text-center py-8">Пока тут пусто.<br/>Выделите фрагмент статьи → появится кнопка «прокомментировать».</p>
        ) : list.map(t => (
          <ThreadCard
            key={t.id}
            thread={t}
            users={users}
            pov={pov}
            active={t.id === activeThreadId}
            onClick={() => onPickThread(t)}
            onApply={onApply}
            onReply={onPickThread}
          />
        ))}
      </div>

      <Composer pov={pov} anchorPreview={anchorPreview} suggestFrom={suggestFrom} onPost={onPost} />
    </aside>
  );
}

function Composer({ pov, anchorPreview, suggestFrom, onPost }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("comment");   // comment | suggest
  const [teammateTyping, setTeammateTyping] = useState(null);
  // Drop suggest mode if the fresh selection it relied on disappears.
  useEffect(() => { if (!suggestFrom && mode === "suggest") setMode("comment"); }, [suggestFrom, mode]);
  useEffect(() => {
    let id;
    const cycle = () => {
      const handles = ["dm.k", "kostya", "ira.m"].filter(h => h !== pov);
      if (Math.random() < 0.35 && handles.length) {
        setTeammateTyping(handles[Math.floor(Math.random() * handles.length)]);
        id = setTimeout(() => { setTeammateTyping(null); id = setTimeout(cycle, 3500 + Math.random() * 4000); }, 1800 + Math.random() * 2200);
      } else {
        id = setTimeout(cycle, 3500 + Math.random() * 4000);
      }
    };
    id = setTimeout(cycle, 2000);
    return () => clearTimeout(id);
  }, [pov]);
  const submit = () => {
    if (!text.trim()) return;
    onPost?.(text.trim(), { suggest: mode === "suggest" });
    setText("");
    setMode("comment");
  };
  const placeholder = anchorPreview
    ? (pov === "author" ? "Ответить ревьюеру…" : "Ответить или дополнить…")
    : (pov === "author" ? "Откройте тред справа или выделите фрагмент в статье…" : "Выделите фрагмент в статье — появится кнопка «Прокомментировать».");
  const canSubmit = !!text.trim() && (mode === "suggest" ? !!suggestFrom : !!anchorPreview);
  return (
    <div className="border-t border-[var(--border)] bg-[var(--background)] p-3">
      {teammateTyping && (
        <div className="flex items-center gap-1.5 mb-1.5 text-[10.5px] text-[var(--muted-foreground)]">
          <TypingDots />
          <span>@{teammateTyping} печатает…</span>
        </div>
      )}

      {/* Mode toggle — only when a fresh fragment is selected (a suggestion
          needs a concrete «было» to replace). */}
      {suggestFrom && (
        <div className="inline-flex items-center gap-0.5 mb-2 border border-[var(--border)] rounded p-0.5 text-[11px]">
          <button type="button" onClick={() => setMode("comment")} className={`px-2 py-0.5 rounded min-h-[26px] transition-colors ${mode === "comment" ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-medium" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}>Комментарий</button>
          <button type="button" onClick={() => setMode("suggest")} className={`px-2 py-0.5 rounded min-h-[26px] transition-colors ${mode === "suggest" ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-medium" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}>Правка</button>
        </div>
      )}

      {/* Suggest «было» preview */}
      {mode === "suggest" && suggestFrom && (
        <div className="mb-2 rounded border border-[var(--border)] bg-[var(--code-bg)] p-2">
          <p className="text-[9.5px] uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5 font-semibold">Было</p>
          <div className="text-[11px] font-[var(--font-mono)] line-through opacity-60 whitespace-pre-wrap title-clamp-3">{suggestFrom}</div>
        </div>
      )}

      <div className={`rounded border focus-within:border-[var(--accent)] transition-colors ${mode === "suggest" ? "border-[var(--success-border)]" : "border-[var(--border)]"} ${(anchorPreview || mode === "suggest") ? "" : "opacity-90"}`}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={mode === "suggest" ? "Как должно стать — введите замену фрагмента…" : placeholder}
          rows={2}
          className="block w-full bg-transparent text-[12.5px] px-2.5 py-2 resize-none focus:outline-none"
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}
        />
        <div className="flex items-center justify-between gap-2 px-2 py-1 border-t border-[var(--border)] text-[10.5px]">
          <span className={`truncate min-w-0 ${mode === "suggest" ? "text-[var(--success)]" : anchorPreview ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`} title={anchorPreview || ""}>
            {mode === "suggest" ? "↳ замена выделенного · ⌘+Enter" : anchorPreview ? `↳ ${anchorPreview}` : "без привязки · ⌘+Enter — отправить"}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className={`rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed min-h-[28px] ${mode === "suggest" ? "px-2.5 py-0.5 bg-[var(--success)] text-white text-[11px]" : "px-2 py-0.5 bg-[var(--accent)] text-[var(--accent-foreground)]"}`}
            title={!canSubmit ? "Выберите фрагмент или тред — иначе непонятно, куда уходит сообщение" : "Отправить (⌘+Enter)"}
          >{mode === "suggest" ? "Предложить" : "→"}</button>
        </div>
      </div>
    </div>
  );
}

// Three-dot typing animation
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="w-1 h-1 rounded-full bg-[var(--muted-foreground)] animate-pulse" style={{ animationDelay: "0s" }} />
      <span className="w-1 h-1 rounded-full bg-[var(--muted-foreground)] animate-pulse" style={{ animationDelay: "0.2s" }} />
      <span className="w-1 h-1 rounded-full bg-[var(--muted-foreground)] animate-pulse" style={{ animationDelay: "0.4s" }} />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// Top bar (sticky). Status pill, rev, deadline, POV switcher, back.
// ─────────────────────────────────────────────────────────────────
function ReviewHeaderV2({ article, blog, chapter, activeChapterSlug, onSwitchChapter, onOpenWholeBlog, team, users, pov, setPov, onBack, onOpenAuthor, onOpenAdmin, openTeamMobile, setOpenTeamMobile }) {
  const ReviewStatusPill = window.ReviewStatusPill;
  const author = users[article.authorSlug] || { handle: article.authorSlug, name: article.authorSlug };
  const povOptions = [
    { id: "author", label: `${author.name} · автор` },
    ...team.reviewerHandles.map(h => ({
      id: h,
      label: `${users[h]?.name || h} · ${h === team.primaryHandle ? "вед. ревьюер" : "ревьюер"}`,
    })),
  ];
  const povUser = pov === "author" ? author : (users[pov] || { handle: pov, name: pov });
  const isMulti = blog && blog.chapters.length > 1;
  const chapters = blog?.chapters || [];

  return (
    <header className="sticky top-0 z-30 bg-[var(--background)]/95 backdrop-blur border-b border-[var(--border)]">
      <div className="px-3 sm:px-5 py-2 flex items-center gap-2 min-w-0">
        <button type="button" onClick={onBack} className="text-[12.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-1 shrink-0 min-h-[32px] px-1">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 18 5 12 11 6"/></svg>
          <span className="hidden sm:inline">К списку</span>
        </button>
        <span className="text-[var(--border)] hidden sm:inline">·</span>

        {/* Compound title: blog tiny on top, chapter big below */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="min-w-0">
            {isMulti && (
              <p className="text-[10.5px] text-[var(--muted-foreground)] leading-tight title-clamp-1" title={blog.title}>
                {blog.title}
              </p>
            )}
            <h1 className="font-[var(--font-display)] font-bold text-[15px] sm:text-[19px] tracking-tight title-clamp-1 leading-tight" title={article.title}>
              {article.title}
            </h1>
          </div>
          <span className="text-[10px] tabular-nums text-[var(--muted-foreground)] shrink-0 whitespace-nowrap">rev {article.revision?.number || 1}</span>
          {ReviewStatusPill && <span className="hidden sm:inline-flex shrink-0"><ReviewStatusPill status={article.revision?.status} /></span>}
        </div>

        {/* Compact online-presence avatars (desktop) — folded in from the
            former standalone presence row to de-clutter the header. */}
        <div className="hidden md:flex items-center -space-x-1.5 shrink-0 mr-1" title="Онлайн сейчас">
          {(team.reviewerHandles || []).slice(0, 4).map(h => {
            const u = users[h] || { handle: h, name: h };
            const online = team.state?.[h]?.online;
            const isPrimary = h === team.primaryHandle;
            return (
              <span key={h} className="relative inline-flex" title={`@${u.handle}${isPrimary ? " · ведущий" : ""}${online ? " · онлайн" : " · был недавно"}`}>
                <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] uppercase font-semibold ring-2 ring-[var(--background)] ${online ? "" : "opacity-45"} ${isPrimary ? "outline outline-1 outline-[var(--accent)]" : ""} bg-[var(--muted)] text-[var(--muted-foreground)]`}>
                  {u.name?.slice(0, 1)}
                </span>
                {online && <span className="absolute -right-0 -bottom-0 w-2 h-2 rounded-full border-2 border-[var(--background)] bg-[var(--success)]" />}
              </span>
            );
          })}
        </div>

        {/* POV switcher (compact) */}
        <div className="relative shrink-0">
          <select
            value={pov}
            onChange={(e) => setPov(e.target.value)}
            className="appearance-none bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 pr-6 text-[11.5px] focus:outline-none focus:border-[var(--accent)] max-w-[170px] truncate cursor-pointer"
            title="Демо: переключить POV"
          >
            {povOptions.map(o => <option key={o.id} value={o.id} className="truncate">{o.label}</option>)}
          </select>
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Mobile: open team modal */}
        <button
          type="button"
          onClick={() => setOpenTeamMobile(true)}
          className="md:hidden text-[11.5px] px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)] shrink-0 min-h-[32px]"
          title="Команда"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </button>
      </div>

      {/* Chapter strip — desktop: tab row; mobile: dropdown picker */}
      <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
        {/* Mobile: full-width select + «Весь блог» button */}
        {isMulti && (
          <div className="sm:hidden flex items-stretch gap-2 px-3 py-2">
            <div className="relative flex-1 min-w-0">
              <select
                aria-label="Выбрать главу"
                value={activeChapterSlug}
                onChange={(e) => onSwitchChapter?.(e.target.value)}
                className="w-full min-h-[40px] appearance-none rounded-md border border-[var(--border)] bg-[var(--background)] pl-3 pr-9 py-2 text-[13px] font-medium text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
              >
                {chapters.map((c, i) => (
                  <option key={c.slug} value={c.slug}>
                    {`Глава ${String(i + 1).padStart(2, "0")} · ${c.title}`}
                  </option>
                ))}
              </select>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <button
              onClick={onOpenWholeBlog}
              className="shrink-0 min-h-[40px] px-3 rounded-md border border-[var(--border)] text-[12.5px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-1"
              title="Открыть весь блог в режиме чтения"
            >
              Весь блог
            </button>
          </div>
        )}
        {/* Desktop: horizontal tab strip */}
        <div role={isMulti ? "tablist" : undefined} aria-label={isMulti ? "Главы" : undefined} className={`${isMulti ? "hidden sm:flex" : "flex"} items-center gap-2 px-3 sm:px-5 py-1.5 text-[11px] overflow-x-auto whitespace-nowrap`}>
          <span className="text-[var(--muted-foreground)] uppercase tracking-wider font-semibold text-[10px] shrink-0">Главы</span>
          {isMulti ? chapters.map((c, i) => {
            const isActive = c.slug === activeChapterSlug;
            const status = window.__blogData.chapterStatus(c);
            const tone = status === "published" ? "var(--success)"
                       : status === "under-review" || status === "changes-requested" ? "var(--info)"
                       : "var(--muted-foreground)";
            return (
              <button
                key={c.slug}
                role="tab"
                aria-selected={isActive}
                aria-controls="review-article-panel"
                onClick={() => onSwitchChapter?.(c.slug)}
                className={`shrink-0 min-h-[24px] inline-flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors ${
                  isActive
                    ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] font-semibold"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
                title={c.title}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tone }} />
                <span className="tabular-nums opacity-70">{String(i + 1).padStart(2, "0")}</span>
                <span className="max-w-[110px] sm:max-w-[160px] truncate">{c.title}</span>
              </button>
            );
          }) : (
            <button className="shrink-0 px-2 py-0.5 rounded bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] font-semibold min-h-[24px]">Текущая</button>
          )}
          {isMulti && (
            <button
              onClick={onOpenWholeBlog}
              className="shrink-0 px-2 py-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] min-h-[24px] inline-flex items-center gap-1 ml-auto"
              title="Открыть весь блог в режиме чтения"
            >
              Весь блог →
            </button>
          )}
        </div>
      </div>

    </header>
  );
}

function PresenceStrip({ team, users, povUser }) {
  // Compose people we want to surface: primary first, then others. The
  // demo `online` flag lives on team.state[handle]. Even when the flag
  // is missing, we surface the avatar dim so the bar always has content.
  const handles = team.reviewerHandles || [];
  if (handles.length === 0) return null;
  return (
    <div className="flex items-center gap-2 px-3 sm:px-5 py-1 border-t border-[var(--border)] bg-[var(--background)] text-[11px] overflow-x-auto">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] shrink-0">Онлайн сейчас</span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {handles.map(h => {
          const u = users[h] || { handle: h, name: h };
          const online = team.state?.[h]?.online;
          const isPrimary = h === team.primaryHandle;
          return (
            <span key={h} className="relative inline-flex items-center shrink-0" title={`@${u.handle}${isPrimary ? " · ведущий" : ""}${online ? " · онлайн" : " · был недавно"}`}>
              <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[9.5px] uppercase font-semibold ${online ? "" : "opacity-50"} ${isPrimary ? "ring-1 ring-[var(--accent)]" : ""} bg-[var(--muted)] text-[var(--muted-foreground)]`}>
                {u.name?.slice(0, 1)}
              </span>
              {online && (
                <span className="absolute -right-0.5 -bottom-0.5 w-2 h-2 rounded-full border-2 border-[var(--background)] bg-[var(--success)]" />
              )}
            </span>
          );
        })}
      </div>
      <span className="ml-auto shrink-0 text-[var(--muted-foreground)] hidden sm:inline">Вы: <span className="text-[var(--foreground)] font-medium">{povUser?.name}</span></span>
    </div>
  );
}

// Tiny avatar (kept local to avoid Components.jsx tight-coupling)
function Avatar({ handle, name, size = 20 }) {
  return (
    <span
      title={`@${handle}`}
      style={{ width: size, height: size, background: "var(--muted)", color: "var(--muted-foreground)", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45, fontWeight: 600, flexShrink: 0 }}
    >
      {(name || handle || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bottom action bar — role-aware verdict actions.
// ─────────────────────────────────────────────────────────────────
function ActionBar({ pov, team, article, threads, onApprove, onRequestChanges, onSubmitRevision, onPublish, onRequestPrimaryChange }) {
  const isAuthor   = pov === "author";
  const isPrimary  = pov === team.primaryHandle;
  const myVerdict  = team.state?.[pov]?.verdict;
  const openCount  = threads.filter(t => t.status === "open").length;
  const status     = article.revision?.status || "draft";
  const isDraft    = status === "draft";
  const inFlight   = status === "under-review" || status === "changes-requested";
  const allApproved = team.reviewerHandles.length > 0 && team.reviewerHandles.every(h => team.state[h]?.verdict === "approve") && inFlight;
  const anyChanges  = team.reviewerHandles.some(h => team.state[h]?.verdict === "request-changes");

  return (
    <div className="border-t border-[var(--border)] bg-[var(--background)] px-3 sm:px-5 py-2 flex items-center gap-2 min-h-[60px]">
      {/* Status summary */}
      <div className="hidden sm:flex items-center gap-3 flex-1 min-w-0 text-[11.5px]">
        {isDraft ? (
          <span className="text-[var(--muted-foreground)]">Глава в черновике — голосование откроется после отправки на ревью.</span>
        ) : (
          <>
            <span className="text-[var(--muted-foreground)] tabular-nums">{openCount} открытых · {team.reviewerHandles.length} реценз.</span>
            {allApproved && <span className="text-[var(--success)] font-medium">все одобрили</span>}
            {anyChanges && !allApproved && <span className="text-[var(--warning)] font-medium">есть запрос правок</span>}
          </>
        )}
      </div>

      {isAuthor ? (
        <>
          <button
            type="button"
            onClick={onRequestPrimaryChange}
            disabled={isDraft}
            className="hidden sm:inline-flex text-[11.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline-offset-2 hover:underline px-2 min-h-[36px] disabled:opacity-40 disabled:cursor-not-allowed"
          >Сменить ведущего</button>
          {allApproved && (
            <button type="button" onClick={onPublish} className="text-[12.5px] font-medium px-3 py-2 rounded bg-[var(--success)] text-white whitespace-nowrap min-h-[36px]">Опубликовать</button>
          )}
          <button
            type="button"
            onClick={onSubmitRevision}
            disabled={isDraft && !article.blocks?.some(b => (b.text || "").trim())}
            className="text-[12.5px] font-medium px-3 py-2 rounded bg-[var(--accent)] text-[var(--accent-foreground)] whitespace-nowrap min-h-[36px] disabled:opacity-50 disabled:cursor-not-allowed"
            title={isDraft ? "Отправить на ревью впервые" : "Отправить новую ревизию"}
          >{isDraft ? "Отправить на ревью" : `Отправить v${(article.revision?.number || 1) + 1}`}</button>
        </>
      ) : (
        // Reviewer POV — voting only when chapter is actually under review.
        isDraft ? (
          <span className="text-[12px] text-[var(--muted-foreground)] italic">Автор ещё не отправил главу на ревью.</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onRequestChanges(pov)}
              className={`text-[12.5px] font-medium px-3 py-2 rounded border whitespace-nowrap min-h-[36px] ${myVerdict === "request-changes" ? "border-[var(--warning)] bg-[var(--warning-bg)] text-[var(--warning)]" : "border-[var(--border)] text-[var(--warning)] hover:bg-[var(--warning-bg)]"}`}
            >Нужны правки</button>
            <button
              type="button"
              onClick={() => onApprove(pov)}
              className={`text-[12.5px] font-medium px-3 py-2 rounded whitespace-nowrap min-h-[36px] ${myVerdict === "approve" ? "bg-[var(--success)] text-white" : "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)] hover:bg-[var(--success)] hover:text-white"}`}
            >Одобрить</button>
          </>
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Floating selection toolbar (when user selects text in the article).
// Uses position: fixed so it sits in viewport space and isn't affected
// by the article column's own scroll offset.
// ─────────────────────────────────────────────────────────────────
function SelectionToolbar({ selection, onComment }) {
  if (!selection) return null;
  const top  = selection.rect.top - 42;
  const left = selection.rect.left + selection.rect.width / 2;
  // preventDefault on pointer/touch start keeps the active text selection from
  // collapsing when the toolbar is tapped (critical on touch + virtual keyboard).
  const keepSelection = (e) => e.preventDefault();
  return (
    <div
      data-selection-toolbar=""
      style={{ position: "fixed", top, left, transform: "translateX(-50%)", zIndex: 60 }}
      className="inline-flex items-center gap-0.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md p-1"
      onMouseDown={keepSelection}
      onTouchStart={keepSelection}
    >
      <button
        type="button"
        onClick={onComment}
        onTouchEnd={(e) => { e.preventDefault(); onComment?.(); }}
        className="px-2 py-1 text-[11.5px] inline-flex items-center gap-1 hover:bg-[var(--muted)] rounded min-h-[28px]"
      >
        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        Прокомментировать
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Team-status mini panel (mobile modal). Shows reviewers + verdicts.
// ─────────────────────────────────────────────────────────────────
function TeamSheet({ team, users, pov, onClose, onRequestPrimaryChange }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-[var(--font-display)] font-bold text-[17px]">Команда ревью</h3>
          <button type="button" onClick={onClose} className="text-[var(--muted-foreground)] text-[20px] leading-none">×</button>
        </div>
        <ul className="space-y-1.5">
          {team.reviewerHandles.map(h => {
            const u = users[h] || { handle: h, name: h };
            const st = team.state?.[h] || {};
            const verdict = st.verdict;
            return (
              <li key={h} className="flex items-center gap-2 p-2 border border-[var(--border)] rounded-md">
                <Avatar handle={h} name={u.name} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate">{u.name}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)] truncate">@{h}{h === team.primaryHandle ? " · ведущий" : ""}</p>
                </div>
                {verdict === "approve" && <span className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--success)] px-1.5 py-0.5 rounded bg-[var(--success-bg)]">одобрил</span>}
                {verdict === "request-changes" && <span className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--warning)] px-1.5 py-0.5 rounded bg-[var(--warning-bg)]">правки</span>}
                {!verdict && <span className="text-[10.5px] text-[var(--muted-foreground)]">ждём</span>}
              </li>
            );
          })}
        </ul>
        {pov === "author" && (
          <button type="button" onClick={onRequestPrimaryChange} className="mt-3 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--accent)] underline">
            Запросить смену ведущего →
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PrimaryChangeModal — author requests a new primary reviewer (relocated
// here from the retired legacy review-rail; Review-v2-main reuses it via
// window.PrimaryChangeModal).
// ─────────────────────────────────────────────────────────────────
function PrimaryChangeModal({ team, users, onClose, onSubmit }) {
  const others = team.reviewerHandles.filter(h => h !== team.primaryHandle);
  const [proposed, setProposed] = useState(others[0] || "");
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-[var(--font-display)] font-bold text-[20px] mb-1">Сменить ведущего ревьюера</h3>
        <p className="text-[12.5px] text-[var(--muted-foreground)] mb-4">Запрос уйдёт админу. До его решения ведущим остаётся @{team.primaryHandle}.</p>

        <label className="block text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5">Новый ведущий</label>
        <div className="space-y-1.5 mb-4">
          {others.map(h => {
            const u = users[h] || { handle: h, name: h };
            const sel = proposed === h;
            return (
              <label key={h} className={`flex items-center gap-2.5 px-2.5 py-2 rounded border cursor-pointer transition-colors ${sel ? "border-[var(--accent)] bg-[var(--accent)]/[0.05]" : "border-[var(--border)] hover:border-[var(--accent)]/60"}`}>
                <input type="radio" name="proposed" value={h} checked={sel} onChange={() => setProposed(h)} className="accent-[var(--accent)]" />
                <Avatar handle={u.handle} name={u.name} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-tight">{u.name}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">@{u.handle}</p>
                </div>
              </label>
            );
          })}
        </div>

        <label className="block text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5">Причина</label>
        <textarea
          value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Например: текущий ведущий в отпуске, нужен срочный ревью."
          rows={3}
          className="w-full text-[13px] bg-[var(--background)] border border-[var(--border)] rounded px-2.5 py-2 focus:outline-none focus:border-[var(--accent)] resize-none mb-4"
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3.5 py-1.5 rounded-md text-[13px] font-medium border border-[var(--border)] hover:border-[var(--accent)] transition-colors">Отмена</button>
          <button
            onClick={() => onSubmit(proposed, reason)}
            disabled={!proposed || !reason.trim()}
            className="px-3.5 py-1.5 rounded-md text-[13px] font-medium bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40"
          >
            Отправить запрос
          </button>
        </div>
      </div>
    </div>
  );
}

window.__reviewV2 = {
  InlineDiff, MermaidBlock, Bauble, ArticleBlock, ThreadCard,
  ThreadsRail, Composer, ReviewHeaderV2, Avatar, ActionBar,
  SelectionToolbar, TeamSheet, TONE, pickTone, wdiff,
};
