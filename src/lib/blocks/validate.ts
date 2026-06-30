// Валидация контента + чек-лист готовности к отправке. Изоморфно: редактор (клиент) показывает гейт,
// submit-роут (сервер) применяет его повторно (никогда не доверяем клиенту). Нормализация — в normalize.ts.

import type { Block, Complexity } from "@/types";
import { normalizeBlocks } from "./normalize";

const MAX_BLOCKS = 400;
const MAX_BLOCK_TEXT = 20_000;
const MAX_TOTAL_TEXT = 500_000;
const UPLOADS_PREFIX = "/uploads/";

export type BlocksValidation =
  | { ok: true; blocks: Block[] }
  | { ok: false; error: string };

/** Структурная валидация + лимиты + политика URL. Возвращает уже нормализованные блоки. */
export function validateBlocks(raw: unknown): BlocksValidation {
  if (!Array.isArray(raw)) return { ok: false, error: "Поле blocks должно быть массивом." };
  if (raw.length > MAX_BLOCKS) return { ok: false, error: `Слишком много блоков (>${MAX_BLOCKS}).` };

  const blocks = normalizeBlocks(raw);
  let total = 0;
  for (const b of blocks) {
    const text = typeof b.text === "string" ? b.text : "";
    if (text.length > MAX_BLOCK_TEXT) return { ok: false, error: "Блок превышает лимит длины." };
    total += text.length;
    if (b.type === "image") {
      const src = typeof b.src === "string" ? b.src : "";
      if (src && !src.startsWith(UPLOADS_PREFIX)) {
        return { ok: false, error: "Изображение: разрешён только путь, начинающийся с /uploads/." };
      }
    }
    if (b.type === "embed") {
      const url = typeof b.url === "string" ? b.url : "";
      if (url && !/^https?:\/\//.test(url)) {
        return { ok: false, error: "Embed: разрешён только http(s)-URL." };
      }
    }
  }
  if (total > MAX_TOTAL_TEXT) return { ok: false, error: "Суммарный размер контента превышен." };
  return { ok: true, blocks };
}

// ───────────────────────────── чек-лист готовности к ревью ─────────────────────────────

export const COMPLEXITY_TIERS = {
  simple: { label: "Простая", min: 1, max: 2, hint: "1 ревьюер хватит; максимум 2." },
  medium: { label: "Средняя", min: 2, max: 3, hint: "2 ревьюера — оптимально; максимум 3." },
  complex: { label: "Сложная", min: 3, max: 5, hint: "Минимум 3 ревьюера; до 5 для глубокого ревью." },
} as const satisfies Record<Complexity, { label: string; min: number; max: number; hint: string }>;

export const MAX_SKILLS = 6;

export interface ReadinessInput {
  title: string;
  blocks: Block[];
  tags: string[];
  skills: string[];
  complexity: Complexity;
  reviewers: string[];
  primary: string | null;
}

export interface ReadinessCheck {
  id: string;
  label: string;
  ok: boolean;
}

function isSubstantive(b: Block): boolean {
  if (typeof b.text === "string" && b.text.trim()) return true;
  if (Array.isArray(b.items) && b.items.some((x) => typeof x === "string" && x.trim())) return true;
  if (Array.isArray(b.rows) && b.rows.length > 0) return true;
  if (typeof b.src === "string" && b.src.trim()) return true;
  if (typeof b.url === "string" && b.url.trim()) return true;
  return false;
}

/** 7 пунктов готовности (как в прототипе SubmitSheet). Гейт отправки = все ok. */
export function readinessChecklist(i: ReadinessInput): ReadinessCheck[] {
  const tier = COMPLEXITY_TIERS[i.complexity];
  const hasH2 = i.blocks.some((b) => b.type === "h2" && typeof b.text === "string" && b.text.trim());
  const substantive = i.blocks.filter(isSubstantive).length;
  return [
    { id: "title", label: "Заголовок главы (от 6 символов)", ok: i.title.trim().length >= 6 },
    { id: "h2", label: "Есть хотя бы один раздел (заголовок H2)", ok: hasH2 },
    { id: "blocks", label: "Не меньше трёх содержательных блоков", ok: substantive >= 3 },
    { id: "tags", label: "Хотя бы один тег блога", ok: i.tags.length >= 1 },
    {
      id: "skills",
      label: `Ключевые навыки статьи (1–${MAX_SKILLS})`,
      ok: i.skills.length >= 1 && i.skills.length <= MAX_SKILLS,
    },
    {
      id: "reviewers",
      label: `Ревьюеров по сложности: ${tier.min}–${tier.max}`,
      ok: i.reviewers.length >= tier.min && i.reviewers.length <= tier.max,
    },
    {
      id: "primary",
      label: "Назначен ведущий из выбранных",
      ok: !!i.primary && i.reviewers.includes(i.primary),
    },
  ];
}

export function isReadyToSubmit(i: ReadinessInput): boolean {
  return readinessChecklist(i).every((c) => c.ok);
}
