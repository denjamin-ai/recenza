// Content-Security-Policy с per-request nonce (аудит ИБ 2026-07-26, закрывает backlog Фазы 12).
//
// ⚠️ ЭТОТ MIDDLEWARE — ТОЛЬКО CSP. Он НЕ является гейтом аутентификации и не должен им становиться:
//    гейтинг в Recenza пороутовый (require*/require*Page + resolveReviewAccess), и «страховка» на
//    уровне middleware создала бы ложное чувство защиты в обход явных гардов. Ничего, кроме
//    заголовков, здесь не решается.
//
// Зачем nonce, а не 'unsafe-inline': Next инлайнит бутстрап-скрипты, а next-themes — скрипт выбора
// темы ДО гидрации (иначе мигает светлая тема). 'unsafe-inline' в script-src обесценил бы политику.
// Схема стандартная для Next: middleware кладёт nonce в ЗАПРОС (заголовок x-nonce), Next
// проставляет его своим тегам сам, а корневой layout читает его и передаёт в ThemeProvider.
//
// В приложении пять санкционированных dangerouslySetInnerHTML (JSON-LD, Shiki, KaTeX ×2, Mermaid).
// Самый слабый — Mermaid: он клиентский и полагается на собственный DOMPurify (securityLevel:
// "strict"). CSP — второй рубеж именно под него.

import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const isProd = process.env.NODE_ENV === "production";

  const directives = [
    "default-src 'self'",
    // 'strict-dynamic' — чтобы чанки, подгружаемые доверенным бутстрапом Next, не требовали
    // перечисления по URL. В dev Turbopack-HMR использует eval → без 'unsafe-eval' стенд не грузится.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isProd ? "" : "'unsafe-eval'"}`.trim(),
    // 'unsafe-inline' в СТИЛЯХ обязателен: KaTeX и Shiki пишут инлайн-style в разметку, Mermaid
    // добавляет <style> в SVG. Риск несопоставим с script-src: инлайн-стиль кода не исполняет.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Свой origin для fetch к /api; в dev — ws для HMR.
    `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ];
  const csp = directives.join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next читает nonce ИМЕННО из CSP на запросе и проставляет его своим инлайн-скриптам.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Всё, кроме статики и загруженных файлов:
     *  - _next/static, _next/image — контент-хэшированные ассеты, CSP им не нужен;
     *  - uploads — в проде их отдаёт Caddy мимо Next (заголовки — в Caddyfile), в dev это public/;
     *  - favicon/robots/sitemap — статика.
     * prefetch-запросы Next исключены, чтобы не тратить nonce на них.
     */
    {
      source:
        "/((?!_next/static|_next/image|uploads/|favicon.ico|robots.txt|sitemap.xml|feed.xml).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
