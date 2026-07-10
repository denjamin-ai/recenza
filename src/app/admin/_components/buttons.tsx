// Единые стили кнопок админ-портала (ui-feedback-4 П5, тона — по прототипу admin/*.jsx).
// Без "use client": класс-константы и презентационный ActionBtn импортируются и клиентскими
// экшен-компонентами, и серверными страницами. Тексты кнопок задаёт вызывающий код (e2e-локаторы).

const base =
  "min-h-9 rounded-[var(--radius-md)] px-3 py-1.5 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60";

/** Primary — accent solid: подтверждающее/позитивное действие («Создать», «Одобрить», «Утвердить»). */
export const btnPrimary = `${base} bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]`;

/** Secondary — нейтральный outline: обратимые действия и отмены с рамкой. */
export const btnSecondary = `${base} border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]`;

/** Text — голая текстовая кнопка (отмена без рамки). */
export const btnText = `${base} text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]`;

/** DangerSoft — мягкий danger для списков/триггеров («Заблокировать», «Отклонить», «Снять»). */
export const btnDangerSoft = `${base} border border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)] hover:opacity-90`;

/** DangerStrong — сплошной danger для финальных подтверждений удаления/блокировки. */
export const btnDangerStrong = `${base} bg-[var(--danger)] text-[var(--danger-foreground)] hover:opacity-90`;

/** Warning — amber outline: триггер опасного-но-легитимного действия (force-approve). */
export const btnWarning = `${base} border border-[var(--warning-border)] text-[var(--warning)] hover:bg-[var(--warning-bg)]`;

/** WarningStrong — amber solid: подтверждение force-approve («Да, опубликовать»). */
export const btnWarningStrong = `${base} bg-[var(--warning-solid)] text-[var(--warning-foreground)] hover:opacity-90`;

/** Общий инпут форм админки (раньше дублировался в banner/donation/recruit-менеджерах). */
export const inputCls =
  "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 text-[length:var(--type-small)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export type ActionTone = "neutral" | "warning" | "danger" | "danger-strong";

const ACTION_TONES: Record<ActionTone, string> = {
  neutral: "border-[var(--border)] hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] hover:bg-[color-mix(in_srgb,var(--accent)_4%,transparent)]",
  warning: "border-[var(--warning-border)] hover:bg-[var(--warning-bg)]",
  danger: "border-[color-mix(in_srgb,var(--danger)_25%,var(--border))] hover:border-[color-mix(in_srgb,var(--danger)_50%,var(--border))] hover:bg-[color-mix(in_srgb,var(--danger)_6%,transparent)]",
  "danger-strong": "border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_4%,transparent)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]",
};

/**
 * Крупная кнопка-карточка решения (прототип admin-users-reports.jsx ActionBtn): title + hint,
 * сетка `grid gap-2 md:grid-cols-2` у вызывающего. hint попадает в accessible name (конкатенация) —
 * не использовать для кнопок, которые e2e матчит с exact: true.
 */
export function ActionBtn({
  tone,
  title,
  hint,
  onClick,
  disabled,
}: {
  tone: ActionTone;
  title: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[var(--radius-lg)] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60 ${ACTION_TONES[tone]}`}
    >
      <p className="mb-0.5 text-[0.85rem] font-medium text-[var(--foreground)]">{title}</p>
      <p className="text-[0.75rem] leading-relaxed text-[var(--muted-foreground)]">{hint}</p>
    </button>
  );
}
