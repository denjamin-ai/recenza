// Глобальная очередь ревью (Фаза 10). Ф15:
//   • сверху — ЗАЯВКИ (`review_requests`): что висит без ревьюера и что просрочено по SLA,
//     с ручным назначением (подстраховка холодного старта);
//   • ниже — активные ревью-сессии с force-approve и снятием ревьюеров;
//   • в самом низу — журнал снятий (`getRemovedReviewers()` был написан в Ф10 и не вызывался
//     ни разу — З-55).
// ⚠️ Ссылка на главу ведёт на АДМИНСКИЙ read-only просмотр `/admin/review/[chapterId]`: раньше
// она вела в кабинет автора, откуда `requireAuthorPage` редиректил админа обратно в /admin (З-54).
import Link from "next/link";
import { getAdminReviewQueue, getAssignableReviewers, getRemovedReviewers } from "@/lib/queries/admin";
import { getAdminRequestQueue } from "@/lib/queries/review-requests";
import { ScreenHead, Pill, Card, EmptyState, SectionTitle, SkillChips } from "@/app/admin/_components/primitives";
import { ReviewActions } from "@/app/admin/_components/review-actions";
import { RequestAssign } from "@/app/admin/_components/request-assign";
import { formatDueLabel, slaState } from "@/lib/review-sla";
import { formatRelativeTime } from "@/lib/format";
import { skillMatch } from "@/lib/reviewer-match";

export const dynamic = "force-dynamic";

/**
 * Момент рендера в Unix seconds — база для SLA-чипов очереди.
 * ⚠️ Вынесено из тела компонента: `react-hooks/purity` запрещает звать `Date.now()` прямо в
 * рендере (тот же приём, что в кабинете ревьюера). Страница `force-dynamic`, значение честно
 * пересчитывается на каждый запрос.
 */
function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export default async function AdminReviewPage() {
  const now = nowSeconds();
  const [items, requests, removed, reviewers] = await Promise.all([
    getAdminReviewQueue(),
    getAdminRequestQueue(now),
    getRemovedReviewers(),
    getAssignableReviewers(),
  ]);

  return (
    <div className="max-w-3xl">
      <ScreenHead
        eyebrow="Модерация"
        title="Ревью глав"
        description="Заявки в очереди и активные ревью-сессии. Заявку можно закрыть руками — назначить ревьюера; главу можно опубликовать в обход ревью (force-approve) или снять с неё ревьюера."
      />

      <div className="mb-6">
        <SectionTitle count={requests.length}>Заявки в очереди</SectionTitle>
        {requests.length === 0 ? (
          <EmptyState>Открытых заявок нет.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => {
              const sla = slaState(r.dueAt, now);
              return (
                <li key={r.id} className="rounded-[var(--radius-md)] border border-[var(--border-secondary)] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/review/${r.chapterId}`}
                        className="font-medium text-[var(--foreground)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      >
                        {r.chapterTitle}
                      </Link>
                      <p className="text-[0.7rem] text-[var(--muted-foreground)]">
                        {r.blogTitle} · {r.authorName} · v{r.revisionNumber} · подана {formatRelativeTime(r.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Pill tone={r.status === "open" ? "warning" : "info"}>
                        {r.status === "open" ? "Ждёт ревьюера" : `Взял ${r.claimedByName}`}
                      </Pill>
                      {r.channel === "editorial" && <Pill tone="danger">Эскалирована</Pill>}
                      {r.dueAt != null && (
                        <Pill tone={sla === "overdue" ? "danger" : sla === "soon" ? "warning" : "neutral"}>
                          {formatDueLabel(r.dueAt, now)}
                        </Pill>
                      )}
                    </div>
                  </div>
                  {r.skills.length > 0 && (
                    <div className="mt-2">
                      <SkillChips skills={r.skills} />
                    </div>
                  )}
                  {r.note && (
                    <p className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] [text-wrap:pretty]">
                      {r.note}
                    </p>
                  )}
                  {r.status === "open" && (
                    <RequestAssign
                      requestId={r.id}
                      authorHandle={r.authorHandle}
                      skills={r.skills}
                      // Тот же `skillMatch`, что сортирует очередь ревьюера: редакция видит те же
                      // проценты совпадения, что увидел бы сам ревьюер (Ф14, чистая функция).
                      reviewers={reviewers
                        .map((c) => ({
                          handle: c.handle,
                          displayName: c.displayName,
                          load: c.load,
                          capacity: c.capacity,
                          matchPct: skillMatch(c.competencies, r.skills).pct,
                        }))
                        .sort((a, b) => b.matchPct - a.matchPct || a.displayName.localeCompare(b.displayName, "ru"))}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mb-6">
        <SectionTitle count={items.length}>Активные ревью</SectionTitle>
        {items.length === 0 ? (
          <EmptyState>Нет глав в активном ревью.</EmptyState>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              // ⚠️ Card (= <section>) — РОВНО одна на главу: спеки находят карточку главы
              // локатором `section`, отфильтрованным по ссылке с её названием.
              <Card key={it.chapterId}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/review/${it.chapterId}`}
                      className="font-medium text-[var(--foreground)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      {it.chapterTitle}
                    </Link>
                    <p className="text-[0.7rem] text-[var(--muted-foreground)]">{it.blogTitle} · {it.authorName} · v{it.revisionNumber}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Pill tone={it.reviewStatus === "changes-requested" ? "warning" : "info"}>
                      {it.reviewStatus === "changes-requested"
                        ? "Нужны правки"
                        : it.reviewStatus === "requested"
                          ? "Ждёт ревьюера"
                          : it.reviewStatus === "reviewed"
                            ? "Ревью пройдено"
                            : "На ревью"}
                    </Pill>
                    <Pill tone={it.reviewerCount > 0 && it.approvedCount === it.reviewerCount ? "success" : "neutral"}>
                      {it.approvedCount}/{it.reviewerCount} approve
                    </Pill>
                  </div>
                </div>

                <ReviewActions chapterId={it.chapterId} reviewers={it.reviewers} />
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionTitle count={removed.length}>Журнал: снятия с ревью</SectionTitle>
        {removed.length === 0 ? (
          <EmptyState>Снятий не было.</EmptyState>
        ) : (
          <ul className="divide-y divide-[var(--border-secondary)]">
            {removed.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[length:var(--type-small)]">
                <span className="text-[var(--foreground)]">
                  @{r.handle} · /{r.blogSlug}/{r.chapterSlug}
                  {r.reason ? <span className="text-[var(--muted-foreground)]"> · {r.reason}</span> : null}
                </span>
                <span className="text-[0.7rem] text-[var(--muted-foreground)]">{formatRelativeTime(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
