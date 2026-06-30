// Форматирование для UI (русская локаль).

const DATE_FMT = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Unix seconds → «28 июня 2026». Пустой ввод → "". */
export function formatDate(unixSeconds: number | null | undefined): string {
  if (unixSeconds == null) return "";
  return DATE_FMT.format(new Date(unixSeconds * 1000));
}

/** Unix seconds → относительное время («только что», «5 мин назад», …); старше недели → дата. */
export function formatRelativeTime(unixSeconds: number | null | undefined): string {
  if (unixSeconds == null) return "";
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} дн назад`;
  return formatDate(unixSeconds);
}
