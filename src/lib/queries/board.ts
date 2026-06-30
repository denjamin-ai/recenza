// Публичная доска «Ищем ревьюеров» (Фаза 10, §11.6). Read-only, без авторизации.

import { db } from "@/lib/db";
import { boardCalls } from "@/lib/db/schema";
import { parseJson } from "@/lib/db/json";

export interface BoardCallView {
  id: string;
  area: string;
  skills: string[];
  waiting: number;
  note: string | null;
  hot: boolean;
}

export async function getPublicBoardCalls(): Promise<BoardCallView[]> {
  const rows = await db.select().from(boardCalls);
  return rows
    .map((c) => ({ id: c.id, area: c.area, skills: parseJson<string[]>(c.skills, []), waiting: c.waiting, note: c.note, hot: c.hot }))
    .sort((a, b) => Number(b.hot) - Number(a.hot) || a.area.localeCompare(b.area, "ru"));
}
