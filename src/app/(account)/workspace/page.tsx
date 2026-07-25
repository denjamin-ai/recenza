// «Рабочее место» (Фаза 13.6) — приватный хаб: кабинеты возможностей + «Требует внимания».
// Порт private/workspace.jsx прототипа с двумя отличиями (решения владельца):
//   • карточка администратора НЕ реализуется — админ env-based, возможностей не имеет;
//   • ИКОНКА-ЗАМОК НЕ ПОРТИРУЕТСЯ вовсе (в прототипе она в трёх местах) — остаются только
//     текстовые подписи «Приватная страница · только вы».

import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { capabilitiesOf } from "@/lib/roles";
import { getWorkspace, type WorkspaceCard } from "@/lib/queries/workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Рабочее место",
  robots: { index: false, follow: false },
};

/** Пунктирная приватная поверхность строится из одного токена --private (см. globals.css). */
const CARD_CLS =
  "block rounded-[var(--radius-lg)] border border-dashed border-[var(--private-border)] bg-[var(--private-bg)] p-5 transition-colors hover:border-[var(--private)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--private)] focus-visible:ring-offset-2";

function PrivateTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--private)]">
      {children}
    </span>
  );
}

function Card({ card }: { card: WorkspaceCard }) {
  return (
    <Link href={card.href} className={CARD_CLS}>
      <h2 className="font-display text-[length:var(--type-h4)] font-bold text-[var(--foreground)]">
        {card.title}
      </h2>
      <p className="mt-1 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
        {card.hint}
      </p>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
        {card.stats.map((s) => (
          <div key={s.label}>
            <dt className="mb-0.5 text-[0.65rem] uppercase tracking-wider text-[var(--muted-foreground)]">
              {s.label}
            </dt>
            <dd
              className={`font-display text-[length:var(--type-h4)] font-semibold tabular-nums ${
                s.alert ? "text-[var(--warning)]" : "text-[var(--foreground)]"
              }`}
            >
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      {card.footer && (
        <p
          className={`mt-3.5 text-[length:var(--type-small)] ${
            card.footer.tone === "warning" ? "text-[var(--warning)]" : "text-[var(--accent)]"
          }`}
        >
          {card.footer.text}
        </p>
      )}
    </Link>
  );
}

export default async function WorkspacePage() {
  const user = await getCurrentUser(); // не null: гард в layout
  if (!user) return null;

  const capabilities = capabilitiesOf(user);
  const { cards, attention } = await getWorkspace(user.id, user.handle, capabilities);

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-10">
      <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <PrivateTag>Приватная страница · только вы</PrivateTag>
          <h1 className="mt-2.5">Рабочее место</h1>
          <p className="mt-2 max-w-lg text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)] [text-wrap:pretty]">
            Кабинеты ваших возможностей и то, что ждёт вашего решения. Публичный профиль это никак
            не меняет.
          </p>
        </div>
        <Link
          href={`/u/${user.slug}`}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2 text-[length:var(--type-small)] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          Мой публичный профиль →
        </Link>
      </header>

      {cards.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-10 text-center">
          <h2 className="mb-1.5 font-display text-[length:var(--type-h4)] font-bold">
            Пока нет кабинетов
          </h2>
          <p className="mx-auto max-w-md text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)]">
            Кабинеты появляются вместе с возможностями — автора или ревьюера. Их выдаёт
            администратор. Читать, комментировать и собирать закладки можно и без них.
          </p>
        </div>
      ) : (
        <>
          <div className={`grid gap-3.5 ${cards.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {cards.map((c) => (
              <Card key={c.capability} card={c} />
            ))}
          </div>

          <section className="mt-9">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <h2 className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Требует внимания
              </h2>
              {attention.length > 0 && (
                <span className="text-[length:var(--type-small)] tabular-nums text-[var(--muted-foreground)]">
                  {attention.length}
                </span>
              )}
            </div>
            {attention.length === 0 ? (
              <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] py-9 text-center text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                Ничего не ждёт вашего решения — всё чисто.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {attention.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      className="flex min-h-[44px] w-full items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-3.5 transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[length:var(--type-small)] font-semibold leading-snug">
                          {a.title}
                        </span>
                        <span className="mt-0.5 truncate text-[0.75rem] text-[var(--muted-foreground)]">
                          {a.body}
                        </span>
                      </span>
                      <span className="ml-auto shrink-0 rounded-[var(--radius-pill)] bg-[var(--muted)] px-2 py-0.5 font-mono text-[0.65rem] text-[var(--muted-foreground)]">
                        {a.source}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="mt-9 flex flex-wrap items-center gap-2.5 border-t border-[var(--border)] pt-6">
        <span className="mr-1 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Аккаунт
        </span>
        <Link
          href="/bookmarks"
          className="inline-flex min-h-[40px] items-center rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Закладки
        </Link>
        <Link
          href="/settings"
          className="inline-flex min-h-[40px] items-center rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Настройки
        </Link>
      </section>
    </div>
  );
}
