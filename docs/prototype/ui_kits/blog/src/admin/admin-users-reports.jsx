// Admin Portal — part 2: Users list, User detail, Reports list, Report detail.
// Continues the surface defined in Admin.jsx; relies on the same shared
// helpers (RolePill, StatusDot, fmtDate, relTime, ROLE_LABELS) which are
// declared globally there.

const { useState } = React;
// ──────────────────────────────────────────────────────────────────────────
// AdminUsers — table of all platform users.
// ──────────────────────────────────────────────────────────────────────────
function AdminUsers({ users, onOpen }) {
  const [query, setQuery]   = useState("");
  // screen-label set on the wrapper below
  const [roleF, setRoleF]   = useState("all");
  const [statusF, setStatF] = useState("all");

  const list = Object.values(users).filter(u => {
    if (roleF !== "all"   && u.role !== roleF)   return false;
    if (statusF !== "all" && u.status !== statusF) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!(`@${u.handle} ${u.name}`.toLowerCase().includes(q))) return false;
    }
    return true;
  }).sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));

  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      <AdminScreenHead eyebrow="Люди" title="Все аккаунты" sub="Роли, статусы, активность. Откройте карточку, чтобы изменить роль или заблокировать." />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по @handle или имени"
          className="flex-1 min-w-[220px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        <SelectChip value={roleF} onChange={setRoleF} options={[
          ["all", "Все роли"],
          ["reader", "Читатели"],
          ["author", "Авторы"],
          ["reviewer", "Ревьюеры"],
          ["admin", "Админы"],
        ]} />
        <SelectChip value={statusF} onChange={setStatF} options={[
          ["all", "Все статусы"],
          ["active", "Активные"],
          ["blocked", "Заблокированные"],
          ["deactivated", "Деактивированные"],
        ]} />
      </div>

      {/* Table — bordered card, sticky head, dense rows */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_130px_90px] gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)] text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] sticky top-0 z-10">
          <span>Пользователь</span>
          <span>Роль</span>
          <span>Статус</span>
          <span className="text-right">Визит</span>
        </div>
        {list.length === 0 && (
          <p className="py-8 text-center text-[13px] text-[var(--muted-foreground)]">Никого не нашлось.</p>
        )}
        <ul>
          {list.map(u => (
            <li key={u.handle}>
              <button
                onClick={() => onOpen(u.handle)}
                className="w-full grid grid-cols-[1fr_120px_130px_90px] gap-3 px-4 py-2.5 text-left border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors items-center"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar handle={u.handle} name={u.name} size={28} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate leading-tight">{u.name}</p>
                    <p className="text-[11px] text-[var(--muted-foreground)] truncate leading-tight">@{u.handle}</p>
                  </div>
                </div>
                <RolePill role={u.role} />
                <StatusDot status={u.status} />
                <span className="text-[11.5px] text-[var(--muted-foreground)] tabular-nums text-right">{u.lastSeenAt ? relTime(u.lastSeenAt) : "—"}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11.5px] text-[var(--muted-foreground)] mt-3">{list.length} из {Object.keys(users).length}</p>
    </div>
  );
}

function SelectChip({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[var(--background)] border border-[var(--border)] rounded-md px-2.5 py-2 text-[13px] focus:outline-none focus:border-[var(--accent)] transition-colors"
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AdminUserDetail — drill-in for a single user.
// ──────────────────────────────────────────────────────────────────────────
function AdminUserDetail({ user, log, reports, unpublished, onBack, onSetRole, onBlock, onUnblock, onUnpublishArticle, onRepublishArticle, onOpenProfile }) {
  const [confirmBlock, setConfirmBlock] = useState(false);
  // screen-label set on the wrapper below
  const [blockReason, setBlockReason]   = useState("");
  if (!user) return null;

  // History — entries from the audit log mentioning this user.
  const history = log.filter(e => e.target.includes(`@${user.handle}`));
  const reportsAgainst = reports.filter(r => r.targetAuthorHandle === user.handle);
  const articlesByUser = (window.FAKE_DATA.articles || []).filter(a => a.authorSlug === user.handle);

  return (
    <div className="px-10 py-10 max-w-4xl">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-6">
        <Icon.ArrowLeft /> Все пользователи
      </button>

      {/* Header */}
      <header className="flex items-start gap-4 mb-8 pb-6 border-b border-[var(--border)]">
        <Avatar handle={user.handle} name={user.name} size={56} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-[var(--font-display)] font-extrabold text-2xl md:text-[28px] tracking-tight">{user.name}</h2>
            <RolePill role={user.role} />
            <StatusDot status={user.status} />
          </div>
          <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5">@{user.handle} · с {fmtDate(user.joinedAt)}</p>
          {user.bio && <p className="text-[13.5px] text-[var(--foreground)] mt-2 max-w-xl leading-relaxed">{user.bio}</p>}
          {user.status === "blocked" && user.blockedReason && (
            <div className="mt-3 inline-flex items-start gap-2 px-3 py-2 rounded-md bg-rose-500/[0.08] border border-rose-500/20 text-[12.5px]">
              <span className="text-rose-600 dark:text-rose-400 font-semibold mt-px">Заблокирован.</span>
              <span className="text-[var(--foreground)]">{user.blockedReason}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => onOpenProfile?.(user.handle)}
          className="text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline-offset-2 hover:underline shrink-0 mt-2"
        >
          Публичный профиль →
        </button>
      </header>

      {/* Action panels — role + status side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
        {/* Role */}
        <div className="rounded-lg border border-[var(--border)] p-4">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-2">Роль</p>
          <div className="flex flex-wrap gap-1.5">
            {["reader", "author", "reviewer", "admin"].map(r => (
              <button
                key={r}
                onClick={() => onSetRole(user.handle, r)}
                disabled={user.role === r}
                className={`text-[12.5px] px-2.5 py-1.5 rounded border transition-colors ${
                  user.role === r
                    ? "bg-[var(--accent)]/14 border-[var(--accent)]/40 text-[var(--accent)] font-medium cursor-default"
                    : "border-[var(--border)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <p className="text-[11.5px] text-[var(--muted-foreground)] mt-2.5 leading-relaxed">
            Смена роли применяется немедленно и пишется в журнал.
          </p>
        </div>

        {/* Status */}
        <div className="rounded-lg border border-[var(--border)] p-4">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-2">Доступ</p>
          {user.status === "blocked" ? (
            <button
              onClick={() => onUnblock(user.handle)}
              className="text-[13px] px-3 py-1.5 rounded bg-emerald-500/14 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors font-medium"
            >
              Разблокировать
            </button>
          ) : !confirmBlock ? (
            <button
              onClick={() => setConfirmBlock(true)}
              disabled={user.status === "deactivated"}
              className="text-[13px] px-3 py-1.5 rounded border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Заблокировать
            </button>
          ) : (
            <div className="space-y-2">
              <input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Причина блокировки…"
                autoFocus
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-[13px] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { onBlock(user.handle, blockReason || "Без указания причины"); setConfirmBlock(false); setBlockReason(""); }}
                  className="text-[12.5px] font-medium px-2.5 py-1 rounded bg-rose-600 text-white hover:bg-rose-500 transition-colors"
                >Заблокировать</button>
                <button
                  onClick={() => { setConfirmBlock(false); setBlockReason(""); }}
                  className="text-[12.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                >Отмена</button>
              </div>
            </div>
          )}
          <p className="text-[11.5px] text-[var(--muted-foreground)] mt-2.5 leading-relaxed">
            Заблокированный аккаунт не может комментировать и публиковаться. Контент сохраняется.
          </p>
        </div>
      </div>

      {/* Articles by user (only for authors) */}
      {articlesByUser.length > 0 && (
        <section className="mb-10">
          <h3 className="text-[13px] font-semibold mb-3">Статьи автора <span className="text-[var(--muted-foreground)] font-normal">{articlesByUser.length}</span></h3>
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {articlesByUser.map(a => {
              const off = unpublished.has(a.slug);
              return (
                <li key={a.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2.5 px-1">
                  <span className={`text-[13.5px] truncate ${off ? "text-[var(--muted-foreground)] line-through" : ""}`}>{a.title}</span>
                  <span className="text-[11.5px] text-[var(--muted-foreground)] tabular-nums">{a.viewCount.toLocaleString("ru-RU")} просм.</span>
                  {off ? (
                    <button onClick={() => onRepublishArticle(a.slug)} className="text-[12px] px-2 py-1 rounded border border-[var(--border)] hover:border-emerald-500/40 hover:text-emerald-600 transition-colors">
                      Восстановить
                    </button>
                  ) : (
                    <button onClick={() => onUnpublishArticle(a.slug, "Снято модератором")} className="text-[12px] px-2 py-1 rounded border border-[var(--border)] hover:border-rose-500/40 hover:text-rose-600 transition-colors">
                      Снять с публикации
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Reports against this user */}
      {reportsAgainst.length > 0 && (
        <section className="mb-10">
          <h3 className="text-[13px] font-semibold mb-3">Жалобы на пользователя <span className="text-[var(--muted-foreground)] font-normal">{reportsAgainst.length}</span></h3>
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {reportsAgainst.map(r => (
              <li key={r.id} className="grid grid-cols-[110px_1fr_auto] items-baseline gap-4 py-2.5 px-1 text-[13px]">
                <span className="text-[11.5px] tabular-nums text-[var(--muted-foreground)]">{relTime(r.reportedAt)}</span>
                <span className="truncate">{r.reasonText} <span className="text-[var(--muted-foreground)]">— «{r.targetBody.slice(0, 80)}…»</span></span>
                <StatusDot status={r.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Audit history */}
      <section>
        <h3 className="text-[13px] font-semibold mb-3">История модерации <span className="text-[var(--muted-foreground)] font-normal">{history.length}</span></h3>
        {history.length === 0 ? (
          <p className="text-[13px] text-[var(--muted-foreground)] py-3 border-t border-[var(--border)]">Действий по этому пользователю не было.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {history.map(e => (
              <li key={e.id} className="grid grid-cols-[110px_140px_1fr_auto] items-baseline gap-4 py-2.5 px-1 text-[13px]">
                <span className="text-[11.5px] tabular-nums text-[var(--muted-foreground)]">{relTime(e.at)}</span>
                <span className="font-mono text-[12px] text-[var(--muted-foreground)] truncate">{e.action}</span>
                <span className="truncate">{e.note}</span>
                <span className="text-[11.5px] text-[var(--muted-foreground)]">@{e.actor}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AdminReports — pending + resolved queue.
// ──────────────────────────────────────────────────────────────────────────
function AdminReports({ reports, users, onOpen }) {
  const [tab, setTab] = useState("pending");
  const groups = {
    pending:   reports.filter(r => r.status === "pending"),
    resolved:  reports.filter(r => r.status === "resolved" || r.status === "dismissed"),
  };
  const list = groups[tab];
  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      <AdminScreenHead eyebrow="Модерация" title="Очередь жалоб" sub="Жалобы от читателей на комментарии и блоги. Откройте карточку, чтобы увидеть контекст и принять решение." />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] mb-5">
        {[["pending", "Открытые", groups.pending.length], ["resolved", "Закрытые", groups.resolved.length]].map(([k, l, n]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-[13px] -mb-px border-b-2 transition-colors ${
              tab === k
                ? "border-[var(--accent)] text-[var(--foreground)] font-medium"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {l} <span className="text-[var(--muted-foreground)] font-normal tabular-nums ml-1">{n}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {list.length === 0 ? (
        <p className="text-[13px] text-[var(--muted-foreground)] py-10 text-center border border-dashed border-[var(--border)] rounded-md">
          {tab === "pending" ? "Очередь пуста — отдыхайте." : "Закрытых жалоб пока нет."}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {list.map(r => {
            const author = users[r.targetAuthorHandle] || { name: r.targetAuthorHandle, handle: r.targetAuthorHandle };
            return (
              <li key={r.id}>
                <button
                  onClick={() => onOpen(r.id)}
                  className="w-full grid grid-cols-[1fr_140px_110px_auto] items-center gap-4 py-3.5 px-2 -mx-2 text-left rounded hover:bg-[var(--muted)]/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-rose-600 dark:text-rose-400">{r.reasonText}</span>
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-px rounded bg-[var(--muted)] text-[var(--muted-foreground)]">{r.kind === "blog" ? "блог" : "коммент"}</span>
                      {r.reportsCount > 1 && <span className="text-[11px] text-[var(--muted-foreground)]">· {r.reportsCount} жалобы</span>}
                    </div>
                    <p className="text-[13px] line-clamp-1 text-[var(--foreground)]">«{r.targetBody}»</p>
                  </div>
                  <span className="text-[12px] text-[var(--muted-foreground)] inline-flex items-center gap-2 shrink-0 truncate">
                    <Avatar handle={author.handle} name={author.name} size={20} /> @{author.handle}
                  </span>
                  <span className="text-[12px] text-[var(--muted-foreground)] tabular-nums shrink-0">{relTime(r.reportedAt)}</span>
                  <StatusDot status={r.status} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AdminReportDetail — single report with full comment context + actions.
// ──────────────────────────────────────────────────────────────────────────
function AdminReportDetail({ report, users, onBack, onResolve }) {
  if (!report) return null;
  const author = users[report.targetAuthorHandle] || { name: report.targetAuthorHandle, handle: report.targetAuthorHandle };
  const reporter = users[report.reporterHandle] || { name: report.reporterHandle, handle: report.reporterHandle };
  const blog = window.__blogData?.getBlogBySlug?.(report.targetArticleSlug);
  const article = blog || (window.FAKE_DATA.articles || []).find(a => a.slug === report.targetArticleSlug);
  const isBlog = report.kind === "blog";
  const closed = report.status !== "pending";

  return (
    <div className="px-10 py-10 max-w-3xl">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-6">
        <Icon.ArrowLeft /> Все жалобы
      </button>

      <header className="mb-6 pb-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-rose-600 dark:text-rose-400">{report.reasonText}</span>
          <StatusDot status={report.status} />
          <span className="text-[12px] text-[var(--muted-foreground)]">· {report.reportsCount} {report.reportsCount === 1 ? "жалоба" : "жалоб"}</span>
        </div>
        <h2 className="font-[var(--font-display)] font-bold text-2xl tracking-tight">{isBlog ? "Жалоба на блог" : "Жалоба на комментарий"}</h2>
        <p className="text-[12.5px] text-[var(--muted-foreground)] mt-1">
          Подал @{reporter.handle} · {fmtDate(report.reportedAt)} · {isBlog ? "блог" : "к статье"} «{article?.title || report.targetArticleSlug}»{report.note ? ` · «${report.note}»` : ""}
        </p>
      </header>

      {/* Context: comment text or blog card */}
      <section className="mb-8">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-2">{isBlog ? "Блог" : "Комментарий"}</p>
        {isBlog ? (
          <article className="rounded-lg border border-[var(--border)] p-4 bg-[var(--muted)]/20">
            <p className="font-[var(--font-display)] font-bold text-[17px] tracking-tight mb-1">{article?.title || report.targetBody}</p>
            <p className="text-[12.5px] text-[var(--muted-foreground)]">Автор @{author.handle} · {author.name}</p>
          </article>
        ) : (
          <article className="rounded-lg border border-[var(--border)] p-4 bg-[var(--muted)]/20">
            <header className="flex items-center gap-2 mb-2">
              <Avatar handle={author.handle} name={author.name} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium truncate">{author.name}</span>
                  <RolePill role={author.role} />
                  <StatusDot status={author.status} />
                </div>
                <p className="text-[11.5px] text-[var(--muted-foreground)]">@{author.handle}</p>
              </div>
            </header>
            <p className="text-[14px] leading-relaxed text-[var(--foreground)]">{report.targetBody}</p>
          </article>
        )}
      </section>

      {/* Actions or resolution */}
      {closed ? (
        <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--muted)]/20">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Решение</p>
          <p className="text-[14px]">{report.resolution || "—"}</p>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-1">@{report.resolvedBy} · {report.resolvedAt ? relTime(report.resolvedAt) : "—"}</p>
        </div>
      ) : (
        <section>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-2">Действие</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
            <ActionBtn
              tone="rose"
              onClick={() => onResolve(report.id, "delete")}
              title={isBlog ? "Снять блог с публикации" : "Удалить комментарий"}
              hint={isBlog ? "Блог скрывается из ленты, автор не блокируется." : "Удалить только этот комментарий, автор продолжит писать."}
            />
            <ActionBtn
              tone="rose-strong"
              onClick={() => onResolve(report.id, "block+delete")}
              title={isBlog ? "Снять блог + заблокировать автора" : "Удалить + заблокировать автора"}
              hint={isBlog ? "Снять блог с публикации и закрыть автору запись." : "Снести комментарий и закрыть аккаунту запись."}
            />
            <ActionBtn
              tone="amber"
              onClick={() => onResolve(report.id, "block")}
              title="Только заблокировать автора"
              hint={isBlog ? "Блог оставить, автору закрыть запись." : "Комментарий оставить как есть, автору закрыть запись."}
            />
            <ActionBtn
              tone="slate"
              onClick={() => onResolve(report.id, "dismiss")}
              title="Отклонить жалобу"
              hint={isBlog ? "Жалоба необоснованна — блог и автор остаются." : "Жалоба необоснованна — комментарий и автор остаются."}
            />
          </div>
          <p className="text-[11.5px] text-[var(--muted-foreground)] leading-relaxed mt-3">
            Все действия пишутся в журнал и видны на вкладке «Сводка».
          </p>
        </section>
      )}
    </div>
  );
}

function ActionBtn({ tone, onClick, title, hint }) {
  const tones = {
    "rose":        "border-rose-500/25 hover:border-rose-500/50 hover:bg-rose-500/[0.06]",
    "rose-strong": "border-rose-500/40 bg-rose-500/[0.04] hover:bg-rose-500/[0.10]",
    "amber":       "border-amber-500/25 hover:border-amber-500/50 hover:bg-amber-500/[0.06]",
    "slate":       "border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/[0.04]",
  };
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition-colors ${tones[tone]}`}
    >
      <p className="text-[13.5px] font-medium mb-0.5">{title}</p>
      <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed">{hint}</p>
    </button>
  );
}

Object.assign(window, { AdminUsers, AdminUserDetail, AdminReports, AdminReportDetail });

// (A legacy AdminReview + ReviewQueueRow were retired — the chapter-aware
//  moderation queue AdminReview / ChapterQueueRow in Admin-review.jsx is canonical.)
