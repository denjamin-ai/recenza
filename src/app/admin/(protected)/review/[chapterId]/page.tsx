// Read-only просмотр ревью админом (Фаза 15, З-54).
//
// До неё «ссылка на ревью» из очереди вела на `/author/blog/.../review`, где `requireAuthorPage`
// редиректил админа обратно в `/admin` — мёртвая ссылка.
//
// ⚠️ `resolveReviewAccess` НЕ трогаем ни строкой: он намеренно исключает админа (админ — не
// участник ревью, Фаза 10), и на нём стоят 8 мутирующих роутов `/api/review/**`. «Read-only»
// здесь обеспечивается тем, что страница вообще не содержит мутирующих поверхностей: это RSC
// без единой кнопки действия. Клиентский `ReviewScreen` переиспользовать нельзя — он шлёт
// heartbeat и рисует ActionBar/PublishModal, которым админ получил бы 401/403.
// Действия админа (force-approve, снятие ревьюера) остались на списковой странице `/admin/review`.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getReviewSession } from "@/lib/queries/review";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { ScreenHead, Card, Pill, SectionTitle, EmptyState, SkillChips } from "@/app/admin/_components/primitives";
import { BackLink } from "@/components/back-link";
import { VerifiedChip } from "@/components/reader/verified-badge";
import { PUBLICATION_META, reviewMeta } from "@/lib/review-status";
import { formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminReviewViewPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;
  const session = await getReviewSession(chapterId);
  if (!session) notFound();

  const { blog, chapter, revision, reviewers, threads, chat } = session;

  return (
    <div className="max-w-3xl">
      <div className="mb-3">
        <BackLink href="/admin/review">К очереди ревью</BackLink>
      </div>

      <ScreenHead
        eyebrow="Модерация · только чтение"
        title={chapter.title}
        description={`${blog.title} · ${blog.authorName} · версия v${revision.number}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill tone={revision.status === "published" ? "success" : "neutral"}>
          {PUBLICATION_META[revision.status].label}
        </Pill>
        {/* `none` бейджа не имеет — ревью не запрашивали (единый источник подписей). */}
        {reviewMeta(revision.reviewStatus) && (
          <Pill tone="info">{reviewMeta(revision.reviewStatus)!.label}</Pill>
        )}
        {revision.verifiedTier && <VerifiedChip tier={revision.verifiedTier} size="sm" />}
        <Link
          href={`/blog/${blog.slug}/${chapter.slug}`}
          className="rounded-[var(--radius-sm)] text-[length:var(--type-small)] text-[var(--accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Публичная глава →
        </Link>
        <Link
          href={`/u/${blog.authorSlug}`}
          className="rounded-[var(--radius-sm)] text-[length:var(--type-small)] text-[var(--accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Автор →
        </Link>
      </div>

      {chapter.skills.length > 0 && (
        <div className="mb-4">
          <SkillChips skills={chapter.skills} />
        </div>
      )}

      <Card className="mb-4">
        <SectionTitle count={reviewers.length}>Состав ревью</SectionTitle>
        {reviewers.length === 0 ? (
          <EmptyState>Ревьюеры не назначены.</EmptyState>
        ) : (
          <ul className="divide-y divide-[var(--border-secondary)]">
            {reviewers.map((r) => (
              <li key={r.handle} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link
                  href={`/admin/users/${r.handle}`}
                  className="rounded-[var(--radius-sm)] text-[length:var(--type-small)] text-[var(--foreground)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  {r.displayName} <span className="text-[var(--muted-foreground)]">@{r.handle}</span>
                </Link>
                <Pill tone={r.verdict === "approve" ? "success" : r.verdict === "request-changes" ? "warning" : "neutral"}>
                  {r.verdict === "approve" ? "Одобрил" : r.verdict === "request-changes" ? "Нужны правки" : "Ждём"}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4">
        <SectionTitle count={threads.length}>Треды замечаний</SectionTitle>
        {threads.length === 0 ? (
          <EmptyState>Замечаний нет.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {threads.map((t) => (
              <li key={t.id} className="rounded-[var(--radius-md)] border border-[var(--border-secondary)] p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[0.7rem] text-[var(--muted-foreground)]">
                    {t.fromName} · {formatRelativeTime(t.createdAt)}
                  </span>
                  <Pill tone={t.status === "resolved" ? "success" : "warning"}>
                    {t.status === "resolved" ? "Решён" : "Открыт"}
                  </Pill>
                </div>
                <p className="text-[length:var(--type-small)] text-[var(--foreground)] [text-wrap:pretty]">{t.text}</p>
                {t.replies.length > 0 && (
                  <ul className="mt-2 space-y-1.5 border-l border-[var(--border)] pl-3">
                    {t.replies.map((rep) => (
                      <li key={rep.id} className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                        <span className="text-[var(--foreground)]">{rep.fromName}:</span> {rep.text}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4">
        <SectionTitle count={chat.length}>Чат сессии</SectionTitle>
        {chat.length === 0 ? (
          <EmptyState>Сообщений нет.</EmptyState>
        ) : (
          <ul className="space-y-1.5">
            {chat.map((m) => (
              <li key={m.id} className="text-[length:var(--type-small)]">
                <span className="text-[var(--foreground)]">{m.fromName}:</span>{" "}
                <span className="text-[var(--muted-foreground)]">{m.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Текст версии</SectionTitle>
        <div className="prose-review mt-2">
          <BlockRenderer blocks={revision.blocks} prev={revision.prevBlocks} mode="review" />
        </div>
      </Card>
    </div>
  );
}
