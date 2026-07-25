// WorkspaceScreen — «Рабочее место»: приватная страница-хаб (вариант E).
// Одна учётная запись может держать несколько ролей; здесь собраны кабинеты
// этих ролей, цифры по каждому и список «требует внимания». Страница видна
// только владельцу — публичный профиль ничего из этого не показывает.
// Globals: WorkspaceScreen.
const { useState: useWsState, useEffect: useWsEffect, useReducer: useWsReducer } = React;

const WS_ROLE_META = {
  author: {
    label: "Кабинет автора",
    hint: "Черновики, главы на ревью, публикации",
    icon: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  },
  reviewer: {
    label: "Кабинет ревьюера",
    hint: "Очередь, ваши вердикты и история ревью",
    icon: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  },
  admin: {
    label: "Кабинет администратора",
    hint: "Модерация, пользователи, жалобы",
    icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>,
  },
};

function WsPrivateTag({ children = "Только вы" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider font-bold text-[var(--private)]">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
      {children}
    </span>
  );
}

function WsStat({ k, v, tone }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">{k}</dt>
      <dd className="font-[var(--font-display)] font-semibold text-[19px] tabular-nums" style={tone ? { color: tone } : null}>{v}</dd>
    </div>
  );
}

function WsRoleCard({ role, stats, footer, onOpen }) {
  const meta = WS_ROLE_META[role];
  if (!meta) return null;
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-xl border border-dashed border-[color-mix(in_srgb,var(--private)_50%,transparent)] bg-[color-mix(in_srgb,var(--private)_9%,transparent)] p-5 hover:border-[color-mix(in_srgb,var(--private)_85%,transparent)] transition-colors"
    >
      <span className="w-9 h-9 rounded-lg inline-flex items-center justify-center bg-[color-mix(in_srgb,var(--private)_16%,transparent)] text-[var(--private)]">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{meta.icon}</svg>
      </span>
      <h2 className="font-[var(--font-display)] font-bold text-[17px] mt-3">{meta.label}</h2>
      <p className="text-[12.5px] text-[var(--muted-foreground)] mt-1">{meta.hint}</p>
      <dl className="flex flex-wrap gap-x-6 gap-y-3 mt-4">
        {stats.map(s => <WsStat key={s.k} {...s} />)}
      </dl>
      {footer && <p className="text-[12.5px] mt-3.5" style={{ color: footer.tone }}>{footer.text}</p>}
    </button>
  );
}

function WorkspaceScreen({ session, onOpenAuthor, onOpenReviewer, onOpenAdmin, onOpenProfile, onOpenReview, onOpenEditor, onOpenBookmarks, onBack }) {
  const handle = session?.handle;
  const users = window.FAKE_DATA.users || {};
  const me = users[handle] || {};
  const D = window.__blogData;
  const roles = window.rolesOf ? window.rolesOf(me) : [];
  const [, tick] = useWsReducer(x => x + 1, 0);
  useWsEffect(() => {
    const unsub = window.__reviewStore?.subscribe(() => tick());
    const unsubReports = window.__reports?.subscribe?.(() => tick());
    const h = () => tick();
    window.addEventListener("devblog:follows-changed", h);
    return () => { unsub && unsub(); unsubReports && unsubReports(); window.removeEventListener("devblog:follows-changed", h); };
  }, []);

  // ── Author numbers ───────────────────────────────────────────────
  const myBlogs = roles.includes("author") ? (D.getAuthorBlogs?.(handle) || []) : [];
  const allChapters = myBlogs.flatMap(b => (b.chapters || []).map(c => ({ blog: b, c })));
  const drafts = allChapters.filter(x => D.isChapterDraft(x.c));
  const inReview = allChapters.filter(x => D.isChapterInFlight(x.c));
  const published = allChapters.filter(x => D.isChapterPublished(x.c));
  const needFix = allChapters.filter(x => D.chapterStatus?.(x.c) === "changes-requested");

  // ── Reviewer numbers ─────────────────────────────────────────────
  const inFlight = roles.includes("reviewer") ? (D.getInFlightChapters?.() || []) : [];
  const assigned = inFlight.filter(r => (r.reviewerHandles || []).includes(handle));
  const myTurn = assigned.filter(r => {
    const ch = D.getChapter?.(r.blogSlug, r.chapterSlug);
    return !(ch?.state?.[handle]?.verdict);
  });
  const invites = roles.includes("reviewer") ? (window.__reviewerFlow?.invitesFor(handle, "pending") || []) : [];
  const doneReviews = roles.includes("reviewer") ? (D.getReviewedChapters?.(handle) || []) : [];

  // ── Admin numbers ────────────────────────────────────────────────
  const modQueue = roles.includes("admin") ? (D.getInFlightChapters?.() || []) : [];
  const reports = roles.includes("admin") ? (window.__reports?.get()?.items || []) : [];
  const openReports = reports.filter(r => r.status === "pending");

  // ── «Требует внимания» — cross-role, most urgent first ───────────
  const attention = [];
  needFix.slice(0, 3).forEach(x => attention.push({
    id: "fix-" + x.blog.slug + "-" + x.c.slug,
    role: "автор",
    title: `«${x.blog.title}» · ${x.c.title}`,
    body: "Ревьюер запросил правки",
    icon: <><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></>,
    onClick: () => onOpenEditor?.(x.blog.slug, x.c.slug),
  }));
  myTurn.slice(0, 3).forEach(r => attention.push({
    id: "turn-" + r.blogSlug + "-" + r.chapterSlug,
    role: "ревьюер",
    title: `«${r.blogTitle || r.blogSlug}» · ${r.chapterTitle || r.chapterSlug}`,
    body: r.stalledFor > 3 ? `Ждёт вашего вердикта ${r.stalledFor} дн.` : "Ваш ход — ждёт вердикта",
    icon: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" /></>,
    onClick: () => onOpenReview?.(r.blogSlug, r.chapterSlug),
  }));
  invites.slice(0, 2).forEach(i => attention.push({
    id: "inv-" + i.id,
    role: "ревьюер",
    title: i.chapterTitle || i.blogTitle || "Приглашение на ревью",
    body: "Новое приглашение — примите или откажитесь",
    icon: <><path d="M4 4h16v16H4z" /><polyline points="4 7 12 13 20 7" /></>,
    onClick: () => onOpenReviewer?.(),
  }));
  openReports.slice(0, 2).forEach(r => attention.push({
    id: "rep-" + (r.id || Math.random()),
    role: "админ",
    title: r.reasonText || "Жалоба",
    body: r.targetBody ? `«${String(r.targetBody).slice(0, 70)}…»` : "Ожидает решения модератора",
    icon: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></>,
    onClick: () => onOpenAdmin?.(),
  }));

  const roleOpen = { author: onOpenAuthor, reviewer: onOpenReviewer, admin: onOpenAdmin };

  return (
    <div className="max-w-5xl mx-auto px-4 py-9 sm:py-12" data-screen-label="Workspace">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <WsPrivateTag>Приватная страница · только вы</WsPrivateTag>
          <h1 className="font-[var(--font-display)] font-extrabold text-[30px] sm:text-4xl tracking-tight mt-2.5">Рабочее место</h1>
          <p className="text-[13.5px] text-[var(--muted-foreground)] mt-2 max-w-lg leading-relaxed [text-wrap:pretty]">
            Кабинеты ваших ролей и то, что ждёт вашего решения. Публичный профиль это никак не меняет.
          </p>
        </div>
        <button
          onClick={() => onOpenProfile?.(handle)}
          className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] transition-colors min-h-[44px]"
        >
          Мой публичный профиль
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" /></svg>
        </button>
      </header>

      {roles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center">
          <h2 className="font-[var(--font-display)] font-bold text-[19px] mb-1.5">Пока нет кабинетов</h2>
          <p className="text-[13.5px] text-[var(--muted-foreground)] max-w-md mx-auto leading-relaxed">
            Кабинеты появляются вместе с ролями — автора или ревьюера. Роли выдаёт администратор.
          </p>
        </div>
      ) : (
        <>
          <div className={`grid gap-3.5 ${roles.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {roles.map(role => {
              if (role === "author") return (
                <WsRoleCard
                  key={role} role={role} onOpen={roleOpen[role]}
                  stats={[
                    { k: "Черновики", v: drafts.length },
                    { k: "На ревью", v: inReview.length },
                    { k: "Опубликовано", v: published.length },
                  ]}
                  footer={needFix.length ? { text: `${needFix.length} ${needFix.length === 1 ? "глава ждёт" : "главы ждут"} ваших правок`, tone: "var(--warning)" } : null}
                />
              );
              if (role === "reviewer") return (
                <WsRoleCard
                  key={role} role={role} onOpen={roleOpen[role]}
                  stats={[
                    { k: "В очереди", v: assigned.length },
                    { k: "Ваш ход", v: myTurn.length, tone: myTurn.length ? "var(--warning)" : null },
                    { k: "Вердиктов", v: doneReviews.length },
                  ]}
                  footer={invites.length ? { text: `${invites.length} новое приглашение на ревью`, tone: "var(--accent)" } : null}
                />
              );
              return (
                <WsRoleCard
                  key={role} role={role} onOpen={roleOpen[role]}
                  stats={[
                    { k: "В модерации", v: modQueue.length },
                    { k: "Жалобы", v: openReports.length, tone: openReports.length ? "var(--warning)" : null },
                  ]}
                />
              );
            })}
          </div>

          <section className="mt-9">
            <div className="flex items-center justify-between gap-3 mb-3.5">
              <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Требует внимания</h2>
              {attention.length > 0 && (
                <span className="text-[11.5px] text-[var(--muted-foreground)] tabular-nums">{attention.length}</span>
              )}
            </div>
            {attention.length === 0 ? (
              <p className="text-[13.5px] text-[var(--muted-foreground)] py-9 text-center border border-dashed border-[var(--border)] rounded-xl">
                Ничего не ждёт вашего решения — всё чисто.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {attention.map(a => (
                  <li key={a.id}>
                    <button
                      onClick={a.onClick}
                      className="w-full flex items-center gap-3 text-left rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3.5 hover:border-[color-mix(in_srgb,var(--foreground)_22%,transparent)] transition-colors min-h-[44px]"
                    >
                      <span className="w-9 h-9 shrink-0 rounded-lg inline-flex items-center justify-center bg-[color-mix(in_srgb,var(--private)_14%,transparent)] text-[var(--private)]">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{a.icon}</svg>
                      </span>
                      <span className="min-w-0 flex flex-col">
                        <span className="text-[13.5px] font-semibold leading-snug title-clamp-1">{a.title}</span>
                        <span className="text-[12px] text-[var(--muted-foreground)] mt-0.5 title-clamp-1">{a.body}</span>
                      </span>
                      <span className="ml-auto shrink-0 font-[var(--font-mono)] text-[10.5px] px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">{a.role}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-9 pt-6 border-t border-[var(--border)] flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mr-1">Аккаунт</span>
            <button onClick={() => onOpenBookmarks?.()} className="text-[12.5px] px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors min-h-[40px]">Закладки</button>
            <button onClick={() => onOpenProfile?.(handle)} className="text-[12.5px] px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors min-h-[40px]">Редактировать профиль</button>
          </section>
        </>
      )}
    </div>
  );
}

Object.assign(window, { WorkspaceScreen, WsPrivateTag });
