// Подбор ревьюеров (Фаза 9) — ЧИСТЫЙ модуль: без db/auth/drizzle-импортов, чтобы клиентский
// SubmitSheet мог пересчитывать match%/«Топ» вживую при правке навыков (как split review-links.ts).
// Сервер остаётся источником правды: match% перепроверяется на /submit и /invitations (flag-гейт).
//
// Термины (binding, см. skill review-flow-domain):
//   competencies — что умеет ревьюер (users.competencies)
//   skills       — навыки статьи (chapters.skills), обязательны для отправки и видны читателю
//   match.pct    — доля навыков статьи, покрытых компетенциями ревьюера
//   «Топ»        — композит: навыки 50% + рейтинг 30% + объём 20%

export type Availability = "free" | "busy" | "full";

/** Объём, дающий максимальный вклад (≥ этого числа отрецензированных глав → volume = 1). */
export const VOLUME_CAP = 60;

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

/** Занятость: load≥capacity → full (не выбирается); load=0 → free; иначе busy. */
export function availability(load: number, capacity: number): Availability {
  if (load >= capacity) return "full";
  if (load <= 0) return "free";
  return "busy";
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** «Топ» = навыки 50% + рейтинг 30% + объём 20% → 0..100 (binding-веса). */
export function topScore(input: { matchPct: number; rating: number | null; reviewsCount: number }): number {
  const skills = clamp01(input.matchPct / 100);
  const rating = clamp01((input.rating ?? 0) / 5);
  const volume = clamp01(input.reviewsCount / VOLUME_CAP);
  return Math.round((0.5 * skills + 0.3 * rating + 0.2 * volume) * 100);
}

/** Кандидат для ранжирования (одна форма для сервера и клиента). */
export interface ReviewerMatchInput {
  handle: string;
  displayName: string;
  competencies: string[];
  rating: number | null; // агрегат (в «Топ» идёт только он, не отдельные оценки)
  ratingsN: number;
  reviewsCount: number; // число отрецензированных глав (reviewer_history)
  availability: Availability;
}

export interface RankedReviewer extends ReviewerMatchInput {
  matchPct: number;
  matched: string[];
  top: number;
}

/**
 * Ранжирование по «Топ» (desc). onlyMatched → только match.pct > 0 (вкладка «По навыкам»).
 * Тай-брейк — имя (стабильный порядок). full-ревьюеров НЕ фильтруем (их дизейблит UI).
 */
export function rankReviewers(
  reviewers: ReviewerMatchInput[],
  skills: string[],
  opts: { onlyMatched?: boolean } = {},
): RankedReviewer[] {
  const ranked = reviewers.map((r): RankedReviewer => {
    const m = skillMatch(r.competencies, skills);
    return {
      ...r,
      matchPct: m.pct,
      matched: m.matched,
      top: topScore({ matchPct: m.pct, rating: r.rating, reviewsCount: r.reviewsCount }),
    };
  });
  const filtered = opts.onlyMatched ? ranked.filter((r) => r.matchPct > 0) : ranked;
  return filtered.sort((a, b) => b.top - a.top || a.displayName.localeCompare(b.displayName, "ru"));
}
