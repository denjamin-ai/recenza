// Кабинет ревьюера (Фаза 14.6) — RSC-корень: считает все три секции и отдаёт их готовыми узлами
// в клиентскую оболочку с табами (паттерн Ф13.5: секции — RSC, табы — клиент).
//
// ⚠️ Приглашения ушли вместе с Ф14: `@/lib/queries/invitations` больше нет — автор не выбирает
// ревьюера, ревьюер сам берёт заявку из очереди. Плитка «Ваш рейтинг» снята (рейтинг сносится
// целиком), на её место встал объём проделанной работы.

import { getCurrentUser } from "@/lib/auth";
import { getReviewQueue } from "@/lib/queries/review-requests";
import {
  getReviewerActiveByBlog,
  getReviewerCompleted,
  getReviewerVolume,
} from "@/lib/queries/review";
import { plural } from "@/lib/plural";
import { ReviewerCabinet, type CabinetTile } from "@/app/reviewer/_components/reviewer-cabinet";
import { QueueSection } from "@/app/reviewer/_components/queue-section";
import { ActiveSection } from "@/app/reviewer/_components/active-section";
import { CompletedSection } from "@/app/reviewer/_components/completed-section";

export const dynamic = "force-dynamic";

/**
 * Момент рендера в Unix seconds — база для SLA-чипов очереди.
 * ⚠️ Вынесено из тела компонента: `react-hooks/purity` запрещает звать `Date.now()` прямо в
 * рендере. Страница `force-dynamic`, так что значение честно пересчитывается на каждый запрос.
 */
function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export default async function ReviewerPage() {
  const user = await getCurrentUser(); // гарантированно ревьюер (гард в layout)
  const [queue, active, completed, volume] = user
    ? await Promise.all([
        getReviewQueue(user.handle, user.id),
        getReviewerActiveByBlog(user.handle),
        getReviewerCompleted(user.handle),
        getReviewerVolume(user.handle),
      ])
    : [[], [], [], { chapters: 0, blogs: 0 }];

  const activeItems = active.reduce((n, g) => n + g.items.length, 0);
  const awaitingMe = active.reduce((n, g) => n + g.items.filter((i) => i.myVerdict === null).length, 0);
  const completedItems = completed.reduce((n, g) => n + g.chapters.length, 0);
  const now = nowSeconds();

  const tiles: CabinetTile[] = [
    { label: "Заявок в очереди", value: String(queue.length) },
    { label: "Ваш ход", value: String(awaitingMe) },
    { label: "Активные ревью", value: String(activeItems) },
    {
      label: "Отрецензировано",
      value: `${volume.chapters} ${plural(volume.chapters, "глава", "главы", "глав")}`,
      hint: `в ${volume.blogs} ${plural(volume.blogs, "блоге", "блогах", "блогах")}`,
    },
  ];

  return (
    <ReviewerCabinet
      displayName={user?.displayName ?? ""}
      tiles={tiles}
      queue={<QueueSection items={queue} now={now} />}
      queueCount={queue.length}
      active={<ActiveSection groups={active} />}
      activeCount={activeItems}
      completed={<CompletedSection groups={completed} />}
      completedCount={completedItems}
    />
  );
}
