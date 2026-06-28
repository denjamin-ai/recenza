// CSRF-защита: same-origin на всех мутациях (CLAUDE.md §Безопасность «Все мутации требуют same-origin»).
// Сверяем host из заголовка Origin с заголовком Host. Браузер всегда шлёт Origin на POST/DELETE;
// harness (login.sh) шлёт `Origin: $BASE_URL`. Несовпадение / отсутствие → 403.

import { NextResponse } from "next/server";

/** Возвращает 403-NextResponse при нарушении same-origin, иначе null (запрос разрешён). */
export function assertSameOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  if (!origin || !host) {
    return forbidden("Запрос отклонён: отсутствует Origin.");
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return forbidden("Запрос отклонён: некорректный Origin.");
  }

  if (originHost !== host) {
    return forbidden("Запрос отклонён: межсайтовый запрос.");
  }

  return null;
}

function forbidden(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 403 });
}
