// Человекочитаемые строки уведомлений (общий словарь для колокола и «Событий» кабинета автора).
// Чистые функции без побочных эффектов — безопасно и в клиенте, и в RSC.

export interface NotificationLike {
  type: string;
  payload: Record<string, unknown>;
}

export function notificationLabel(item: NotificationLike): string {
  const title = typeof item.payload.title === "string" ? item.payload.title : null;
  const chapterTitle = typeof item.payload.chapterTitle === "string" ? item.payload.chapterTitle : null;
  switch (item.type) {
    case "new_chapter":
      return title ? `Новая глава: ${title}` : "Новая глава в подписке";
    case "comment_reply":
      return "Ответ на ваш комментарий";
    case "comment_new":
      return chapterTitle ? `Новый комментарий: ${chapterTitle}` : "Новый комментарий к вашей главе";
    case "review_revision_submitted":
      return chapterTitle ? `Автор сдал новую версию: ${chapterTitle}` : "Автор сдал новую версию";
    // ── заявки на ревью (Фаза 14) ──
    case "review_request_claimed":
      return chapterTitle ? `Ревьюер взял заявку: ${chapterTitle}` : "Ревьюер взял вашу заявку на ревью";
    case "review_request_returned":
      return chapterTitle
        ? `Заявка вернулась в очередь: ${chapterTitle}`
        : "Заявка вернулась в очередь — ревьюер не приступил к работе";
    case "review_request_escalated":
      return "Заявку на ревью никто не взял — нужен подбор";
    case "review_request_expired":
      return chapterTitle
        ? `Заявка закрыта — ревьюер не нашёлся: ${chapterTitle}`
        : "Заявка закрыта — ревьюер не нашёлся";
    case "review_badge_granted":
      return chapterTitle ? `Глава прошла ревью: ${chapterTitle}` : "Глава прошла ревью";
    case "expert_application_filed":
      return "Анкета эксперта по приглашению автора";
    // ⚠️ З-30: тип ЖИВОЙ (шлётся из POST /api/board/applications), но `case` для него не было —
    // админ видел «Уведомление» без смысла. Тип не удаляем, а даём ему подпись.
    case "reviewer_application_filed":
      return "Новая заявка в ревьюеры с доски";
    // ⚠️ Ф15: тип существовал с Фазы 10, но эмитился только сидом и падал в default «Уведомление».
    // С появлением POST /api/reports он живой — подпись обязательна (ср. З-30 выше).
    case "report_filed": {
      const target = typeof item.payload.targetType === "string" ? item.payload.targetType : null;
      if (target === "blog") return "Жалоба на блог";
      if (target === "review") return "Жалоба на ревью";
      if (target === "comment") return "Жалоба на комментарий";
      return "Новая жалоба модератору";
    }
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
    // ── админ-действия (Фаза 10) ──
    case "force_approved":
      return chapterTitle ? `Администратор опубликовал главу: ${chapterTitle}` : "Администратор опубликовал главу";
    case "reviewer_removed":
      return chapterTitle ? `Вы сняты с ревью: ${chapterTitle}` : "Администратор снял вас с ревью";
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

export type NotificationTone = "accent" | "warning" | "default";

/** Тон точки-маркера в «Событиях» кабинета: accent — требует действия, warning — проблема. */
export function notificationTone(type: string): NotificationTone {
  switch (type) {
    case "review_changes_requested":
    case "review_ready":
    case "review_request_claimed":
    case "review_badge_granted":
      return "accent";
    case "scheduled_publish_failed":
    case "reviewer_removed":
    case "recruit_rejected":
    case "review_request_returned":
    case "review_request_expired":
      return "warning";
    default:
      return "default";
  }
}
