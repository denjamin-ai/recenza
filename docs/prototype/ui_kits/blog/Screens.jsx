// LoginScreen — the only live screen left here. HomeScreen / ArticleIndexScreen /
// ProfileScreen (+ their ProfileActionPanel / VerdictBadge helpers) were retired:
// they are overridden by Index-v2 (HomeScreenV2 / ArticleIndexScreenV2 /
// ProfileScreenV2). Globals: LoginScreen.
const { useState } = React;

// -----------------------------------------------------------------------------
// Login — centered form, mirrors blog/src/app/login/page.tsx
// -----------------------------------------------------------------------------
function LoginScreen({ onLogin, returnNote }) {
  const users = window.FAKE_DATA.users || {};
  const [username, setUsername] = useState("alex");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  // Demo accounts surface every role so the prototype can showcase
  // role-specific UIs (guide, profile action panel, reviewer portal).
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

  return (
    <div className="flex items-center justify-center px-4 py-24 min-h-[600px]" data-screen-label="Login">
      <div className="w-full max-w-sm">
        <p className="font-[var(--font-display)] text-center mb-2 inline-flex items-baseline gap-2 justify-center w-full">
          <span className="font-extrabold text-3xl leading-none tracking-tight">Recenza</span>
        </p>
        <h1 className="text-sm text-[var(--muted-foreground)] text-center mb-8">Вход в аккаунт</h1>

        {returnNote && (
          <div className="mb-6 rounded-md border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-3 py-2.5 text-[12.5px] text-[var(--foreground)] leading-relaxed">
            После входа вы вернётесь к блогу «{returnNote}» — уже подписанными.
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-sm font-medium">Никнейм</label>
            <input
              id="username" type="text" autoComplete="username" required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="nickname"
              className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">Пароль</label>
            <input
              id="password" type="password" autoComplete="current-password" required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
            />
          </div>

          {err && <p className="text-[var(--danger)] text-sm">{err}</p>}

          <button
            type="submit" disabled={loading}
            className="mt-2 px-4 py-2 bg-[var(--accent)] text-[var(--accent-foreground)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Вход…" : "Войти"}
          </button>
        </form>

        <div className="mt-8 pt-5 border-t border-[var(--border)]">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-3">
            Демо-аккаунты
          </p>
          <ul className="space-y-1.5">
            {demoAccounts.map(({ handle, label, hint }) => (
              <li key={handle}>
                <button
                  type="button"
                  onClick={() => { setUsername(handle); setPassword("demo"); }}
                  className="w-full flex items-baseline justify-between gap-2 text-left px-2 py-1.5 -mx-2 rounded hover:bg-[var(--muted)] transition-colors"
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
          <p className="text-[11px] text-[var(--muted-foreground)] mt-3">
            Любой пароль ≥ 3 символов.
          </p>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen });
