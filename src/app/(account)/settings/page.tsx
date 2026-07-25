// «Настройки» (Фаза 13.7) — канонический адрес редактирования профиля (решение владельца):
// сюда ведут «Рабочее место» и меню аватара; та же форма доступна модалкой на своём /u/[slug].
// Закрывает З-38/З-39: до Ф13 имя/био/ссылки не редактировались нигде, компетенции — только
// через accept заявки с доски.

import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { parseJson } from "@/lib/db/json";
import { capabilitiesLabel } from "@/lib/roles";
import { ProfileForm } from "@/components/profile/profile-form";
import { AvatarChanger } from "@/components/profile/avatar-changer";
import type { LinkItem } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Настройки",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await getCurrentUser(); // не null: гард в layout
  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-[40rem] px-6 py-10">
      <header className="mb-8">
        <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--private)]">
          Приватная страница · только вы
        </span>
        <h1 className="mt-2.5">Настройки</h1>
        <p className="mt-2 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          @{user.handle} · {capabilitiesLabel(user)}
        </p>
      </header>

      <section aria-label="Аватар" className="mb-8">
        <h2 className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Аватар
        </h2>
        <AvatarChanger />
      </section>

      <section aria-label="Профиль">
        <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Профиль
        </h2>
        <ProfileForm
          initial={{
            displayName: user.displayName,
            bio: user.bio,
            links: parseJson<LinkItem[]>(user.links, []),
            competencies: parseJson<string[]>(user.competencies, []),
          }}
          isReviewer={user.isReviewer}
        />
      </section>

      <p className="mt-8 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
        Никнейм и адрес профиля изменить нельзя — на них ссылается история ревью.{" "}
        <Link
          href={`/u/${user.slug}`}
          className="text-[var(--accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-sm)]"
        >
          Посмотреть публичный профиль →
        </Link>
      </p>
    </div>
  );
}
