// Заявки ревьюеров (Фаза 10): запросы авторов на подбор (approve→доска / reject→причина),
// публичная доска board_calls (ведёт админ) и заявки apply-to-review (accept→роль / decline).
import { getAdminRecruit } from "@/lib/queries/admin";
import { ScreenHead, Pill, Card, SectionTitle, EmptyState, SkillChips } from "@/app/admin/_components/primitives";
import { formatRelativeTime } from "@/lib/format";
import {
  RecruitRequestActions,
  ApplicationActions,
  BoardCallCreate,
  BoardCallActions,
} from "@/app/admin/_components/recruit-actions";

export const dynamic = "force-dynamic";

export default async function AdminRecruitPage() {
  const { requests, calls, applications } = await getAdminRecruit();
  const pendingReq = requests.filter((r) => r.status === "pending");
  const resolvedReq = requests.filter((r) => r.status !== "pending");
  const pendingApps = applications.filter((a) => a.status === "pending");
  const resolvedApps = applications.filter((a) => a.status !== "pending");

  return (
    <div className="max-w-3xl space-y-4">
      <ScreenHead eyebrow="Модерация" title="Заявки ревьюеров" description="Запросы авторов на подбор, публичная доска «Ищем ревьюеров» и отклики с неё." />

      {/* Запросы авторов «найдите ревьюеров» */}
      <Card>
        <SectionTitle count={pendingReq.length}>Запросы на подбор · на рассмотрении</SectionTitle>
        {pendingReq.length === 0 ? (
          <EmptyState>Нет запросов на рассмотрении.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {pendingReq.map((r) => (
              <li key={r.id} className="rounded-[var(--radius-md)] border border-[var(--border-secondary)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[length:var(--type-small)] text-[var(--foreground)]">
                    {r.chapterTitle ?? "Без главы"} <span className="text-[var(--muted-foreground)]">· @{r.byHandle}</span>
                  </p>
                  <span className="text-[0.7rem] text-[var(--muted-foreground)]">{formatRelativeTime(r.createdAt)}</span>
                </div>
                <div className="mt-1.5"><SkillChips skills={r.skills} /></div>
                <RecruitRequestActions id={r.id} defaultArea={r.skills[0] ?? ""} />
              </li>
            ))}
          </ul>
        )}
        {resolvedReq.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-[var(--border-secondary)] pt-3">
            {resolvedReq.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                <span>{r.chapterTitle ?? "Без главы"} · @{r.byHandle}</span>
                <span className="flex items-center gap-2">
                  {r.reason && <span className="text-[0.7rem]">{r.reason}</span>}
                  <Pill tone={r.status === "approved" ? "success" : "danger"}>{r.status === "approved" ? "Одобрен" : "Отклонён"}</Pill>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Публичная доска. ui-feedback-5 П5: создание направления — НАВЕРХУ секции (владелец не
          находил кнопку под списком) + ссылка на публичную доску для сверки результата. */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle count={calls.length}>Доска «Ищем ревьюеров»</SectionTitle>
          <a
            href="/board"
            target="_blank"
            rel="noopener"
            className="rounded-[var(--radius-sm)] text-[0.75rem] text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Открыть доску →
          </a>
        </div>
        <div className="mb-3">
          <BoardCallCreate />
        </div>
        {calls.length === 0 ? (
          <EmptyState>Доска пуста — добавьте первое направление.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {calls.map((c) => (
              <li key={c.id} className="rounded-[var(--radius-md)] border border-[var(--border-secondary)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-[var(--foreground)]">{c.area}</span>
                    {c.hot && <Pill tone="danger">срочно</Pill>}
                    <span className="text-[0.7rem] text-[var(--muted-foreground)]">в ожидании: {c.waiting}</span>
                  </span>
                  <BoardCallActions id={c.id} hot={c.hot} />
                </div>
                {c.skills.length > 0 && <div className="mt-1.5"><SkillChips skills={c.skills} /></div>}
                {c.note && <p className="mt-1.5 text-[0.7rem] text-[var(--muted-foreground)]">{c.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Заявки с доски */}
      <Card>
        <SectionTitle count={pendingApps.length}>Отклики с доски · на рассмотрении</SectionTitle>
        {pendingApps.length === 0 ? (
          <EmptyState>Нет новых откликов.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {pendingApps.map((a) => (
              <li key={a.id} className="rounded-[var(--radius-md)] border border-[var(--border-secondary)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[length:var(--type-small)] text-[var(--foreground)]">
                    {a.applicantName ?? a.name ?? "Гость"}
                    {a.byHandle ? <span className="text-[var(--muted-foreground)]"> · @{a.byHandle}</span> : <span className="text-[var(--muted-foreground)]"> · гость</span>}
                    {a.area && <span className="text-[var(--muted-foreground)]"> · {a.area}</span>}
                  </p>
                  <span className="text-[0.7rem] text-[var(--muted-foreground)]">{formatRelativeTime(a.createdAt)}</span>
                </div>
                {a.skills.length > 0 && <div className="mt-1.5"><SkillChips skills={a.skills} /></div>}
                {a.message && <p className="mt-1.5 text-[length:var(--type-small)] text-[var(--muted-foreground)] [text-wrap:pretty]">{a.message}</p>}
                <ApplicationActions id={a.id} canPromote={!!a.byHandle && a.applicantRole !== "reviewer" && a.applicantRole !== "admin"} />
              </li>
            ))}
          </ul>
        )}
        {resolvedApps.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-[var(--border-secondary)] pt-3">
            {resolvedApps.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                <span>{a.applicantName ?? a.name ?? "Гость"}{a.area ? ` · ${a.area}` : ""}</span>
                <Pill tone={a.status === "accepted" ? "success" : "danger"}>{a.status === "accepted" ? "Принят" : "Отклонён"}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
