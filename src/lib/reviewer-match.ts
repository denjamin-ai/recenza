// Совпадение компетенций и навыков — ЧИСТЫЙ модуль (без db/auth/drizzle), поэтому его свободно
// тянут и сервер, и клиент.
//
// ⚠️ Фаза 14 «перевернула» подбор: раньше считали «какой ревьюер подходит автору» (пикер в
// SubmitSheet, композит «Топ» = навыки 50% + рейтинг 30% + объём 20%), теперь — «какая заявка
// подходит ЭТОМУ ревьюеру» в его очереди. Аргументы поменялись местами, сама функция сравнения
// не изменилась ни на строку. Вместе с пикером и рейтингом снесены `topScore`, `rankReviewers`,
// `availability` и типы кандидатов: считать «рейтинг 30%» стало не из чего, а сортировать
// кандидатов больше некому — очередь сортируется по match% и возрасту заявки
// (`src/lib/queries/review-requests.ts`).
//
// Термины (binding, см. skill review-flow-domain):
//   competencies — что умеет ревьюер (users.competencies)
//   skills       — навыки статьи (chapter_revisions.skills), обязательны для ЗАЯВКИ и видны читателю
//   match.pct    — доля навыков статьи, покрытых компетенциями ревьюера

/**
 * Токены строки: lowercase → split по не-(буква/цифра/точка) → отбрасываем токены ≤2 символов.
 * Точка сохраняется, чтобы «node.js» оставался одним токеном (а «snake_case» бьётся по «_»).
 */
export function tokenize(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of s.toLowerCase().split(/[^a-zа-яё0-9.]+/)) {
    if (w.length > 2) out.add(w);
  }
  return out;
}

export interface MatchResult {
  /** Навыки статьи, покрытые компетенциями ревьюера (для UI-чипов). */
  matched: string[];
  /** Кол-во покрытых навыков (= matched.length). */
  covered: number;
  /** Всего навыков статьи. */
  total: number;
  /** round(covered / total * 100); при total=0 → 0. */
  pct: number;
}

/** Навык статьи «покрыт», если его токены пересекаются с объединением токенов компетенций. */
export function skillMatch(competencies: string[], skills: string[]): MatchResult {
  const total = skills.length;
  if (total === 0) return { matched: [], covered: 0, total: 0, pct: 0 };

  const compTokens = new Set<string>();
  for (const c of competencies) for (const t of tokenize(c)) compTokens.add(t);

  const matched: string[] = [];
  for (const skill of skills) {
    for (const t of tokenize(skill)) {
      if (compTokens.has(t)) {
        matched.push(skill);
        break;
      }
    }
  }
  const covered = matched.length;
  return { matched, covered, total, pct: Math.round((covered / total) * 100) };
}
