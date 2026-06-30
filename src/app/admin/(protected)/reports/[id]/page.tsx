// Детальная жалоба (Фаза 10): причина, заявитель, контекст цели (комментарий) + действия разбора.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminReportDetail } from "@/lib/queries/admin";
import { ScreenHead, Pill, Card } from "@/app/admin/_components/primitives";
import { ReportActions } from "@/app/admin/_components/report-actions";
import { formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getAdminReportDetail(id);
  if (!r) notFound();

  const isOpen = r.status === "open";
  const commentDeleted = r.comment?.deletedAt != null;

  return (
    <div className="max-w-2xl">
      <Link href="/admin/reports" className="mb-4 inline-block text-[length:var(--type-small)] text-[var(--accent)] hover:underline">
        ← К жалобам
      </Link>

      <ScreenHead eyebrow="Жалоба" title={r.reason} />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
        <Pill tone={isOpen ? "warning" : "success"}>{isOpen ? "На рассмотрении" : "Закрыта"}</Pill>
        <span>Цель: {r.targetType === "comment" ? "комментарий" : r.targetType}</span>
        <span>· Заявитель: {r.reporterName ?? "—"}</span>
        <span>· {formatRelativeTime(r.createdAt)}</span>
      </div>

      {r.targetType === "comment" && (
        <Card className="mb-4">
          <h2 className="mb-2 text-[length:var(--type-small)] font-semibold text-[var(--foreground)]">Комментарий</h2>
          {r.comment ? (
            <>
              <blockquote className="border-l-2 border-[var(--border)] pl-3 text-[length:var(--type-small)] text-[var(--foreground)] [text-wrap:pretty]">
                {commentDeleted ? <span className="italic text-[var(--muted-foreground)]">[удалён]</span> : r.comment.text}
              </blockquote>
              <p className="mt-2 text-[0.7rem] text-[var(--muted-foreground)]">
                {r.comment.authorName ?? "—"} · /{r.comment.blogSlug}/{r.comment.chapterSlug} · версия v{r.comment.revision}
              </p>
            </>
          ) : (
            <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">Комментарий не найден (возможно, уже удалён).</p>
          )}
        </Card>
      )}

      {isOpen ? (
        <Card>
          <h2 className="mb-3 text-[length:var(--type-small)] font-semibold text-[var(--foreground)]">Решение</h2>
          <ReportActions reportId={r.id} canDeleteComment={r.targetType === "comment" && !!r.comment && !commentDeleted} />
        </Card>
      ) : (
        <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">Жалоба закрыта.</p>
      )}
    </div>
  );
}
