// Панель «Подписки»: главы авторов, на которых подписан пользователь. Гость → приглашение войти.

import Link from "next/link";
import { ChapterFeedCard } from "@/components/reader/chapter-feed-card";
import type { FeedItemView } from "@/lib/queries/types";

export function SubscriptionFeed({ items, isAuthed }: { items: FeedItemView[]; isAuthed: boolean }) {
  if (!isAuthed) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--muted-foreground)]">Войдите, чтобы видеть ленту подписок.</p>
        <Link
          href="/login?next=/?tab=subscriptions"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        >
          Войти
        </Link>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-[var(--muted-foreground)]">
        Вы ещё не подписаны на авторов — откройте блог и нажмите «Подписаться».
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4">
      {items.map((item) => (
        <ChapterFeedCard key={`${item.blogSlug}/${item.chapterSlug}`} item={item} />
      ))}
    </div>
  );
}
