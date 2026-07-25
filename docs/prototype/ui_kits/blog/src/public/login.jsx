// LoginScreen + AdminLoginScreen — the auth surfaces.
// HomeScreen / ArticleIndexScreen / ProfileScreen are overridden by Index.jsx.
// Globals: LoginScreen, AdminLoginScreen.
const { useState } = React;

// Small shared alpha note for the auth cards (always visible here — auth pages
// should make the alpha status unmissable, unlike the dismissible nav strip).
function AuthAlphaNote() {
  return (
    <div
      className="mb-6 rounded-lg border px-3 py-2.5 flex items-start gap-2.5"
      style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning)" }}
    >
      <span className="shrink-0 mt-px inline-flex items-center rounded-full border px-1.5 py-[2px] text-[9px] font-bold uppercase tracking-[0.14em] leading-none" style={{ borderColor: "currentColor" }}>Alpha</span>
      <p className="text-[12px] leading-relaxed">
        {ALPHA_COPY} Возможны сбои и потеря данных — не используйте для рабочих материалов.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Login — centered form, mirrors blog/src/app/login/page.tsx
// -----------------------------------------------------------------------------
function LoginScreen({ onLogin, returnNote, onAdminLogin, onReadFeed }) {
  const users = window.FAKE_DATA.users || {};
  const [username, setUsername] = useState("alex");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const demoAccounts = [
    { handle: "alex",      label: "Автор",    hint: "пишет статьи" },
    { handle: "dm.k",      label: "Ревьюер",  hint: "ревьюит технические тексты" },
    { handle: "moderator", label: "Админ",    hint: "модерирует и публикует" },
    { handle: "nika",      label: "Читатель", hint: "читает и комментирует" },
  ];

  const submit = (e) => {
    e.preventDefault();
    setErr(null);
    if (!password) { setErr("Введите пароль"); return; }
    if (password.length < 3) { setErr("Неверный пароль"); return; }
    const u = users[username.trim().toLowerCase()];
    if (!u) { setErr("Пользователь не найден"); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin({ id: u.handle, handle: u.handle, name: u.name, role: u.role });
    }, 400);
  };

  const field = "px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm min-h-[44px]";

  return (
    <div className="flex items-center justify-center px-4 py-14 sm:py-20 min-h-[600px]" data-screen-label="Login">
      <div className="w-full max-w-sm">
        <h1 className="sr-only">Вход в аккаунт Recenza</h1>

        {/* Wordmark + alpha badge — no card */}
        <div className="mb-7 flex items-center justify-center gap-2">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onReadFeed?.(); }}
            className="font-[var(--font-display)] font-extrabold text-[30px] leading-none tracking-tight rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >Recenza</a>
          <AlphaBadge />
        </div>

        {returnNote && (
          <div className="mb-5 rounded-lg border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-3 py-2.5 text-[12.5px] text-[var(--foreground)] leading-relaxed">
            После входа вы вернётесь к блогу «{returnNote}» — уже подписанными.
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-[13px] font-medium">Никнейм</label>
              <input
                id="username" type="text" autoComplete="username" required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="nickname"
                className={field}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[13px] font-medium">Пароль</label>
              <input
                id="password" type="password" autoComplete="current-password" required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={field}
              />
            </div>

            {err && <p className="text-[var(--danger)] text-[13px]">{err}</p>}

            <button
              type="submit" disabled={loading}
              className="mt-1 px-4 py-2 bg-[var(--accent)] text-[var(--accent-foreground)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 min-h-[44px]"
            >
              {loading ? "Вход…" : "Войти"}
            </button>
        </form>

        {/* Demo accounts — prototype affordance, clearly set apart */}
        <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)]">
          <button
            type="button"
            onClick={() => setShowDemo((v) => !v)}
            aria-expanded={showDemo}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left min-h-[44px]"
          >
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">
              Демо-аккаунты прототипа
            </span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={"text-[var(--muted-foreground)] transition-transform " + (showDemo ? "rotate-180" : "")}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showDemo && (
            <div className="px-3 pb-3">
              <ul className="space-y-1">
                {demoAccounts.map(({ handle, label, hint }) => (
                  <li key={handle}>
                    <button
                      type="button"
                      onClick={() => { setUsername(handle); setPassword("demo"); }}
                      className="w-full flex items-baseline justify-between gap-2 text-left px-2 py-2 rounded-md hover:bg-[var(--muted)] transition-colors min-h-[40px]"
                    >
                      <span className="text-[13px]">
                        <span className="font-medium">{label}</span>
                        <span className="text-[var(--muted-foreground)]"> · @{handle}</span>
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)] truncate">{hint}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-2 px-2">Пароль подставляется автоматически · любой ≥ 3 символов.</p>
            </div>
          )}
        </div>

        {/* Admin service entry */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => onAdminLogin?.()}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors min-h-[40px]"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Служебный вход для администраторов
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// AdminLoginScreen — dedicated, hardened service entry (/admin/login).
// No demo accounts, explicit 2FA field, restricted-access + audit notice.
// -----------------------------------------------------------------------------
function AdminLoginScreen({ onLogin, onBackToMain }) {
  const users = window.FAKE_DATA.users || {};
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setErr(null);
    if (!login.trim()) { setErr("Введите служебный логин"); return; }
    if (password.length < 3) { setErr("Неверный пароль"); return; }
    if (!/^\d{6}$/.test(code.trim())) { setErr("Код 2FA — 6 цифр из приложения-аутентификатора"); return; }
    const u = users[login.trim().toLowerCase()];
    if (!u || u.role !== "admin") { setErr("Учётная запись не найдена или без прав администратора"); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin({ id: u.handle, handle: u.handle, name: u.name, role: u.role });
    }, 500);
  };

  const field = "px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm min-h-[44px]";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-secondary)]" data-screen-label="AdminLogin">
      {/* Minimal service topbar */}
      <header className="border-b border-[var(--border)] bg-[var(--background)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-[var(--font-display)] font-extrabold text-lg leading-none tracking-tight">Recenza</span>
            <span className="text-[var(--muted-foreground)] text-sm">· Администрирование</span>
            <AlphaBadge />
          </div>
          <button
            onClick={() => onBackToMain?.()}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors min-h-[40px]"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Обычный вход
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-[400px]">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl p-6 sm:p-8">
            <div className="flex flex-col items-center text-center mb-6">
              <span className="w-12 h-12 rounded-xl inline-flex items-center justify-center mb-3" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
              </span>
              <h1 className="font-[var(--font-display)] font-extrabold text-2xl tracking-tight">Служебный вход</h1>
              <p className="text-[13px] text-[var(--muted-foreground)] mt-1">Панель администрирования Recenza</p>
            </div>

            <AuthAlphaNote />

            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="admin-login" className="text-sm font-medium">Служебный логин</label>
                <input id="admin-login" type="text" autoComplete="username" value={login}
                  onChange={(e) => setLogin(e.target.value)} placeholder="admin@recenza" className={field} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="admin-pass" className="text-sm font-medium">Пароль</label>
                <input id="admin-pass" type="password" autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={field} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="admin-2fa" className="text-sm font-medium flex items-center justify-between">
                  <span>Код 2FA</span>
                  <span className="text-[11px] font-normal text-[var(--muted-foreground)]">из приложения-аутентификатора</span>
                </label>
                <input id="admin-2fa" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" className={field + " tracking-[0.4em] font-[var(--font-mono)] text-center"} />
              </div>

              {err && <p className="text-[var(--danger)] text-[13px] leading-snug">{err}</p>}

              <button type="submit" disabled={loading}
                className="mt-1 px-4 py-2 bg-[var(--accent)] text-[var(--accent-foreground)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 min-h-[44px]">
                {loading ? "Проверка…" : "Войти в панель"}
              </button>
            </form>
          </div>

          <p className="mt-4 px-1 text-[11.5px] leading-relaxed text-[var(--muted-foreground)] flex items-start gap-2">
            <svg viewBox="0 0 24 24" width="14" height="14" className="shrink-0 mt-px" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Доступ только для авторизованного персонала. Все действия в панели журналируются. В демо-прототипе подойдёт любой 6-значный код и учётная запись с ролью администратора (например, <span className="font-[var(--font-mono)]">moderator</span>).
          </p>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, AdminLoginScreen, AuthAlphaNote });
