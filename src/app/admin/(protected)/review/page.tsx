// Глобальная очередь глав на ревью (Фаза 10): прогресс вердиктов, force-approve, смена ведущего,
// снятие ревьюеров. Только активные ревизии (under-review|changes-requested).
import Link from "next/link";
import { getAdminReviewQueue } from "@/lib/queries/admin";
import { ScreenHead, Pill, Card, EmptyState } from "@/app/admin/_components/primitives";
import { ReviewActions } from "@/app/admin/_components/review-actions";

export const dynamic = "force-dynamic";

export default async function AdminReviewPage() {
  const items = await getAdminReviewQueue();

  return (
    <div className="max-w-3xl">
      <ScreenHead eyebrow="Модерация" title="Ревью глав" description="Очередь глав на ревью. Можно опубликовать в обход гейта (force-approve), сменить ведущего, снять ревьюера." />

      {items.length === 0 ? (
        <EmptyState>Нет глав в активном ревью.</EmptyState>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <Card key={it.chapterId}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/author/blog/${it.blogSlug}/${it.chapterSlug}/review`}
                    className="font-medium text-[var(--foreground)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    {it.chapterTitle}
                  </Link>
                  <p className="text-[0.7rem] text-[var(--muted-foreground)]">{it.blogTitle} · {it.authorName} · v{it.revisionNumber}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Pill tone={it.status === "changes-requested" ? "warning" : "info"}>
                    {it.status === "changes-requested" ? "Нужны правки" : "На ревью"}
                  </Pill>
                  <Pill tone={it.reviewerCount > 0 && it.approvedCount === it.reviewerCount ? "success" : "neutral"}>
                    {it.approvedCount}/{it.reviewerCount} approve
                  </Pill>
                </div>
              </div>

              <ReviewActions chapterId={it.chapterId} reviewers={it.reviewers} pendingPrimaryChange={it.pendingPrimaryChange} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
