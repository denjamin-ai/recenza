"use client";

// Фильтры списка пользователей (Фаза 15, З-58). Состояние живёт в URL — страница остаётся
// адресуемой и переживает refresh; поиск из топбара (`?q=`) продолжает работать как раньше.

import { useRouter } from "next/navigation";
import { inputCls } from "@/app/admin/_components/buttons";

const CAP_OPTIONS = [
  { value: "", label: "Все возможности" },
  { value: "author", label: "Авторы" },
  { value: "reviewer", label: "Ревьюеры" },
  { value: "none", label: "Только читатели" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Любой статус" },
  { value: "active", label: "Активные" },
  { value: "blocked", label: "Заблокированные" },
  { value: "muted", label: "Без комментариев" },
];

const SORT_OPTIONS = [
  { value: "new", label: "Сначала новые" },
  { value: "name", label: "По имени" },
  { value: "load", label: "По нагрузке" },
];

export function UserFilters({
  q,
  cap,
  status,
  sort,
}: {
  q: string;
  cap: string;
  status: string;
  sort: string;
}) {
  const router = useRouter();

  function apply(patch: Record<string, string>) {
    const params = new URLSearchParams();
    const next = { q, cap, status, sort, ...patch };
    if (next.q) params.set("q", next.q);
    if (next.cap) params.set("cap", next.cap);
    if (next.status) params.set("status", next.status);
    if (next.sort && next.sort !== "new") params.set("sort", next.sort);
    const qs = params.toString();
    router.push(qs ? `/admin/users?${qs}` : "/admin/users");
  }

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <select
        className={inputCls}
        aria-label="Фильтр по возможностям"
        value={cap}
        onChange={(e) => apply({ cap: e.target.value })}
      >
        {CAP_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={inputCls}
        aria-label="Фильтр по статусу"
        value={status}
        onChange={(e) => apply({ status: e.target.value })}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={inputCls}
        aria-label="Сортировка"
        value={sort}
        onChange={(e) => apply({ sort: e.target.value })}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
