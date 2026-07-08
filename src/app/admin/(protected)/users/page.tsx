// Пользователи (Фаза 10): плотная таблица со sticky-заголовком, поиск (?q=), роль/статус-pill.
// Модерация (баны/ёмкость) — на детальной странице /admin/users/[handle].
import Link from "next/link";
import { getAdminUsers } from "@/lib/queries/admin";
import { ScreenHead, RolePill, Pill } from "@/app/admin/_components/primitives";
import { UserCreate } from "@/app/admin/_components/user-create";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = (q ?? "").trim().toLowerCase();
  const all = await getAdminUsers();
  const users = term
    ? all.filter((u) => u.handle.toLowerCase().includes(term) || u.displayName.toLowerCase().includes(term))
    : all;

  return (
    <div>
      <ScreenHead eyebrow="Люди" title="Пользователи" description="Роли, баны и ограничение комментирования. Роль меняется только через приём заявки с доски." />

      <UserCreate />

      {term && (
        <p className="mb-3 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Поиск: <span className="text-[var(--foreground)]">{q}</span> · найдено {users.length}{" "}
          <Link href="/admin/users" className="text-[var(--accent)] hover:underline">сбросить</Link>
        </p>
      )}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-secondary)]">
        <table className="w-full border-collapse text-[length:var(--type-small)]">
          <thead className="sticky top-0 bg-[var(--bg-secondary)]">
            <tr className="text-left text-[var(--muted-foreground)]">
              <th className="px-3 py-2 font-medium">Пользователь</th>
              <th className="px-3 py-2 font-medium">Роль</th>
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
                </td>
                <td className="px-3 py-2"><RolePill role={u.role} /></td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {u.isBlocked && <Pill tone="danger">Заблокирован</Pill>}
                    {u.commentingBlocked && <Pill tone="warning">Комментарии off</Pill>}
                    {!u.isBlocked && !u.commentingBlocked && <Pill tone="success">Активен</Pill>}
                  </span>
                </td>
                <td className="px-3 py-2 text-[var(--muted-foreground)]">
                  {u.role === "reviewer" ? `${u.reviewLoad}/${u.reviewCapacity}` : "—"}
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
