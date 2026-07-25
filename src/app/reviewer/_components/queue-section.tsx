// Таб «Очередь» (Фаза 14.6) — свободные заявки авторов, отсортированные по совпадению с
// компетенциями ЭТОГО ревьюера (сортировку и match% считает getReviewQueue). RSC: сама карточка
// клиентская только ради кнопки «Взять».

import type { QueueRequestItem } from "@/lib/queries/review-requests";
import { QueueRequestCard } from "./queue-request-card";

export function QueueSection({ items, now }: { items: QueueRequestItem[]; now: number }) {
  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-6">
        <p className="text-[var(--muted-foreground)]">Свободных заявок сейчас нет.</p>
        <p className="mt-1 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Заявки появляются здесь, когда авторы просят ревью. Чем ближе навыки главы к вашим
          компетенциям, тем выше заявка в списке.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <QueueRequestCard key={item.id} item={item} now={now} />
      ))}
    </ul>
  );
}
