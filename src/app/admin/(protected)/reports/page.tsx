// Жалобы (Фаза 10): открытые (требуют разбора) + закрытые. Клик → детальная страница.
import Link from "next/link";
import { getAdminReports } from "@/lib/queries/admin";
import { ScreenHead, Pill, Card, SectionTitle, EmptyState } from "@/app/admin/_components/primitives";
import { formatRelativeTime } from "@/lib/format";
import type { AdminReportRow } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

function ReportLink({ r }: { r: AdminReportRow }) {
  return (
    <li>
      <Link
        href={`/admin/reports/${r.id}`}
        className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <span className="min-w-0">
          <span className="text-[length:var(--type-small)] text-[var(--foreground)]">{r.reason}</span>
          <span className="ml-2 text-[0.7rem] text-[var(--muted-foreground)]">
            {r.targetType === "comment" ? "комментарий" : r.targetType} · от {r.reporterName ?? "—"}
          </span>
        </span>
        <span className="shrink-0 text-[0.7rem] text-[var(--muted-foreground)]">{formatRelativeTime(r.createdAt)}</span>
      </Link>
    </li>
  );
}

export default async function AdminReportsPage() {
  const reports = await getAdminReports();
  const open = reports.filter((r) => r.status === "open");
  const resolved = reports.filter((r) => r.status === "resolved");

  return (
    <div className="max-w-3xl">
      <ScreenHead eyebrow="Модерация" title="Жалобы" description="Разбор жалоб на контент. Комментарии удаляются мягко (ветка ответов сохраняется)." />

      <div className="space-y-4">
        <Card>
          <SectionTitle count={open.length}>На рассмотрении</SectionTitle>
          {open.length === 0 ? (
            <EmptyState>Открытых жалоб нет.</EmptyState>
          ) : (
            <ul className="divide-y divide-[var(--border-secondary)]">
              {open.map((r) => <ReportLink key={r.id} r={r} />)}
            </ul>
          )}
        </Card>

        {resolved.length > 0 && (
          <Card>
            <SectionTitle count={resolved.length}>Закрытые</SectionTitle>
            <ul className="divide-y divide-[var(--border-secondary)]">
              {resolved.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">{r.reason}</span>
                  <Pill tone="success">Закрыта</Pill>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
