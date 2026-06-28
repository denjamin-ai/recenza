// Панель «Лента»: список глав (последние публикации).

import { ChapterFeedCard } from "@/components/reader/chapter-feed-card";
import type { FeedItemView } from "@/lib/queries/types";

export function FeedList({ items }: { items: FeedItemView[] }) {
  if (items.length === 0) {
    return <p className="py-12 text-center text-[var(--muted-foreground)]">Пока нет опубликованных глав.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4">
      {items.map((item) => (
        <ChapterFeedCard key={`${item.blogSlug}/${item.chapterSlug}`} item={item} />
      ))}
    </div>
  );
}
