// Закладки пользователя. Личная страница — гость → логин, noindex.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBookmarkedBlogs } from "@/lib/queries/bookmarks";
import { BlogCard } from "@/components/reader/blog-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Закладки",
  description: "Сохранённые блоги и главы — ваша личная подборка на Recenza.",
  robots: { index: false, follow: false },
};

export default async function BookmarksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/bookmarks");
  // ui-feedback-5 П4: закладки — только у читателя (модель ролей).
  if (user.role !== "reader") redirect("/");

  const blogs = await getBookmarkedBlogs(user.id);

  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-12">
      <h1 className="text-[length:var(--type-h2)]">Закладки</h1>
      {blogs.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {blogs.map((b) => (
            <BlogCard key={b.id} blog={b} />
          ))}
        </div>
      ) : (
        <p className="mt-8 text-[var(--muted-foreground)]">
          Вы ещё ничего не добавили в закладки. Откройте блог и нажмите «★».
        </p>
      )}
    </div>
  );
}
