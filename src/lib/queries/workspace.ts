// «Рабочее место» (Фаза 13.6) — приватный хаб кабинетов по возможностям аккаунта.
// Порт private/workspace.jsx прототипа: карточки кабинетов с цифрами + кросс-ролевой список
// «Требует внимания». Всё считается из уже существующих запросов — своих таблиц у экрана нет.
//
// ⚠️ Карточка администратора НЕ реализуется (решение владельца): админ env-based, строки в `users`
// не имеет, а значит и возможностей — тоже.

import { getAuthorCabinet } from "./author";
import { getReviewerQueue } from "./review";
import { getReviewerInbox } from "./invitations";
import { getReviewedChapters } from "./profile";
import { plural } from "@/lib/plural";
import type { Capability } from "@/lib/roles";

export interface WorkspaceStat {
  label: string;
  value: number;
  /** Подсветить значение как требующее внимания (прототип: tone на цифре). */
  alert?: boolean;
}

export interface WorkspaceCard {
  capability: Capability;
  title: string;
  hint: string;
  href: string;
  stats: WorkspaceStat[];
  /** Подвал карточки — «N глав ждут ваших правок» / «N приглашений». */
  footer: { text: string; tone: "warning" | "accent" } | null;
}

/** Пункт «Требует внимания» — кросс-ролевой, самое срочное сверху. */
export interface AttentionItem {
  id: string;
  /** Подпись-источник справа: «автор» / «ревьюер». */
  source: string;
  title: string;
  body: string;
  href: string;
}

export interface WorkspaceView {
  cards: WorkspaceCard[];
  attention: AttentionItem[];
}

/** Сколько пунктов одного типа показываем (прототип: 3 правки, 3 хода, 2 приглашения). */
const MAX_FIX = 3;
const MAX_TURN = 3;
const MAX_INVITE = 2;

export async function getWorkspace(
  userId: string,
  handle: string,
  capabilities: Capability[],
): Promise<WorkspaceView> {
  const isAuthor = capabilities.includes("author");
  const isReviewer = capabilities.includes("reviewer");

  const [cabinet, queue, invitations, reviewed] = await Promise.all([
    isAuthor ? getAuthorCabinet(userId) : Promise.resolve(null),
    isReviewer ? getReviewerQueue(handle) : Promise.resolve([]),
    isReviewer ? getReviewerInbox(handle) : Promise.resolve([]),
    isReviewer ? getReviewedChapters(handle) : Promise.resolve([]),
  ]);

  const cards: WorkspaceCard[] = [];
  const attention: AttentionItem[] = [];

  if (isAuthor && cabinet) {
    const chapters = cabinet.blogs.flatMap((b) =>
      b.chapterStatuses.map((c) => ({ blog: b, ...c })),
    );
    // ⚠️ Две оси: «Черновики» считаем так же, как кабинет автора (ВСЕ `status==='draft'`), иначе
    // одна глава давала бы разные цифры на /workspace и /author. Отдельно выделяем состояние
    // «одобрено, ждёт публикации» — именно оно требует действия автора и без него было невидимо.
    const drafts = chapters.filter((c) => c.status === "draft").length;
    const onReview = chapters.filter(
      (c) => c.reviewStatus === "requested" || c.reviewStatus === "in-review",
    ).length;
    const published = chapters.filter((c) => c.status === "published").length;
    const readyToPublish = chapters.filter(
      (c) => c.status === "draft" && c.reviewStatus === "reviewed",
    );
    const needFix = chapters.filter((c) => c.reviewStatus === "changes-requested");

    cards.push({
      capability: "author",
      title: "Кабинет автора",
      hint: "Черновики, главы на ревью, публикации",
      href: "/author",
      stats: [
        { label: "Черновики", value: drafts },
        { label: "На ревью", value: onReview },
        { label: "Готовы к публикации", value: readyToPublish.length, alert: readyToPublish.length > 0 },
        { label: "Опубликовано", value: published },
      ],
      footer:
        needFix.length > 0
          ? {
              text: `${needFix.length} ${plural(needFix.length, "глава ждёт", "главы ждут", "глав ждут")} ваших правок`,
              tone: "warning",
            }
          : null,
    });

    for (const c of readyToPublish.slice(0, MAX_FIX)) {
      attention.push({
        id: `pub-${c.blog.slug}-${c.order}`,
        source: "автор",
        title: `«${c.blog.title}» · глава ${c.order}`,
        body: "Ревью пройдено — можно публиковать",
        href: `/author/blog/${c.blog.slug}`,
      });
    }

    // Точный адрес главы в chapterStatuses не хранится — ведём в кабинет блога, где она видна.
    for (const c of needFix.slice(0, MAX_FIX)) {
      attention.push({
        id: `fix-${c.blog.slug}-${c.order}`,
        source: "автор",
        title: `«${c.blog.title}» · глава ${c.order}`,
        body: "Ревьюер запросил правки",
        href: `/author/blog/${c.blog.slug}`,
      });
    }
  }

  if (isReviewer) {
    const myTurn = queue.filter((q) => q.myVerdict === null);
    cards.push({
      capability: "reviewer",
      title: "Кабинет ревьюера",
      hint: "Очередь, ваши вердикты и история ревью",
      href: "/reviewer",
      stats: [
        { label: "В очереди", value: queue.length },
        { label: "Ваш ход", value: myTurn.length, alert: myTurn.length > 0 },
        { label: "Отрецензировано", value: reviewed.length },
      ],
      footer:
        invitations.length > 0
          ? {
              text: `${invitations.length} ${plural(invitations.length, "новое приглашение", "новых приглашения", "новых приглашений")} на ревью`,
              tone: "accent",
            }
          : null,
    });

    for (const q of myTurn.slice(0, MAX_TURN)) {
      attention.push({
        id: `turn-${q.chapterId}`,
        source: "ревьюер",
        title: `«${q.blogTitle}» · ${q.chapterTitle}`,
        body: "Ваш ход — ждёт вердикта",
        href: `/reviewer/review/${q.chapterId}`,
      });
    }
    for (const inv of invitations.slice(0, MAX_INVITE)) {
      attention.push({
        id: `inv-${inv.id}`,
        source: "ревьюер",
        title: inv.chapterTitle,
        body: "Новое приглашение — примите или откажитесь",
        href: "/reviewer",
      });
    }
  }

  return { cards, attention };
}
