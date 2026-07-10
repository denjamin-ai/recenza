"use client";

// Кабинет автора «Мои блоги» (ui-feedback-4 П1, прототип author-portal.jsx AuthorPortal):
// двухколоночный layout — сетка карточек (max 2 колонки, плитка «создать» первой, пин первым)
// + aside 300px (жалобы → оценки → recruit-статус → «Об авторе» → «События»).
// Карточка: точки-прогресс глав + чипы «Закреплён»/«ваш ход», title+summary, статистика с бейджами,
// футер «＋ Глава» + pin-тоггл 38px. Создание = create-then-edit: POST /api/author/blogs → деталь.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  AuthorBlogCard,
  AuthorPortfolio,
  RatingPrompt,
  RecruitStatusItem,
  SkillsMismatchNotice,
} from "@/lib/queries/author";
import type { NotificationView } from "@/lib/queries/notifications";
import type { Block, RecruitStatus, RevisionStatus } from "@/types";
import { plural } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/format";
import { notificationLabel, notificationTone } from "@/lib/notification-text";
import { IconBookOpen, IconEdit } from "@/components/icons";
import { RatingPromptCard } from "./rating-prompt";

const RECRUIT_META: Record<RecruitStatus, { label: string; cls: string }> = {
  pending: { label: "На рассмотрении", cls: "bg-[var(--warning-bg)] text-[var(--warning)]" },
  approved: { label: "Одобрен", cls: "bg-[var(--success-bg)] text-[var(--success)]" },
  rejected: { label: "Отклонён", cls: "bg-[var(--danger-bg)] text-[var(--danger)]" },
};

const RECRUIT_HINT: Record<RecruitStatus, string> = {
  pending: "Запрос отправлен админу. Блог нельзя опубликовать, пока нет подходящих ревьюеров.",
  approved: "Админ ищет ревьюеров по вашим навыкам — направление добавлено на доску «Ищем ревьюеров».",
  rejected: "Запрос отклонён.",
};

// Точки-прогресс по прототипу: published — заполненная (success), остальные — контурные
// (ревью — warning, «нужны правки» — danger, черновик — muted).
const STATUS_DOT: Record<RevisionStatus, string> = {
  published: "bg-[var(--success)]",
  "under-review": "border border-[var(--warning)]",
  "changes-requested": "border border-[var(--danger)]",
  draft: "border border-[var(--muted-foreground)]",
};

function ChapterDots({ statuses }: { statuses: { order: number; status: RevisionStatus }[] }) {
  if (statuses.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1" aria-hidden="true">
      {statuses.map((s, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[s.status]}`} />
      ))}
    </span>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14l-1.4-4.2a2 2 0 0 1-.1-.6V5a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2v7.2a2 2 0 0 1-.1.6z" />
    </svg>
  );
}

async function postPin(blogId: string | null): Promise<boolean> {
  const res = await fetch("/api/author/pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blogId }),
  });
  return res.ok;
}

function CreateTile() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setError(null);
    start(async () => {
      const res = await fetch("/api/author/blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      const data = (await res.json().catch(() => ({}))) as { blogSlug?: string; error?: string };
      if (res.ok && data.blogSlug) {
        router.push(`/author/blog/${data.blogSlug}`);
      } else {
        setError(data.error ?? "Не удалось создать блог.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-4 text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] border border-current text-xl leading-none">
          ＋
        </span>
        <span className="text-[0.82rem] font-medium">Новый блог</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex h-full min-h-[120px] flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--accent)] bg-[var(--bg-elevated)] p-4"
    >
      <label htmlFor="new-blog-title" className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
        Название блога
      </label>
      <input
        id="new-blog-title"
        autoFocus
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Например: Внутренности JavaScript"
        className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      />
      {error && <p className="text-[length:var(--type-small)] text-[var(--danger)]">{error}</p>}
      <div className="mt-auto flex gap-2">
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="min-h-9 flex-1 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-2 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          {pending ? "Создаём…" : "Создать"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTitle("");
            setError(null);
          }}
          className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

function BlogTile({ blog, pinned }: { blog: AuthorBlogCard; pinned: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const onReview = blog.chapterStatuses.filter((c) => c.status === "under-review").length;
  const drafts = blog.chapterStatuses.filter((c) => c.status === "draft").length;
  // «ваш ход» — есть глава со статусом «нужны правки» (ход за автором).
  const myTurn = blog.chapterStatuses.some((c) => c.status === "changes-requested");

  function togglePin() {
    start(async () => {
      const ok = await postPin(pinned ? null : blog.id);
      if (ok) router.refresh();
    });
  }

  function addChapter() {
    start(async () => {
      const res = await fetch(`/api/author/blogs/${blog.id}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as { chapterSlug?: string };
      if (res.ok && data.chapterSlug) {
        router.push(`/author/blog/${blog.slug}/${data.chapterSlug}/edit`);
      }
    });
  }

  return (
    <article
      className={`flex h-full flex-col rounded-[var(--radius-lg)] border bg-[var(--bg-elevated)] transition-all hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        pinned
          ? "border-[var(--pin-border)] ring-1 ring-[var(--pin-ring)]"
          : "border-[var(--border)] hover:border-[color-mix(in_srgb,var(--foreground)_20%,var(--border))]"
      }`}
    >
      {/* Тело-ссылка: точки-прогресс + чипы, title+summary, статистика — клик открывает деталь */}
      <Link
        href={`/author/blog/${blog.slug}`}
        className="flex flex-1 flex-col gap-3 rounded-t-[var(--radius-lg)] p-4 pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <span className="flex items-center justify-between gap-2">
          <ChapterDots statuses={blog.chapterStatuses} />
          <span className="flex shrink-0 items-center gap-2">
            {pinned && (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--pin-border)] bg-[var(--pin-bg)] px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-[var(--pin)]">
                <PinIcon filled />
                Закреплён
              </span>
            )}
            {myTurn && (
              <span className="inline-flex items-center gap-1 text-[0.66rem] font-semibold uppercase tracking-wider text-[var(--accent)]">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> ваш ход
              </span>
            )}
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <h3 className="mb-1.5 line-clamp-2 font-display text-[18px] font-bold leading-snug" title={blog.title}>
            {blog.title}
          </h3>
          <span className="line-clamp-2 block text-[0.78rem] leading-relaxed text-[var(--muted-foreground)]">
            {blog.summary || "Без описания."}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-2 text-[0.72rem] tabular-nums text-[var(--muted-foreground)]">
          <span>
            {blog.chapterCount} {plural(blog.chapterCount, "глава", "главы", "глав")} · {blog.publishedCount} опубл.
          </span>
          {onReview > 0 && (
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--info-border)] bg-[var(--info-bg)] px-1.5 py-0.5 text-[0.68rem] font-medium text-[var(--info)]">
              {onReview} на ревью
            </span>
          )}
          {drafts > 0 && (
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 text-[0.68rem] font-medium text-[var(--muted-foreground)]">
              {drafts} черн.
            </span>
          )}
        </span>
      </Link>

      {/* Общая панель действий (прототип): «＋ Глава» + pin-тоггл 38px */}
      <div className="flex items-stretch gap-1.5 border-t border-[var(--border)] px-3 py-2.5">
        <button
          type="button"
          onClick={addChapter}
          disabled={pending}
          className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] px-3 py-2 text-[0.78rem] font-medium text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <span aria-hidden="true">＋</span> Глава
        </button>
        <button
          type="button"
          onClick={togglePin}
          disabled={pending}
          aria-pressed={pinned}
          aria-label={pinned ? "Открепить блог" : "Закрепить блог"}
          title={pinned ? "Открепить" : "Закрепить как портфолио"}
          className={`inline-flex w-[38px] shrink-0 items-center justify-center rounded-[var(--radius-md)] border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            pinned
              ? "border-[var(--pin-border)] bg-[var(--pin-bg)] text-[var(--pin)]"
              : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          <PinIcon filled={pinned} />
        </button>
      </div>
    </article>
  );
}

/** Превью портфолио: текст первого блока с текстом (для карточки «Об авторе»). */
function portfolioPreview(blocks: Block[]): string | null {
  for (const b of blocks) {
    if ("text" in b && typeof b.text === "string" && b.text.trim()) return b.text.trim();
  }
  return null;
}

function PortfolioCard({ portfolio }: { portfolio: AuthorPortfolio | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggleVisible() {
    if (!portfolio) return;
    start(async () => {
      const res = await fetch("/api/author/portfolio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: !portfolio.isVisible }),
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <section aria-label="Об авторе" className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <h2 className="mb-1.5 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        <IconBookOpen className="h-3.5 w-3.5 text-[var(--accent)]" />
        Об авторе
      </h2>
      {portfolio ? (
        <>
          <p className="mb-1 line-clamp-2 text-[0.82rem] leading-snug text-[var(--foreground)]">
            {portfolioPreview(portfolio.blocks) ?? "Без заголовка"}
          </p>
          <p className="mb-3 text-[0.72rem] text-[var(--muted-foreground)]">
            {portfolio.isVisible ? "Опубликовано · видно всем" : "Скрыто от читателей"}
          </p>
          <div className="flex items-center gap-1.5">
            <Link
              href="/author/portfolio"
              className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] px-3 py-2 text-[0.78rem] font-medium text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <IconEdit className="h-3.5 w-3.5" />
              Изменить
            </Link>
            <button
              type="button"
              onClick={toggleVisible}
              disabled={pending}
              aria-pressed={portfolio.isVisible}
              aria-label={portfolio.isVisible ? "Скрыть от читателей" : "Показать читателям"}
              title={portfolio.isVisible ? "Скрыть от читателей" : "Показать читателям"}
              className={`inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[var(--radius-md)] border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                portfolio.isVisible
                  ? "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {portfolio.isVisible ? (
                  <>
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                ) : (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-[0.72rem] leading-relaxed text-[var(--muted-foreground)]">
            Расширенное «Обо мне» — публикуется сразу, без ревью.
          </p>
          <Link
            href="/author/portfolio"
            className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-2 text-[0.78rem] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            ＋ Создать
          </Link>
        </>
      )}
    </section>
  );
}

const EVENT_DOT: Record<string, string> = {
  accent: "bg-[var(--accent)]",
  warning: "bg-[var(--warning)]",
  default: "bg-[var(--muted-foreground)]",
};

function EventsList({ events }: { events: NotificationView[] }) {
  if (events.length === 0) {
    return <p className="text-[0.78rem] text-[var(--muted-foreground)]">Пока нет событий.</p>;
  }
  return (
    <ul className="space-y-3.5">
      {events.map((e) => (
        <li key={e.id} className="text-[0.82rem] leading-snug">
          <div className="flex items-start gap-2">
            <span aria-hidden="true" className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${EVENT_DOT[notificationTone(e.type)]}`} />
            <div className="min-w-0">
              <p className="text-[var(--foreground)]">{notificationLabel(e)}</p>
              <p className="mt-0.5 text-[0.72rem] text-[var(--muted-foreground)]">{formatRelativeTime(e.createdAt)}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AuthorCabinet({
  blogs,
  pinnedBlogId,
  recruitRequests,
  ratingPrompts,
  mismatches,
  portfolio,
  events,
}: {
  blogs: AuthorBlogCard[];
  pinnedBlogId: string | null;
  recruitRequests: RecruitStatusItem[];
  ratingPrompts: RatingPrompt[];
  mismatches: SkillsMismatchNotice[];
  portfolio: AuthorPortfolio | null;
  events: NotificationView[];
}) {
  return (
    <div className="mx-auto w-full max-w-[var(--max-article)] px-6 py-10">
      <header className="mb-6 sm:mb-8">
        <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Кабинет автора
        </p>
        <h1>Мои блоги</h1>
        <p className="mt-2 max-w-xl text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)]">
          Каждый блог — это набор глав. Откройте блог, чтобы добавить главу или посмотреть статус существующих.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px] lg:gap-10">
        {/* Сетка карточек: плитка «создать» первой, закреплённый — первым из блогов (сортировка в query) */}
        <div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <li>
              <CreateTile />
            </li>
            {blogs.map((blog) => (
              <li key={blog.id}>
                <BlogTile blog={blog} pinned={blog.id === pinnedBlogId} />
              </li>
            ))}
          </ul>
        </div>

        <aside className="flex flex-col gap-7 lg:border-l lg:border-[var(--border)] lg:pl-8">
          {mismatches.length > 0 && (
            <section aria-label="Навыки не совпадают">
              <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Навыки не совпадают
              </h2>
              <ul className="flex flex-col gap-2">
                {mismatches.map((m) => (
                  <li
                    key={m.chapterId}
                    className="rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3"
                  >
                    <span className="block truncate text-[0.82rem] font-medium">{m.chapterTitle}</span>
                    <span className="mt-0.5 block text-[0.72rem] text-[var(--warning)]">
                      Глава снята с ревью: {m.flagReason ?? "навыки не совпадают"}. Исправьте навыки и отправьте заново.
                    </span>
                    <Link
                      href={`/author/blog/${m.blogSlug}/${m.chapterSlug}/edit`}
                      className="mt-2 inline-flex min-h-9 items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[0.78rem] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      Изменить навыки →
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ratingPrompts.length > 0 && (
            <section aria-label="Оцените ревьюеров">
              <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Оцените ревьюеров
              </h2>
              <div className="flex flex-col gap-3">
                {ratingPrompts.map((p) => (
                  <RatingPromptCard key={p.chapterId} prompt={p} />
                ))}
              </div>
            </section>
          )}

          {recruitRequests.length > 0 && (
            <section aria-label="Запросы ревьюеров">
              <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Запросы ревьюеров
              </h2>
              <ul className="flex flex-col gap-2">
                {recruitRequests.map((r) => (
                  <li key={r.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[0.82rem] font-medium">{r.chapterTitle ?? "Запрос на подбор"}</span>
                      <span className={`shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.7rem] ${RECRUIT_META[r.status].cls}`}>
                        {RECRUIT_META[r.status].label}
                      </span>
                    </div>
                    {r.skills.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.skills.map((s) => (
                          <span key={s} className="rounded-[var(--radius-pill)] bg-[var(--muted)] px-1.5 py-0.5 text-[0.7rem] text-[var(--muted-foreground)]">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-1.5 text-[0.72rem] text-[var(--muted-foreground)]">
                      {r.status === "rejected" && r.reason ? r.reason : RECRUIT_HINT[r.status]}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <PortfolioCard portfolio={portfolio} />

          <section aria-label="События">
            <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              События
            </h2>
            <EventsList events={events} />
          </section>
        </aside>
      </div>
    </div>
  );
}
