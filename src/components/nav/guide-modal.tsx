"use client";

// «Руководство» — гид по возможностям аккаунта (порт GuideModal прототипа, ui-feedback-3).
// ⚠️ Фаза 13: тексты приведены к новой модели — публикация СВОБОДНА (не «когда все одобрили»),
// ревьюер комментирует чужие блоги (запрещена только глава, которую он рецензировал), базовые
// возможности читателя есть у всех.
// ⚠️ Фаза 15 (З-27 + 15.3): гид строится по ВОЗМОЖНОСТЯМ, а не по «главной роли» — аккаунт с
// обеими возможностями видел раньше только авторский раздел, хотя ревьюерский к нему тоже
// относится. Тексты про приглашения переписаны под Ф14 (заявка → очередь → claim), у читателя
// добавлен раздел про ревью и бейджи.
// Вёрстка на токенах DS (без теней/raw-цветов); мобильный bottom-sheet; Esc/оверлей закрывают.
// Админ шапку сайта не видит — admin-варианта нет намеренно.

import { useEffect, useState } from "react";
import { useModalA11y } from "@/lib/use-modal-a11y";
import Link from "next/link";
import { IconBookOpen, IconCheck, IconEdit } from "@/components/icons";
import { capabilitiesLabel, capabilitiesOf, type CapabilityHolder } from "@/lib/roles";

type GuideSectionKey = "reader" | "author" | "reviewer";

interface GuideSection {
  title: string;
  intro: string;
  icon: React.ReactNode;
  capabilities: { glyph: string; title: string; text: string }[];
  // ui-feedback-7: CTA есть только у reader-секции («Доска») — кабинетные CTA убраны,
  // в кабинеты ведёт «Рабочее место» из меню аватара.
  cta?: { label: string; href: string };
}

const GUIDE_CONTENT: Record<GuideSectionKey, GuideSection> = {
  reader: {
    title: "Что может любой аккаунт",
    intro: "Базовые возможности есть у любого аккаунта Recenza.",
    icon: <IconBookOpen className="h-5 w-5" />,
    capabilities: [
      { glyph: "★", title: "Голосуйте за блоги", text: "Поднимайте полезные блоги выше. Один голос на блог, его можно отозвать." },
      { glyph: "❑", title: "Закладки", text: "Сохраняйте блоги в личную коллекцию — она доступна из меню аватара." },
      { glyph: "✎", title: "Комментарии", text: "Ветки до двух уровней с привязкой к фрагменту статьи. 15 минут на правку своего комментария." },
      { glyph: "@", title: "Подписки", text: "Подпишитесь на автора — уведомление о новой главе придёт в колокольчик." },
      // З-27: раздела про ревью и бейджи в гиде читателя не было вовсе.
      { glyph: "✓", title: "Бейдж ревью", text: "«Проверено на Recenza» — независимое ревью, «Проверено приглашённым экспертом» — ревьюер, которого привёл автор. Бейдж привязан к версии главы: если она изменилась, видно, какую версию проверяли." },
      { glyph: "⚑", title: "Жалоба модератору", text: "На блог или комментарий можно пожаловаться — жалобу видит только редакция." },
    ],
    cta: { label: "Доска «Ищем ревьюеров»", href: "/board" },
  },
  author: {
    title: "Гид автора",
    intro: "Дополнительно к базовым возможностям у вас есть редактор, черновики и ревью.",
    icon: <IconEdit className="h-5 w-5" />,
    capabilities: [
      { glyph: "▢", title: "Редактор блоков", text: "Writing-first документ: 12 типов блоков, markdown-шорткаты, слэш-меню, формулы и схемы." },
      { glyph: "✓", title: "Публикация — когда хотите", text: "Ревьюеры для публикации не нужны: глава выходит по вашей кнопке. Публикацию можно отложить по расписанию." },
      // Ф14: автор больше НИКОГО не приглашает — он оставляет заявку, ревьюер берёт её сам.
      { glyph: "↑", title: "Ревью — по желанию", text: "Укажите навыки статьи и оставьте заявку — ревьюер возьмёт её из очереди сам, по своим компетенциям. Заявку можно оставить и на уже опубликованную главу; ревью не блокирует выход." },
      { glyph: "◷", title: "Версии", text: "Правка опубликованной главы создаёт новую версию поверх: читатель видит текущую, пока вы не опубликуете новую." },
    ],
  },
  reviewer: {
    title: "Гид ревьюера",
    intro: "У вас отдельное рабочее место для проверки чужих статей — кабинет ревьюера.",
    icon: <IconCheck className="h-5 w-5" />,
    capabilities: [
      // Ф14: приглашений больше нет — есть очередь заявок, отсортированная по вашим компетенциям.
      { glyph: "≡", title: "Очередь заявок", text: "Заявки авторов сортируются по совпадению с вашими компетенциями. Вы берёте работу сами — в пределах своей ёмкости." },
      { glyph: "❝", title: "Треды замечаний", text: "Комментируйте фрагменты и предлагайте правки — автор применяет их одним действием." },
      { glyph: "✓", title: "Вердикт", text: "«Одобрить» или «Нужны правки» по каждой ревизии; для обсуждения есть чат сессии." },
      { glyph: "⌘", title: "Без конфликта интересов", text: "В чужих блогах вы обычный читатель, но главу, которую рецензировали, публично не комментируете. Профиль показывает, что вы отрецензировали." },
    ],
  },
};

export function GuideButton({ user }: { user: CapabilityHolder | null }) {
  const [open, setOpen] = useState(false);
  // Escape/автофокус/focus-trap/возврат фокуса — общий хук; здесь остаётся только блокировка скролла.
  const dialogRef = useModalA11y<HTMLDivElement>(open, () => setOpen(false));

  // Ф15: разделы по ВОЗМОЖНОСТЯМ. Базовый уровень есть у всех, поэтому «reader» — всегда;
  // аккаунт с обеими возможностями видит оба кабинетных раздела (раньше — только авторский).
  const caps = capabilitiesOf(user);
  const sectionKeys: GuideSectionKey[] = ["reader", ...caps];
  const sections = sectionKeys.map((k) => GUIDE_CONTENT[k]);
  const lead = sections[sections.length - 1];
  const title = caps.length > 0 ? "Ваши возможности" : "Гид читателя";
  // ui-feedback-7: CTA остаётся только у аккаунта без кабинетов — гостю вход, читателю доска.
  // Автору/ревьюеру дублирующая кнопка кабинета убрана: туда ведёт «Рабочее место».
  const cta =
    user == null
      ? { label: "Войти", href: "/login" }
      : caps.length === 0
        ? (GUIDE_CONTENT.reader.cta ?? null)
        : null;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
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
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] outline-none sm:max-h-[88vh] sm:max-w-2xl sm:rounded-[var(--radius-lg)]"
          >
            {/* Ручка bottom-sheet на мобиле */}
            <div className="flex shrink-0 justify-center pb-1 pt-2.5 sm:hidden">
              <span aria-hidden="true" className="h-1 w-9 rounded-[var(--radius-pill)] bg-[var(--border)]" />
            </div>

            <div className="shrink-0 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-5 pb-5 pt-4 sm:px-7 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] text-[var(--accent)]">
                    {lead.icon}
                  </div>
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {/* Ф15: возможности, а не «тип пользователя» — их может быть несколько сразу */}
                      Возможности · {capabilitiesLabel(user).toLowerCase()}
                    </p>
                    <h2 id="guide-title" className="mt-0.5 font-display text-xl font-extrabold tracking-tight sm:text-2xl">
                      {title}
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
                {lead.intro}
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              {sections.map((section) => (
                <section key={section.title}>
                  {sections.length > 1 && (
                    <h3 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {section.title}
                    </h3>
                  )}
                  <ul className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 sm:gap-y-5">
                    {section.capabilities.map((c) => (
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
                </section>
              ))}
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-7 sm:pb-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-[44px] rounded-[var(--radius-md)] px-3 py-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:min-h-9 sm:py-1.5"
              >
                Понятно
              </button>
              {cta && (
                <Link
                  href={cta.href}
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] px-3.5 py-2 text-center text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 sm:min-h-9 sm:py-1.5"
                >
                  {cta.label} →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
