// Панель «Каталог»: карточки блогов.

import { BlogCard } from "@/components/reader/blog-card";
import type { BlogCardView } from "@/lib/queries/types";

export function CatalogGrid({ blogs }: { blogs: BlogCardView[] }) {
  if (blogs.length === 0) {
    return <p className="py-12 text-center text-[var(--muted-foreground)]">Блоги не найдены.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {blogs.map((blog) => (
        <BlogCard key={blog.id} blog={blog} />
      ))}
    </div>
  );
}
