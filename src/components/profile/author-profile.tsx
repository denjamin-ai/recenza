// Профиль автора: «Об авторе» (портфолио, read-only — редактор в Фазе 6) + «Блоги».

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { BlogCard } from "@/components/reader/blog-card";
import type { Block } from "@/types";
import type { BlogCardView } from "@/lib/queries/types";

export function AuthorProfile({
  blogs,
  portfolio,
}: {
  blogs: BlogCardView[];
  portfolio: Block[] | null;
}) {
  return (
    <div className="space-y-12">
      {portfolio && portfolio.length > 0 && (
        <section aria-label="Об авторе">
          <h2 className="text-[length:var(--type-h3)]">Об авторе</h2>
          <div className="mt-4">
            <BlockRenderer blocks={portfolio} prefix="portfolio" />
          </div>
        </section>
      )}

      <section aria-label="Блоги автора">
        <h2 className="text-[length:var(--type-h3)]">Блоги</h2>
        {blogs.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {blogs.map((b) => (
              <BlogCard key={b.id} blog={b} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[var(--muted-foreground)]">Пока нет опубликованных блогов.</p>
        )}
      </section>
    </div>
  );
}
