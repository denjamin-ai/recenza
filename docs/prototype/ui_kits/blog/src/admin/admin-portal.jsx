// Admin Portal — separate environment for moderators/admins.
// Three sections: Dashboard / Users / Reports, plus drill-in screens for
// users and reports. Renders inside its own full-screen shell with a
// persistent left sidebar (the only place in the kit that uses one —
// this is an "ops" surface, not editorial).
//
// Globals exposed: AdminPortal (single entry; takes session + onBack).
// State that mutates (user roles, blocks, deleted comments, resolved
// reports, audit log) lives inside the portal and does NOT round-trip
// to FAKE_DATA — refreshing the page resets it. That's intentional;
// it keeps the kit deterministic for screenshots.

const { useState, useEffect, useMemo } = React;
// ──────────────────────────────────────────────────────────────────────────
// Tiny shared bits
// ──────────────────────────────────────────────────────────────────────────

const ROLE_LABELS = {
  reader:   "Читатель",
  author:   "Автор",
  reviewer: "Ревьюер",
  admin:    "Администратор",
};

const ROLE_TONE = {
  reader:   "bg-slate-500/12 text-slate-700 dark:text-slate-300",
  author:   "bg-[var(--accent)]/14 text-[var(--accent)]",
  reviewer: "bg-violet-500/14 text-violet-700 dark:text-violet-300",
  admin:    "bg-amber-500/16 text-amber-800 dark:text-amber-300",
};

const STATUS_TONE = {
  active:      { dot: "bg-emerald-500",        label: "активен"      },
  blocked:     { dot: "bg-rose-500",           label: "заблокирован" },
  deactivated: { dot: "bg-slate-400",          label: "деактивирован" },
  pending:     { dot: "bg-amber-500",          label: "ожидает"      },
  resolved:    { dot: "bg-emerald-500",        label: "решено"       },
  dismissed:   { dot: "bg-slate-400",          label: "отклонено"    },
};

function RolePill({ role }) {
  return (
    <span className={`text-[10.5px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded shrink-0 ${ROLE_TONE[role] || ROLE_TONE.reader}`}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

function StatusDot({ status }) {
  const s = STATUS_TONE[status] || STATUS_TONE.active;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)]">
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>{s.label}
    </span>
  );
}

const fmtDate = (ts) => new Date(ts * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
const fmtShortDate = (ts) => new Date(ts * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
const relTime = (ts) => {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} дн назад`;
  return fmtShortDate(ts);
};

// ──────────────────────────────────────────────────────────────────────────
// Sparkline — simple inline SVG, no library
// ──────────────────────────────────────────────────────────────────────────
function Sparkline({ values, color = "var(--accent)", height = 36 }) {
  const w = 140;
  const h = height;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  const areaPts = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block" aria-hidden>
      <polygon points={areaPts} fill={color} fillOpacity="0.10" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AdminPortal — root component. Owns mutable state for the entire admin
// surface so the three tabs see the same edits.
// ──────────────────────────────────────────────────────────────────────────
function AdminPortal({ session, onBack, onOpenProfile }) {
  const [tab, setTab]               = useState("dashboard");          // dashboard | users | reports
  const [openUserHandle, setOpenUH] = useState(null);                 // drill-in user
  const [openReportId, setOpenRId]  = useState(null);                 // drill-in report

  // Mutable copies — admin actions edit these locally.
  const [users, setUsers]     = useState(() => ({ ...window.FAKE_DATA.users }));
  // Reports come from the shared __reports store (public side files into it).
  const [reports, setReports] = useState(() => [...(window.__reports?.get().items || [])]);
  useEffect(() => window.__reports?.subscribe(s => setReports([...s.items])), []);
  const [, forceFlow] = useState(0);
  useEffect(() => window.__reviewerFlow?.subscribe(() => forceFlow(n => n + 1)), []);
  const [log, setLog]         = useState(() => [...(window.FAKE_DATA.auditLog || [])]);
  // Articles: only track unpublished slugs to avoid copying the full list.
  const [unpublished, setUnpublished] = useState(() => new Set());

  const pushLog = (action, target, note) => {
    setLog(prev => [{
      id: `log-${Date.now()}`,
      at: Math.floor(Date.now() / 1000),
      actor: session?.handle || "moderator",
      action, target, note,
    }, ...prev]);
  };

  // ────────────── User actions
  const setUserRole = (handle, role) => {
    const prev = users[handle]?.role;
    setUsers(u => ({ ...u, [handle]: { ...u[handle], role } }));
    pushLog("user.role.change", `@${handle}`, `${ROLE_LABELS[prev] || prev} → ${ROLE_LABELS[role] || role}`);
  };
  const blockUser = (handle, reason) => {
    setUsers(u => ({ ...u, [handle]: { ...u[handle], status: "blocked", blockedAt: Math.floor(Date.now() / 1000), blockedReason: reason || "Без указания причины" } }));
    pushLog("user.block", `@${handle}`, reason || "Без указания причины");
  };
  const unblockUser = (handle) => {
    setUsers(u => ({ ...u, [handle]: { ...u[handle], status: "active", blockedAt: undefined, blockedReason: undefined } }));
    pushLog("user.unblock", `@${handle}`, "Разблокирован вручную");
  };

  // ────────────── Report actions
  const resolveReport = (id, action) => {
    // action ∈ "delete" | "block" | "block+delete" | "dismiss"
    // For blog reports "delete" means "unpublish the blog".
    const r = reports.find(x => x.id === id);
    if (!r) return;
    const stamp = { resolvedAt: Math.floor(Date.now() / 1000), resolvedBy: session?.handle || "moderator" };
    const isBlog = r.kind === "blog";
    if (action === "dismiss") {
      window.__reports?.resolve(id, { status: "dismissed", resolution: "Отклонено модератором", ...stamp });
      pushLog("report.dismiss", id, `@${r.targetAuthorHandle} · ${r.reasonText}`);
      return;
    }
    const removeLabel = isBlog ? "Блог снят с публикации" : "Комментарий удалён";
    const resolution = action === "block+delete"
      ? `${removeLabel} + автор заблокирован`
      : action === "block" ? "Автор заблокирован" : removeLabel;
    window.__reports?.resolve(id, { status: "resolved", resolution, ...stamp });
    if (action === "delete" || action === "block+delete") {
      if (isBlog) {
        setUnpublished(s => new Set([...s, r.targetArticleSlug]));
        pushLog("article.unpublish", r.targetArticleSlug, r.reasonText);
      } else {
        pushLog("comment.delete", `@${r.targetAuthorHandle} → ${r.targetArticleSlug}`, r.reasonText);
      }
    }
    if (action === "block"  || action === "block+delete") {
      setUsers(u => ({ ...u, [r.targetAuthorHandle]: { ...u[r.targetAuthorHandle], status: "blocked", blockedAt: Math.floor(Date.now() / 1000), blockedReason: r.reasonText } }));
      pushLog("user.block", `@${r.targetAuthorHandle}`, r.reasonText);
    }
  };

  // ────────────── Article actions
  const unpublishArticle = (slug, reason) => {
    setUnpublished(s => new Set([...s, slug]));
    pushLog("article.unpublish", slug, reason || "Снято модератором");
  };
  const republishArticle = (slug) => {
    setUnpublished(s => { const n = new Set(s); n.delete(slug); return n; });
    pushLog("article.republish", slug, "Возвращено в публикацию");
  };

  // ────────────── Render
  const openUser = (h) => setOpenUH(h);
  const openReport = (id) => setOpenRId(id);

  return (
    <div className="fixed inset-0 z-30 bg-[var(--background)] flex flex-col md:flex-row" data-screen-label="AdminPortal">
      {/* Sidebar */}
      <AdminSidebar tab={tab} onTab={(t) => { setTab(t); setOpenUH(null); setOpenRId(null); }} onBack={onBack}
        counts={{
          users: Object.keys(users).length,
          reports: reports.filter(r => r.status === "pending").length,
          review: (window.__reviewStore?.get().pcRequests || []).filter(r => r.status === "pending").length,
          recruit: (window.__reviewerFlow?.recruitRequests || []).filter(r => r.status === "pending").length,
        }}
      />

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <AdminTopbar
          crumb="Платформа"
          title={{ dashboard: "Сводка", review: "Ревью глав", recruit: "Заявки ревьюеров", users: "Пользователи", reports: "Жалобы", banners: "Баннеры", donation: "Пожертвования" }[tab] || "Админ"}
        />
        <div className="flex-1 min-w-0 overflow-y-auto">
        {tab === "review" && (
          <div data-screen-label="AdminReview">
          <AdminReview session={session} pushLog={pushLog}
            onOpenReview={(slug) => {
              // Bridge back to the blog shell — close the admin portal and open ReviewPage.
              window.dispatchEvent(new CustomEvent("blog:open-review", { detail: { slug } }));
            }}
          />
          </div>
        )}
        {tab === "recruit" && (
          <div data-screen-label="AdminRecruit"><AdminRecruit pushLog={pushLog} /></div>
        )}
        {tab === "banners" && window.AdminBanners && (
          <div data-screen-label="AdminBannersTab"><AdminBanners /></div>
        )}
        {tab === "donation" && window.AdminDonation && (
          <div data-screen-label="AdminDonationTab"><AdminDonation /></div>
        )}
        {tab === "dashboard" && (
          <div data-screen-label="AdminDashboard">
          <AdminDashboard
            users={users} reports={reports} log={log} unpublished={unpublished}
            onOpenUser={openUser} onOpenReport={openReport}
            onGoTab={(t) => setTab(t)}
            onGoUsers={() => setTab("users")} onGoReports={() => setTab("reports")}
          />
          </div>
        )}
        {tab === "users" && !openUserHandle && (
          <div data-screen-label="AdminUsers"><AdminUsers users={users} onOpen={openUser} /></div>
        )}
        {tab === "users" && openUserHandle && (
          <div data-screen-label="AdminUserDetail">
          <AdminUserDetail
            user={users[openUserHandle]} log={log} reports={reports} unpublished={unpublished}
            onBack={() => setOpenUH(null)} onSetRole={setUserRole} onBlock={blockUser} onUnblock={unblockUser}
            onUnpublishArticle={unpublishArticle} onRepublishArticle={republishArticle}
            onOpenProfile={onOpenProfile}
          />
          </div>
        )}
        {tab === "reports" && !openReportId && (
          <div data-screen-label="AdminReports"><AdminReports reports={reports} users={users} onOpen={openReport} /></div>
        )}
        {tab === "reports" && openReportId && (
          <div data-screen-label="AdminReportDetail">
          <AdminReportDetail
            report={reports.find(r => r.id === openReportId)} users={users}
            onBack={() => setOpenRId(null)} onResolve={resolveReport}
          />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Admin line-icon set (replaces arbitrary unicode glyphs) + shared chrome
// ──────────────────────────────────────────────────────────────────────────
function AdmIcon({ d, w = 16, sw = 1.7, fill = "none" }) {
  return <svg viewBox="0 0 24 24" width={w} height={w} fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;
}
const ADM_I = {
  gauge:    <><path d="M12 13a3 3 0 1 0 3 3" /><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 13l5-5" /></>,
  edit:     <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  userPlus: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5 6-5 1.2 0 2.3.2 3.2.7" /><path d="M19 14v6M16 17h6" /></>,
  users:    <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" /><path d="M16 5.5a3.2 3.2 0 0 1 0 6M21 20c0-2.4-1.4-4.2-3.5-4.8" /></>,
  flag:     <><path d="M4 21V4M4 4h13l-2.5 4L17 12H4" /></>,
  image:    <><rect x="3" y="4" width="18" height="14" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 15l-5-5L5 18" /></>,
  heart:    <path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21z" />,
  search:   <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></>,
  bell:     <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  chevR:    <path d="M9 6l6 6-6 6" />,
};

// Sidebar nav grouped by domain, with a brand header (no longer collides with
// the site logo — the site nav is hidden while the admin portal is open).
const ADMIN_NAV_GROUPS = [
  { label: null, items: [{ id: "dashboard", label: "Сводка", icon: "gauge" }] },
  { label: "Модерация", items: [
    { id: "reports", label: "Жалобы", icon: "flag", countKey: "reports" },
    { id: "review", label: "Ревью глав", icon: "edit", countKey: "review" },
    { id: "recruit", label: "Заявки ревьюеров", icon: "userPlus", countKey: "recruit" },
  ] },
  { label: "Люди", items: [{ id: "users", label: "Пользователи", icon: "users", countKey: "users" }] },
  { label: "Платформа", items: [
    { id: "banners", label: "Баннеры", icon: "image" },
    { id: "donation", label: "Пожертвования", icon: "heart" },
  ] },
];

function AdminSidebar({ tab, onTab, onBack, counts }) {
  return (
    <aside className="w-full md:w-[212px] shrink-0 border-b md:border-b-0 md:border-r border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col">
      <div className="px-4 h-[52px] flex items-center justify-between gap-2 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-[var(--font-display)] font-extrabold text-[16px] tracking-tight">Recenza</span>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] rounded px-1.5 py-0.5">admin</span>
        </div>
        <button onClick={onBack} className="md:hidden inline-flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><Icon.ArrowLeft /></button>
      </div>
      <nav className="flex md:flex-col md:flex-1 gap-0 md:gap-0 px-2 md:px-2.5 py-2 md:py-3 overflow-x-auto md:overflow-y-auto">
        {ADMIN_NAV_GROUPS.map((grp, gi) => (
          <div key={gi} className={`flex md:flex-col gap-0.5 ${gi ? "md:mt-4" : ""}`}>
            {grp.label && <p className="hidden md:block px-2.5 mb-1.5 text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--muted-foreground)]">{grp.label}</p>}
            {grp.items.map(it => {
              const count = it.countKey ? counts[it.countKey] : undefined;
              const alert = (it.countKey === "reports" || it.countKey === "review" || it.countKey === "recruit") && count > 0;
              const on = tab === it.id;
              return (
                <button
                  key={it.id}
                  onClick={() => onTab(it.id)}
                  className={`shrink-0 md:w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors text-left whitespace-nowrap border ${
                    on ? "bg-[var(--bg-elevated)] border-[var(--border)] font-medium text-[var(--foreground)]" : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)]/60"
                  }`}
                >
                  <span className={on ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}><AdmIcon d={ADM_I[it.icon]} w={16} /></span>
                  <span className="md:flex-1">{it.label}</span>
                  {typeof count === "number" && (
                    <span className={`tabular-nums text-[10.5px] rounded-full px-1.5 leading-5 ${alert ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold" : "text-[var(--muted-foreground)] bg-[var(--muted)]"}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="hidden md:block px-2.5 pb-3 border-t border-[var(--border)] pt-3">
        <button onClick={onBack} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)]/60 transition-colors">
          <Icon.ArrowLeft /> Выйти к блогу
        </button>
      </div>
    </aside>
  );
}

// Top bar inside the admin shell — owns the chrome (search + breadcrumb +
// notifications) now that the site nav is hidden.
function AdminTopbar({ title, crumb }) {
  return (
    <div className="h-[52px] shrink-0 border-b border-[var(--border)] flex items-center justify-between px-4 sm:px-6 bg-[var(--bg-elevated)]">
      <div className="flex items-center gap-2 text-[13px] min-w-0">
        {crumb && <><span className="text-[var(--muted-foreground)] hidden sm:inline shrink-0">{crumb}</span><span className="text-[var(--border)] hidden sm:inline shrink-0"><AdmIcon d={ADM_I.chevR} w={13} /></span></>}
        <span className="font-semibold whitespace-nowrap">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[var(--muted-foreground)] w-[200px]">
          <AdmIcon d={ADM_I.search} w={14} /><span className="text-[12.5px]">Поиск по платформе…</span>
        </div>
        <button className="relative w-9 h-9 rounded-lg border border-[var(--border)] inline-flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><AdmIcon d={ADM_I.bell} w={16} /></button>
      </div>
    </div>
  );
}

// Compact screen header — shared by every admin tab (replaces the oversized
// serif H1 + low-contrast eyebrow).
function AdminScreenHead({ eyebrow, title, sub }) {
  return (
    <div className="mb-5">
      {eyebrow && <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-[var(--accent)] mb-1">{eyebrow}</p>}
      <h2 className="font-[var(--font-display)] font-bold text-[22px] tracking-tight leading-tight mb-1">{title}</h2>
      {sub && <p className="text-[12.5px] text-[var(--muted-foreground)] max-w-xl leading-relaxed">{sub}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Dashboard
// ──────────────────────────────────────────────────────────────────────────
function AdminRecruit({ pushLog }) {
  const [, setTick] = useState(0);
  useEffect(() => window.__reviewerFlow?.subscribe(() => setTick(t => t + 1)), []);
  const [rejectId, setRejectId] = useState(null);
  const [reason, setReason] = useState("");
  const users = window.FAKE_DATA.users || {};
  const reqs = window.__reviewerFlow?.recruitRequests || [];
  const pending = reqs.filter(r => r.status === "pending");
  const resolved = reqs.filter(r => r.status !== "pending");
  const approve = (r) => { window.__reviewerFlow.resolveRecruit(r.id, "approved"); pushLog && pushLog("Одобрил запрос ревьюеров", r.by, r.chapterTitle); };
  const doReject = (r) => { window.__reviewerFlow.resolveRecruit(r.id, "rejected", reason.trim() || "Навыки указаны слишком общо или не относятся к теме статьи."); setRejectId(null); setReason(""); pushLog && pushLog("Отклонил запрос ревьюеров", r.by, r.chapterTitle); };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <AdminScreenHead eyebrow="Модерация" title="Заявки ревьюеров" sub="Авторы просят найти ревьюеров, когда под их навыки нет совпадений. Одобрение публикует направление на доску «Ищем ревьюеров»; отклонение возвращает автору вердикт с причиной." />

      <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-2.5">На рассмотрении <span className="tabular-nums">· {pending.length}</span></h2>
      {pending.length === 0 ? (
        <p className="text-[13.5px] text-[var(--muted-foreground)] py-8 text-center border border-dashed border-[var(--border)] rounded-lg mb-8">Новых запросов нет.</p>
      ) : (
        <div className="flex flex-col gap-3 mb-8">
          {pending.map(r => {
            const author = users[r.by] || { name: r.by, handle: r.by };
            return (
              <div key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11.5px] text-[var(--muted-foreground)]">{r.blogTitle}</p>
                    <h3 className="font-[var(--font-display)] font-bold text-[16px] leading-snug">{r.chapterTitle || r.blogTitle}</h3>
                  </div>
                  <span className="text-[11.5px] text-[var(--muted-foreground)] shrink-0">от {author.name}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                  {(r.skills || []).map(s => <span key={s} className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--muted-foreground)] text-[11px] px-2 py-0.5">{s}</span>)}
                </div>
                {rejectId === r.id ? (
                  <div className="mt-3 pt-3 border-t border-[var(--border)]">
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Причина отказа — её увидит автор…" className="block w-full bg-[var(--background)] border border-[var(--border)] rounded px-2.5 py-2 text-[12.5px] focus:outline-none focus:border-[var(--accent)] resize-y mb-2" />
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => { setRejectId(null); setReason(""); }} className="text-[12px] px-3 py-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Отмена</button>
                      <button onClick={() => doReject(r)} className="text-[12px] px-3 py-1.5 rounded font-medium bg-[var(--danger)] text-white hover:opacity-90">Отклонить с причиной</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 justify-end mt-3 pt-3 border-t border-[var(--border)]">
                    <button onClick={() => setRejectId(r.id)} className="text-[12px] px-3 py-1.5 rounded font-medium bg-[var(--bg-elevated)] text-[var(--danger)] border border-[var(--danger-bg)] hover:bg-[var(--danger-bg)]">Отклонить</button>
                    <button onClick={() => approve(r)} className="text-[12px] px-3 py-1.5 rounded font-medium bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]">Одобрить · на доску</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <React.Fragment>
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-2.5">Обработанные</h2>
          <ul className="rounded-xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)] bg-[var(--bg-elevated)]">
            {resolved.map(r => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`text-[10.5px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${r.status === "approved" ? "text-[var(--success)] bg-[var(--success-bg)]" : "text-[var(--danger)] bg-[var(--danger-bg)]"}`}>{r.status === "approved" ? "Одобрен" : "Отклонён"}</span>
                <span className="text-[13px] truncate flex-1">{r.chapterTitle || r.blogTitle}</span>
                <span className="text-[11.5px] text-[var(--muted-foreground)] shrink-0">{(users[r.by] || {}).name || r.by}</span>
              </li>
            ))}
          </ul>
        </React.Fragment>
      )}

      {/* Reviewer applications (from the public board «Стать ревьюером») */}
      <RecruitApplications pushLog={pushLog} users={users} />
    </div>
  );
}

// Applications submitted from the public board. Admin accepts (→ onboard) or
// declines; author of the platform sees the queue drain.
function RecruitApplications({ pushLog, users }) {
  const [, setTick] = useState(0);
  useEffect(() => window.__reviewerFlow?.subscribe(() => setTick(t => t + 1)), []);
  const apps = window.__reviewerFlow?.applications || [];
  if (apps.length === 0) return null;
  const pending = apps.filter(a => a.status === "pending");
  const resolved = apps.filter(a => a.status !== "pending");
  const act = (a, status) => { window.__reviewerFlow.resolveApplication(a.id, status); pushLog && pushLog(status === "accepted" ? "Принял заявку в ревьюеры" : "Отклонил заявку в ревьюеры", a.by || "гость", a.area); };
  return (
    <div className="mt-10">
      <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-2.5">Заявки в ревьюеры <span className="tabular-nums">· {pending.length}</span></h2>
      {pending.length === 0 ? (
        <p className="text-[13px] text-[var(--muted-foreground)] py-6 text-center border border-dashed border-[var(--border)] rounded-lg mb-3">Новых заявок нет.</p>
      ) : (
        <div className="flex flex-col gap-3 mb-3">
          {pending.map(a => (
            <div key={a.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold">{a.name || (users[a.by] || {}).name || "Гость"} {a.by && <span className="text-[var(--muted-foreground)] font-normal">@{a.by}</span>}</p>
                  <p className="text-[11.5px] text-[var(--muted-foreground)] mt-0.5">Направление: {a.area}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                {(a.skills || []).map(s => <span key={s} className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--muted-foreground)] text-[11px] px-2 py-0.5">{s}</span>)}
              </div>
              {a.message && <p className="text-[12.5px] text-[var(--muted-foreground)] leading-relaxed mt-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] px-3 py-2">«{a.message}»</p>}
              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                <button onClick={() => act(a, "declined")} className="text-[12px] px-3 py-1.5 rounded font-medium bg-[var(--bg-elevated)] text-[var(--danger)] border border-[var(--danger-bg)] hover:bg-[var(--danger-bg)]">Отклонить</button>
                <button onClick={() => act(a, "accepted")} className="text-[12px] px-3 py-1.5 rounded font-medium bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]">Принять</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {resolved.length > 0 && (
        <ul className="rounded-xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)] bg-[var(--bg-elevated)]">
          {resolved.map(a => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className={`text-[10.5px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${a.status === "accepted" ? "text-[var(--success)] bg-[var(--success-bg)]" : "text-[var(--danger)] bg-[var(--danger-bg)]"}`}>{a.status === "accepted" ? "Принят" : "Отклонён"}</span>
              <span className="text-[13px] truncate flex-1">{a.name || (users[a.by] || {}).name || "Гость"} · {a.area}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminDashboard({ users, reports, log, unpublished, onOpenUser, onOpenReport, onGoTab, onGoUsers, onGoReports }) {
  const m = window.FAKE_DATA.platformMetrics || {};
  const userCount       = Object.keys(users).length;
  const blockedCount    = Object.values(users).filter(u => u.status === "blocked").length;
  const pendingReports  = reports.filter(r => r.status === "pending").length;
  const publishedNow    = (m.publishedArticles || 0) - unpublished.size;
  const recentLog       = log.slice(0, 6);
  const pendingReview   = (window.__reviewStore?.get().pcRequests || []).filter(r => r.status === "pending").length;
  const pendingRecruit  = (window.__reviewerFlow?.recruitRequests || []).filter(r => r.status === "pending").length;
  const pendingApps     = (window.__reviewerFlow?.applications || []).filter(a => a.status === "pending").length;

  const kpis = [
    { label: "Активные читатели · 7 дн", value: (m.activeUsers7d || 0).toLocaleString("ru-RU"), trend: m.signupsTrend },
    { label: "Регистрации · 7 дн", value: m.newSignups7d || 0 },
    { label: "Опубликовано", value: publishedNow, hint: unpublished.size ? `${unpublished.size} снято` : "статей" },
    { label: "Аккаунтов", value: userCount, hint: blockedCount ? `${blockedCount} в блоке` : "все активны" },
  ];
  const queues = [
    { id: "reports", icon: "flag", label: "Жалобы", n: pendingReports, tone: "danger", note: pendingReports ? "ожидают решения" : "очередь пуста" },
    { id: "review", icon: "edit", label: "Ревью глав", n: pendingReview, tone: "accent", note: pendingReview ? "смена ведущего" : "нет запросов" },
    { id: "recruit", icon: "userPlus", label: "Запросы + заявки", n: pendingRecruit + pendingApps, tone: "accent", note: pendingRecruit + pendingApps ? "новые обращения" : "нет новых" },
    { id: "users", icon: "users", label: "Заблокировано", n: blockedCount, tone: "muted", note: `из ${userCount} аккаунтов` },
  ];

  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      <AdminScreenHead eyebrow="Сводка" title="Состояние платформы" sub="Срез ключевых метрик и очередей, требующих внимания модератора." />

      {/* KPI row — uniform */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {kpis.map((k, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <p className="font-[var(--font-display)] font-extrabold text-[26px] leading-none tabular-nums mb-1.5">{k.value}</p>
            <p className="text-[12px] font-medium">{k.label}</p>
            {k.trend ? <div className="-mb-1 -mx-1 mt-1.5"><Sparkline values={k.trend} /></div> : <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{k.hint}</p>}
          </div>
        ))}
      </div>

      {/* Queues — uniform actionable cards */}
      <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-[var(--muted-foreground)] mt-6 mb-2">Требует внимания</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {queues.map((q) => {
          const c = q.tone === "danger" ? "var(--danger)" : q.tone === "accent" ? "var(--accent)" : "var(--muted-foreground)";
          return (
            <button key={q.id} onClick={() => onGoTab?.(q.id)} className="text-left rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 hover:border-[color-mix(in_srgb,var(--foreground)_20%,transparent)] transition-colors group">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: `color-mix(in srgb,${c} 12%,transparent)`, color: c }}><AdmIcon d={ADM_I[q.icon]} w={16} /></span>
                <span className="font-[var(--font-display)] font-extrabold text-[22px] tabular-nums leading-none" style={{ color: q.n > 0 ? c : "var(--muted-foreground)" }}>{q.n}</span>
              </div>
              <p className="text-[12.5px] font-medium">{q.label}</p>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 flex items-center justify-between">{q.note}<span className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--accent)]"><AdmIcon d={ADM_I.chevR} w={12} /></span></p>
            </button>
          );
        })}
      </div>

      {/* Audit log */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-[13px] font-semibold">Последние действия</h3>
          <span className="text-[11.5px] text-[var(--muted-foreground)]">Все события за {log.length > 0 ? "сегодня" : "—"}</span>
        </div>
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {recentLog.map(entry => (
            <li key={entry.id} className="grid grid-cols-[110px_140px_1fr_auto] items-baseline gap-4 py-2.5 px-1 text-[13px]">
              <span className="text-[11.5px] tabular-nums text-[var(--muted-foreground)]">{relTime(entry.at)}</span>
              <span className="font-mono text-[12px] text-[var(--muted-foreground)] truncate">{entry.action}</span>
              <span className="truncate">{entry.target} <span className="text-[var(--muted-foreground)]">— {entry.note}</span></span>
              <span className="text-[11.5px] text-[var(--muted-foreground)]">@{entry.actor}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Metric({ label, value, trend, hint }) {
  return (
    <div className="rounded-lg border border-[var(--border)] px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">{label}</p>
      <p className="font-[var(--font-display)] font-bold text-2xl tabular-nums mt-1">{value}</p>
      {trend && <div className="-mb-1 -mx-1 mt-1.5"><Sparkline values={trend} /></div>}
      {hint && <p className="text-[11.5px] text-[var(--muted-foreground)] mt-1">{hint}</p>}
    </div>
  );
}

Object.assign(window, { AdminPortal });
