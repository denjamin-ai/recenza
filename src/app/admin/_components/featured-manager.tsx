"use client";

// «Выбор редакции» (Фаза 15): тоггл закрепления блога на витрине главной.
// Дату закрепления ставит сервер (`PATCH /api/admin/blogs/[blogId]`, поле `featured: boolean`) —
// клиент её не передаёт, иначе порядок витрины можно было бы подделать телом запроса.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminMutate } from "@/app/admin/_components/client";
import { btnSecondary, btnText } from "@/app/admin/_components/buttons";
import { Pill, EmptyState } from "@/app/admin/_components/primitives";
import { SHOWCASE_MIN_VERIFIED } from "@/lib/showcase";
import type { AdminFeaturedRow } from "@/lib/queries/admin";

export function FeaturedManager({
  blogs,
  verifiedCount,
}: {
  blogs: AdminFeaturedRow[];
  verifiedCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (blog: AdminFeaturedRow) => {
    setError(null);
    start(async () => {
      const res = await adminMutate(`/api/admin/blogs/${blog.id}`, "PATCH", {
        featured: blog.featuredAt == null,
      });
      if (!res.ok) {
        setError(res.error ?? "Не удалось изменить закрепление.");
        return;
      }
      router.refresh();
    });
  };

  const featuredCount = blogs.filter((b) => b.featuredAt != null).length;
  const editorialLed = verifiedCount < SHOWCASE_MIN_VERIFIED;

  return (
    <div className="space-y-4">
      <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
        Проверенных блогов: <span className="tabular-nums text-[var(--foreground)]">{verifiedCount}</span> из{" "}
        {SHOWCASE_MIN_VERIFIED} · закреплено:{" "}
        <span className="tabular-nums text-[var(--foreground)]">{featuredCount}</span>
      </p>

      {editorialLed && featuredCount === 0 && (
        <p className="rounded-[var(--radius-sm)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--warning)]">
          Главная сейчас пустая: проверенных блогов меньше {SHOWCASE_MIN_VERIFIED}, а закреплённых нет.
          Закрепите блоги — они станут витриной.
        </p>
      )}

      {error && (
        <p role="alert" className="text-[length:var(--type-small)] text-[var(--danger)]">
          {error}
        </p>
      )}

      {blogs.length === 0 ? (
        <EmptyState>Пока нет блогов.</EmptyState>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {blogs.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link
                  href={`/blog/${b.slug}`}
                  className="rounded-[var(--radius-sm)] font-medium text-[var(--foreground)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  {b.title}
                </Link>
                <p className="text-[0.7rem] text-[var(--muted-foreground)]">{b.authorName}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {b.hidden && <Pill tone="danger">Скрыт</Pill>}
                {b.verifiedTier === "independent" && <Pill tone="success">Проверен</Pill>}
                {b.verifiedTier === "invited" && <Pill tone="neutral">Приглашённым экспертом</Pill>}
                {b.featuredAt != null && <Pill tone="accent">В подборке</Pill>}
                <button
                  type="button"
                  disabled={pending}
                  className={b.featuredAt != null ? btnText : btnSecondary}
                  onClick={() => toggle(b)}
                >
                  {b.featuredAt != null ? "Убрать из подборки" : "Закрепить"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
