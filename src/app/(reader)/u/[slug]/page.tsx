// Публичный профиль /u/[slug]. Автор → «Об авторе» + блоги; ревьюер → «что отрецензировал».
// Читатель/админ/заблокированный → 404 (нет публичного профиля).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProfileBySlug } from "@/lib/queries/profile";
import { getPortfolioForAuthor } from "@/lib/queries/author";
import { getCurrentUser } from "@/lib/auth";
import { AuthorProfile } from "@/components/profile/author-profile";
import { ReviewerProfile } from "@/components/profile/reviewer-profile";
import { absoluteUrl, truncate } from "@/lib/seo";

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

export default async function ProfilePage({ params }: { params: Params }) {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);
  if (!profile) notFound();

  const { user } = profile;
  const viewer = await getCurrentUser();
  const isOwner = profile.kind === "author" && viewer?.id === profile.user.id;
  // Владелец видит своё портфолио даже скрытым (профиль-запрос отдаёт только видимое).
  const ownerPortfolio = isOwner ? await getPortfolioForAuthor(profile.user.id) : null;
  const roleLabel = profile.kind === "author" ? "Автор" : "Ревьюер";
  const initial = (user.displayName || user.handle).charAt(0).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-12">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-8 sm:flex-row sm:items-center">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-secondary)]"
          aria-hidden="true"
        >
          <span className="font-display text-[length:var(--type-h3)] text-[var(--foreground)]">{initial}</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-[length:var(--type-h2)]">{user.displayName}</h1>
          <p className="mt-1 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            <span className="font-mono">@{user.handle}</span>
            <span aria-hidden="true"> · </span>
            <span>{roleLabel}</span>
          </p>
          {user.bio && <p className="mt-3 text-[var(--muted-foreground)]">{user.bio}</p>}
          {user.links.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-3 text-[length:var(--type-small)]">
              {user.links.map((l) => (
                <li key={l.url}>
                  <a
                    href={/^https?:\/\//i.test(l.url) ? l.url : "#"}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <div className="mt-10">
        {profile.kind === "author" ? (
          <AuthorProfile
            blogs={profile.blogs}
            portfolio={isOwner ? (ownerPortfolio?.blocks ?? null) : profile.portfolio}
            portfolioVisible={isOwner ? (ownerPortfolio?.isVisible ?? false) : true}
            isOwner={isOwner}
          />
        ) : (
          <ReviewerProfile user={profile.user} reviewed={profile.reviewed} />
        )}
      </div>

      <div className="mt-12 border-t border-[var(--border)] pt-6">
        <Link
          href="/"
          className="text-[length:var(--type-small)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]"
        >
          ← На главную
        </Link>
      </div>
    </div>
  );
}
