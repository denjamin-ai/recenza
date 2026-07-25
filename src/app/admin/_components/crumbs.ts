// Крошки админ-топбара (Фаза 15, З-62) — ЧИСТАЯ функция, без хуков и DOM.
//
// До Ф15 крошка была захардкожена как «Платформа · {раздел}»: первый уровень врал для разделов
// групп «Модерация» и «Люди», а на детальных страницах (`/admin/users/{handle}`,
// `/admin/reports/{id}`) не углублялась вовсе — карточка пользователя показывала «Платформа · Жалобы»
// соседнего раздела ровно так же, как их список.
//
// Третий уровень — человеческая подпись раздела, а не сегмент URL: ULID в крошке нечитаем.

export interface CrumbSource {
  /** Метка группы сайдбара («Модерация» / «Люди» / «Платформа»); null — для «Сводки». */
  group: string | null;
  /** Метка раздела («Жалобы», «Пользователи», …). */
  section: string;
  /** href раздела — по нему отделяется хвост пути. */
  href: string;
}

/** Подпись третьего уровня по разделу. Для `/admin/users/{handle}` подставляем сам handle. */
function detailLabel(href: string, tail: string): string {
  if (href === "/admin/users") return `@${tail}`;
  if (href === "/admin/reports") return "Разбор";
  if (href === "/admin/review") return "Ревью главы";
  return "Детали";
}

/**
 * Крошки для текущего пути. Первый уровень — группа (если она есть), затем раздел,
 * затем — подпись детальной страницы, если путь глубже раздела.
 */
export function adminCrumbs(pathname: string, active: CrumbSource | null): string[] {
  if (!active) return ["Админка"];

  const crumbs: string[] = [];
  if (active.group) crumbs.push(active.group);
  crumbs.push(active.section);

  const tail = pathname.startsWith(active.href + "/") ? pathname.slice(active.href.length + 1) : "";
  const first = tail.split("/")[0];
  if (first) crumbs.push(detailLabel(active.href, decodeURIComponent(first)));

  return crumbs;
}
