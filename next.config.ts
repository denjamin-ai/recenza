import type { NextConfig } from "next";

// Security-заголовки (Фаза 12) — на все пути. HSTS здесь НЕ ставим: его добавляет Caddy только
// на HTTPS-контуре прода (из next.config он отравил бы http://localhost). Полный CSP — backlog:
// inline-скрипты Next/next-themes требуют nonce-middleware (см. Журнал Фазы 12 в PLAN.md).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Прод-деплой на VPS (Фаза 12): деплой-CI собирает standalone-артефакт (server.js без
  // node_modules) и возит его в /srv/recenza/releases/<sha> — см. runbook в ENVIRONMENTS.md.
  // Условно (BUILD_STANDALONE=1 только в deploy.yml): standalone ломает `next start`,
  // которым пользуются lighthouse-workflow и локальная проверка прод-сборки.
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  // ⚠️ Без excludes file-tracer (@libsql dynamic require) утаскивает в standalone ВЕСЬ проект,
  // включая .env*, .git и локальные БД — утечка секретов в артефакт релиза (найдено на Фазе 12).
  outputFileTracingExcludes: {
    "*": [
      ".env*",
      "blog.db",
      "blog.test.db",
      ".git/**",
      ".github/**",
      ".claude/**",
      ".playwright-mcp/**",
      "docs/**",
      "testing/**",
      "deploy/**",
      "test-results/**",
      "scripts/**",
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
