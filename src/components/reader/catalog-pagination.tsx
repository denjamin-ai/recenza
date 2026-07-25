// Пагинация каталога и витрины (Фаза 15, З-25 — вместо жёсткого `others.slice(0, 4)`).
// Server Component на обычных ссылках: ноль клиентского JS, работает без гидрации,
// страница остаётся адресуемой (`?page=2` можно переслать).

import Link from "next/link";
import type { CatalogSort } from "@/lib/showcase";

const btn =
  "inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-[var(--border)] px-4 text-[length:var(--type-small)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

function href(page: number, sort?: CatalogSort): string {
  const params = new URLSearchParams();
  if (sort) {
    params.set("view", "all");
    if (sort !== "new") params.set("sort", sort);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function CatalogPagination({
  page,
  pageCount,
  sort,
}: {
  page: number;
  pageCount: number;
  /** Задан только для каталога `?view=all` — витрина сортировки не имеет. */
  sort?: CatalogSort;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Постраничная навигация">
      {page > 1 ? (
        <Link href={href(page - 1, sort)} rel="prev" className={btn}>
          ← Назад
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}

      <p className="text-[length:var(--type-small)] tabular-nums text-[var(--muted-foreground)]">
        Страница {page} из {pageCount}
      </p>

      {page < pageCount ? (
        <Link href={href(page + 1, sort)} rel="next" className={btn}>
          Вперёд →
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}
