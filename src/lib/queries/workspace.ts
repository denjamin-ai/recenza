// «Рабочее место» (Фаза 13.6) — приватный хаб кабинетов по возможностям аккаунта.
// Порт private/workspace.jsx прототипа: карточки кабинетов с цифрами + кросс-ролевой список
// «Требует внимания». Всё считается из уже существующих запросов — своих таблиц у экрана нет.
//
// ⚠️ Карточка администратора НЕ реализуется (решение владельца): админ env-based, строки в `users`
// не имеет, а значит и возможностей — тоже.

import { getAuthorCabinet } from "./author";
import { getReviewerQueue } from "./review";
import { getReviewQueue } from "./review-requests";
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

/** Сколько пунктов одного типа показываем (3 правки, 3 хода, 2 подходящих заявки). */
const MAX_FIX = 3;
const MAX_TURN = 3;
const MAX_OPEN = 2;

export async function getWorkspace(
  userId: string,
  handle: string,
  capabilities: Capability[],
): Promise<WorkspaceView> {
  const isAuthor = capabilities.includes("author");
  const isReviewer = capabilities.includes("reviewer");

  const [cabinet, active, open, reviewed] = await Promise.all([
    isAuthor ? getAuthorCabinet(userId) : Promise.resolve(null),
    isReviewer ? getReviewerQueue(handle) : Promise.resolve([]),
    // Ф14: вместо входящих приглашений — открытые заявки, которые ревьюер может взять сам.
    isReviewer ? getReviewQueue(handle, userId) : Promise.resolve([]),
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
    const myTurn = active.filter((q) => q.myVerdict === null);
    cards.push({
      capability: "reviewer",
      title: "Кабинет ревьюера",
      hint: "Очередь заявок, ваши вердикты и история ревью",
      href: "/reviewer",
      stats: [
        { label: "Заявок в очереди", value: open.length },
        { label: "Ваш ход", value: myTurn.length, alert: myTurn.length > 0 },
        { label: "Активные ревью", value: active.length },
        { label: "Отрецензировано", value: reviewed.length },
      ],
      footer:
        open.length > 0
          ? {
              text: `${open.length} ${plural(open.length, "заявка ждёт", "заявки ждут", "заявок ждут")} ревьюера`,
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
    // Заявки с высоким совпадением по компетенциям — их стоит взять именно этому ревьюеру.
    for (const r of open.filter((x) => x.matchPct >= 50).slice(0, MAX_OPEN)) {
      attention.push({
        id: `req-${r.id}`,
        source: "ревьюер",
        title: `«${r.blogTitle}» · ${r.chapterTitle}`,
        body: `Заявка по вашим навыкам — совпадение ${r.matchPct}%`,
        href: "/reviewer",
      });
    }
  }

  return { cards, attention };
}
