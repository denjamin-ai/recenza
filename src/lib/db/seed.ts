// Dev-seed: наполняет dev-БД (по .env.local → file:blog.db) детерминированным набором.
// Запуск: npm run seed (= dotenv -e .env.local -- tsx src/lib/db/seed.ts).
// Контент общий с тест-стендом — единый построитель ./seed-core.
import { db } from "./index";
import { seedAll } from "./seed-core";

async function main() {
  await seedAll(db);
  console.log(`[seed] БД наполнена (DB_FILE_NAME=${process.env.DB_FILE_NAME ?? "blog.db"}).`);
  // libsql держит соединение — без явного выхода процесс висит (CLAUDE.md §Gotchas).
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] ошибка:", err);
  process.exit(1);
});
