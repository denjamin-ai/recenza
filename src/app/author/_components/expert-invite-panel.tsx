// «Пригласить эксперта» (Фаза 14, канал 2) — автор выпускает персональную ссылку для рецензента
// ИЗВНЕ платформы. Нужен, когда в очереди нет никого с подходящими компетенциями: узкая тема может
// не иметь ревьюера на площадке вовсе.
//
// Плата за канал — прозрачность: ревью от приведённого автором эксперта даёт бейдж уровня
// «Проверено приглашённым экспертом», который не пускает блог на главную. Панель говорит это прямо,
// чтобы выбор канала был осознанным, а не выглядел как «обходной путь».
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AuthorInviteView } from "@/lib/queries/expert-invites";
import { IconCheck, IconLink, IconTrash } from "@/components/icons";

const STATUS_LABEL: Record<AuthorInviteView["status"], string> = {
  pending: "Ждёт ответа",
  used: "Анкета отправлена",
  revoked: "Отозвана",
  expired: "Истекла",
};

function formatDate(unixSeconds: number): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(unixSeconds * 1000),
  );
}

export function ExpertInvitePanel({ invites, now }: { invites: AuthorInviteView[]; now: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const active = invites.filter((i) => i.status === "pending" && i.expiresAt > now);

  async function create() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/author/expert-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось создать ссылку.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Сетевая ошибка. Проверьте соединение.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/author/expert-invites/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Не удалось отозвать ссылку.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Сетевая ошибка. Проверьте соединение.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Не удалось скопировать — скопируйте ссылку вручную из адреса ниже.");
    }
  }

  return (
    <section aria-label="Пригласить эксперта">
      <h2 className="text-[length:var(--type-small)] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
        Пригласить эксперта
      </h2>
      <p className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] [text-wrap:pretty]">
        Если в очереди нет ревьюера с нужными навыками — позовите своего. Ссылка ведёт на анкету;
        аккаунт заведёт редакция. Такое ревью помечается как «Проверено приглашённым экспертом».
      </p>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]"
        >
          {error}
        </p>
      )}

      {active.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {active.map((inv) => (
            <li
              key={inv.id}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] p-3"
            >
              <p className="text-[length:var(--type-small)] text-[var(--foreground)]">
                {inv.chapterTitle ? `Для главы «${inv.chapterTitle}»` : "Приглашение в платформу"}
              </p>
              <p className="mt-0.5 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                {STATUS_LABEL[inv.status]} · действует до {formatDate(inv.expiresAt)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => copy(inv.token)}
                  disabled={busy || pending}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:border-[var(--accent)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  {copied === inv.token ? (
                    <>
                      <IconCheck className="h-3.5 w-3.5" /> Скопировано
                    </>
                  ) : (
                    <>
                      <IconLink className="h-3.5 w-3.5" /> Скопировать ссылку
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => revoke(inv.id)}
                  disabled={busy || pending}
                  aria-label="Отозвать ссылку"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--danger)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
                >
                  <IconTrash className="h-3.5 w-3.5" /> Отозвать
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={create}
        disabled={busy || pending}
        className="mt-3 inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-[length:var(--type-small)] font-medium text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        {busy ? "Создаём…" : "Создать ссылку"}
      </button>
    </section>
  );
}
