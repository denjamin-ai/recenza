"use client";

// «Руководство» — роль-зависимый гид (порт GuideModal прототипа shared/components.jsx, ui-feedback-3).
// Тексты переписаны под реальную модель (прототипные — легаси: «один ревьюер», «админ назначает
// роли»): согласие через приглашения, ведущий, публикация при all-approve, роли не меняются.
// Вёрстка на токенах DS (без теней/raw-цветов); мобильный bottom-sheet; Esc/оверлей закрывают.
// Админ шапку сайта не видит — admin-варианта нет намеренно.

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconBookOpen, IconCheck, IconEdit } from "@/components/icons";
import type { Role } from "@/types";

type GuideRole = "reader" | "author" | "reviewer";

interface GuideContent {
  title: string;
  intro: string;
  icon: React.ReactNode;
  capabilities: { glyph: string; title: string; text: string }[];
  cta: { label: string; href: string };
}

const GUIDE_CONTENT: Record<GuideRole, GuideContent> = {
  reader: {
    title: "Гид читателя",
    intro: "Что вы можете делать на Recenza как читатель.",
    icon: <IconBookOpen className="h-5 w-5" />,
    capabilities: [
      { glyph: "★", title: "Голосуйте за главы", text: "Поднимайте полезные статьи выше. Один голос на главу, его можно отозвать." },
      { glyph: "❑", title: "Закладки", text: "Сохраняйте блоги в личную коллекцию — она доступна из меню аватара." },
      { glyph: "✎", title: "Комментарии", text: "Ветки до двух уровней с привязкой к фрагменту статьи. 15 минут на правку своего комментария." },
      { glyph: "@", title: "Подписки", text: "Подпишитесь на автора — уведомление о новой главе придёт в колокольчик." },
    ],
    cta: { label: "Доска «Ищем ревьюеров»", href: "/board" },
  },
  author: {
    title: "Гид автора",
    intro: "Дополнительно к возможностям читателя у вас есть редактор, черновики и ревью.",
    icon: <IconEdit className="h-5 w-5" />,
    capabilities: [
      { glyph: "▢", title: "Редактор блоков", text: "Writing-first документ: 12 типов блоков, markdown-шорткаты, слэш-меню, формулы и схемы." },
      { glyph: "↑", title: "Отправка на ревью", text: "Укажите навыки статьи и пригласите подходящих ревьюеров — ревью начнётся после их согласия." },
      { glyph: "✓", title: "Публикация", text: "Глава выходит, когда все ревьюеры одобрили ревизию. Публикацию можно отложить по расписанию." },
      { glyph: "◷", title: "Версии", text: "Каждая отправка — новая ревизия; читатель видит опубликованную, история сохраняется." },
    ],
    cta: { label: "Кабинет автора", href: "/author" },
  },
  reviewer: {
    title: "Гид ревьюера",
    intro: "У вас отдельное рабочее место для проверки чужих статей — кабинет ревьюера.",
    icon: <IconCheck className="h-5 w-5" />,
    capabilities: [
      { glyph: "≡", title: "Приглашения", text: "Авторы приглашают вас по совпадению навыков. Ревью начинается только после вашего согласия." },
      { glyph: "❝", title: "Треды замечаний", text: "Комментируйте фрагменты и предлагайте правки — автор применяет их одним действием." },
      { glyph: "✓", title: "Вердикт", text: "«Одобрить» или «Нужны правки» по каждой ревизии; для обсуждения есть чат сессии." },
      { glyph: "⌘", title: "Только ревью", text: "Ревьюер не ведёт блоги и не пишет публичные комментарии. Ваш профиль показывает, что вы отрецензировали." },
    ],
    cta: { label: "Кабинет ревьюера", href: "/reviewer" },
  },
};

export function GuideButton({ role }: { role: Role | null }) {
  const [open, setOpen] = useState(false);

  const guideRole: GuideRole = role === "author" || role === "reviewer" ? role : "reader";
  const content = GUIDE_CONTENT[guideRole];
  // Гостю показываем гид читателя, но CTA ведёт на вход.
  const cta = role == null ? { label: "Войти", href: "/login" } : content.cta;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Руководство"
        title="Руководство"
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)]"
      >
        <IconBookOpen className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-title"
        >
          <button
            type="button"
            aria-label="Закрыть руководство"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[var(--overlay)]"
          />
          <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] sm:max-h-[88vh] sm:max-w-2xl sm:rounded-[var(--radius-lg)]">
            {/* Ручка bottom-sheet на мобиле */}
            <div className="flex shrink-0 justify-center pb-1 pt-2.5 sm:hidden">
              <span aria-hidden="true" className="h-1 w-9 rounded-[var(--radius-pill)] bg-[var(--border)]" />
            </div>

            <div className="shrink-0 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-5 pb-5 pt-4 sm:px-7 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] text-[var(--accent)]">
                    {content.icon}
                  </div>
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Тип пользователя · {guideRole === "author" ? "автор" : guideRole === "reviewer" ? "ревьюер" : "читатель"}
                    </p>
                    <h2 id="guide-title" className="mt-0.5 font-display text-xl font-extrabold tracking-tight sm:text-2xl">
                      {content.title}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  ✕
                </button>
              </div>
              <p className="mt-3 max-w-lg text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)]">
                {content.intro}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              <ul className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 sm:gap-y-5">
                {content.capabilities.map((c) => (
                  <li key={c.title} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)] text-sm font-semibold text-[var(--accent)]"
                    >
                      {c.glyph}
                    </span>
                    <div>
                      <p className="text-[length:var(--type-small)] font-semibold leading-snug">{c.title}</p>
                      <p className="mt-0.5 text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)]">{c.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-7 sm:pb-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-[44px] rounded-[var(--radius-md)] px-3 py-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:min-h-9 sm:py-1.5"
              >
                Понятно
              </button>
              <Link
                href={cta.href}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] px-3.5 py-2 text-center text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 sm:min-h-9 sm:py-1.5"
              >
                {cta.label} →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
