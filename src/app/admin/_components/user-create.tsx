"use client";

// Форма «Новый пользователь» (Фаза 12, альфа): админ создаёт аккаунт и сообщает пароль лично.
// Сворачиваемая панель над таблицей пользователей; успех → сброс формы + router.refresh().

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminMutate } from "@/app/admin/_components/client";

const inputCls =
  "min-h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[length:var(--type-small)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export function UserCreate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  // Фаза 13: вместо одной роли — независимые возможности. Авторство включено по умолчанию
  // (решение владельца), ревьюерство выдаётся явно.
  const [canAuthor, setCanAuthor] = useState(true);
  const [isReviewer, setIsReviewer] = useState(false);
  // Ф14: кто привёл человека. От этого поля зависит УРОВЕНЬ БЕЙДЖА его ревью: приведённый автором
  // эксперт даёт «Проверено приглашённым экспертом», независимый — «Проверено на Recenza».
  // Заполняется при разборе анкеты с инвайт-ссылки (там же указан handle пригласившего).
  const [introducedBy, setIntroducedBy] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    startTransition(async () => {
      const res = await adminMutate("/api/admin/users", "POST", {
        handle,
        displayName,
        password,
        canAuthor,
        isReviewer,
        introducedBy: introducedBy.trim() ? introducedBy.trim() : undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Не удалось создать пользователя.");
        return;
      }
      setDone(`Пользователь @${handle.trim().toLowerCase()} создан. Сообщите ему пароль лично.`);
      setHandle("");
      setDisplayName("");
      setPassword("");
      setCanAuthor(true);
      setIsReviewer(false);
      setIntroducedBy("");
      router.refresh();
    });
  }

  return (
    <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--border-secondary)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between px-4 py-2 text-left text-[length:var(--type-small)] font-medium text-[var(--foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        Новый пользователь
        <span aria-hidden className="text-[var(--muted-foreground)]">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <form onSubmit={submit} className="space-y-3 border-t border-[var(--border-secondary)] px-4 py-3">
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)] [text-wrap:pretty]">
            Самостоятельной регистрации нет: доступ выдаёт администратор. Новый аккаунт по
            умолчанию может вести блоги; снимите отметку, если это только читатель. Возможности
            меняются и позже — в карточке пользователя.
          </p>
          {error && (
            <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]">
              {error}
            </p>
          )}
          {done && (
            <p role="status" className="rounded-[var(--radius-md)] border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--success)]">
              {done}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[length:var(--type-small)] text-[var(--muted-foreground)]">Хэндл</span>
              <input
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                pattern="[a-z0-9_\-]{3,30}"
                title="3–30 символов: a-z, 0-9, «_», «-»"
                placeholder="ivan_petrov"
                autoComplete="off"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[length:var(--type-small)] text-[var(--muted-foreground)]">Отображаемое имя</span>
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                placeholder="Иван Петров"
                autoComplete="off"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                Кто пригласил (необязательно)
              </span>
              <input
                value={introducedBy}
                onChange={(e) => setIntroducedBy(e.target.value)}
                placeholder="handle автора"
                autoComplete="off"
                className={inputCls}
              />
              <span className="mt-1 block text-[0.7rem] text-[var(--muted-foreground)] [text-wrap:pretty]">
                Заполняется для эксперта, пришедшего по инвайт-ссылке: его ревью получит пометку
                «Проверено приглашённым экспертом».
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-[length:var(--type-small)] text-[var(--muted-foreground)]">Пароль (мин. 8 символов)</span>
              <input
                required
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={200}
                autoComplete="off"
                className={`${inputCls} font-mono`}
              />
            </label>
            <fieldset className="block">
              <legend className="mb-1 block text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                Возможности
              </legend>
              <span className="flex flex-wrap items-center gap-4 pt-1.5">
                <label className="inline-flex min-h-9 items-center gap-2 text-[length:var(--type-small)]">
                  <input
                    type="checkbox"
                    checked={canAuthor}
                    onChange={(e) => setCanAuthor(e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  Автор
                </label>
                <label className="inline-flex min-h-9 items-center gap-2 text-[length:var(--type-small)]">
                  <input
                    type="checkbox"
                    checked={isReviewer}
                    onChange={(e) => setIsReviewer(e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  Ревьюер
                </label>
              </span>
            </fieldset>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {pending ? "Создаю…" : "Создать пользователя"}
          </button>
        </form>
      )}
    </div>
  );
}
