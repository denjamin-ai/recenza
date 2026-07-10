// Публичный профиль /u/[slug]. Автор → «Об авторе» + блоги; ревьюер → «что отрецензировал».
// Читатель/админ/заблокированный → 404 (нет публичного профиля).
// Шапка — по прототипу ProfileScreen (feed.jsx): back вверху, карточка с аватаром, пилюлей роли,
// «на платформе с …», соц-иконками и статистикой. «Изменить профиль» убран (ui-feedback-6 П3) —
// редактирование «Об авторе» живёт кнопкой внутри одноимённого таба (AuthorProfile).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { AvatarChanger } from "@/components/profile/avatar-changer";
import { getProfileBySlug } from "@/lib/queries/profile";
import { getPortfolioForAuthor } from "@/lib/queries/author";
import { getCurrentUser } from "@/lib/auth";
import { AuthorProfile } from "@/components/profile/author-profile";
import { ReviewerProfile } from "@/components/profile/reviewer-profile";
import { BackLink } from "@/components/back-link";
import { IconGitHub, IconGlobe, IconTelegram } from "@/components/icons";
import { formatCompact, formatMonthYear } from "@/lib/format";
import { absoluteUrl, truncate } from "@/lib/seo";
import type { LinkItem } from "@/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);
  if (!profile) return { title: "Профиль не найден" };

  const roleLabel = profile.kind === "author" ? "Автор" : "Ревьюер";
  const description = truncate(profile.user.bio || `${roleLabel} на Recenza: ${profile.user.displayName}.`);
  const url = absoluteUrl(`/u/${slug}`);
  return {
    title: profile.user.displayName,
    description,
    alternates: { canonical: url },
    openGraph: { type: "profile", title: profile.user.displayName, description, url },
  };
}

/** Иконка соц-ссылки по hostname (github → GitHub, t.me/telegram → Telegram, иначе — глобус). */
function SocialIcon({ url, className }: { url: string; className?: string }) {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    /* не-URL — глобус */
  }
  if (host.includes("github.")) return <IconGitHub className={className} />;
  if (host === "t.me" || host.includes("telegram.")) return <IconTelegram className={className} />;
  return <IconGlobe className={className} />;
}

function SocialLinks({ links }: { links: LinkItem[] }) {
  const valid = links.filter((l) => /^https?:\/\//i.test(l.url));
  if (valid.length === 0) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-2 sm:justify-start">
      {valid.map((l) => (
        <a
          key={l.url}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          title={l.label}
          aria-label={l.label}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <SocialIcon url={l.url} className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
}

function StatCells({ stats }: { stats: { k: string; v: string | number }[] }) {
  return (
    <dl className="mt-5 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:gap-x-7 sm:gap-y-3">
      {stats.map((s, i) => (
        <div
          key={s.k}
          className={`rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-left sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 ${
            i > 0 ? "sm:border-l sm:border-[var(--border)] sm:pl-7" : ""
          }`}
        >
          <dt className="mb-0.5 text-[0.65rem] uppercase tracking-wider text-[var(--muted-foreground)]">{s.k}</dt>
          <dd className="font-display text-[19px] font-semibold tabular-nums text-[var(--foreground)]">{s.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ProfilePage({ params }: { params: Params }) {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);
  if (!profile) notFound();

  const { user } = profile;
  const viewer = await getCurrentUser();
  const isOwner = profile.kind === "author" && viewer?.id === profile.user.id;
  // Владелец профиля любой роли (и автор, и ревьюер) — для смены аватарки (ui-feedback-5 П2).
  const isOwnProfile = viewer?.id === profile.user.id;
  // Владелец видит своё портфолио даже скрытым (профиль-запрос отдаёт только видимое).
  const ownerPortfolio = isOwner ? await getPortfolioForAuthor(profile.user.id) : null;
  const roleLabel = profile.kind === "author" ? "Автор" : "Ревьюер";
  const initial = (user.displayName || user.handle).charAt(0).toUpperCase();
  const memberSince = formatMonthYear(user.createdAt);

  const stats =
    profile.kind === "author"
      ? [
          { k: profile.stats.blogs === 1 ? "Блог" : "Блогов", v: profile.stats.blogs },
          { k: "Глав", v: profile.stats.chapters },
          { k: "Просмотров", v: formatCompact(profile.stats.views) },
          { k: "В закладках", v: formatCompact(profile.stats.bookmarks) },
        ]
      : [{ k: "Отрецензировано", v: profile.reviewed.length }];

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <div className="mb-5">
        <BackLink href="/">На главную</BackLink>
      </div>

      <header className="mb-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] p-5 sm:p-7">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] sm:h-24 sm:w-24"
              aria-hidden="true"
            >
              {user.avatarUrl ? (
                <Image src={user.avatarUrl} alt="" width={96} height={96} unoptimized className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-[30px] font-semibold uppercase text-[var(--muted-foreground)] sm:text-[34px]">
                  {initial}
                </span>
              )}
            </div>
            {/* ui-feedback-5 П2: смена аватарки на своей странице (автор и ревьюер) */}
            {isOwnProfile && <AvatarChanger />}
          </div>
          <div className="w-full min-w-0">
            <div className="mb-1 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
              <h1 className="font-display text-[26px] font-extrabold leading-[1.1] tracking-tight sm:text-4xl">
                {user.displayName}
              </h1>
              <span className="shrink-0 rounded-[var(--radius-pill)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--accent)]">
                {roleLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] sm:justify-start">
              <span className="font-mono">@{user.handle}</span>
              {memberSince && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>на платформе с {memberSince}</span>
                </>
              )}
            </div>
            {user.bio && (
              <p className="mx-auto mt-3 max-w-xl leading-relaxed text-[var(--foreground)] sm:mx-0">{user.bio}</p>
            )}
            <SocialLinks links={user.links} />
            <StatCells stats={stats} />
          </div>
        </div>
      </header>

      <div>
        {profile.kind === "author" ? (
          <AuthorProfile
            blogs={profile.blogs}
            portfolio={isOwner ? (ownerPortfolio?.blocks ?? null) : profile.portfolio}
            portfolioVisible={isOwner ? (ownerPortfolio?.isVisible ?? false) : true}
            isOwner={isOwner}
            pinnedBlogId={profile.pinnedBlogId}
          />
        ) : (
          <ReviewerProfile user={profile.user} reviewed={profile.reviewed} />
        )}
      </div>
    </div>
  );
}
