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

const MONTH_YEAR_FMT = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

/** Unix seconds → «июнь 2026» (профиль: «на платформе с …»). Пустой ввод → "". */
export function formatMonthYear(unixSeconds: number | null | undefined): string {
  if (unixSeconds == null) return "";
  return MONTH_YEAR_FMT.format(new Date(unixSeconds * 1000));
}

/** Компактное число для статистики: 999 → «999», 1200 → «1.2k», 15000 → «15k». */
export function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "") + "k";
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
