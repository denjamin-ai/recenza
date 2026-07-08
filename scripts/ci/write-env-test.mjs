/**
 * Генерирует .env.test для эфемерного CI-стенда. GitHub-секреты не нужны:
 * пароль админа и SESSION_SECRET создаются на лету и живут один прогон.
 *
 * ⚠️ Экранирование '$' в bcrypt-хэше: значение .env.test проходит ДВА expand-прохода
 * (dotenv-cli → @next/env), поэтому каждый '$' пишется как '\\$' (см. CLAUDE.md, Фаза 4).
 */
import { writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const target = new URL("../../.env.test", import.meta.url);

if (existsSync(target) && !process.env.CI) {
  console.error("[write-env-test] .env.test уже существует — локальный файл не перезаписываю (запусти с CI=1, если нужно).");
  process.exit(1);
}

const adminPassword = randomBytes(12).toString("hex"); // без '$' — expand-безопасно
const hash = bcrypt.hashSync(adminPassword, 10);
const escapedHash = hash.replaceAll("$", "\\\\$"); // '$' → '\\$' (двойной expand)

const env = [
  "# Сгенерировано scripts/ci/write-env-test.mjs — эфемерный CI-стенд",
  "DB_FILE_NAME=blog.test.db",
  `SESSION_SECRET=${randomBytes(32).toString("hex")}`,
  `ADMIN_PASSWORD_HASH=${escapedHash}`,
  `ADMIN_PASSWORD_PLAIN=${adminPassword}`,
  `CRON_SECRET=${randomBytes(24).toString("hex")}`,
  "NEXT_PUBLIC_BASE_URL=http://localhost:3001",
  "TURSO_CONNECTION_URL=",
  "TURSO_AUTH_TOKEN=",
  "",
].join("\n");

writeFileSync(target, env, "utf8");
console.log("[write-env-test] .env.test создан (DB_FILE_NAME=blog.test.db, секреты сгенерированы).");
