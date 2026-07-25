// Пользователи (Фаза 10): плотная таблица со sticky-заголовком, поиск (?q=), возможности/статус-pill.
// Модерация (баны/ёмкость/выдача возможностей) — на детальной странице /admin/users/[handle].
//
// Ф15 (З-58): к поиску добавлены фильтры по возможности и статусу + сортировка, и всё это уехало
// в SQL — раньше `getAdminUsers()` тянул ВСЕХ, а `?q=` фильтровался в JS уже на странице.
// Ф15 (15.5): форма создания раскрывается предзаполненной из анкеты по инвайт-ссылке — `introducedBy`
// больше не набирается руками, а от него зависит уровень бейджа.
import Link from "next/link";
import { getAdminUsers, type AdminUserFilter } from "@/lib/queries/admin";
import { ScreenHead, CapabilityPills, Pill } from "@/app/admin/_components/primitives";
import { UserCreate } from "@/app/admin/_components/user-create";
import { UserFilters } from "@/app/admin/_components/user-filters";

export const dynamic = "force-dynamic";

type Search = Promise<{
  q?: string;
  cap?: string;
  status?: string;
  sort?: string;
  new?: string;
  handle?: string;
  name?: string;
  introducedBy?: string;
}>;

const CAPS = ["author", "reviewer", "none"] as const;
const STATUSES = ["active", "blocked", "muted"] as const;
const SORTS = ["new", "name", "load"] as const;

export default async function AdminUsersPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const filter: AdminUserFilter = {
    q: sp.q?.trim() || undefined,
    cap: CAPS.find((c) => c === sp.cap),
    status: STATUSES.find((s) => s === sp.status),
    sort: SORTS.find((s) => s === sp.sort),
  };
  const users = await getAdminUsers(filter);
  const filtered = !!(filter.q || filter.cap || filter.status);

  return (
    <div>
      <ScreenHead
        eyebrow="Люди"
        title="Пользователи"
        description="Возможности, баны и ограничение комментирования. Возможности «автор» и «ревьюер» выдаёт и отзывает администратор в карточке пользователя."
      />

      <UserCreate
        initialOpen={sp.new === "1"}
        initial={{
          handle: sp.handle ?? "",
          displayName: sp.name ?? "",
          introducedBy: sp.introducedBy ?? "",
        }}
      />

      <UserFilters
        q={filter.q ?? ""}
        cap={filter.cap ?? ""}
        status={filter.status ?? ""}
        sort={filter.sort ?? "new"}
      />

      {filtered && (
        <p className="mb-3 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Найдено {users.length}{" "}
          <Link href="/admin/users" className="text-[var(--accent)] hover:underline">
            сбросить
          </Link>
        </p>
      )}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-secondary)]">
        <table className="w-full border-collapse text-[length:var(--type-small)]">
          <thead className="sticky top-0 bg-[var(--bg-secondary)]">
            <tr className="text-left text-[var(--muted-foreground)]">
              <th className="px-3 py-2 font-medium">Пользователь</th>
              <th className="px-3 py-2 font-medium">Возможности</th>
              <th className="px-3 py-2 font-medium">Статус</th>
              <th className="px-3 py-2 font-medium">Нагрузка</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-[var(--border-secondary)] hover:bg-[var(--muted)]">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/users/${u.handle}`}
                    className="font-medium text-[var(--foreground)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    {u.displayName}
                  </Link>
                  <span className="ml-1 text-[var(--muted-foreground)]">@{u.handle}</span>
                  {u.introducedBy && (
                    <span className="ml-1 text-[0.7rem] text-[var(--muted-foreground)]">
                      · привёл @{u.introducedBy}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2"><CapabilityPills user={u} /></td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {u.isBlocked && <Pill tone="danger">Заблокирован</Pill>}
                    {u.commentingBlocked && <Pill tone="warning">Комментарии off</Pill>}
                    {!u.isBlocked && !u.commentingBlocked && <Pill tone="success">Активен</Pill>}
                  </span>
                </td>
                <td className="px-3 py-2 text-[var(--muted-foreground)]">
                  {u.isReviewer ? `${u.reviewLoad}/${u.reviewCapacity}` : "—"}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-[var(--muted-foreground)]">Никого не найдено.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
