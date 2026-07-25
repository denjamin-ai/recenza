// CRON-* — отложенная публикация через /api/cron/publish (Фаза 12).
// Требует CRON_SECRET в .env.test (стенд и спек читают одно значение через dotenv) — без него skip.
// Негативы 401 (нет/неверный Bearer) — в security.spec (SEC-CRON-01), они работают и без секрета.
//
// Мутирует seed (публикация главы) → serial + reseed в beforeAll И afterAll (дисциплина flows/*).
//
// ⚠️ Фаза 13: планирование больше НЕ требует одобрений — публикация свободна, роут переехал
// в /api/author/chapters/[id]/publish. Поэтому сценарий «гейт перестал проходить» исчез:
// единственная причина, по которой cron не публикует запланированное — ревизию опубликовали иначе.

import { test, expect } from "./fixtures";
import { CHAPTERS, USERS, BLOG } from "./helpers/seed";
import { reseed } from "./helpers/db";
import { throttleMutation } from "./helpers/throttle";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const AUTH = { authorization: `Bearer ${CRON_SECRET}` };
const publishHref = (chapterId: string) => `/api/author/chapters/${chapterId}/publish`;

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
    const author = await api("author");

    await test.step("Автор планирует публикацию на +3с → 200 scheduled:true (ревьюеры не нужны)", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await author.post(publishHref(CHAPTERS.underReview.id), {
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

  test("CRON-02 @critical: ручная публикация до срока снимает план — cron ничего не делает и не дублирует", async ({
    api,
  }) => {
    reseed(); // независимый сценарий: свежий seed, глава снова черновик на ревью
    const author = await api("author");

    await test.step("План на +30с, затем автор публикует главу вручную", async () => {
      await throttleMutation(USERS.author.handle);
      const planned = await author.post(publishHref(CHAPTERS.underReview.id), {
        data: { scheduledAt: Math.floor(Date.now() / 1000) + 30 },
      });
      expect(planned.status()).toBe(200);

      await throttleMutation(USERS.author.handle);
      const now = await author.post(publishHref(CHAPTERS.underReview.id), { data: {} });
      expect(now.status()).toBe(200);
    });

    await test.step("Cron: due=0 — публикация сняла план (двойного fan-out нет)", async () => {
      const res = await author.get("/api/cron/publish", { headers: AUTH });
      const body = (await res.json()) as { due: number; published: number; failed: number };
      expect(body.due).toBe(0);
      expect(body.published).toBe(0);
      expect(body.failed).toBe(0);
    });

    await test.step("Повторная публикация той же версии → 409 (идемпотентность)", async () => {
      await throttleMutation(USERS.author.handle);
      const again = await author.post(publishHref(CHAPTERS.underReview.id), { data: {} });
      expect(again.status()).toBe(409);
      expect(((await again.json()) as { error?: string }).error).toBe(
        "Эта версия главы уже опубликована.",
      );
    });
  });
});
