// «О платформе» (Фаза 15, З-28) — статическая страница, на которую ведёт подвал.
// Заведена вместе с подвалом: без неё пункт «о платформе» вёл бы либо в никуда, либо на блог
// «О Recenza», который существует только на проде (scripts/seed-recenza.mjs) и отсутствует на
// тестовом стенде — то есть был бы мёртвой ссылкой в e2e.
//
// Тексты описывают РЕАЛЬНУЮ модель после Фаз 13–15: публикация свободна, ревью — награда на
// выходе, бейдж двух уровней, аккаунты выдаёт админ (регистрации нет — альфа).

import type { Metadata } from "next";
import Link from "next/link";
import { siteUrl } from "@/lib/seo";
import { SHOWCASE_MIN_VERIFIED } from "@/lib/showcase";

export const metadata: Metadata = {
  title: "О платформе",
  description:
    "Recenza — девблоги с редакционным ревью: публикация свободна, ревью даёт бейдж и место на главной.",
  alternates: { canonical: `${siteUrl()}/about` },
};

const SECTIONS = [
  {
    title: "Что это",
    body: "Recenza — площадка многоглавных девблогов. Автор ведёт блог главами, читатель читает, комментирует и подписывается, а редакционное ревью превращает главу в проверенную.",
  },
  {
    title: "Публикация свободна",
    body: "Ревьюеры не нужны, чтобы опубликовать главу: автор публикует, когда считает нужным, и правит что хочет. Ревью — отдельный трек, который можно запросить до или после публикации.",
  },
  {
    title: "Ревью — награда на выходе",
    body: "Автор оставляет заявку и указывает навыки статьи; ревьюер берёт заявку из очереди сам, по своим компетенциям. Пройденное ревью даёт главе бейдж, а ревьюеру — строчку в публичном кредите.",
  },
  {
    title: "Два уровня бейджа",
    body: "«Проверено на Recenza» — ревью независимого ревьюера. «Проверено приглашённым экспертом» — ревьюер, которого привёл сам автор: это прозрачность, а не запрет. Бейдж привязан к номеру версии: если глава изменилась, читатель видит, какая именно версия проверялась.",
  },
  {
    title: "Что попадает на главную",
    body: `Витрина — это блоги с независимым ревью. Пока таких меньше ${SHOWCASE_MIN_VERIFIED}, подборку ведёт редакция. Блог без ревью полностью работоспособен: он открывается по прямой ссылке, индексируется и виден в профиле автора.`,
  },
  {
    title: "Аккаунты",
    body: "Платформа в альфе: регистрации нет, аккаунт заводит администратор. Вести блог может любой аккаунт; возможность рецензировать выдаётся отдельно.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-[var(--max-article)] px-6 py-10">
      <h1 className="mb-3">О платформе</h1>
      <p className="mb-8 text-[var(--muted-foreground)]">
        Как устроена Recenza: чем ревью отличается от модерации и что означает бейдж у главы.
      </p>

      <div className="space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="mb-2 text-[length:var(--type-h3)]">{s.title}</h2>
            <p className="leading-relaxed text-[var(--muted-foreground)]">{s.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3 border-t border-[var(--border)] pt-6">
        <Link
          href="/board"
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-[var(--accent)] px-5 font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          Стать ревьюером
        </Link>
        <Link
          href="/?view=all"
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-[var(--border)] px-4 text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Все блоги
        </Link>
      </div>
    </div>
  );
}
