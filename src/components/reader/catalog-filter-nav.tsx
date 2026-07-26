// Фильтр каталога «Все / Проверенные» (ui-feedback-7) — по образцу CatalogSortNav:
// Server Component на ссылках, состояние живёт в URL, клиентского JS нет.
// ⚠️ aria-label намеренно НЕ «Разделы ленты» — на это имя стоят негативные e2e-ассерты
// главной (табов на ленте нет по построению, guest.spec/reader.spec).
// Смена фильтра сохраняет сортировку и сбрасывает страницу (как и чипы сортировки).

import Link from "next/link";
import {
  CATALOG_FILTERS,
  CATALOG_FILTER_LABEL,
  catalogQuery,
  type CatalogFilter,
  type CatalogSort,
} from "@/lib/showcase";

export function CatalogFilterNav({ active, sort }: { active: CatalogFilter; sort: CatalogSort }) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-2" aria-label="Фильтр каталога">
      {CATALOG_FILTERS.map((filter) => {
        const current = filter === active;
        return (
          <Link
            key={filter}
            href={`/?${catalogQuery({ catalog: true, filter, sort })}`}
            aria-current={current ? "true" : undefined}
            className={`inline-flex min-h-[36px] items-center rounded-[var(--radius-pill)] border px-3 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              current
                ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            }`}
          >
            {CATALOG_FILTER_LABEL[filter]}
          </Link>
        );
      })}
    </nav>
  );
}
