// Публичная доска «Ищем ревьюеров» (Фаза 10, §11.6). Read-only, без авторизации.

import { db } from "@/lib/db";
import { boardCalls } from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";

export interface BoardCallView {
  id: string;
  area: string;
  skills: string[];
  note: string | null;
  hot: boolean;
}

/**
 * ⚠️ Ф15 (З-57, решение владельца): `board_calls.waiting` больше НЕ читается. Колонка ставилась
 * нулём при создании направления, никаким API не менялась и автопересчёта не имела — публичная
 * доска годами показывала «0 глав ждут». Колонка остаётся в БД как legacy (деструктивные миграции
 * запрещены), новый код её не использует.
 */
export async function getPublicBoardCalls(): Promise<BoardCallView[]> {
  const rows = await db.select().from(boardCalls);
  return rows
    .map((c) => ({ id: c.id, area: c.area, skills: parseJson<string[]>(c.skills, []), note: c.note, hot: c.hot }))
    .sort((a, b) => Number(b.hot) - Number(a.hot) || a.area.localeCompare(b.area, "ru"));
}
