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
