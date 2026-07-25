// Публичная страница инвайт-ссылки эксперта (Фаза 14, канал 2): анкета для рецензента,
// которого автор зовёт извне платформы. Аккаунт создаёт админ — здесь только анкета.
//
// ⚠️ noindex/nofollow: ссылка персональная и одноразовая, в индексе ей делать нечего.
// ⚠️ Невалидный, отработавший и истёкший токен дают ОДНУ И ТУ ЖЕ страницу без деталей —
// иначе страница работает оракулом существования токенов.

import type { Metadata } from "next";
import Link from "next/link";
import { getPublicInvite } from "@/lib/queries/expert-invites";
import { InviteForm } from "./invite-form";

export const dynamic = "force-dynamic";

/** `Date.now()` в теле RSC ловит правило `react-hooks/purity` — выносим за границу компонента. */
function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export const metadata: Metadata = {
  title: "Приглашение эксперта",
  robots: { index: false, follow: false },
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getPublicInvite(token, nowSeconds());

  if (!invite) {
    return (
      <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-16">
        <div className="mx-auto max-w-[520px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] p-6 text-center">
          <h1 className="text-[length:var(--type-h2)]">Ссылка недействительна</h1>
          <p className="mt-3 text-[var(--muted-foreground)]">
            Приглашение уже использовано, отозвано или истекло. Попросите автора прислать новое —
            или откликнитесь на открытые направления сами.
          </p>
          <Link
            href="/board"
            className="mt-5 inline-flex min-h-9 items-center rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 text-[length:var(--type-body)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            Открытые направления
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-12">
      <div className="mx-auto max-w-[560px]">
        <header>
          <p className="text-[length:var(--type-small)] font-bold uppercase tracking-wider text-[var(--accent)]">
            Приглашение эксперта
          </p>
          {/* На 375px «рецензировать» в кегле h1 не влезает в строку и уводило страницу вправо
              на 9px; `break-words` рвал слово посередине. Поэтому на мобиле кегль h2, с sm — h1.
              `break-words` оставлен страховкой: имя автора приходит извне и может быть длинным. */}
          <h1 className="mt-2 break-words text-[length:var(--type-h2)] [text-wrap:balance] sm:text-[length:var(--type-h1)]">
            {invite.byName} приглашает вас рецензировать
          </h1>
          <p className="mt-3 text-[var(--muted-foreground)]">
            {invite.chapterTitle
              ? `Повод — глава «${invite.chapterTitle}»${invite.blogTitle ? ` из блога «${invite.blogTitle}»` : ""}.`
              : "Приглашение в платформу как рецензента."}{" "}
            Заполните анкету — редакция свяжется с вами и заведёт аккаунт: самостоятельной
            регистрации на платформе пока нет.
          </p>
          <p className="mt-3 rounded-[var(--radius-md)] border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-3 text-[length:var(--type-small)] text-[var(--info)]">
            Ревью от эксперта, которого привёл автор, помечается отдельно — «Проверено приглашённым
            экспертом». Это не ограничение, а честная подпись для читателя.
          </p>
        </header>

        <InviteForm token={invite.token} />
      </div>
    </div>
  );
}
