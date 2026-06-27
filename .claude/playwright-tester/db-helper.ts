// Read-only интроспекция тест-БД для harness (используется db-query.sh / cleanup-test-data.sh).
// НЕ часть кода приложения: лежит вне src/, исключён из tsconfig/eslint, запускается через tsx.
// Драйвер — @libsql/client напрямую на file:${DB_PATH} (без зависимости от sqlite3 CLI на Windows).
// Именованные таблицы — через Drizzle (allowlist). Режим `sql` — escape-hatch: только одиночный
// SELECT/PRAGMA (составные запросы с `;` отклоняются). Это ОДОБРЕННОЕ tooling-исключение из политики
// «no raw SQL» (.claude/rules/security.md): файл вне src/, read-only, доступен только тому, у кого
// есть ФС-доступ к тест-БД (не удалённый вектор).
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "../../src/lib/db/schema";

const DB_PATH = process.env.DB_PATH ?? "blog.test.db";
const client = createClient({ url: `file:${DB_PATH}` });
const db = drizzle(client, { schema });

// allowlist: имя таблицы в CLI (= snake_case как в БД) → drizzle-объект.
const TABLES = {
  users: schema.users,
  app_settings: schema.appSettings,
  blogs: schema.blogs,
  chapters: schema.chapters,
  chapter_revisions: schema.chapterRevisions,
  chapter_reviewers: schema.chapterReviewers,
  reviewer_history: schema.reviewerHistory,
  threads: schema.threads,
  thread_replies: schema.threadReplies,
  review_chat: schema.reviewChat,
  review_checklists: schema.reviewChecklists,
  public_comments: schema.publicComments,
  comment_votes: schema.commentVotes,
  chapter_votes: schema.chapterVotes,
  bookmarks: schema.bookmarks,
  follows: schema.follows,
  notifications: schema.notifications,
  portfolios: schema.portfolios,
  reports: schema.reports,
  primary_change_requests: schema.primaryChangeRequests,
  removed_reviewers: schema.removedReviewers,
  review_invitations: schema.reviewInvitations,
  reviewer_ratings: schema.reviewerRatings,
  recruit_requests: schema.recruitRequests,
  board_calls: schema.boardCalls,
  reviewer_applications: schema.reviewerApplications,
  promo_banners: schema.promoBanners,
  donation_methods: schema.donationMethods,
};

function printRows(rows) {
  console.log(`(${rows.length} строк)`);
  console.log(JSON.stringify(rows, null, 2));
}

async function main() {
  const [, , cmd, arg] = process.argv;

  if (!cmd || cmd === "--help" || cmd === "-h") {
    console.log('db-helper: <table> | user <handle> | sql "<SELECT…>"');
    console.log("Таблицы:", Object.keys(TABLES).join(", "));
    return;
  }

  if (cmd === "user") {
    if (!arg) throw new Error("usage: db-query user <handle>");
    printRows(await db.select().from(schema.users).where(eq(schema.users.handle, arg)));
    return;
  }

  if (cmd === "sql") {
    if (!arg) throw new Error('usage: db-query sql "<SELECT…>"');
    // Снимаем один завершающий ';' (удобство CLI), затем запрещаем любой внутренний ';' (составные).
    const q = arg.trim().replace(/;\s*$/, "");
    // Только одиночный SELECT/PRAGMA: ведущий оператор + запрет `SELECT 1; DELETE …`.
    if (!/^(select|pragma)\b/i.test(q) || q.includes(";")) {
      throw new Error("В режиме sql разрешён только одиночный SELECT/PRAGMA без внутренних ';' (read-only harness).");
    }
    printRows((await client.execute(q)).rows);
    return;
  }

  const table = TABLES[cmd];
  if (!table) {
    throw new Error(`Неизвестная таблица '${cmd}'. Доступны: ${Object.keys(TABLES).join(", ")}`);
  }
  printRows(await db.select().from(table));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[db-helper]", err instanceof Error ? err.message : err);
    process.exit(1);
  });
