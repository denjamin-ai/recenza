// URL-слаги для блогов/глав: транслитерация кириллицы → ASCII, нижний регистр, дефисы.
// ⚠️ НЕ путать с slugify() из src/components/blocks/anchors.ts — тот СОХРАНЯЕТ кириллицу для #-якорей
// (Unicode id), что некорректно для URL. Здесь — именно ASCII-слаг для путей /blog/<slug>.

const RU_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};

function transliterate(input: string): string {
  let out = "";
  for (const ch of input.toLowerCase()) {
    out += ch in RU_MAP ? RU_MAP[ch] : ch;
  }
  return out;
}

/**
 * Превращает заголовок в URL-слаг: транслит → [a-z0-9-], схлопывание дефисов, обрезка по краям.
 * Пустой результат (нет латиницы/цифр) → "" (вызывающий подставит fallback, напр. ulid-хвост).
 */
export function slugify(input: string): string {
  return transliterate(input)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // комбинируемая диакритика
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

/**
 * Делает слаг уникальным через инъектируемый предикат `exists` (обычно — запрос к БД в скоупе).
 * База пустая → fallback. Коллизии → `<base>-2`, `<base>-3`, … (до 50 попыток, затем суффикс времени-независим:
 * берём усечённый исходный uniqueness-ключ, который передаёт вызывающий через fallback).
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
  fallback = "blog",
): Promise<string> {
  const root = base || fallback;
  if (!(await exists(root))) return root;
  for (let n = 2; n <= 50; n++) {
    const candidate = `${root}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
  // крайне маловероятно: 50 коллизий — пусть вызывающий поймает unique-violation (catch → 409).
  return `${root}-${50}`;
}
