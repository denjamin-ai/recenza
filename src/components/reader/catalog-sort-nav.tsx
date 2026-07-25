// Сортировка каталога (Фаза 15, З-25: «сортировка перестаёт быть чисто механической»).
// Server Component на ссылках — состояние живёт в URL, клиентского JS нет.

import Link from "next/link";
import { CATALOG_SORTS, CATALOG_SORT_LABEL, type CatalogSort } from "@/lib/showcase";

export function CatalogSortNav({ active }: { active: CatalogSort }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-2" aria-label="Сортировка каталога">
      {CATALOG_SORTS.map((sort) => {
        const current = sort === active;
        return (
          <Link
            key={sort}
            href={sort === "new" ? "/?view=all" : `/?view=all&sort=${sort}`}
            aria-current={current ? "true" : undefined}
            className={`inline-flex min-h-[36px] items-center rounded-[var(--radius-pill)] border px-3 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              current
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            }`}
          >
            {CATALOG_SORT_LABEL[sort]}
          </Link>
        );
      })}
    </nav>
  );
}
