"use client";

// Клиентские действия модерации пользователя (Фаза 10): баны, ограничение комментариев, ёмкость
// ревью, смена пароля, скрытие/показ его блогов. Каждое действие → admin-API + router.refresh()
// в startTransition.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminMutate } from "@/app/admin/_components/client";
import { btnDangerSoft, btnSecondary } from "@/app/admin/_components/buttons";

interface BlogRow {
  id: string;
  slug: string;
  title: string;
  hidden: boolean;
}

export function UserModeration(props: {
  handle: string;
  role: string;
  isBlocked: boolean;
  commentingBlocked: boolean;
  reviewCapacity: number;
  blogs: BlogRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordDone, setPasswordDone] = useState(false);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Не удалось.");
        return;
      }
      after?.();
      router.refresh();
    });
  }

  const patchUser = (body: Record<string, unknown>) => adminMutate(`/api/admin/users/${props.handle}`, "PATCH", body);

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => patchUser({ isBlocked: !props.isBlocked }))}
          className={props.isBlocked ? btnSecondary : btnDangerSoft}
        >
          {props.isBlocked ? "Разблокировать" : "Заблокировать (бан)"}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => patchUser({ commentingBlocked: !props.commentingBlocked }))}
          className={btnSecondary}
        >
          {props.commentingBlocked ? "Разрешить комментарии" : "Запретить комментарии"}
        </button>
      </div>

      {props.role === "reviewer" && (
        <div className="flex items-center gap-2 text-[length:var(--type-small)] text-[var(--foreground)]">
          <span>Ёмкость ревью:</span>
          <button
            type="button"
            aria-label="Уменьшить ёмкость"
            disabled={pending || props.reviewCapacity <= 0}
            onClick={() => run(() => patchUser({ reviewCapacity: props.reviewCapacity - 1 }))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50"
          >
            −
          </button>
          <span className="min-w-6 text-center font-medium">{props.reviewCapacity}</span>
          <button
            type="button"
            aria-label="Увеличить ёмкость"
            disabled={pending || props.reviewCapacity >= 50}
            onClick={() => run(() => patchUser({ reviewCapacity: props.reviewCapacity + 1 }))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50"
          >
            +
          </button>
        </div>
      )}

      <div>
        <p className="mb-2 text-[length:var(--type-small)] font-medium text-[var(--foreground)]">Сменить пароль</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordDone(false);
            }}
            placeholder="Новый пароль (мин. 8 символов)"
            aria-label="Новый пароль"
            autoComplete="new-password"
            className="h-9 w-64 max-w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 text-[length:var(--type-small)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          />
          <button
            type="button"
            disabled={pending || password.length < 8}
            onClick={() =>
              run(
                () => patchUser({ password }),
                () => {
                  setPassword("");
                  setPasswordDone(true);
                },
              )
            }
            className={btnSecondary}
          >
            Задать пароль
          </button>
          {passwordDone && (
            <span role="status" className="text-[length:var(--type-small)] text-[var(--success)]">
              Пароль обновлён
            </span>
          )}
        </div>
        <p className="mt-1 text-[0.7rem] text-[var(--muted-foreground)]">
          Активные сессии пользователя не завершаются.
        </p>
      </div>

      {props.blogs.length > 0 && (
        <div>
          <p className="mb-2 text-[length:var(--type-small)] font-medium text-[var(--foreground)]">Блоги автора</p>
          <ul className="space-y-1.5">
            {props.blogs.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-secondary)] px-3 py-2">
                <span className="truncate text-[length:var(--type-small)] text-[var(--foreground)]">
                  {b.title}
                  {b.hidden && <span className="ml-2 text-[0.7rem] text-[var(--danger)]">скрыт</span>}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => adminMutate(`/api/admin/blogs/${b.id}`, "PATCH", { hidden: !b.hidden }))}
                  className={`shrink-0 ${btnSecondary}`}
                >
                  {b.hidden ? "Показать" : "Скрыть"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
