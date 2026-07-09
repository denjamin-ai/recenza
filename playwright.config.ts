import { randomBytes } from "node:crypto";
import { defineConfig } from "@playwright/test";
import dotenv from "dotenv";

// ADMIN_PASSWORD_PLAIN и прочие переменные тест-стенда — из .env.test (не .env.local!)
dotenv.config({ path: ".env.test" });

// CRON_SECRET для cron.spec (Фаза 12): если в .env.test не задан — генерируем эфемерный и
// отдаём его И спекам (process.env), И webServer-у (env ниже; dotenv-cli не перетирает
// унаследованные переменные, отсутствующие в файле). ⚠️ Если стенд :3001 поднят ВРУЧНУЮ без
// CRON_SECRET, cron.spec упадёт на 401 — задай переменную в .env.test или перезапусти стенд.
if (!process.env.CRON_SECRET) {
  process.env.CRON_SECRET = randomBytes(24).toString("hex");
}

export default defineConfig({
  testDir: "./testing/e2e",
  globalSetup: "./testing/e2e/global-setup.ts",
  // Единый общий тест-стенд :3001 → строго последовательное исполнение
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  // next dev компилирует роуты при первом обращении — таймауты с запасом
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["html", { outputFolder: "testing/reports/playwright-html", open: "never" }],
    ["list"],
  ],
  use: {
    baseURL: "http://localhost:3001",
    locale: "ru-RU",
    navigationTimeout: 30_000,
    // «Мёртвые» клики до гидрации + first-compile (MCP-FINDINGS §4)
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    // dev:test сам делает test:reset (migrate + детерминированный seed) перед стартом
    command: "npm run dev:test",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { CRON_SECRET: process.env.CRON_SECRET ?? "" },
  },
});
