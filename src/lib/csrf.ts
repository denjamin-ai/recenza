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

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return forbidden("Запрос отклонён: некорректный Origin.");
  }

  if (parsed.host !== host) {
    return forbidden("Запрос отклонён: межсайтовый запрос.");
  }

  // ⚠️ Аудит ИБ 2026-07-26: схему тоже сверяем. Раньше сравнивался только host, из-за чего
  // `Origin: http://recenza.ru` принимался на HTTPS-сайте (protocol confusion). На проде это
  // прикрыто HSTS, но полагаться на внешний рубеж в CSRF-проверке незачем.
  // В dev/тесте контур http://localhost — поэтому https требуем только в проде.
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    return forbidden("Запрос отклонён: небезопасная схема Origin.");
  }

  return null;
}

function forbidden(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 403 });
}
