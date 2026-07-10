// Доска ревьюеров (ui-feedback-6 П5, решение владельца — отдельная страница в «Платформе»):
// админ ведёт «вакансии» публичной доски «Ищем ревьюеров» (/board). Форма создания раскрыта
// сразу; отклики с доски и запросы авторов разбираются на «Заявках ревьюеров».
import { getAdminBoardCalls } from "@/lib/queries/admin";
import { ScreenHead, Pill, Card, SectionTitle, EmptyState, SkillChips } from "@/app/admin/_components/primitives";
import { BoardCallCreate, BoardCallActions } from "@/app/admin/_components/board-actions";

export const dynamic = "force-dynamic";

export default async function AdminBoardPage() {
  const calls = await getAdminBoardCalls();

  return (
    <div className="max-w-3xl space-y-4">
      <ScreenHead
        eyebrow="Платформа"
        title="Доска ревьюеров"
        description="Открытые направления (вакансии) публичной доски «Ищем ревьюеров». Отклики кандидатов — на странице «Заявки ревьюеров»."
      />

      <Card>
        <BoardCallCreate />
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle count={calls.length}>Открытые направления</SectionTitle>
          <a
            href="/board"
            target="_blank"
            rel="noopener"
            className="rounded-[var(--radius-sm)] text-[0.75rem] text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Открыть доску →
          </a>
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
    </div>
  );
}
