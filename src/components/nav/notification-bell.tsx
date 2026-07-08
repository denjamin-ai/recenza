"use client";

// Колокол уведомлений: поллинг GET /api/notifications (+ на фокус окна), бейдж непрочитанных,
// попап со списком и read-state. Рендерится только залогиненным (SiteNav). a11y как в AvatarMenu.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Item {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: number;
}

const POLL_MS = 45000;

function labelOf(item: Item): string {
  const title = typeof item.payload.title === "string" ? item.payload.title : null;
  const chapterTitle = typeof item.payload.chapterTitle === "string" ? item.payload.chapterTitle : null;
  switch (item.type) {
    case "new_chapter":
      return title ? `Новая глава: ${title}` : "Новая глава в подписке";
    case "review_turn":
      return "Ваш ход в ревью";
    case "comment_reply":
      return "Ответ на ваш комментарий";
    case "comment_new":
      return chapterTitle ? `Новый комментарий: ${chapterTitle}` : "Новый комментарий к вашей главе";
    // ── review-flow (Фаза 7) ──
    case "review_invited":
      return chapterTitle ? `Вас пригласили в ревью: ${chapterTitle}` : "Вас пригласили в ревью";
    // ── подбор/согласие (Фаза 9) ──
    case "review_invite_accepted":
      return chapterTitle ? `Ревьюер принял приглашение: ${chapterTitle}` : "Ревьюер принял приглашение";
    case "review_invite_declined":
      return chapterTitle ? `Ревьюер отклонил приглашение: ${chapterTitle}` : "Ревьюер отклонил приглашение";
    case "review_skills_mismatch":
      return chapterTitle ? `Навыки не совпадают — исправьте навыки: ${chapterTitle}` : "Навыки не совпадают — исправьте навыки";
    case "recruit_requested":
      return "Запрос на подбор ревьюеров";
    case "review_changes_requested":
      return chapterTitle ? `Запрошены правки: ${chapterTitle}` : "Ревьюер запросил правки";
    case "review_ready":
      return chapterTitle ? `Глава одобрена — можно публиковать: ${chapterTitle}` : "Глава одобрена — можно публиковать";
    case "review_published":
      return chapterTitle ? `Глава опубликована: ${chapterTitle}` : "Глава опубликована";
    case "scheduled_publish_failed":
      return chapterTitle
        ? `Отложенная публикация не прошла: ${chapterTitle}`
        : "Отложенная публикация не прошла проверку одобрений";
    case "review_comment":
      return chapterTitle ? `Новое сообщение в ревью: ${chapterTitle}` : "Новое сообщение в ревью";
    case "primary_change_request":
      return chapterTitle ? `Запрос смены ведущего: ${chapterTitle}` : "Запрос смены ведущего ревьюера";
    // ── админ-действия (Фаза 10) ──
    case "force_approved":
      return chapterTitle ? `Администратор опубликовал главу: ${chapterTitle}` : "Администратор опубликовал главу";
    case "reviewer_removed":
      return chapterTitle ? `Вы сняты с ревью: ${chapterTitle}` : "Администратор снял вас с ревью";
    case "primary_changed":
      return chapterTitle ? `Сменён ведущий ревьюер: ${chapterTitle}` : "Сменён ведущий ревьюер";
    case "recruit_approved":
      return "Запрос на подбор ревьюеров одобрен — направление на доске";
    case "recruit_rejected":
      return "Запрос на подбор ревьюеров отклонён";
    case "application_accepted":
      return "Вас приняли в ревьюеры!";
    case "application_declined":
      return "Заявка ревьюера отклонена";
    default:
      return "Уведомление";
  }
}

function hrefOf(item: Item): string | null {
  // Универсально: создатель уведомления кладёт payload.href (знает роль получателя).
  if (typeof item.payload.href === "string" && item.payload.href.startsWith("/")) {
    return item.payload.href;
  }
  if (item.type === "new_chapter") {
    const blogSlug = item.payload.blogSlug;
    const chapterSlug = item.payload.chapterSlug;
    if (typeof blogSlug === "string" && typeof chapterSlug === "string") {
      return `/blog/${blogSlug}/${chapterSlug}`;
    }
  }
  return null;
}

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { unread: number; items: Item[] };
        if (!alive) return;
        setItems(data.items ?? []);
        setUnread(data.unread ?? 0);
      } catch {
        /* офлайн/ошибка — тихо игнорируем, попробуем в следующий тик */
      }
    }
    load();
    const timer = window.setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(id?: string) {
    // оптимистично
    setItems((prev) => prev.map((i) => (id == null || i.id === id ? { ...i, isRead: true } : i)));
    setUnread((prev) => (id == null ? 0 : Math.max(0, prev - 1)));
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
    } catch {
      /* best-effort */
    }
  }

  function onItemClick(item: Item) {
    if (!item.isRead) markRead(item.id);
    const href = hrefOf(item);
    if (href) {
      setOpen(false);
      router.push(href);
    }
  }

  const badge = unread > 9 ? "9+" : String(unread);

  return (
    <div ref={ref} className="relative" onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
    }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `Уведомления: ${unread} непрочитанных` : "Уведомления"}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-[var(--radius-pill)] bg-[var(--accent)] px-1 text-[10px] font-medium leading-none text-[var(--accent-foreground)]"
          >
            {badge}
          </span>
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {unread > 0 ? `${unread} непрочитанных уведомлений` : "Нет новых уведомлений"}
      </span>

      {open && (
        <div
          role="menu"
          aria-label="Уведомления"
          className="absolute right-0 z-50 mt-2 w-80 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-2"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-secondary)] px-2 pb-2">
            <span className="text-[length:var(--type-small)] font-medium text-[var(--foreground)]">Уведомления</span>
            {unread > 0 && (
              <button
                role="menuitem"
                type="button"
                onClick={() => markRead()}
                className="rounded-[var(--radius-sm)] px-2 py-1 text-[length:var(--type-small)] text-[var(--accent)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                Прочитать всё
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-[length:var(--type-small)] text-[var(--muted-foreground)]">
              Нет уведомлений.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto pt-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => onItemClick(item)}
                    className="flex w-full items-start gap-2 rounded-[var(--radius-md)] px-2 py-2 text-left transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    {!item.isRead && (
                      <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                    )}
                    <span className={`text-[length:var(--type-small)] ${item.isRead ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]"} ${item.isRead ? "pl-3.5" : ""}`}>
                      {labelOf(item)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
