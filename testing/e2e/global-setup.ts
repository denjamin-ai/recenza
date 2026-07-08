import fs from "node:fs";
import { apiLoginAdmin, apiLoginUser, authFile, newApiContext, AUTH_DIR } from "./helpers/auth";
import { reseed } from "./helpers/db";
import { BLOG, CHAPTERS } from "./helpers/seed";

/**
 * Выполняется один раз перед прогоном (webServer уже поднят):
 * 1) reseed — детерминированный baseline даже при reuseExistingServer (локальный стенд
 *    мог быть «грязным» после ручной работы); storageState переживает reseed —
 *    ID пользователей в seed фиксированы, cookie шифрует userId.
 * 2) auth-state 4 ролей → testing/e2e/.auth/{reader,author,reviewer,admin}.json.
 * 3) Прогрев холодных роутов — компиляция next dev уходит из времени первого теста.
 */
export default async function globalSetup(): Promise<void> {
  reseed();
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  for (const role of ["reader", "author", "reviewer"] as const) {
    const ctx = await apiLoginUser(role);
    await ctx.storageState({ path: authFile(role) });
    await ctx.dispose();
  }
  const admin = await apiLoginAdmin();
  await admin.storageState({ path: authFile("admin") });
  await admin.dispose();

  // Прогрев: гостевые + ролевые сегменты (ошибки игнорируем — это только компиляция)
  const guestPaths = [
    "/",
    "/login",
    `/blog/${BLOG.slug}`,
    `/blog/${BLOG.slug}/${CHAPTERS.published.slug}`,
    "/board",
    "/admin/login",
  ];
  const warmups: Array<[string | undefined, string[]]> = [
    [undefined, guestPaths],
    [authFile("author"), ["/author", `/author/blog/${BLOG.slug}`, `/author/blog/${BLOG.slug}/${CHAPTERS.draft.slug}/edit`]],
    [authFile("reviewer"), ["/reviewer", `/reviewer/review/${CHAPTERS.underReview.id}`]],
    [authFile("admin"), ["/admin/dashboard", "/admin/users"]],
  ];
  for (const [state, paths] of warmups) {
    const ctx = await newApiContext(state);
    for (const p of paths) {
      await ctx.get(p).catch(() => {});
    }
    await ctx.dispose();
  }
}
