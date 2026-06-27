import { defineConfig } from "drizzle-kit";

// dialect `turso` (не `sqlite`). Правило выбора БД идентично src/lib/db/index.ts:
// какую БД мигрировать решает env-файл, поданный через dotenv-cli (.env.local / .env.test).
export default defineConfig({
  dialect: "turso",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // «пуст → file:» (ENVIRONMENTS §2): пустая строка трактуется как отсутствие, не только undefined.
    url:
      process.env.TURSO_CONNECTION_URL?.trim() ||
      `file:${process.env.DB_FILE_NAME ?? "blog.db"}`,
    authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
  },
});
