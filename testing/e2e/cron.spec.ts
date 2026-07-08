// CRON-* — отложенная публикация через /api/cron/publish (Фаза 12).
// Требует CRON_SECRET в .env.test (стенд и спек читают одно значение через dotenv) — без него skip.
// Негативы 401 (нет/неверный Bearer) — в security.spec (SEC-CRON-01), они работают и без секрета.
//
// Мутирует seed (approve обоих ревьюеров chp_under_review + публикация) → serial + reseed
// в beforeAll И afterAll (дисциплина flows/*). Порядок значим: happy-path, затем gate-failure.

import { test, expect } from "./fixtures";
import { apiLoginUser } from "./helpers/auth";
import { CHAPTERS, USERS, BLOG } from "./helpers/seed";
import { reseed } from "./helpers/db";
import { throttleMutation } from "./helpers/throttle";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const AUTH = { authorization: `Bearer ${CRON_SECRET}` };

/** Оба назначенных ревьюера chp_under_review дают approve → гейт публикации открыт. */
async function approveAll(): Promise<void> {
  for (const handle of [USERS.reviewer.handle, USERS.lena.handle]) {
    const ctx = await apiLoginUser(handle);
    await throttleMutation(handle);
    const res = await ctx.post(`/api/review/${CHAPTERS.underReview.id}/verdict`, {
      data: { verdict: "approve" },
    });
    expect(res.ok()).toBeTruthy();
    await ctx.dispose();
  }
}

test.describe("CRON — отложенная публикация", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!CRON_SECRET, "CRON_SECRET не задан в .env.test — добавьте строку CRON_SECRET=<hex> и перезапустите стенд");

  test.beforeAll(() => {
    reseed();
  });
  test.afterAll(() => {
    reseed();
  });

  test("CRON-01 @critical: план в будущем не публикуется, наступивший — публикуется, план очищается", async ({
    api,
  }) => {
    await approveAll();
    const author = await api("author");

    await test.step("Автор планирует публикацию на +3с → 200 scheduled:true", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await author.post(`/api/review/${CHAPTERS.underReview.id}/publish`, {
        data: { scheduledAt: Math.floor(Date.now() / 1000) + 3 },
      });
      expect(res.status()).toBe(200);
      expect(((await res.json()) as { scheduled: boolean }).scheduled).toBe(true);
    });

    await test.step("Cron до срока: due=0, глава не опубликована", async () => {
      const res = await author.get("/api/cron/publish", { headers: AUTH });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { due: number; published: number };
      expect(body.due).toBe(0);
      expect(body.published).toBe(0);
    });

    await test.step("Cron после срока: published=1, глава читается гостем", async () => {
      await new Promise((r) => setTimeout(r, 3_500));
      const res = await author.get("/api/cron/publish", { headers: AUTH });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { due: number; published: number; failed: number };
      expect(body.published).toBe(1);
      expect(body.failed).toBe(0);

      const pub = await author.get(`/blog/${BLOG.slug}/${CHAPTERS.underReview.slug}`, { maxRedirects: 0 });
      expect(pub.status()).toBe(200);
    });

    await test.step("Повторный cron: план очищен — due=0 (идемпотентность)", async () => {
      const res = await author.get("/api/cron/publish", { headers: AUTH });
      expect(((await res.json()) as { due: number }).due).toBe(0);
    });
  });

  test("CRON-02 @critical: вердикт отозван после планирования — cron снимает план и уведомляет автора", async ({
    api,
  }) => {
    reseed(); // независимый сценарий: свежий seed, глава снова under-review
    await approveAll();
    const author = await api("author");

    await test.step("План на +1с, затем lena меняет вердикт на request-changes", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await author.post(`/api/review/${CHAPTERS.underReview.id}/publish`, {
        data: { scheduledAt: Math.floor(Date.now() / 1000) + 1 },
      });
      expect(res.status()).toBe(200);

      const lena = await apiLoginUser(USERS.lena.handle);
      await throttleMutation(USERS.lena.handle);
      const verdict = await lena.post(`/api/review/${CHAPTERS.underReview.id}/verdict`, {
        data: { verdict: "request-changes" },
      });
      expect(verdict.ok()).toBeTruthy();
      await lena.dispose();
    });

    await test.step("Cron: failed=1, план снят, автору пришло scheduled_publish_failed", async () => {
      await new Promise((r) => setTimeout(r, 1_500));
      const res = await author.get("/api/cron/publish", { headers: AUTH });
      const body = (await res.json()) as { published: number; failed: number };
      expect(body.published).toBe(0);
      expect(body.failed).toBe(1);

      // План очищен: повторный тик пуст, глава НЕ опубликована.
      const again = await author.get("/api/cron/publish", { headers: AUTH });
      expect(((await again.json()) as { due: number }).due).toBe(0);

      const feed = (await (await author.get("/api/notifications")).json()) as {
        items: Array<{ type: string }>;
      };
      expect(feed.items.some((i) => i.type === "scheduled_publish_failed")).toBe(true);
    });
  });
});
