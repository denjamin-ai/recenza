// Детальная жалоба (Фаза 10): причина, заявитель, контекст цели + действия разбора.
// Ф15: целей стало три (комментарий / блог / ревью), у каждой свой контекст; появились
// комментарий заявителя, «о ком» у жалоб на ревью и действие «Скрыть блог» (З-51/З-61).
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { getAdminReportDetail } from "@/lib/queries/admin";
import { ScreenHead, Pill, Card } from "@/app/admin/_components/primitives";
import { ReportActions } from "@/app/admin/_components/report-actions";
import { formatRelativeTime } from "@/lib/format";
import { REPORT_TARGET_LABEL, reasonLabel } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getAdminReportDetail(id);
  if (!r) notFound();

  const isOpen = r.status === "open";
  const target = r.target;
  const commentDeleted = target.kind === "comment" && target.deletedAt != null;

  return (
    <div className="max-w-2xl">
      <div className="mb-3">
        <BackLink href="/admin/reports">К жалобам</BackLink>
      </div>

      <ScreenHead eyebrow="Жалоба" title={reasonLabel(r.reason)} />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
        <Pill tone={isOpen ? "warning" : "success"}>{isOpen ? "На рассмотрении" : "Закрыта"}</Pill>
        <span>Цель: {REPORT_TARGET_LABEL[r.targetType]}</span>
        <span>· Заявитель: {r.reporterName ?? "—"}</span>
        <span>· {formatRelativeTime(r.createdAt)}</span>
        {r.resolvedAt && <span>· закрыта {formatRelativeTime(r.resolvedAt)}</span>}
      </div>

      {r.note && (
        <Card className="mb-4">
          <h2 className="mb-2 text-[length:var(--type-small)] font-semibold text-[var(--foreground)]">
            Комментарий заявителя
          </h2>
          <p className="text-[length:var(--type-small)] text-[var(--foreground)] [text-wrap:pretty]">{r.note}</p>
        </Card>
      )}

      {target.kind === "comment" && (
        <Card className="mb-4">
          <h2 className="mb-2 text-[length:var(--type-small)] font-semibold text-[var(--foreground)]">Комментарий</h2>
          <blockquote className="border-l-2 border-[var(--border)] pl-3 text-[length:var(--type-small)] text-[var(--foreground)] [text-wrap:pretty]">
            {commentDeleted ? <span className="italic text-[var(--muted-foreground)]">[удалён]</span> : target.text}
          </blockquote>
          <p className="mt-2 text-[0.7rem] text-[var(--muted-foreground)]">
            {target.authorName ?? "—"} · /{target.blogSlug}/{target.chapterSlug} · версия v{target.revision}
          </p>
        </Card>
      )}

      {target.kind === "blog" && (
        <Card className="mb-4">
          <h2 className="mb-2 text-[length:var(--type-small)] font-semibold text-[var(--foreground)]">Блог</h2>
          <Link
            href={`/blog/${target.slug}`}
            className="rounded-[var(--radius-sm)] font-medium text-[var(--foreground)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {target.title}
          </Link>
          <p className="mt-1 text-[0.7rem] text-[var(--muted-foreground)]">
            {target.authorName}
            {target.hidden ? " · уже скрыт" : ""}
          </p>
        </Card>
      )}

      {target.kind === "review" && (
        <Card className="mb-4">
          <h2 className="mb-2 text-[length:var(--type-small)] font-semibold text-[var(--foreground)]">Ревью</h2>
          <p className="text-[length:var(--type-small)] text-[var(--foreground)]">
            {target.chapterTitle} · автор {target.authorName}
          </p>
          <p className="mt-1 text-[0.7rem] text-[var(--muted-foreground)]">
            Жалоба на участника: {target.aboutName ?? "—"}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-[length:var(--type-small)]">
            <Link
              href={`/admin/review/${target.chapterId}`}
              className="rounded-[var(--radius-sm)] text-[var(--accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Открыть ревью
            </Link>
            {r.aboutHandle && (
              <Link
                href={`/admin/users/${r.aboutHandle}`}
                className="rounded-[var(--radius-sm)] text-[var(--accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                Карточка @{r.aboutHandle}
              </Link>
            )}
          </div>
        </Card>
      )}

      {target.kind === "unknown" && (
        <Card className="mb-4">
          <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            Цель не найдена (возможно, уже удалена).
          </p>
        </Card>
      )}

      {isOpen ? (
        <Card>
          <h2 className="mb-3 text-[length:var(--type-small)] font-semibold text-[var(--foreground)]">Решение</h2>
          <ReportActions
            reportId={r.id}
            canDeleteComment={target.kind === "comment" && !commentDeleted}
            canHideBlog={target.kind === "blog" && !target.hidden}
          />
        </Card>
      ) : (
        <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">Жалоба закрыта.</p>
      )}
    </div>
  );
}
