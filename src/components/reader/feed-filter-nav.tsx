// Единая лента (ui-feedback-8): один чип-ряд и на главной вошедшего, и в каталоге —
// «Подписки» (только вошедшему) / «Все» / «Проверенные». Состояние живёт в URL:
// «Подписки» = `/` без параметров (личная лента, дефолт вошедшего), остальные — каталог
// `/?view=all[&filter=verified]`; смена чипа сохраняет сортировку каталога и сбрасывает страницу.
// Server Component на ссылках, клиентского JS нет (паттерн CatalogSortNav).
// ⚠️ aria-label намеренно НЕ «Разделы ленты» — на это имя стоят негативные e2e-ассерты
// главной (guest.spec/reader.spec: табов ui-feedback-4 больше нет).

import Link from "next/link";
import {
  CATALOG_FILTER_LABEL,
  catalogQuery,
  type CatalogFilter,
  type CatalogSort,
} from "@/lib/showcase";

/** «Подписки» — виртуальный фильтр ленты поверх двух фильтров каталога. */
export type FeedFilter = "subs" | CatalogFilter;

export function FeedFilterNav({
  active,
  sort,
  showSubs,
}: {
  active: FeedFilter;
  /** Задан только в каталоге — чипы «Все»/«Проверенные» сохраняют текущую сортировку. */
  sort?: CatalogSort;
  /** Чип «Подписки» есть только у вошедшего: у гостя личной ленты нет. */
  showSubs: boolean;
}) {
  const items: { key: FeedFilter; label: string; href: string }[] = [
    ...(showSubs ? [{ key: "subs" as const, label: "Подписки", href: "/" }] : []),
    { key: "all" as const, label: CATALOG_FILTER_LABEL.all, href: `/?${catalogQuery({ catalog: true, sort })}` },
    {
      key: "verified" as const,
      label: CATALOG_FILTER_LABEL.verified,
      href: `/?${catalogQuery({ catalog: true, filter: "verified", sort })}`,
    },
  ];

  return (
    <nav className="mb-3 flex flex-wrap items-center gap-2" aria-label="Фильтр ленты">
      {items.map((item) => {
        const current = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={current ? "true" : undefined}
            className={`inline-flex min-h-[36px] items-center rounded-[var(--radius-pill)] border px-3 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              current
                ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
