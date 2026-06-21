// Editor — main screen, right-rail metadata, submit sheet.
// Exports window.EditorScreen.

const { useState, useEffect, useRef, useMemo, useCallback } = React;
const { emptyBlock, slugifyRu, stripHtml, COMPLEXITY, COMPLEXITY_ORDER, pluralReviewers } = window.__editorHelpers;
const {
  BlockFrame, BlockHeading, BlockParagraph, BlockQuote, BlockList,
  BlockCode, BlockCallout, BlockTechnical, BlockImage, BlockTable, BlockEmbed,
} = window.EditorBlocks;

// Type-router for a block.
function BlockRouter({ block, focused, onChange, onEnter, onBackspaceEmpty, replaceType }) {
  switch (block.type) {
    case "h2":
    case "h3":      return <BlockHeading   {...{ block, focused, onChange, onEnter, onBackspaceEmpty, replaceType }} />;
    case "p":       return <BlockParagraph {...{ block, focused, onChange, onEnter, onBackspaceEmpty, replaceType }} />;
    case "quote":   return <BlockQuote     {...{ block, focused, onChange, onEnter, onBackspaceEmpty, replaceType }} />;
    case "list":    return <BlockList      {...{ block, focused, onChange, onEnter, onBackspaceEmpty }} />;
    case "code":    return <BlockCode      {...{ block, onChange }} />;
    case "callout": return <BlockCallout   {...{ block, focused, onChange }} />;
    case "mermaid": return <BlockTechnical kind="mermaid" {...{ block, onChange }} />;
    case "latex":   return <BlockTechnical kind="latex"   {...{ block, onChange }} />;
    case "image":   return <BlockImage     {...{ block, onChange }} />;
    case "table":   return <BlockTable     {...{ block, onChange }} />;
    case "embed":   return <BlockEmbed     {...{ block, onChange }} />;
    default:        return <p className="text-rose-600 text-[12px]">Неизвестный тип: {block.type}</p>;
  }
}

// ─────────────────────────────────────────────────────────────────
// Reviewers picker (right-rail). Lets author pick 1–5 reviewers
// constrained by the chosen complexity tier.
// ─────────────────────────────────────────────────────────────────
// Skill-matched picker: ranks reviewers by composite Top score (skill match
// 50% + rating 30% + volume 20%), surfaces availability, lets the author
// confirm the system's suggestions and pick a lead. Empty → request admin.
function rpStars(value, size) {
  size = size || 11;
  const full = Math.floor(value), frac = value - full;
  const star = "M12 2l3 6.5 7 .8-5.2 4.7 1.5 6.9L12 17.8 5.2 20.9l1.5-6.9L1.5 9.3l7-.8z";
  return (
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
  );
}

function ReviewersPicker({ users, picked, setPicked, primary, setPrimary, complexity, skills, onRequestAdmin }) {
  const tier = COMPLEXITY[complexity] || COMPLEXITY.medium;
  const M = window.__reviewerMatch;
  const articleSkills = (skills && skills.length) ? skills : [];
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Ranked candidates. "Matched" tab first; "all" reveals zero-match reviewers.
  const rankedMatched = useMemo(() => M ? M.ranked(articleSkills, { onlyMatched: true }) : [], [articleSkills.join("|")]);
  const rankedAll = useMemo(() => M ? M.ranked(articleSkills, {}) : [], [articleSkills.join("|")]);
  const base = showAll ? rankedAll : rankedMatched;
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(h => `@${h} ${(users[h] || {}).name || ""}`.toLowerCase().includes(q));
  }, [base, query, users]);

  const toggle = (h) => {
    if (picked.includes(h)) {
      const next = picked.filter(x => x !== h);
      setPicked(next);
      if (primary === h) setPrimary(next[0] || null);
    } else {
      if (picked.length >= tier.max) return;
      setPicked([...picked, h]);
      if (!primary) setPrimary(h);
    }
  };

  useEffect(() => {
    if (picked.length > tier.max) setPicked(picked.slice(0, tier.max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complexity]);

  // No skills entered yet, or no matches at all → guidance / request admin.
  const noSkills = articleSkills.length === 0;
  const noMatches = !noSkills && rankedMatched.length === 0;

  if (noSkills) {
    return <p className="text-[12px] text-[var(--warning)] leading-relaxed rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2.5">Сначала укажите ключевые навыки статьи выше — по ним подбираются ревьюеры.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* tabs + search */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 bg-[var(--muted)] rounded-md p-0.5">
          {[["matched", "По навыкам"], ["all", "Все"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setShowAll(k === "all")} className={`text-[11.5px] px-2.5 py-1 rounded font-medium transition-colors ${(showAll ? "all" : "matched") === k ? "bg-[var(--bg-elevated)] text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>{l}</button>
          ))}
        </div>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="навык или имя…" className="flex-1 min-w-0 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1.5 text-[12px] focus:outline-none focus:border-[var(--accent)]" />
      </div>

      {noMatches && !showAll ? (
        <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-3 text-[12px] leading-relaxed">
          <p className="text-[var(--warning)] font-medium mb-2">Ревьюеры под эти навыки не найдены.</p>
          <p className="text-[var(--muted-foreground)] mb-2.5">Блог нельзя опубликовать без ревью. Обновите навыки статьи или попросите админа привлечь специалистов.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAll(true)} className="text-[11.5px] px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--foreground)]/30">Показать всех</button>
            <button type="button" onClick={onRequestAdmin} className="text-[11.5px] px-2.5 py-1.5 rounded font-medium bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]">Запросить у админа</button>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto">
          {list.map(h => {
            const u = users[h] || { handle: h, name: h };
            const m = M.match(h, articleSkills);
            const sc = M.score(h, articleSkills);
            const av = M.avail(h);
            const on = picked.includes(h);
            const full = av.key === "full";
            const isLead = primary === h;
            const avColor = av.tone === "success" ? "var(--success)" : av.tone === "warning" ? "var(--warning)" : "var(--danger)";
            return (
              <li key={h} className={`flex items-center gap-2 p-2 rounded-md border transition-colors ${on ? "border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]" : "border-[var(--border)] bg-[var(--bg-elevated)]"}`}>
                <button type="button" onClick={() => !full && toggle(h)} disabled={full} className={`w-4.5 h-4.5 rounded border flex items-center justify-center shrink-0 ${on ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border)]"} ${full ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`} style={{ width: 18, height: 18 }} title={full ? "Занят" : on ? "Убрать" : "Выбрать"}>{on && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>}</button>
                <span className="w-7 h-7 rounded-full bg-[var(--muted)] inline-flex items-center justify-center text-[11px] font-semibold text-[var(--muted-foreground)] shrink-0 font-[var(--font-display)]" style={{ border: isLead ? "2px solid var(--accent)" : "1px solid var(--border)" }}>{u.name.slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[12.5px] font-medium leading-tight truncate" title={u.name}>{u.name}</p>
                    {isLead && <span className="text-[9px] uppercase tracking-wider font-semibold text-[var(--accent)] shrink-0">ведущий</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {rpStars(u.rating || 0)}
                    <span className="text-[10.5px] tabular-nums" style={{ color: avColor }}>● {av.label}</span>
                    <span className="text-[10.5px] text-[var(--muted-foreground)] tabular-nums">{m.pct}%</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="font-[var(--font-display)] font-bold text-[15px] tabular-nums leading-none" style={{ color: sc >= 70 ? "var(--accent)" : "var(--foreground)" }}>{sc}</span>
                  {on && <button type="button" onClick={() => setPrimary(h)} className={`text-[9.5px] px-1.5 rounded-full border ${isLead ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]"}`}>{isLead ? "ведущий" : "вести"}</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">{tier.hint} Приглашённые ревьюеры должны согласиться — ответ придёт сразу.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Top collapsible meta bar — sits between the editor header and the
// article column. Holds cover, slug, tags, complexity, reviewers,
// deadline, note, and a readiness ledger. Collapsed by default for
// existing chapters, expanded for new ones.
// ─────────────────────────────────────────────────────────────────
function MetaBar({
  cover, setCover, slug, slugOverride, setSlugOverride,
  tags, setTags, complexity, setComplexity, picked, setPicked, primary, setPrimary,
  deadline, setDeadline, note, setNote, users, ready, checks,
  expanded, setExpanded,
}) {
  const tier = COMPLEXITY[complexity] || COMPLEXITY.medium;
  const okCount = checks.filter(c => c.ok).length;
  const primaryUser = primary ? users[primary] : null;
  const tagList = tags.split(",").map(s => s.trim()).filter(Boolean);

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">
        {/* ── Collapsed chip strip — always visible, click to toggle ── */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls="meta-bar-panel"
          className="w-full flex items-center gap-2 sm:gap-3 py-2.5 text-left min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
        >
          {/* Cover thumb */}
          <span className="w-10 h-7 rounded border border-[var(--border)] bg-[var(--background)] flex items-center justify-center text-[9.5px] text-[var(--muted-foreground)] overflow-hidden shrink-0">
            {cover ? <img src={cover} alt="" className="w-full h-full object-cover" /> : "обл."}
          </span>

          {/* Complexity */}
          <span className="text-[11.5px] text-[var(--muted-foreground)] shrink-0 hidden sm:inline">
            <span className="text-[var(--foreground)] font-medium">{tier.label}</span>
          </span>
          <span className="text-[var(--border)] shrink-0 hidden sm:inline">·</span>

          {/* Reviewers */}
          <span className="text-[11.5px] text-[var(--muted-foreground)] shrink-0 truncate min-w-0">
            {primaryUser ? (
              <>Ведущий <span className="text-[var(--foreground)] font-medium">@{primaryUser.handle}</span>{picked.length > 1 ? <span className="text-[var(--muted-foreground)]"> +{picked.length - 1}</span> : null}</>
            ) : (
              <span className="text-[var(--warning)]">Ревьюер не назначен</span>
            )}
          </span>

          <span className="text-[var(--border)] shrink-0 hidden sm:inline">·</span>

          {/* Deadline */}
          <span className="text-[11.5px] text-[var(--muted-foreground)] shrink-0 tabular-nums hidden sm:inline">до {deadline || "—"}</span>

          <span className="flex-1" />

          {/* Readiness */}
          <span className={`inline-flex items-center gap-1 text-[11.5px] tabular-nums shrink-0 ${ready ? "text-[var(--success)]" : "text-[var(--muted-foreground)]"}`}>
            {ready && <span aria-hidden="true">✓</span>}<span>{okCount}/{checks.length} готово</span>
          </span>

          {/* Expand chevron */}
          <span
            className={`text-[var(--muted-foreground)] text-[9px] shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          >▼</span>
        </button>

        {/* ── Expanded form ── */}
        {expanded && (
          <div id="meta-bar-panel" className="pb-5 pt-4 grid grid-cols-1 md:grid-cols-12 gap-x-5 gap-y-4 border-t border-[var(--border)]">
            {/* Cover */}
            <div className="md:col-span-4 lg:col-span-3">
              <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5">Обложка</label>
              <div
                className="aspect-[16/9] rounded-md border border-dashed border-[var(--border)] bg-[var(--background)] flex items-center justify-center text-[var(--muted-foreground)] text-[11.5px] cursor-pointer hover:border-[var(--accent)] overflow-hidden"
                onClick={() => { const url = prompt("URL обложки"); if (url) setCover(url); }}
              >
                {cover ? <img src={cover} alt="" className="w-full h-full object-cover" /> : "Загрузить или вставить URL"}
              </div>
            </div>

            {/* Slug + Tags */}
            <div className="md:col-span-4 lg:col-span-4 flex flex-col gap-3">
              <div>
                <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Slug</label>
                <div className="flex items-center gap-1">
                  <span className="text-[11.5px] text-[var(--muted-foreground)] font-mono">/blog/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlugOverride(e.target.value)}
                    placeholder="auto"
                    className="block flex-1 min-w-0 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-[12.5px] font-mono focus:outline-none focus:border-[var(--accent)]"
                  />
                  {slugOverride !== null && (
                    <button type="button" onClick={() => setSlugOverride(null)} className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--accent)] px-1" title="Авто-slug">↺</button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Теги</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="через запятую: Next.js, App Router"
                  className="block w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)]"
                />
                {tagList.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {tagList.map(t => (
                      <span key={t} className="text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Complexity + Deadline */}
            <div className="md:col-span-4 lg:col-span-5 flex flex-col gap-3">
              <div>
                <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5">Сложность статьи</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {COMPLEXITY_ORDER.map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setComplexity(k)}
                      className={`px-1 py-1.5 rounded text-[11.5px] font-medium border transition-colors ${complexity === k
                        ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]/40"}`}
                    >{COMPLEXITY[k].label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Срок ревью</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="block w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            {/* Reviewers */}
            <div className="md:col-span-7 lg:col-span-7">
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Ревьюеры</label>
                <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums">{picked.length}/{tier.max}</span>
              </div>
              <ReviewersPicker users={users} picked={picked} setPicked={setPicked} primary={primary} setPrimary={setPrimary} complexity={complexity} />
            </div>

            {/* Note */}
            <div className="md:col-span-5 lg:col-span-5">
              <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Записка ревьюерам</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Что просите посмотреть особенно внимательно?"
                className="block w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)] resize-y"
              />
            </div>

            {/* Readiness ledger */}
            <div className="md:col-span-12 pt-3 border-t border-[var(--border)]">
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Готовность к ревью</label>
                {!ready && <span className="text-[11px] text-[var(--muted-foreground)]">Закройте все пункты, чтобы отправить</span>}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                {checks.map((c, i) => (
                  <li key={i} className="flex items-baseline gap-1.5 text-[12.5px]">
                    <span className={c.ok ? "text-[var(--success)]" : "text-[var(--muted-foreground)]"}>{c.ok ? "✓" : "○"}</span>
                    <span className={c.ok ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Submit step — large right-side sheet (see SubmitSheet below).
// ─────────────────────────────────────────────────────────────────
// SubmitSheet — large right-side sheet for the "Отправить на ревью" step.
// Holds everything that used to live always-on in the editor meta bar:
// readiness gate, complexity, reviewers + lead, deadline, note. This is the
// review-handoff stage, separated from the writing surface.
// ─────────────────────────────────────────────────────────────────
// Inline chip editor for article key-skills (scientific-keyword style).
function SkillsField({ skills, setSkills }) {
  const [val, setVal] = useState("");
  const add = (s) => { s = s.trim(); if (s && !skills.includes(s) && skills.length < 6) setSkills([...skills, s]); setVal(""); };
  return (
    <div>
      <div className="flex items-center gap-1.5 flex-wrap rounded-md border border-[var(--border)] bg-[var(--background)] p-2 min-h-[40px]">
        {skills.map(s => (
          <span key={s} className="inline-flex items-center gap-1.5 rounded-full text-[11.5px] px-2 py-0.5 font-medium" style={{ background: "color-mix(in srgb,var(--accent) 12%,transparent)", color: "var(--accent)" }}>
            {s}<button type="button" onClick={() => setSkills(skills.filter(x => x !== s))} className="hover:opacity-60">×</button>
          </span>
        ))}
        <input type="text" value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(val); } else if (e.key === "Backspace" && !val && skills.length) setSkills(skills.slice(0, -1)); }}
          placeholder={skills.length ? "" : "OpenTelemetry, Node.js…"} className="flex-1 min-w-[80px] bg-transparent text-[12.5px] focus:outline-none py-0.5" />
      </div>
      <p className="text-[11px] text-[var(--muted-foreground)] mt-1 leading-relaxed">Ключевые слова темы — по ним подбираются ревьюеры; видны и читателю. Enter добавляет.</p>
    </div>
  );
}

function SubmitSheet({
  open, title, isChapter, chapterNumber,
  complexity, setComplexity, picked, setPicked, primary, setPrimary,
  deadline, setDeadline, note, setNote, users, checks, ready,
  skills, setSkills, onRequestAdmin,
  onClose, onConfirm,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const tier = COMPLEXITY[complexity] || COMPLEXITY.medium;
  const okCount = checks.filter(c => c.ok).length;
  const label = "block text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5";
  return (
    <div className="fixed inset-0 z-[55] bg-black/40 flex justify-end" onClick={onClose} role="dialog" aria-modal="true">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px] h-full bg-[var(--bg-elevated)] border-l border-[var(--border)] flex flex-col" style={{ boxShadow: "-16px 0 40px rgba(0,0,0,0.18)" }}>
        <header className="px-5 py-4 border-b border-[var(--border)] shrink-0 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Передача на ревью</p>
            <h2 className="font-[var(--font-display)] font-bold text-[20px] tracking-tight leading-snug">
              {isChapter ? `Отправить главу ${chapterNumber || ""} на ревью` : "Отправить на ревью"}
            </h2>
            <p className="text-[12.5px] text-[var(--muted-foreground)] mt-1 title-clamp-1" title={title}>«{title}»</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]">×</button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Readiness gate */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3.5">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Готовность</p>
              <span className={`text-[11.5px] tabular-nums ${ready ? "text-[var(--success)]" : "text-[var(--muted-foreground)]"}`}>{okCount}/{checks.length}</span>
            </div>
            <ul className="grid grid-cols-1 gap-1.5 text-[13px]">
              {checks.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className={c.ok ? "text-[var(--success)]" : "text-[var(--muted-foreground)]"}>{c.ok ? "✓" : "○"}</span>
                  <span className={c.ok ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Complexity */}
          <div>
            <label className={label}>Сложность статьи</label>
            <div className="grid grid-cols-3 gap-1.5">
              {COMPLEXITY_ORDER.map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setComplexity(k)}
                  className={`px-1 py-1.5 rounded text-[11.5px] font-medium border transition-colors ${complexity === k
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]/40"}`}
                >{COMPLEXITY[k].label}</button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5 leading-relaxed">{tier.hint}</p>
          </div>

          {/* Key skills */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Ключевые навыки</label>
              <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums">{(skills || []).length}/6</span>
            </div>
            <SkillsField skills={skills || []} setSkills={setSkills} />
          </div>

          {/* Reviewers */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Ревьюеры · подбор по навыкам</label>
              <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums">{picked.length}/{tier.max}</span>
            </div>
            <ReviewersPicker users={users} picked={picked} setPicked={setPicked} primary={primary} setPrimary={setPrimary} complexity={complexity} skills={skills} onRequestAdmin={onRequestAdmin} />
          </div>

          {/* Note */}
          <div>
            <label className={label}>Записка ревьюерам</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Что просите посмотреть особенно внимательно?"
              className="block w-full bg-[var(--background)] border border-[var(--border)] rounded px-2.5 py-2 text-[12.5px] focus:outline-none focus:border-[var(--accent)] resize-y"
            />
          </div>
        </div>

        <footer className="px-5 py-3.5 border-t border-[var(--border)] shrink-0 flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-[var(--muted-foreground)]">{ready ? "Готово к отправке" : "Закройте все пункты готовности"}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded text-[12.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">Отмена</button>
            <button type="button" disabled={!ready} onClick={onConfirm} className="px-4 py-2 rounded text-[12.5px] font-medium bg-[var(--accent)] text-[var(--accent-foreground)] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">Отправить</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ChapterSettingsPopover — publication metadata (slug / tags / cover),
// moved out of the always-on meta bar. Opened from the gear / settings chip.
// ─────────────────────────────────────────────────────────────────
function ChapterSettingsPopover({ slug, slugOverride, setSlugOverride, tags, setTags, tagList, cover, setCover, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const label = "block text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5";
  return (
    <div className="fixed inset-0 z-[55] bg-black/40 flex items-start justify-center p-4 pt-16" onClick={onClose} role="dialog" aria-modal="true">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]" style={{ boxShadow: "0 16px 40px rgba(0,0,0,0.2)" }}>
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
          <h2 className="font-[var(--font-display)] font-bold text-[17px] tracking-tight">Настройки главы</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]">×</button>
        </header>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className={label}>Slug</label>
            <div className="flex items-center gap-1">
              <span className="text-[11.5px] text-[var(--muted-foreground)] font-[var(--font-mono)]">/blog/</span>
              <input
                type="text" value={slug}
                onChange={(e) => setSlugOverride(e.target.value)}
                placeholder="auto"
                className="block flex-1 min-w-0 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1.5 text-[12.5px] font-[var(--font-mono)] focus:outline-none focus:border-[var(--accent)]"
              />
              {slugOverride !== null && (
                <button type="button" onClick={() => setSlugOverride(null)} className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--accent)] px-1" title="Авто-slug">↺</button>
              )}
            </div>
          </div>
          <div>
            <label className={label}>Теги</label>
            <input
              type="text" value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="через запятую: Next.js, App Router"
              className="block w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)]"
            />
            {tagList.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {tagList.map(t => <span key={t} className="text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">{t}</span>)}
              </div>
            )}
          </div>
          <div>
            <label className={label}>Обложка</label>
            <div
              className="aspect-[16/9] rounded-md border border-dashed border-[var(--border)] bg-[var(--background)] flex items-center justify-center text-[var(--muted-foreground)] text-[11.5px] cursor-pointer hover:border-[var(--accent)] overflow-hidden"
              onClick={() => { const url = prompt("URL обложки"); if (url) setCover(url); }}
            >
              {cover ? <img src={cover} alt="" className="w-full h-full object-cover" /> : "Загрузить или вставить URL"}
            </div>
            {cover && <button type="button" onClick={() => setCover(null)} className="mt-1.5 text-[11.5px] text-[var(--muted-foreground)] hover:text-[var(--danger)]">Убрать обложку</button>}
          </div>
        </div>
        <footer className="px-5 py-3 border-t border-[var(--border)] flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] text-[12.5px] font-medium hover:opacity-90 transition-opacity">Готово</button>
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PreviewArticle — renders the draft (title + blocks) exactly as a reader
// would see it, reusing the public ReaderBlock renderer. Used by both the
// live split-pane preview and the full-screen "Просмотр" mode.
// ─────────────────────────────────────────────────────────────────
function PreviewArticle({ title, blocks, compact }) {
  const RB = window.ReaderBlock;
  const real = (blocks || []).filter(b => (b.text || b.url || b.src || "").toString().trim());
  return (
    <article className={`reader-prose mx-auto ${compact ? "text-[15px]" : "text-[16px]"}`} style={{ maxWidth: 720 }}>
      <h1 className="font-[var(--font-display)] font-extrabold text-[28px] md:text-[40px] leading-[1.1] tracking-tight mb-6">
        {title || "Без названия"}
      </h1>
      {real.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-[14px]">Пока нечего показать — добавьте содержимое в редакторе.</p>
      ) : RB ? (
        real.map(b => <RB key={b.id} block={b} anchor={`preview-${b.id}`} />)
      ) : (
        <p className="text-[var(--danger)] text-[13px]">Рендер недоступен.</p>
      )}
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────
// The main editor screen.
// ─────────────────────────────────────────────────────────────────
function EditorScreen({ session, blogSlug, chapterSlug, onBack, onOpenReview, portfolioMode }) {
  const users = window.FAKE_DATA.users || {};
  const D     = window.__blogData;
  const me    = session?.handle || "alex";
  const pfExisting = portfolioMode ? (window.__portfolio?.get(me) || null) : null;

  // ─── Resolve blog + chapter ──────────────────────────────────
  // Two modes:
  //   A. (blogSlug, chapterSlug) → edit existing chapter
  //   B. (blogSlug, null)        → new chapter for this blog
  // (legacy single-slug callers passed the blog slug both as `blogSlug`
  // and `draftSlug`; the latter is no longer read.)
  let blog = null, existingChapter = null, isNewChapter = false;
  if (blogSlug) {
    blog = D.getBlogBySlug(blogSlug);
    if (chapterSlug) existingChapter = blog?.chapters.find(c => c.slug === chapterSlug) || null;
    if (!existingChapter && chapterSlug) {
      // chapterSlug given but not found — treat as new chapter request
      isNewChapter = true;
    } else if (!chapterSlug) {
      isNewChapter = true;
    } else if (existingChapter) {
      isNewChapter = false;
    }
  }

  const isMultiChapterBlog = (blog?.chapters.length || 0) > 1;
  const prevPublishedChapters = blog?.chapters.filter(c => D.isChapterPublished(c)) || [];
  const lastReviewed = [...(blog?.chapters || [])].reverse().find(c => (c.reviewerHandles || []).length > 0);

  // For new chapter — compute order + seed title with placeholder.
  const newChapterOrder = blog ? blog.chapters.length : 0;

  // ─── State ───────────────────────────────────────────────────
  // Cover / tags / complexity are blog-level — inherited (read-only) when working
  // inside a blog. Title / blocks / reviewers / deadline / note are chapter-level.
  const [cover,      setCover]      = useState(blog?.cover || "");
  const [tags,       setTags]       = useState(blog?.tags?.join(", ") || (existingChapter ? "Next.js, App Router" : ""));
  const [complexity, setComplexity] = useState(
    COMPLEXITY[blog?.complexity] ? blog.complexity : (blog?.complexity === "advanced" ? "complex" : "medium")
  );

  const [title, setTitle] = useState(
    portfolioMode ? (pfExisting?.title || "")
                  : (existingChapter?.title || (isNewChapter ? `Глава ${newChapterOrder + 1}` : ""))
  );
  const [slugOverride, setSlugOverride] = useState(null);
  const slug = slugOverride !== null ? slugOverride : slugifyRu(title);

  // Pre-fill reviewers: for a new chapter, suggest the team of the most recently
  // reviewed chapter in this blog.
  const seedReviewers = existingChapter?.reviewerHandles
    || (isNewChapter && lastReviewed ? lastReviewed.reviewerHandles : []);
  const seedPrimary   = existingChapter?.primaryHandle
    || (isNewChapter && lastReviewed ? lastReviewed.primaryHandle : null);
  const [picked,  setPicked]  = useState(seedReviewers);
  const [primary, setPrimary] = useState(seedPrimary);

  const [deadline, setDeadline] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });
  const [note, setNote] = useState("");

  // Key skills (scientific-keyword style) — separate entity from tags, used
  // for reviewer matching and shown to readers. Seed: chapter skills → blog tags.
  const seedSkills = (existingChapter && Array.isArray(existingChapter.skills) && existingChapter.skills.length)
    ? existingChapter.skills.slice()
    : (blog?.tags?.length ? blog.tags.slice() : []);
  const [skills, setSkills] = useState(seedSkills);
  const [recruitSent, setRecruitSent] = useState(false);
  const requestAdmin = () => {
    window.__reviewerFlow?.requestRecruit({
      blogSlug: blogSlug || slug, chapterSlug: slug,
      blogTitle: blog?.title || title, chapterTitle: title,
      skills: [...skills], by: session?.handle || "alex",
    });
    setRecruitSent(true);
  };

  const [blocks, setBlocks] = useState(() => {
    if (portfolioMode) return pfExisting?.blocks?.length ? structuredClone(pfExisting.blocks) : [emptyBlock("p")];
    if (existingChapter?.blocks?.length) return structuredClone(existingChapter.blocks);
    return [emptyBlock("p")];
  });
  const [focusedId, setFocusedId] = useState(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedAt, setSavedAt] = useState(Date.now());
  const [dirty, setDirty] = useState(false);
  const [metaExpanded, setMetaExpanded] = useState(isNewChapter);
  const [seriesPanelOpen, setSeriesPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Title is a wrapping, auto-growing textarea (a single-line <input> clipped
  // descenders of the large serif and never wrapped long titles).
  const titleRef = useRef(null);
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const resize = () => { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; };
    resize();
    // The serif display font loads async; its taller metrics change scrollHeight,
    // so re-measure once fonts are ready (otherwise the first render clips the
    // bottom of the text until the user types).
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
    const raf = requestAnimationFrame(resize);
    return () => cancelAnimationFrame(raf);
  }, [title]);
  const TITLE_MAX = 64;

  // Preview: live split-pane (PC only) in 'off'|'left'|'right'|'bottom',
  // plus a full-screen reader preview toggled by the "Просмотр" button.
  const [previewPos, setPreviewPos] = useState("off");
  const [fullPreview, setFullPreview] = useState(false);

  // Block drag-and-drop reorder state.
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const commitMove = useCallback((from, to) => {
    setBlocks(arr => {
      if (from == null || to == null) return arr;
      const next = arr.slice();
      const [m] = next.splice(from, 1);
      let t = to;
      if (from < to) t -= 1;
      t = Math.max(0, Math.min(next.length, t));
      next.splice(t, 0, m);
      return next;
    });
  }, []);

  // Explicit draft saving (replaces the old opaque autosave). We track a
  // "dirty" flag: any edit marks the draft unsaved; the Save button persists
  // to localStorage and clears it. First render seeds the baseline as saved.
  const draftKey = `devblog-draft:${blogSlug || "new"}:${chapterSlug || "new"}`;
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) { firstRunRef.current = false; return; }
    setDirty(true);
  }, [title, blocks, tags, picked, primary, deadline, note, cover, complexity]);

  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        title, tags, complexity, cover, note,
        blocks, picked, primary, deadline,
        savedAt: Date.now(),
      }));
    } catch (e) {}
    setSavedAt(Date.now());
    setDirty(false);
  }, [draftKey, title, tags, complexity, cover, note, blocks, picked, primary, deadline]);

  // Ctrl/Cmd+S → save draft.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveDraft(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [saveDraft]);

  // Containers
  const rootRef = useRef(null);

  // ─── Block ops ───────────────────────────────────────────────
  const updateBlock = useCallback((idx, next) => {
    setBlocks(arr => arr.map((b, i) => i === idx ? next : b));
  }, []);
  const insertAfter = useCallback((idx, type = "p", subtype = null) => {
    const fresh = emptyBlock(type, subtype);
    setBlocks(arr => [...arr.slice(0, idx + 1), fresh, ...arr.slice(idx + 1)]);
    setFocusedId(fresh.id);
  }, []);
  const removeBlock = useCallback((idx) => {
    setBlocks(arr => arr.length <= 1 ? [emptyBlock("p")] : arr.filter((_, i) => i !== idx));
  }, []);
  const replaceType = useCallback((idx, type, subtype, html) => {
    setBlocks(arr => arr.map((b, i) => {
      if (i !== idx) return b;
      const next = emptyBlock(type, subtype);
      if ("text" in next) next.text = html ?? "";
      return { ...next, id: b.id };
    }));
  }, []);
  const changeType = useCallback((idx, type, subtype) => replaceType(idx, type, subtype, blocks[idx]?.text || ""), [replaceType, blocks]);

  // ─── Readiness ───────────────────────────────────────────────
  const tagList = useMemo(() => tags.split(",").map(s => s.trim()).filter(Boolean), [tags]);
  const tier = COMPLEXITY[complexity] || COMPLEXITY.medium;
  const checks = useMemo(() => [
    { ok: title.trim().length >= 6,                                                    label: "Заголовок (≥6 знаков)" },
    { ok: blocks.some(b => b.type === "h2" && stripHtml(b.text || "").trim()),         label: "Хотя бы один H2-раздел" },
    { ok: blocks.filter(b => stripHtml(b.text || b.url || b.src || "").trim()).length >= 3, label: "≥3 содержательных блока" },
    { ok: tagList.length >= 1,                                                          label: "Минимум 1 тег" },
    { ok: (skills || []).length >= 1,                                                   label: "Минимум 1 ключевой навык" },
    { ok: picked.length >= tier.min,                                                    label: `Ревьюеров: минимум ${tier.min}` },
    { ok: !!primary,                                                                    label: "Назначен ведущий" },
  ], [title, blocks, tagList, picked, primary, tier]);
  const ready = checks.every(c => c.ok);

  // Portfolio mode: no review gate. Ready = a title + at least one non-empty block.
  const pfReady = title.trim().length >= 3 && blocks.some(b => stripHtml(b.text || "").trim());
  const publishPortfolio = () => {
    window.__portfolio.save(me, {
      title: title.trim(),
      blocks: structuredClone(blocks),
      visible: pfExisting ? pfExisting.visible : true,
    });
    try { localStorage.removeItem(draftKey); } catch (e) {}
    setDirty(false);
    onBack?.();
  };

  // Status pill — based on chapter status now, not legacy article.
  const status = existingChapter?.revision?.status || "draft";
  const statusLabel = status === "draft" ? "Черновик"
    : status === "under-review" ? "На ревью"
    : status === "changes-requested" ? "Нужны правки"
    : status === "published" ? "Опубликовано" : status;
  const statusTone = status === "draft" ? "bg-[var(--muted)] text-[var(--muted-foreground)]"
    : status === "under-review" ? "bg-[color-mix(in_srgb,var(--info)_15%,transparent)] text-[var(--info)]"
    : status === "changes-requested" ? "bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-[var(--warning)]"
    : "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]";

  const fmtSaved = () => {
    if (dirty) return "не сохранено";
    const diff = Math.floor((Date.now() - savedAt) / 1000);
    if (diff < 5)  return "сохранено";
    if (diff < 60) return `сохранено ${diff} с назад`;
    return `сохранено ${Math.floor(diff/60)} мин назад`;
  };

  // ─── Submit — persist to the canonical data model ───────────
  const doSubmit = () => {
    const now = Math.floor(Date.now() / 1000);
    const me = session?.handle || "alex";
    const deadlineTs = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : null;
    const cleanBlocks = structuredClone(blocks);
    const reviewerHandles = (picked && picked.length) ? [...picked] : (primary ? [primary] : []);
    const primaryHandle = primary || reviewerHandles[0] || null;
    const stateObj = {};
    reviewerHandles.forEach(h => { stateObj[h] = { verdict: null, verdictAt: null, online: false, typing: false }; });
    const tagArr = (tags || "").split(",").map(t => t.trim()).filter(Boolean);
    const skillArr = [...(skills || [])];

    // Create pending invitations — reviewers must accept before the review
    // actually starts. Author sees responses in the cabinet / notifications.
    if (window.__reviewerFlow && reviewerHandles.length) {
      const blogTitleForInv = blog?.title || title;
      const totalCh = blog ? (blog.chapters.length + (existingChapter ? 0 : 1)) : 1;
      const chNum = existingChapter ? ((existingChapter.order || 0) + 1) : (blog ? blog.chapters.length + 1 : 1);
      window.__reviewerFlow.invite(reviewerHandles.map((h, i) => ({
        id: `inv-${Date.now()}-${i}`,
        blogSlug: blogSlug || slug, blogTitle: blogTitleForInv,
        chapterTitle: title, chN: chNum, chTotal: totalCh,
        author: me, complexity: COMPLEXITY[complexity]?.label || "Средняя",
        skills: skillArr, note: note || "", asLead: h === primaryHandle,
        to: h, status: "pending", deadlineH: 48, at: now,
      })));
    }

    const makeChapter = (order, chSlug, chTitle) => ({
      id: `ch-${Date.now()}-${order}`,
      slug: chSlug || `chapter-${order + 1}`,
      title: chTitle || `Глава ${order + 1}`,
      order,
      blocks: cleanBlocks,
      prevBlocks: [],
      skills: [...(skills || [])],
      revision: { number: 1, status: "under-review", summary: note || "", submittedAt: now, deadline: deadlineTs },
      primaryHandle, reviewerHandles, state: stateObj,
      threads: [], chat: [],
      openThreads: 0, lastActivityAt: now, hasMyTurn: false, stalledFor: 0,
    });

    let resultBlogSlug = blogSlug, resultChapterSlug = slug;
    if (existingChapter) {
      // Edit existing chapter → resubmit as a new revision under review.
      const wasPublished = existingChapter.revision?.status === "published";
      existingChapter.blocks = cleanBlocks;
      existingChapter.title = title;
      existingChapter.skills = [...(skills || [])];
      existingChapter.reviewerHandles = reviewerHandles;
      existingChapter.primaryHandle = primaryHandle;
      existingChapter.state = stateObj;
      existingChapter.revision = {
        ...(existingChapter.revision || {}),
        number: (existingChapter.revision?.number || 0) + 1,
        status: "under-review",
        submittedAt: now,
        deadline: deadlineTs,
        summary: note || existingChapter.revision?.summary || "",
      };
      existingChapter.hasMyTurn = false;
      existingChapter.lastActivityAt = now;
      resultChapterSlug = existingChapter.slug;
    } else if (blog) {
      // New chapter in existing blog.
      const ch = makeChapter(blog.chapters.length, slug, title);
      blog.chapters.push(ch);
      blog.lastActivityAt = now;
      resultChapterSlug = ch.slug;
    } else {
      // New blog → create with this single chapter (slug "main").
      const blogSlugNew = slug || `blog-${Date.now()}`;
      const newBlog = {
        id: `blog-${Date.now()}`,
        slug: blogSlugNew,
        title,
        authorSlug: me,
        summary: note || "",
        cover: cover || null,
        tags: tagArr,
        complexity: complexity || "medium",
        publishedAt: null,
        lastActivityAt: now,
        viewCount: 0, rating: 0, bookmarkCount: 0,
        chapters: [makeChapter(0, "main", title)],
      };
      window.FAKE_DATA.blogs = window.FAKE_DATA.blogs || [];
      window.FAKE_DATA.blogs.unshift(newBlog);
      resultBlogSlug = blogSlugNew;
      resultChapterSlug = "main";
    }

    // Clear the autosaved draft for this slot now that it's submitted.
    try { localStorage.removeItem(`devblog-draft:${blogSlug || "new"}:${chapterSlug || "new"}`); } catch {}

    window.__reviewStore?.update({}); // broadcast → inbox / author / admin
    window.__submitResult = { blogSlug: resultBlogSlug, chapterSlug: resultChapterSlug };
    setSubmitOpen(false);
    setSubmitted(true);
  };

  return (
    <div ref={rootRef} className="relative flex flex-col min-h-[800px] bg-[var(--background)]" data-screen-label="Editor">
      {/* ── Top bar — minimal (Variant B): writing-only chrome ── */}
      <header className="sticky top-0 z-20 bg-[var(--background)]/95 backdrop-blur border-b border-[var(--border)]">
        <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 text-[12.5px] text-[var(--muted-foreground)]">
            <button onClick={onBack} className="hover:text-[var(--foreground)] transition-colors inline-flex items-center gap-1 shrink-0 min-h-[32px]">← Кабинет</button>
            <span className="inline-flex items-center gap-1 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${dirty ? "bg-[var(--warning)]" : "bg-[var(--success)]"}`} />
              <span className={dirty ? "text-[var(--warning)]" : ""}>{fmtSaved()}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Save (explicit) */}
            <button
              type="button" onClick={saveDraft} disabled={!dirty}
              title="Сохранить черновик (⌘/Ctrl+S)" aria-label="Сохранить черновик"
              className="relative w-9 h-9 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)] disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              {dirty && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--warning)]" />}
            </button>
            {/* Preview (full reader) */}
            <button
              type="button" onClick={() => setFullPreview(true)}
              title="Предпросмотр статьи" aria-label="Предпросмотр"
              className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            {/* Split preview — single toggle (PC only) */}
            <button
              type="button" onClick={() => setPreviewPos(p => p === "off" ? "right" : "off")}
              title="Сплит-превью" aria-label="Сплит-превью" aria-pressed={previewPos !== "off"}
              className={`hidden lg:inline-flex w-9 h-9 items-center justify-center rounded-md border transition-colors ${previewPos !== "off" ? "border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)]"}`}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="13" y1="4" x2="13" y2="20"/></svg>
            </button>
            {/* Chapter settings popover (not in portfolio mode) */}
            {!portfolioMode && (
            <button
              type="button" onClick={() => setSettingsOpen(true)}
              title="Настройки главы" aria-label="Настройки главы"
              className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            )}
            {/* Submit / Publish */}
            {portfolioMode ? (
              <button
                type="button" disabled={!pfReady} onClick={publishPortfolio}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3.5 h-9 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity whitespace-nowrap ml-0.5"
                title={pfReady ? "Опубликовать страницу «Об авторе»" : "Добавьте заголовок и хотя бы один блок"}
              >Опубликовать</button>
            ) : (
              <button
                type="button" onClick={() => setSubmitOpen(true)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3.5 h-9 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity whitespace-nowrap ml-0.5"
              >Отправить на ревью →</button>
            )}
          </div>
        </div>
      </header>

      {/* ── Top collapsible meta bar (removed in Variant B; metadata lives in
            «Настройки главы» popover, review config in the submit sheet) ── */}

      <div className={`flex flex-1 min-h-0 ${previewPos === "bottom" ? "flex-col" : "flex-row"}`}>
        {/* Live preview — LEFT */}
        {previewPos === "left" && (
          <aside className="hidden lg:block shrink-0 w-[42%] max-w-[600px] self-start sticky top-[56px] max-h-[calc(100vh-60px)] overflow-y-auto bg-[var(--bg-secondary)] border-r border-[var(--border)]">
            <div className="px-6 py-8">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-4">Предпросмотр</p>
              <PreviewArticle title={title} blocks={blocks} compact />
            </div>
          </aside>
        )}

        {/* ── Center: blocks ── */}
        <main className="flex-1 min-w-0">
          <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-10">
            {/* Breadcrumb / context */}
            <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-3 inline-flex items-center gap-1.5">
              {portfolioMode
                ? <><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> Об авторе · публикуется сразу, без ревью</>
                : isMultiChapterBlog
                ? <>{blog.title} · Глава {isNewChapter ? newChapterOrder + 1 : existingChapter.order + 1} из {isNewChapter ? newChapterOrder + 1 : blog.chapters.length} · {statusLabel}</>
                : statusLabel}
            </p>

            {/* Title (also editable here for big-screen affordance) */}
            {/* Title — wrapping, auto-growing, capped at 64 chars */}
            <textarea
              ref={titleRef}
              rows={1}
              maxLength={TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              placeholder={portfolioMode ? "Заголовок — кто вы и чем занимаетесь" : "Заголовок статьи"}
              className="block w-full resize-none overflow-hidden bg-transparent border-none focus:outline-none font-[var(--font-display)] font-extrabold text-[34px] md:text-[40px] leading-[1.18] tracking-tight pb-2 mb-4 placeholder-[var(--muted-foreground)]"
            />
            {title.length >= TITLE_MAX - 8 && (
              <p className="-mt-2 mb-3 text-[11px] text-[var(--muted-foreground)] tabular-nums">{title.length}/{TITLE_MAX}</p>
            )}

            {portfolioMode ? (
              <div className="mb-8" />
            ) : (
            /* Contextual settings chip row — opens «Настройки главы» */
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex flex-wrap items-center gap-2 mb-8 text-[12px] text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-md px-3 py-1.5 hover:border-[var(--accent)] hover:text-[var(--foreground)] transition-colors text-left w-full sm:w-auto"
            >
              <span className="font-[var(--font-mono)] text-[11.5px]">/blog/{slug}</span>
              <span className="text-[var(--border)]">·</span>
              {tagList.length > 0
                ? tagList.slice(0, 3).map(t => <span key={t} className="px-1.5 py-0.5 rounded-full bg-[var(--muted)]">{t}</span>)
                : <span>без тегов</span>}
              <span className="text-[var(--border)]">·</span>
              <span>{cover ? "обложка задана" : "обложка не задана"}</span>
              <span className="ml-auto inline-flex items-center gap-1 text-[var(--accent)] font-medium pl-2">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Настройки
              </span>
            </button>
            )}

            {/* Blocks */}
            {blocks.map((b, i) => (
              <BlockFrame
                key={b.id}
                dragging={dragIndex === i}
                dropBefore={dragIndex !== null && dropIndex === i && dragIndex !== i}
                onGripDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  try { e.dataTransfer.setData("text/plain", String(i)); } catch (_) {}
                  setDragIndex(i);
                }}
                onGripDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                dragHandlers={{
                  onDragOver: (e) => {
                    if (dragIndex === null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    const r = e.currentTarget.getBoundingClientRect();
                    const after = (e.clientY - r.top) > r.height / 2;
                    setDropIndex(after ? i + 1 : i);
                  },
                  onDrop: (e) => {
                    if (dragIndex === null) return;
                    e.preventDefault();
                    commitMove(dragIndex, dropIndex == null ? i : dropIndex);
                    setDragIndex(null); setDropIndex(null);
                  },
                }}
                onAddAfter={(t, st) => insertAfter(i, t, st)}
                onDelete={() => removeBlock(i)}
                onChangeType={(t, st) => changeType(i, t, st)}
              >
                <BlockRouter
                  block={b}
                  focused={focusedId === b.id}
                  onChange={(next) => updateBlock(i, next)}
                  onEnter={() => insertAfter(i, "p")}
                  onBackspaceEmpty={() => removeBlock(i)}
                  replaceType={(t, st, html) => replaceType(i, t, st, html)}
                />
              </BlockFrame>
            ))}

            {/* End drop-zone indicator (drop after the last block) */}
            <div
              className="relative pl-12 h-3"
              onDragOver={(e) => { if (dragIndex === null) return; e.preventDefault(); setDropIndex(blocks.length); }}
              onDrop={(e) => { if (dragIndex === null) return; e.preventDefault(); commitMove(dragIndex, blocks.length); setDragIndex(null); setDropIndex(null); }}
            >
              {dragIndex !== null && dropIndex === blocks.length && (
                <div className="absolute top-1 left-12 right-1 h-[3px] bg-[var(--accent)] rounded-full pointer-events-none" />
              )}
            </div>

            {/* Trailing insert hint */}
            <div className="pl-12 mt-1 text-[12px] text-[var(--muted-foreground)]">
              <button type="button" onClick={() => insertAfter(blocks.length - 1, "p")} className="hover:text-[var(--accent)]">+ добавить блок</button>
              <span className="mx-2">·</span>
              <span className="font-mono text-[11px]">/ — команды</span>
              <span className="mx-2">·</span>
              <span className="font-mono text-[11px]">перетащите ⠿, чтобы переставить</span>
            </div>
          </div>
        </main>

        {/* Live preview — RIGHT */}
        {previewPos === "right" && (
          <aside className="hidden lg:block shrink-0 w-[42%] max-w-[600px] self-start sticky top-[56px] max-h-[calc(100vh-60px)] overflow-y-auto bg-[var(--bg-secondary)] border-l border-[var(--border)]">
            <div className="px-6 py-8">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-4">Предпросмотр</p>
              <PreviewArticle title={title} blocks={blocks} compact />
            </div>
          </aside>
        )}

        {/* Live preview — BOTTOM (docked) */}
        {previewPos === "bottom" && (
          <aside className="hidden lg:block sticky bottom-0 max-h-[42vh] overflow-y-auto bg-[var(--bg-secondary)] border-t border-[var(--border)]">
            <div className="max-w-[760px] mx-auto px-6 py-6">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-3">Предпросмотр</p>
              <PreviewArticle title={title} blocks={blocks} compact />
            </div>
          </aside>
        )}
      </div>

      {/* Floating inline-format toolbar */}
      <InlineToolbar containerRef={rootRef} />

      {/* Full-screen reader preview — how the chapter looks to a reader. */}
      {fullPreview && (
        <div className="fixed inset-0 z-[60] bg-[var(--background)] flex flex-col">
          <header className="sticky top-0 shrink-0 bg-[var(--background)]/95 backdrop-blur border-b border-[var(--border)] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setFullPreview(false)}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--foreground)] hover:text-[var(--accent)] transition-colors min-h-[36px]"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 18 5 12 11 6"/></svg>
              Вернуться к редактированию
            </button>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Предпросмотр · как видит читатель</span>
          </header>
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 sm:px-6 py-10">
              <PreviewArticle title={title} blocks={blocks} />
            </div>
          </div>
        </div>
      )}

      {/* Submit step — large right side sheet */}
      <SubmitSheet
        open={submitOpen}
        title={title}
        isChapter={isMultiChapterBlog}
        chapterNumber={isNewChapter ? newChapterOrder + 1 : (existingChapter?.order + 1)}
        complexity={complexity} setComplexity={setComplexity}
        picked={picked} setPicked={setPicked}
        primary={primary} setPrimary={setPrimary}
        deadline={deadline} setDeadline={setDeadline}
        note={note} setNote={setNote}
        users={users} checks={checks} ready={ready}
        skills={skills} setSkills={setSkills} onRequestAdmin={requestAdmin}
        onClose={() => setSubmitOpen(false)}
        onConfirm={doSubmit}
      />

      {/* Chapter settings popover — slug / tags / cover */}
      {settingsOpen && (
        <ChapterSettingsPopover
          slug={slug} slugOverride={slugOverride} setSlugOverride={setSlugOverride}
          tags={tags} setTags={setTags} tagList={tagList}
          cover={cover} setCover={setCover}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Post-submit success bar */}
      {submitted && (
        <div className="fixed bottom-4 right-4 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-4 max-w-sm">
          <p className="font-medium text-[13.5px] mb-1">✓ Отправлено на ревью</p>
          <p className="text-[12px] text-[var(--muted-foreground)] mb-2 leading-relaxed">Ревьюеры получили уведомление. Можно следить за прогрессом на странице ревью.</p>
          <div className="flex gap-2">
            <button onClick={() => { const r = window.__submitResult || {}; onOpenReview?.(r.blogSlug || blogSlug, r.chapterSlug || slug); }} className="text-[12px] font-medium text-[var(--accent)] hover:underline">Открыть страницу ревью →</button>
            <button onClick={() => setSubmitted(false)} className="text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Override window.EditorScreen so App.jsx picks up the new component.
window.EditorScreen = EditorScreen;
