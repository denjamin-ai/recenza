// donation.jsx — donation + promo-banner UI (Phase 3). Reads window.__banners
// and window.__donations. Exposes:
//   window.FeedBannerCarousel  — carousel for the feed (renders nothing if no
//                                visible banners), opens the donate modal
//   window.DonateModal         — adaptive donation modal (link + QR methods)
//   window.AdminBanners        — admin: carousel banner manager
//   window.AdminDonation       — admin: donation method manager
const { useState, useEffect } = React;

// ── shared svg atoms ───────────────────────────────────────────────────
function DnIcon({ name, w = 16, fill = "none", sw = 1.8 }) {
  const P = {
    heart: <path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21z" />,
    pen: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" /><path d="M16 5.5a3.2 3.2 0 0 1 0 6M21 20c0-2.4-1.4-4.2-3.5-4.8" /></>,
    ext: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" /></>,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.2 4M6.6 6.6A18 18 0 0 0 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.2-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    link: <><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    drag: <><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></>,
    check: <path d="M5 12.5l4.5 4.5L19 6.5" />,
    scan: <><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" /><path d="M4 12h16" /></>,
    trash: <><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /></>,
    chevL: <path d="M15 6l-6 6 6 6" />,
    chevR: <path d="M9 6l6 6-6 6" />,
  };
  return <svg viewBox="0 0 24 24" width={w} height={w} fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{P[name]}</svg>;
}

function DnToggle({ on, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="inline-flex items-center shrink-0 rounded-full transition-colors" style={{ width: 38, height: 22, padding: 2, background: on ? "var(--accent)" : "var(--border)" }}>
      <span className="rounded-full bg-white transition-transform" style={{ width: 18, height: 18, transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

// Coarse QR placeholder (admin uploads the real image in production).
function DnQR({ size = 132 }) {
  const N = 11, cell = size / N;
  const on = (r, c) => {
    const corner = (r < 3 && c < 3) || (r < 3 && c > N - 4) || (r > N - 4 && c < 3);
    if (corner) return r === 0 || r === 2 || c === 0 || c === 2 || (r === 1 && c === 1) || r === N - 1 || c === N - 1;
    return (r * 7 + c * 13 + r * c) % 3 === 0;
  };
  return (
    <div className="rounded-xl bg-white p-3 inline-block border border-[var(--border)]">
      <div style={{ width: size, height: size, display: "grid", gridTemplateColumns: `repeat(${N}, 1fr)` }}>
        {Array.from({ length: N * N }, (_, i) => {
          const r = Math.floor(i / N), c = i % N;
          return <span key={i} style={{ width: cell, height: cell, background: on(r, c) ? "#111" : "transparent" }} />;
        })}
      </div>
    </div>
  );
}

function useStoreTick(store) {
  const [, set] = useState(0);
  useEffect(() => store?.subscribe(() => set(n => n + 1)), [store]);
}

// ════════════════════════════════════════════════════════════════════
// FEED BANNER CAROUSEL
// ════════════════════════════════════════════════════════════════════
function BannerSlide({ b, onCta }) {
  const gold = b.tone === "gold";
  const ink = gold ? "#9a6f08" : "var(--accent)";
  const wash = gold
    ? "linear-gradient(100deg, color-mix(in srgb,#d4a017 18%,var(--bg-elevated)) 0%, var(--bg-elevated) 54%)"
    : "linear-gradient(100deg, color-mix(in srgb,var(--accent) 16%,var(--bg-elevated)) 0%, var(--bg-elevated) 54%)";
  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden flex" style={{ border: `1px solid color-mix(in srgb,${ink} 26%,var(--border))` }}>
      <div className="relative w-[32%] shrink-0 overflow-hidden hidden sm:block" style={{ background: `repeating-linear-gradient(135deg, color-mix(in srgb,${ink} 18%,var(--bg-secondary)) 0 13px, color-mix(in srgb,${ink} 8%,var(--bg-secondary)) 13px 26px)` }}>
        <span className="absolute inset-0 flex items-center justify-center" style={{ color: ink, opacity: 0.38 }}><DnIcon name={b.icon} w={42} fill={gold ? "currentColor" : "none"} sw={gold ? 0 : 1.4} /></span>
      </div>
      <div className="flex-1 min-w-0 flex items-center" style={{ background: wash }}>
        <div className="px-5 sm:px-6 py-5 w-full">
          <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold mb-1.5" style={{ color: ink }}>{b.eyebrow}</p>
          <h3 className="font-[var(--font-display)] font-extrabold text-[18px] sm:text-[21px] leading-[1.12] tracking-tight mb-3.5 max-w-md">{b.title}</h3>
          <button onClick={onCta} className="inline-flex items-center gap-2 rounded-full text-[13px] pl-3.5 pr-4 py-2 font-semibold text-white" style={{ background: ink }}>
            <span className="inline-flex items-center justify-center rounded-full" style={{ width: 22, height: 22, background: "rgba(255,255,255,0.22)" }}><DnIcon name={b.icon} w={13} fill={gold ? "currentColor" : "none"} sw={gold ? 0 : 2} /></span>
            {b.cta}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedBannerCarousel({ onNavigate }) {
  useStoreTick(window.__banners);
  const [i, setI] = useState(0);
  const [modal, setModal] = useState(false);
  const items = (window.__banners?.visibleItems() || []).filter(b => b.action !== "donate" || window.__donations?.isEnabled());
  const n = items.length;
  useEffect(() => { if (i >= n && n > 0) setI(0); }, [n]);
  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => setI(p => (p + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n]);
  if (n === 0) return null;
  const fire = (b) => {
    if (b.action === "donate") setModal(true);
    else if (b.action === "external") window.open(b.target, "_blank", "noopener");
    else onNavigate?.(b.target || "board");
  };
  return (
    <div className="relative mb-8" data-screen-label="FeedBanners">
      <div className="relative" style={{ height: 144 }}>
        {items.map((b, idx) => (
          <div key={b.id} className="absolute inset-0 transition-opacity duration-500" style={{ opacity: i === idx ? 1 : 0, pointerEvents: i === idx ? "auto" : "none" }}>
            <BannerSlide b={b} onCta={() => fire(b)} />
          </div>
        ))}
        {n > 1 && <>
          <button onClick={() => setI(p => (p - 1 + n) % n)} aria-label="Назад" className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[var(--bg-elevated)]/85 border border-[var(--border)] inline-flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><DnIcon name="chevL" w={15} /></button>
          <button onClick={() => setI(p => (p + 1) % n)} aria-label="Вперёд" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[var(--bg-elevated)]/85 border border-[var(--border)] inline-flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><DnIcon name="chevR" w={15} /></button>
        </>}
      </div>
      {n > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          {items.map((_, idx) => (
            <button key={idx} onClick={() => setI(idx)} aria-label={`Слайд ${idx + 1}`} className="rounded-full transition-all" style={{ width: i === idx ? 22 : 7, height: 7, background: i === idx ? "var(--accent)" : "var(--border)" }} />
          ))}
        </div>
      )}
      {modal && <DonateModal onClose={() => setModal(false)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// DONATE MODAL — adaptive to method count (see concepts).
// ════════════════════════════════════════════════════════════════════
function DonateModal({ onClose }) {
  useStoreTick(window.__donations);
  const [qrIdx, setQrIdx] = useState(0);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const methods = window.__donations?.visibleMethods() || [];
  const links = methods.filter(m => m.type === "link");
  const qrs = methods.filter(m => m.type === "qr");
  const qr = qrs[Math.min(qrIdx, qrs.length - 1)];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "color-mix(in srgb, var(--foreground) 38%, transparent)" }} onClick={onClose} role="dialog" aria-modal="true">
      <div onClick={e => e.stopPropagation()} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden w-full max-w-[420px]" style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.22)" }}>
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-full inline-flex items-center justify-center" style={{ background: "color-mix(in srgb,#d4a017 16%,transparent)", color: "#9a6f08" }}><DnIcon name="heart" w={20} fill="currentColor" sw={0} /></span>
            <div>
              <h2 className="font-[var(--font-display)] font-bold text-[19px] tracking-tight leading-tight">Поддержать Recenza</h2>
              <p className="text-[11.5px] text-[var(--muted-foreground)]">Пожертвования идут на оплату ревьюеров</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Закрыть" className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--muted)] shrink-0"><DnIcon name="x" w={15} /></button>
        </div>
        <div className="px-6 py-5">
          {methods.length === 0 && <p className="text-[13px] text-[var(--muted-foreground)] text-center py-4">Способы пожертвования пока не настроены.</p>}
          {links.length > 0 && (
            <div className="flex flex-col gap-2 mb-1">
              {links.map(m => (
                <a key={m.id} href={m.url || "#"} target="_blank" rel="noopener noreferrer" className={`w-full inline-flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${m.primary ? "text-white" : "border border-[var(--border)] hover:bg-[var(--bg-secondary)]"}`} style={m.primary ? { background: "#b8860b" } : {}}>
                  <span className={`inline-flex items-center justify-center rounded-lg shrink-0 ${m.primary ? "" : "text-[#9a6f08]"}`} style={{ width: 32, height: 32, background: m.primary ? "rgba(255,255,255,0.18)" : "color-mix(in srgb,#d4a017 14%,transparent)" }}><DnIcon name="heart" w={16} fill="currentColor" sw={0} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold leading-tight">{m.name}</span>
                    {m.hint && <span className={`block text-[11.5px] leading-tight ${m.primary ? "text-white/80" : "text-[var(--muted-foreground)]"}`}>{m.hint}</span>}
                  </span>
                  <DnIcon name="ext" w={15} />
                </a>
              ))}
            </div>
          )}
          {qrs.length > 0 && (
            <div className={links.length > 0 ? "mt-5" : ""}>
              {links.length > 0 && (
                <div className="flex items-center gap-3 mb-3.5">
                  <span className="h-px flex-1 bg-[var(--border)]" />
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">или по QR-коду</span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </div>
              )}
              {qrs.length > 1 && (
                <div className="inline-flex items-center gap-1 bg-[var(--muted)] rounded-lg p-1 mb-3.5 w-full">
                  {qrs.map((m, idx) => (
                    <button key={m.id} onClick={() => setQrIdx(idx)} className={`flex-1 text-[12.5px] px-3 py-1.5 rounded-md font-medium transition-colors ${qrIdx === idx ? "bg-[var(--bg-elevated)] text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>{m.name}</button>
                  ))}
                </div>
              )}
              {links.length === 0 && qrs.length === 1 ? (
                <div className="flex flex-col items-center text-center pt-1">
                  <DnQR size={150} />
                  <p className="text-[15px] font-semibold mt-3">{qr.name}</p>
                  {qr.hint && <p className="text-[12.5px] text-[var(--muted-foreground)] leading-relaxed inline-flex items-center gap-1.5 mt-1"><DnIcon name="scan" w={14} /><span>{qr.hint}</span></p>}
                </div>
              ) : (
                <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                  <DnQR size={108} />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold mb-1">{qr.name}</p>
                    {qr.hint && <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed inline-flex items-start gap-1.5"><DnIcon name="scan" w={14} /><span>{qr.hint}</span></p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ADMIN — CAROUSEL BANNERS
// ════════════════════════════════════════════════════════════════════
const ACTION_LABEL = { internal: "В приложении", external: "Внешняя ссылка", donate: "Открыть окно пожертвования" };
function AdminBanners() {
  useStoreTick(window.__banners);
  const items = window.__banners?.get().items || [];
  const set = (id, patch) => window.__banners.update(id, patch);
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" data-screen-label="AdminBanners">
      <p className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Платформа · Лента</p>
      <h1 className="font-[var(--font-display)] font-bold text-2xl tracking-tight mb-1.5">Баннеры карусели</h1>
      <p className="text-[13px] text-[var(--muted-foreground)] max-w-lg leading-relaxed mb-6">Промо-слайды в карусели Ленты. Видимость и действие по клику. Скрытые не показываются читателям.</p>
      <div className="flex flex-col gap-3">
        {items.map(b => (
          <div key={b.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 flex gap-4" style={{ opacity: b.visible ? 1 : 0.6 }}>
            <span className="shrink-0 self-center text-[var(--border)] cursor-grab" title="Перетащить"><DnIcon name="drag" w={18} /></span>
            <div className="w-[110px] shrink-0 rounded-lg overflow-hidden relative hidden sm:block" style={{ height: 74, background: `repeating-linear-gradient(135deg, color-mix(in srgb,${b.tone === "gold" ? "#d4a017" : "var(--accent)"} 16%,var(--bg-secondary)) 0 11px, var(--bg-secondary) 11px 22px)` }}>
              <span className="absolute inset-0 flex items-center justify-center" style={{ color: b.tone === "gold" ? "#9a6f08" : "var(--accent)", opacity: 0.5 }}><DnIcon name={b.icon} w={26} fill={b.tone === "gold" ? "currentColor" : "none"} sw={b.tone === "gold" ? 0 : 1.5} /></span>
            </div>
            <div className="min-w-0 flex-1">
              <input value={b.title} onChange={e => set(b.id, { title: e.target.value })} className="font-[var(--font-display)] font-bold text-[15px] bg-transparent focus:outline-none focus:bg-[var(--bg-secondary)] rounded px-1 -ml-1 w-full mb-2" />
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Действие</span>
                <div className="inline-flex items-center gap-0.5 bg-[var(--muted)] rounded-md p-0.5">
                  {Object.keys(ACTION_LABEL).map(a => (
                    <button key={a} onClick={() => set(b.id, { action: a })} className={`text-[11px] px-2 py-1 rounded font-medium transition-colors ${b.action === a ? "bg-[var(--bg-elevated)] text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>{ACTION_LABEL[a]}</button>
                  ))}
                </div>
              </div>
              {b.action !== "donate" && (
                <div className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 py-1.5">
                  <span className="text-[var(--muted-foreground)]"><DnIcon name={b.action === "external" ? "ext" : "link"} w={13} /></span>
                  <input value={b.target} onChange={e => set(b.id, { target: e.target.value })} placeholder={b.action === "external" ? "https://…" : "board / blog / …"} className="flex-1 min-w-0 bg-transparent text-[12px] font-[var(--font-mono)] focus:outline-none" />
                </div>
              )}
              <div className="flex items-center justify-between mt-3">
                <label className="inline-flex items-center gap-2 text-[12px] text-[var(--muted-foreground)] cursor-pointer">
                  <DnToggle on={b.visible} onChange={v => set(b.id, { visible: v })} />
                  <span className="inline-flex items-center gap-1">{b.visible ? <><DnIcon name="eye" w={13} />Показан</> : <><DnIcon name="eyeOff" w={13} />Скрыт</>}</span>
                </label>
                <button onClick={() => window.__banners.remove(b.id)} className="text-[var(--muted-foreground)] hover:text-[var(--danger)] p-1" title="Удалить баннер"><DnIcon name="trash" w={15} /></button>
              </div>
            </div>
          </div>
        ))}
        <button onClick={() => window.__banners.add()} className="rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-[var(--muted-foreground)] py-3 text-[13px] font-medium inline-flex items-center justify-center gap-2 transition-colors"><DnIcon name="plus" w={16} />Добавить слайд</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ADMIN — DONATION METHODS
// ════════════════════════════════════════════════════════════════════
function AdminDonation() {
  useStoreTick(window.__donations);
  const st = window.__donations?.get() || { enabled: false, methods: [] };
  const set = (id, patch) => window.__donations.update(id, patch);
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" data-screen-label="AdminDonation">
      <p className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Платформа · Пожертвования</p>
      <h1 className="font-[var(--font-display)] font-bold text-2xl tracking-tight mb-1.5">Способы пожертвования</h1>
      <p className="text-[13px] text-[var(--muted-foreground)] max-w-lg leading-relaxed mb-6">Независимо от баннеров. Каждый способ — ссылка (кнопка, как DonationAlerts) или QR-код (Ozon / СБП). Показываются в окне «Поддержать Recenza».</p>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[13.5px] font-semibold mb-0.5">Приём пожертвований</p>
            <p className="text-[12px] text-[var(--muted-foreground)]">Когда выключено — кнопка и окно скрыты везде.</p>
          </div>
          <DnToggle on={st.enabled} onChange={v => window.__donations.setEnabled(v)} />
        </div>
        {st.methods.map(m => (
          <div key={m.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 flex gap-4" style={{ opacity: st.enabled ? 1 : 0.55 }}>
            <span className="shrink-0 self-center text-[var(--border)] cursor-grab"><DnIcon name="drag" w={18} /></span>
            {m.type === "qr" ? (
              m.qrUploaded
                ? <div className="shrink-0 hidden sm:block"><DnQR size={68} /></div>
                : <button onClick={() => set(m.id, { qrUploaded: true })} className="shrink-0 w-[74px] h-[74px] rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-[var(--muted-foreground)] hidden sm:inline-flex flex-col items-center justify-center gap-1 transition-colors"><DnIcon name="upload" w={16} /><span className="text-[10px]">QR</span></button>
            ) : (
              <div className="shrink-0 w-[74px] h-[74px] rounded-lg hidden sm:inline-flex items-center justify-center" style={{ background: "color-mix(in srgb,#d4a017 14%,transparent)", color: "#9a6f08" }}><DnIcon name="heart" w={26} fill="currentColor" sw={0} /></div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <input value={m.name} onChange={e => set(m.id, { name: e.target.value })} className="font-[var(--font-display)] font-bold text-[15px] bg-transparent focus:outline-none focus:bg-[var(--bg-secondary)] rounded px-1 -ml-1 min-w-0 flex-1" />
                <div className="inline-flex items-center gap-0.5 bg-[var(--muted)] rounded-md p-0.5 shrink-0">
                  {[["link", "Ссылка"], ["qr", "QR"]].map(([t, l]) => (
                    <button key={t} onClick={() => set(m.id, { type: t })} className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded font-medium transition-colors ${m.type === t ? "bg-[var(--bg-elevated)] text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}><DnIcon name={t === "qr" ? "grid" : "link"} w={11} />{l}</button>
                  ))}
                </div>
              </div>
              {m.type === "link" ? (
                <div className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 py-1.5">
                  <span className="text-[var(--muted-foreground)]"><DnIcon name="ext" w={13} /></span>
                  <input value={m.url || ""} onChange={e => set(m.id, { url: e.target.value })} placeholder="https://…" className="flex-1 min-w-0 bg-transparent text-[12px] font-[var(--font-mono)] focus:outline-none" />
                </div>
              ) : (
                <p className="text-[11.5px] text-[var(--muted-foreground)] inline-flex items-center gap-1.5">{m.qrUploaded ? <><DnIcon name="check" w={13} sw={2.4} />Изображение QR загружено · <button onClick={() => set(m.id, { qrUploaded: false })} className="text-[var(--accent)] hover:underline">убрать</button></> : <>Загрузите картинку QR-кода</>}</p>
              )}
              <input value={m.hint || ""} onChange={e => set(m.id, { hint: e.target.value })} placeholder="Подпись для пользователя…" className="w-full mt-2 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-[var(--accent)]" />
              <div className="flex items-center justify-between mt-3">
                <label className="inline-flex items-center gap-2 text-[12px] text-[var(--muted-foreground)] cursor-pointer">
                  <DnToggle on={m.visible} onChange={v => set(m.id, { visible: v })} />
                  <span className="inline-flex items-center gap-1">{m.visible ? <><DnIcon name="eye" w={13} />Показан</> : <><DnIcon name="eyeOff" w={13} />Скрыт</>}</span>
                </label>
                <button onClick={() => window.__donations.remove(m.id)} className="text-[var(--muted-foreground)] hover:text-[var(--danger)] p-1" title="Удалить способ"><DnIcon name="trash" w={15} /></button>
              </div>
            </div>
          </div>
        ))}
        <button onClick={() => window.__donations.add()} className="rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-[var(--muted-foreground)] py-3 text-[13px] font-medium inline-flex items-center justify-center gap-2 transition-colors"><DnIcon name="plus" w={16} />Добавить способ</button>
      </div>
    </div>
  );
}

Object.assign(window, { FeedBannerCarousel, DonateModal, AdminBanners, AdminDonation });
