// reviewer-board.jsx — public "we're looking for reviewers" board.
// Admin-curated open calls (window.__reviewerFlow.boardCalls). Reachable from
// the feed banner ("Стать ревьюером") for everyone. Every CTA is wired:
//  • «Откликнуться» / «Стать ревьюером» → ApplyModal (submits an application
//    that lands in the admin «Запросы ревьюеров» screen)
//  • «Как это работает» → HowItWorksModal
// Overrides window.ReviewerBoardScreen.
const { useState, useEffect } = React;

function BoardSkill({ label, active, onClick }) {
  const base = "inline-flex items-center rounded-full border text-[11.5px] px-2.5 py-0.5 whitespace-nowrap transition-colors";
  if (onClick) {
    return <button type="button" onClick={onClick} className={`${base} ${active ? "border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]" : "border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--muted-foreground)] hover:border-[var(--foreground)]/30"}`}>{label}</button>;
  }
  return <span className={`${base} border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--muted-foreground)]`}>{label}</span>;
}

function RbIcon({ d, w = 15, sw = 1.8 }) {
  return <svg viewBox="0 0 24 24" width={w} height={w} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
}

function BoardCallCard({ c, onRespond }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 flex flex-col gap-3 hover:border-[color-mix(in_srgb,var(--foreground)_18%,transparent)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-[var(--font-display)] font-bold text-[17px] leading-snug tracking-tight">{c.area}</h3>
        {c.hot && <span className="shrink-0 text-[10px] uppercase tracking-wider font-semibold text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] rounded-full px-2 py-0.5">срочно</span>}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">{(c.skills || []).map(s => <BoardSkill key={s} label={s} />)}</div>
      <p className="text-[12.5px] text-[var(--muted-foreground)] leading-relaxed flex-1">{c.note}</p>
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--border)]">
        <span className="text-[12px] text-[var(--muted-foreground)] tabular-nums inline-flex items-center gap-1.5"><RbIcon d={<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></>} w={13} />{c.waiting} {c.waiting === 1 ? "глава ждёт" : "главы ждут"}</span>
        <button onClick={() => onRespond(c)} className="inline-flex items-center gap-1.5 rounded-lg text-[12px] px-3.5 py-1.5 font-semibold bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-colors">Откликнуться</button>
      </div>
    </div>
  );
}

// ── Apply-to-review modal ──────────────────────────────────────────────
function ApplyModal({ session, area, onClose }) {
  const presetSkills = area?.skills || [];
  const [skills, setSkills] = useState(presetSkills);
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const addSkill = (s) => { s = s.trim(); if (s && !skills.includes(s)) setSkills([...skills, s]); setInput(""); };
  const submit = () => {
    window.__reviewerFlow?.apply({
      area: area?.area || "Общая заявка", skills: [...skills], message: msg.trim(),
      by: session?.handle || null, name: session?.name || "",
    });
    setSent(true);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "color-mix(in srgb, var(--foreground) 38%, transparent)" }} onClick={onClose} role="dialog" aria-modal="true">
      <div onClick={e => e.stopPropagation()} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden w-full max-w-[460px]" style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.22)" }}>
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-3 border-b border-[var(--border)]">
          <div>
            <h2 className="font-[var(--font-display)] font-bold text-[19px] tracking-tight leading-tight">{sent ? "Заявка отправлена" : "Стать ревьюером"}</h2>
            <p className="text-[12px] text-[var(--muted-foreground)] mt-1">{area ? `Направление: ${area.area}` : "Укажите свои навыки — администратор рассмотрит заявку"}</p>
          </div>
          <button onClick={onClose} aria-label="Закрыть" className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--muted)] shrink-0"><RbIcon d={<path d="M6 6l12 12M18 6L6 18" />} w={15} /></button>
        </div>
        {sent ? (
          <div className="px-6 py-7 text-center">
            <span className="w-12 h-12 rounded-full inline-flex items-center justify-center mb-3 bg-[var(--success-bg)] text-[var(--success)]"><RbIcon d={<path d="M5 12.5l4.5 4.5L19 6.5" />} w={24} sw={2.4} /></span>
            <p className="text-[14px] leading-relaxed text-[var(--foreground)] max-w-xs mx-auto mb-1">Спасибо! Заявка ушла администратору.</p>
            <p className="text-[12.5px] text-[var(--muted-foreground)] leading-relaxed max-w-xs mx-auto mb-5">Мы свяжемся с вами и подключим к ревью по вашим навыкам.</p>
            <button onClick={onClose} className="text-[13px] px-4 py-2 rounded-lg font-medium bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]">Готово</button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5">Ваши навыки</label>
                <div className="flex items-center gap-1.5 flex-wrap rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 min-h-[42px]">
                  {skills.map(s => (
                    <span key={s} className="inline-flex items-center gap-1.5 rounded-full text-[11.5px] px-2 py-0.5 font-medium" style={{ background: "color-mix(in srgb,var(--accent) 12%,transparent)", color: "var(--accent)" }}>
                      {s}<button onClick={() => setSkills(skills.filter(x => x !== s))} className="hover:opacity-60">×</button>
                    </span>
                  ))}
                  <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(input); } else if (e.key === "Backspace" && !input && skills.length) setSkills(skills.slice(0, -1)); }} placeholder={skills.length ? "" : "React, Go, Postgres…"} className="flex-1 min-w-[90px] bg-transparent text-[12.5px] focus:outline-none py-0.5" />
                </div>
              </div>
              <div>
                <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5">О себе <span className="normal-case font-normal text-[var(--muted-foreground)]">(необязательно)</span></label>
                <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} placeholder="Опыт, ссылки на работы, чем хотите помочь…" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[13px] leading-relaxed focus:outline-none focus:border-[var(--accent)] resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
              <button onClick={onClose} className="px-3 py-2 rounded-lg text-[12.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Отмена</button>
              <button onClick={submit} disabled={skills.length === 0} className="px-4 py-2 rounded-lg text-[12.5px] font-medium bg-[var(--accent)] text-[var(--accent-foreground)] disabled:opacity-50 hover:bg-[var(--accent-hover)]">Отправить заявку</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── How-it-works modal ──────────────────────────────────────────────────
function HowItWorksModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const steps = [
    { n: "1", t: "Оставьте заявку", d: "Укажите навыки — по ним система предлагает вас авторам подходящих статей." },
    { n: "2", t: "Принимайте приглашения", d: "В кабинете ревьюера видно входящие главы. Соглашайтесь или отклоняйте — автор узнаёт сразу." },
    { n: "3", t: "Рецензируйте и получайте оценку", d: "После публикации автор оценивает вашу работу 1–5 звёздами. Рейтинг влияет на то, как часто вас предлагают." },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "color-mix(in srgb, var(--foreground) 38%, transparent)" }} onClick={onClose} role="dialog" aria-modal="true">
      <div onClick={e => e.stopPropagation()} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden w-full max-w-[440px]" style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.22)" }}>
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-3 border-b border-[var(--border)]">
          <h2 className="font-[var(--font-display)] font-bold text-[19px] tracking-tight leading-tight">Как это работает</h2>
          <button onClick={onClose} aria-label="Закрыть" className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--muted)] shrink-0"><RbIcon d={<path d="M6 6l12 12M18 6L6 18" />} w={15} /></button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          {steps.map(s => (
            <div key={s.n} className="flex gap-3.5">
              <span className="shrink-0 w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] font-[var(--font-display)] font-bold inline-flex items-center justify-center">{s.n}</span>
              <div>
                <p className="text-[14px] font-semibold leading-tight mb-1">{s.t}</p>
                <p className="text-[12.5px] text-[var(--muted-foreground)] leading-relaxed">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewerBoardScreen({ session, onBack }) {
  const [, setTick] = useState(0);
  useEffect(() => window.__reviewerFlow?.subscribe(() => setTick(t => t + 1)), []);
  const [apply, setApply] = useState(null);    // null | { area } | {}
  const [how, setHow] = useState(false);
  const [filter, setFilter] = useState(null);  // active skill filter
  const calls = window.__reviewerFlow?.boardCalls || [];
  const totalWaiting = calls.reduce((s, c) => s + (c.waiting || 0), 0);
  const allSkills = [...new Set(calls.flatMap(c => c.skills || []))];
  const shown = filter ? calls.filter(c => (c.skills || []).includes(filter)) : calls;

  return (
    <div className="min-h-full" data-screen-label="ReviewerBoard">
      {/* Top bar — left-aligned back, full width, divider */}
      <div className="border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-3.5">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors min-h-[40px] -ml-1 px-1">
            <RbIcon d={<><line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 18 5 12 11 6"/></>} w={15} />
            К блогам
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="border-b border-[var(--border)]">
        <div className="px-4 sm:px-8 pt-10 pb-11 text-center max-w-3xl mx-auto">
          <p className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] font-semibold text-[var(--accent)] mb-4">
            <span className="h-px w-6 bg-[color-mix(in_srgb,var(--accent)_45%,transparent)]" />
            Ищем ревьюеров
            <span className="h-px w-6 bg-[color-mix(in_srgb,var(--accent)_45%,transparent)]" />
          </p>
          <h1 className="font-[var(--font-display)] font-extrabold text-3xl sm:text-5xl leading-[1.08] tracking-tight max-w-2xl mx-auto mb-4">Помогите авторам выпускать качественные статьи</h1>
          <p className="text-[15px] text-[var(--muted-foreground)] leading-relaxed max-w-xl mx-auto mb-7">Каждая статья проходит ревью перед публикацией. Мы ищем специалистов по направлениям ниже — выберите своё и подключайтесь.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button onClick={() => setApply({})} className="inline-flex items-center gap-2 rounded-lg text-[13.5px] px-5 py-2.5 font-semibold whitespace-nowrap bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-colors">
              <RbIcon d={<><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></>} w={15} sw={2} />Стать ревьюером
            </button>
            <button onClick={() => setHow(true)} className="inline-flex items-center gap-2 rounded-lg text-[13.5px] px-5 py-2.5 font-medium whitespace-nowrap bg-[var(--bg-elevated)] text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--foreground)]/30 transition-colors">
              <RbIcon d={<><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></>} w={15} />Как это работает
            </button>
          </div>
          <div className="flex items-center justify-center gap-8 sm:gap-12 mt-10">
            {[[calls.length, "открытых направлений"], [totalWaiting, "глав ждут ревью"], ["1–5", "звёзд — оценка авторов"]].map(([n, l], i) => (
              <div key={i} className="text-center">
                <p className="font-[var(--font-display)] font-extrabold text-2xl sm:text-[26px] tabular-nums leading-none text-[var(--accent)]">{n}</p>
                <p className="text-[11.5px] text-[var(--muted-foreground)] mt-1.5 max-w-[110px]">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Calls */}
      <div className="px-4 sm:px-8 py-9 max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between gap-3 mb-4">
          <h2 className="font-[var(--font-display)] font-bold text-xl tracking-tight">Открытые направления</h2>
          <span className="text-[12px] text-[var(--muted-foreground)] shrink-0">Список ведёт редакция</span>
        </div>
        {allSkills.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-5">
            <BoardSkill label="Все" active={!filter} onClick={() => setFilter(null)} />
            {allSkills.map(s => <BoardSkill key={s} label={s} active={filter === s} onClick={() => setFilter(filter === s ? null : s)} />)}
          </div>
        )}
        {shown.length === 0 ? (
          <p className="text-[14px] text-[var(--muted-foreground)] py-12 text-center border border-dashed border-[var(--border)] rounded-lg">{calls.length === 0 ? "Открытых направлений сейчас нет." : "Нет направлений по этому навыку."}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shown.map(c => <BoardCallCard key={c.id} c={c} onRespond={(area) => setApply({ area })} />)}
          </div>
        )}
      </div>

      {apply && <ApplyModal session={session} area={apply.area} onClose={() => setApply(null)} />}
      {how && <HowItWorksModal onClose={() => setHow(false)} />}
    </div>
  );
}

window.ReviewerBoardScreen = ReviewerBoardScreen;
