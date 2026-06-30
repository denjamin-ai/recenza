"use client";

// Действия по жалобе (Фаза 10): «закрыть» (resolve) или «удалить комментарий» (soft-delete + resolve).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminMutate } from "@/app/admin/_components/client";

export function ReportActions({ reportId, canDeleteComment }: { reportId: string; canDeleteComment: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: "resolve" | "delete_comment") {
    setError(null);
    startTransition(async () => {
      const res = await adminMutate(`/api/admin/reports/${reportId}`, "PATCH", { action });
      if (!res.ok) {
        setError(res.error ?? "Не удалось.");
        return;
      }
      router.push("/admin/reports");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("resolve")}
          className="min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
        >
          Оставить контент, закрыть жалобу
        </button>
        {canDeleteComment && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run("delete_comment")}
            className="min-h-9 rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
          >
            Удалить комментарий и закрыть
          </button>
        )}
      </div>
    </div>
  );
}
