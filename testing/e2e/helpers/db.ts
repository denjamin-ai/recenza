import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..", "..");

/**
 * Полный сброс тест-БД: migrate + детерминированный seed (blog.test.db).
 * Безопасен при работающем dev:test-сервере — файл БД не удаляется, чистятся строки.
 * ВАЖНО: in-memory rate-limit сервера reseed НЕ сбрасывает (только рестарт стенда).
 */
export function reseed(): void {
  execSync("npm run test:reset", { cwd: ROOT, stdio: "pipe", timeout: 120_000 });
}
