// Test-seed: наполняет тест-БД (по .env.test → file:blog.test.db) детерминированным набором.
// Запуск: npm run seed:test (= dotenv -e .env.test -- tsx src/lib/db/seed-test.ts).
// ⚠️ next dev НЕ читает .env.test автоматически — только через dotenv-cli (ENVIRONMENTS §3).
// Идемпотентно: повтор даёт тот же снимок (см. ./seed-core §Детерминизм).
import { db } from "./index";
import { seedAll } from "./seed-core";

async function main() {
  await seedAll(db);
  console.log(`[seed:test] тест-БД наполнена (DB_FILE_NAME=${process.env.DB_FILE_NAME ?? "blog.test.db"}).`);
  // libsql держит соединение — без явного выхода процесс висит (CLAUDE.md §Gotchas).
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed:test] ошибка:", err);
  process.exit(1);
});
