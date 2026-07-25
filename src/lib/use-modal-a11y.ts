"use client";

// A11y-обвязка модальных диалогов — ОДИН источник на все модалки (Фаза 15.1, backlog Ф6/Ф8/Ф10/Ф12).
//
// До этого хука каждая модалка городила свой `useEffect` с Escape и автофокусом (donate-modal,
// guide-modal, report-dialog, reviewer-board ×2, review-modals), а полноценного focus-trap не было
// НИ В ОДНОЙ — Tab уводил фокус в фон под оверлеем. Пункт «полный focus-trap» висел в бэклоге
// с Фазы 6 и переезжал из фазы в фазу; здесь он закрывается один раз для всех.
//
// Что делает:
//   • Escape → onClose;
//   • автофокус на контейнер при открытии (диалог обязан быть `tabIndex={-1}`);
//   • циклический Tab внутри диалога (focus-trap) — Tab с последнего элемента уходит на первый,
//     Shift+Tab с первого — на последний;
//   • возврат фокуса на элемент, с которого модалку открыли, при закрытии.

import { useEffect, useRef, type RefObject } from "react";

/** Селектор фокусируемых элементов: то же, что используют доступные библиотеки диалогов. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * @param open открыт ли диалог (хук ничего не делает, пока false)
 * @param onClose закрытие по Escape
 * @returns ref, который нужно повесить на КОНТЕЙНЕР диалога (`role="dialog"`, `tabIndex={-1}`)
 */
export function useModalA11y<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Запоминаем, откуда открыли: без этого после закрытия фокус улетает в начало документа.
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;

      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        // Фокусировать нечего — держим фокус на самом контейнере, а не выпускаем его в фон.
        e.preventDefault();
        ref.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!e.shiftKey && (active === last || !ref.current.contains(active))) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || !ref.current.contains(active))) {
        e.preventDefault();
        last.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  return ref;
}
