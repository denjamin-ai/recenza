// BLOG-MANAGE — переименование (inline dblclick, прототип author-portal) и удаление
// блога-черновика (DELETE /api/author/blogs/[id], гейт «только draft»; ui-feedback-3, класс L).
// Мутирует данные (создаёт/удаляет блоги-песочницы) → serial + reseed() в beforeAll И afterAll.
// Негативы API — через api()-фикстуру с Origin (same-origin CSRF).

import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "../fixtures";
import { reseed } from "../helpers/db";
import { BLOG, USERS } from "../helpers/seed";
import { throttleMutation } from "../helpers/throttle";

test.describe.configure({ mode: "serial" });

/** Блог-песочница (POST /api/author/blogs → blogId/blogSlug; глава main — draft). */
async function createSandbox(
  ctx: APIRequestContext,
  titlePrefix: string,
): Promise<{ blogId: string; blogSlug: string; title: string }> {
  await throttleMutation(USERS.author.handle);
  const title = `${titlePrefix} ${Date.now()}`;
  const res = await ctx.post("/api/author/blogs", { data: { title } });
  if (!res.ok()) throw new Error(`Песочница не создалась: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as { blogId: string; blogSlug: string };
  return { blogId: body.blogId, blogSlug: body.blogSlug, title };
}

test.describe("BLOG-MANAGE — переименование и удаление блога", () => {
  test.beforeAll(() => {
    reseed();
  });

  test.afterAll(() => {
    reseed();
  });

  // ── BLOG-RENAME — inline-переименование в детали блога ──────────────────────

  test("BLOG-RENAME @regression: dblclick по заголовку → Enter сохраняет новое название; Escape откатывает", async ({
    asAuthor,
    api,
  }) => {
    const { page } = asAuthor;
    const ctx = await api("author");
    const sandbox = await createSandbox(ctx, "Rename E2E");
    const renamed = `${sandbox.title} (v2)`;

    await test.step("dblclick → input, Enter → заголовок обновился", async () => {
      await asAuthor.goto(`/author/blog/${sandbox.blogSlug}`);
      const input = page.getByRole("textbox", { name: "Название блога" });
      // Ретрай против потери dblclick до гидрации.
      await expect(async () => {
        await page.getByRole("heading", { level: 1 }).dblclick();
        await expect(input).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await throttleMutation(USERS.author.handle);
      await input.fill(renamed);
      await input.press("Enter");
      await expect(page.getByRole("heading", { level: 1, name: renamed })).toBeVisible();
    });

    await test.step("dblclick → правка → Escape: название НЕ меняется", async () => {
      const input = page.getByRole("textbox", { name: "Название блога" });
      await expect(async () => {
        await page.getByRole("heading", { level: 1 }).dblclick();
        await expect(input).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await input.fill("Отменённое имя");
      await input.press("Escape");
      await expect(page.getByRole("heading", { level: 1, name: renamed })).toBeVisible();
    });

    await test.step("после reload название персистентно (PATCH дошёл до БД)", async () => {
      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: renamed })).toBeVisible();
    });
  });

  // ── BLOG-DELETE happy — danger-зона удаляет черновиковый блог ───────────────

  test("BLOG-DELETE @critical: черновиковый блог удаляется через диалог; повторный DELETE → 404", async ({
    asAuthor,
    api,
  }) => {
    const { page } = asAuthor;
    const ctx = await api("author");
    const sandbox = await createSandbox(ctx, "Delete E2E");

    await test.step("danger-зона: «Удалить блог» → подтверждение → redirect в кабинет", async () => {
      await asAuthor.goto(`/author/blog/${sandbox.blogSlug}`);
      await throttleMutation(USERS.author.handle);
      const dialog = page.getByRole("dialog", { name: "Подтверждение удаления блога" });
      await expect(async () => {
        await page.getByRole("button", { name: "Удалить блог" }).click();
        await expect(dialog).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await dialog.getByRole("button", { name: "Удалить", exact: true }).click();
      await page.waitForURL("**/author");
    });

    await test.step("блога нет в кабинете; повторный DELETE по API → 404", async () => {
      await expect(page.getByRole("heading", { name: sandbox.title })).toHaveCount(0);
      await throttleMutation(USERS.author.handle);
      const res = await ctx.delete(`/api/author/blogs/${sandbox.blogId}`);
      expect(res.status()).toBe(404);
    });
  });

  // ── BLOG-DELETE негативы — гейт «только черновики» и несуществующий id ──────

  test("BLOG-DELETE негативы @critical: блог с published/on-review главами → 409; несуществующий id → 404", async ({
    api,
  }) => {
    const ctx = await api("author");

    await test.step("seed-блог blog_async (published + under-review главы) → 409", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await ctx.delete(`/api/author/blogs/${BLOG.id}`);
      expect(res.status()).toBe(409);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toMatch(/удалить нельзя|снимите главы/i);
    });

    await test.step("несуществующий id → 404", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await ctx.delete("/api/author/blogs/blog_missing_e2e");
      expect(res.status()).toBe(404);
    });
  });

  // ── BLOG-DELETE гейтинг — роли ──────────────────────────────────────────────

  test("BLOG-DELETE гейтинг @critical: guest → 401, reader/reviewer → 403", async ({ api }) => {
    await test.step("guest без сессии → 401", async () => {
      const guest = await api();
      const res = await guest.delete(`/api/author/blogs/${BLOG.id}`);
      expect(res.status()).toBe(401);
    });

    await test.step("reader → 403", async () => {
      const reader = await api("reader");
      const res = await reader.delete(`/api/author/blogs/${BLOG.id}`);
      expect(res.status()).toBe(403);
    });

    await test.step("reviewer → 403", async () => {
      const reviewer = await api("reviewer");
      const res = await reviewer.delete(`/api/author/blogs/${BLOG.id}`);
      expect(res.status()).toBe(403);
    });
  });
});
