// Сводка админ-портала (Фаза 10): KPI-плитки + очередь «Требует внимания» (из реальных pending-сущностей).
import Link from "next/link";
import { getAdminDashboard } from "@/lib/queries/admin";
import { ScreenHead, KpiTile, Card, SectionTitle, EmptyState } from "@/app/admin/_components/primitives";
import { formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const { counts, attention } = await getAdminDashboard();

  return (
    <div>
      <ScreenHead eyebrow="Платформа" title="Сводка" description="Что требует разбора прямо сейчас — и общая картина по платформе." />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiTile label="Открытые жалобы" value={counts.openReports} href="/admin/reports" tone={counts.openReports > 0 ? "warning" : "neutral"} />
        <KpiTile label="Главы на ревью" value={counts.reviewQueue} href="/admin/review" />
        <KpiTile label="Смена ведущего" value={counts.pendingPrimaryChanges} href="/admin/review" tone={counts.pendingPrimaryChanges > 0 ? "warning" : "neutral"} />
        <KpiTile label="Запросы подбора" value={counts.pendingRecruit} href="/admin/recruit" tone={counts.pendingRecruit > 0 ? "warning" : "neutral"} />
        <KpiTile label="Заявки ревьюеров" value={counts.pendingApplications} href="/admin/recruit" tone={counts.pendingApplications > 0 ? "warning" : "neutral"} />
        <KpiTile label="Заблокированные" value={counts.blockedUsers} href="/admin/users" tone={counts.blockedUsers > 0 ? "danger" : "neutral"} />
        <KpiTile label="Пользователи" value={counts.users} href="/admin/users" />
        <KpiTile label="Направления на доске" value={counts.boardCalls} href="/admin/board" />
      </div>

      <Card>
        <SectionTitle count={attention.length}>Требует внимания</SectionTitle>
        {attention.length === 0 ? (
          <EmptyState>Очередь пуста — всё разобрано.</EmptyState>
        ) : (
          <ul className="divide-y divide-[var(--border-secondary)]">
            {attention.map((a, i) => (
              <li key={`${a.kind}-${i}`}>
                <Link
                  href={a.href}
                  className="flex items-center justify-between gap-3 py-2.5 text-[length:var(--type-small)] text-[var(--foreground)] transition-colors hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <span>{a.label}</span>
                  <span className="shrink-0 text-[0.7rem] text-[var(--muted-foreground)]">{formatRelativeTime(a.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
