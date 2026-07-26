// Пагинация каталога и витрины (Фаза 15, З-25 — вместо жёсткого `others.slice(0, 4)`).
// Server Component на обычных ссылках: ноль клиентского JS, работает без гидрации,
// страница остаётся адресуемой (`?page=2` можно переслать).

import Link from "next/link";
import { catalogQuery, type CatalogFilter, type CatalogSort } from "@/lib/showcase";

const btn =
  "inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-[var(--border)] px-4 text-[length:var(--type-small)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

function href(page: number, sort?: CatalogSort, filter?: CatalogFilter): string {
  const qs = catalogQuery({ catalog: sort != null, sort, filter, page });
  return qs ? `/?${qs}` : "/";
}

export function CatalogPagination({
  page,
  pageCount,
  sort,
  filter,
}: {
  page: number;
  pageCount: number;
  /** Задан только для каталога `?view=all` — витрина сортировки не имеет. */
  sort?: CatalogSort;
  /** Задан только для каталога (ui-feedback-7) — пагинация не должна сбрасывать фильтр. */
  filter?: CatalogFilter;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Постраничная навигация">
      {page > 1 ? (
        <Link href={href(page - 1, sort, filter)} rel="prev" className={btn}>
          ← Назад
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}

      <p className="text-[length:var(--type-small)] tabular-nums text-[var(--muted-foreground)]">
        Страница {page} из {pageCount}
      </p>

      {page < pageCount ? (
        <Link href={href(page + 1, sort, filter)} rel="next" className={btn}>
          Вперёд →
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}
