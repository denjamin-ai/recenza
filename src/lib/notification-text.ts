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

export type NotificationTone = "accent" | "warning" | "default";

/** Тон точки-маркера в «Событиях» кабинета: accent — требует действия, warning — проблема. */
export function notificationTone(type: string): NotificationTone {
  switch (type) {
    case "review_turn":
    case "review_changes_requested":
    case "review_ready":
    case "primary_change_request":
      return "accent";
    case "review_skills_mismatch":
    case "review_invite_declined":
    case "scheduled_publish_failed":
    case "reviewer_removed":
    case "recruit_rejected":
      return "warning";
    default:
      return "default";
  }
}
