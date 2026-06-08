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
        }}
      />

      {/* Main column */}
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
        {tab === "dashboard" && (
          <div data-screen-label="AdminDashboard">
          <AdminDashboard
            users={users} reports={reports} log={log} unpublished={unpublished}
            onOpenUser={openUser} onOpenReport={openReport}
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
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sidebar
// ──────────────────────────────────────────────────────────────────────────
function AdminSidebar({ tab, onTab, onBack, counts }) {
  const items = [
    { id: "dashboard", label: "Сводка",        glyph: "◇" },
    { id: "review",    label: "Ревью",         glyph: "◫", count: counts.review, accent: counts.review > 0 },
    { id: "users",     label: "Пользователи",  glyph: "◔", count: counts.users },
    { id: "reports",   label: "Жалобы",        glyph: "△", count: counts.reports, accent: counts.reports > 0 },
  ];
  return (
    <aside className="w-full md:w-[220px] shrink-0 border-b md:border-b-0 md:border-r border-[var(--border)] bg-[var(--muted)]/30 flex flex-col md:max-h-none">
      <div className="px-4 md:px-5 pt-4 md:pt-5 pb-3 md:pb-4 border-b border-[var(--border)] flex items-center justify-between md:block">
        <div>
          <p className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Admin</p>
          <h1 className="font-[var(--font-display)] font-bold text-[19px] tracking-tight">Платформа</h1>
        </div>
        <button
          onClick={onBack}
          className="md:hidden inline-flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <Icon.ArrowLeft /> К блогу
        </button>
      </div>
      <nav className="flex md:flex-col md:flex-1 gap-0 md:gap-0.5 px-2 md:px-3 py-2 md:py-3 overflow-x-auto md:overflow-x-visible">
        {items.map(it => (
          <button
            key={it.id}
            onClick={() => onTab(it.id)}
            className={`shrink-0 md:w-full flex items-center gap-2 md:gap-2.5 px-2.5 py-2 rounded-md text-[13px] md:text-[13.5px] transition-colors text-left whitespace-nowrap ${
              tab === it.id
                ? "bg-[var(--background)] border border-[var(--border)] font-medium"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--background)]/60"
            }`}
          >
            <span className="text-[var(--muted-foreground)] w-4 text-center font-mono text-[13px]">{it.glyph}</span>
            <span className="md:flex-1">{it.label}</span>
            {typeof it.count === "number" && (
              <span className={`tabular-nums text-[11.5px] ${it.accent ? "text-rose-600 dark:text-rose-400 font-medium" : "text-[var(--muted-foreground)]"}`}>
                {it.count}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="hidden md:block px-3 pb-3 border-t border-[var(--border)] pt-3">
        <button
          onClick={onBack}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--background)]/60 transition-colors"
        >
          <Icon.ArrowLeft /> К блогу
        </button>
      </div>
    </aside>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Dashboard
// ──────────────────────────────────────────────────────────────────────────
function AdminDashboard({ users, reports, log, unpublished, onOpenUser, onOpenReport, onGoUsers, onGoReports }) {
  const m = window.FAKE_DATA.platformMetrics || {};
  const userCount       = Object.keys(users).length;
  const blockedCount    = Object.values(users).filter(u => u.status === "blocked").length;
  const pendingReports  = reports.filter(r => r.status === "pending").length;
  const publishedNow    = (m.publishedArticles || 0) - unpublished.size;
  const recentLog       = log.slice(0, 6);

  return (
    <div className="px-10 py-10 max-w-5xl">
      <header className="mb-10">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Сводка</p>
        <h2 className="font-[var(--font-display)] font-extrabold text-3xl md:text-4xl tracking-tight mb-2">Состояние платформы</h2>
        <p className="text-[14px] text-[var(--muted-foreground)] max-w-xl">
          Свежий снимок ключевых метрик и последние действия модерации. Цифры обновляются раз в час.
        </p>
      </header>

      {/* Metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <Metric label="Активные читатели · 7 дн" value={(m.activeUsers7d || 0).toLocaleString("ru-RU")} />
        <Metric label="Регистрации · 7 дн" value={m.newSignups7d || 0} trend={m.signupsTrend} />
        <Metric label="Опубликовано статей" value={publishedNow} hint={unpublished.size ? `${unpublished.size} снято` : null} />
        <Metric label="На ревью" value={m.inReview || 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-12">
        <button onClick={onGoReports} className="text-left rounded-lg border border-[var(--border)] px-4 py-4 hover:border-[var(--accent)] hover:bg-[var(--accent)]/[0.04] transition-colors group">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Открытых жалоб</span>
            <span className="text-[11px] text-[var(--muted-foreground)] group-hover:text-[var(--accent)] transition-colors">Открыть →</span>
          </div>
          <p className={`font-[var(--font-display)] font-bold text-3xl tabular-nums ${pendingReports > 0 ? "text-rose-600 dark:text-rose-400" : ""}`}>{pendingReports}</p>
          <p className="text-[12.5px] text-[var(--muted-foreground)] mt-1">
            {pendingReports === 0 ? "Очередь пуста" : `Ожидают решения модератора`}
          </p>
        </button>
        <button onClick={onGoUsers} className="text-left rounded-lg border border-[var(--border)] px-4 py-4 hover:border-[var(--accent)] hover:bg-[var(--accent)]/[0.04] transition-colors group">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Пользователи</span>
            <span className="text-[11px] text-[var(--muted-foreground)] group-hover:text-[var(--accent)] transition-colors">Открыть →</span>
          </div>
          <p className="font-[var(--font-display)] font-bold text-3xl tabular-nums">{userCount}</p>
          <p className="text-[12.5px] text-[var(--muted-foreground)] mt-1">
            {blockedCount > 0 ? `${blockedCount} в блоке` : "Все активны"}
          </p>
        </button>
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
