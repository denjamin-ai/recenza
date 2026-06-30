"use client";

// Клиентские действия модерации пользователя (Фаза 10): баны, ограничение комментариев, ёмкость
// ревью, скрытие/показ его блогов. Каждое действие → admin-API + router.refresh() в startTransition.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminMutate } from "@/app/admin/_components/client";

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

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Не удалось.");
        return;
      }
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
          className={`min-h-9 rounded-[var(--radius-md)] border px-3 py-2 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60 ${
            props.isBlocked
              ? "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
              : "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)] hover:opacity-90"
          }`}
        >
          {props.isBlocked ? "Разблокировать" : "Заблокировать (бан)"}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => patchUser({ commentingBlocked: !props.commentingBlocked }))}
          className="min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
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
                  className="shrink-0 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
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
