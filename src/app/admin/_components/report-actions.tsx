"use client";

// Действия по жалобе (Фаза 10): «закрыть» (resolve) или «удалить комментарий» (soft-delete + resolve).
// ui-feedback-4 П5: крупные кнопки-карточки ActionBtn с пояснением (прототип admin-users-reports.jsx).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminMutate } from "@/app/admin/_components/client";
import { ActionBtn } from "@/app/admin/_components/buttons";

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
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <ActionBtn
          tone="neutral"
          disabled={pending}
          onClick={() => run("resolve")}
          title="Оставить контент, закрыть жалобу"
          hint="Жалоба необоснованна — контент и автор остаются."
        />
        {canDeleteComment && (
          <ActionBtn
            tone="danger-strong"
            disabled={pending}
            onClick={() => run("delete_comment")}
            title="Удалить комментарий и закрыть"
            hint="Удалить только этот комментарий, автор продолжит писать."
          />
        )}
      </div>
    </div>
  );
}
