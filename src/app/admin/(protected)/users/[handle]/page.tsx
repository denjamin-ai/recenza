// Детальная карточка пользователя (Фаза 10): профиль + компетенции + блоги + панель модерации.
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { getAdminUserDetail } from "@/lib/queries/admin";
import { ScreenHead, RolePill, Pill, Card, SkillChips } from "@/app/admin/_components/primitives";
import { UserModeration } from "@/app/admin/_components/user-actions";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const u = await getAdminUserDetail(handle);
  if (!u) notFound();

  return (
    <div className="max-w-3xl">
      <div className="mb-3">
        <BackLink href="/admin/users">К пользователям</BackLink>
      </div>

      <ScreenHead eyebrow={`@${u.handle}`} title={u.displayName} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RolePill role={u.role} />
        {u.isBlocked && <Pill tone="danger">Заблокирован</Pill>}
        {u.commentingBlocked && <Pill tone="warning">Комментарии запрещены</Pill>}
        {u.role === "reviewer" && u.reviewerRating != null && (
          <Pill tone="info">★ {u.reviewerRating.toFixed(1)} ({u.reviewerRatingsN ?? 0})</Pill>
        )}
      </div>

      {u.bio && <p className="mb-4 max-w-2xl text-[length:var(--type-small)] text-[var(--muted-foreground)] [text-wrap:pretty]">{u.bio}</p>}

      {u.role === "reviewer" && u.competencies.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-[length:var(--type-small)] font-medium text-[var(--foreground)]">Компетенции</p>
          <SkillChips skills={u.competencies} />
        </div>
      )}

      <Card>
        <h2 className="mb-3 text-[length:var(--type-small)] font-semibold text-[var(--foreground)]">Модерация</h2>
        <UserModeration
          handle={u.handle}
          role={u.role}
          isBlocked={u.isBlocked}
          commentingBlocked={u.commentingBlocked}
          reviewCapacity={u.reviewCapacity}
          blogs={u.blogs}
        />
      </Card>
    </div>
  );
}
