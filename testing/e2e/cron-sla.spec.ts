// SLA-* — свипы сроков заявок на ревью: GET /api/cron/review-sla (Фаза 14).
//
// Три свипа (сроки — src/lib/review-sla.ts, 14 / 21 день):
//   1. ЭСКАЛАЦИЯ  open + channel='queue' + просрочено → channel='editorial' (+ уведомление админу);
//   2. ИСТЕЧЕНИЕ  open + channel='editorial' + просрочено → expired, ось ревью → none;
//   3. ВОЗВРАТ    claimed + просрочено И БЕЗ признаков работы → обратно в очередь, reviewLoad −1.
// Признак работы = вердикт ИЛИ тред/сообщение в чате от взявшего ПОСЛЕ claim; при его наличии срок
// просто продлевается — медленное ревью не наказывается.
//
// ⚠️ Как и cron.spec.ts, свипы требуют CRON_SECRET в .env.test (стенд и спек читают одно значение
// через dotenv) — без него describe со свипами пропускается. Негативы 401 работают всегда и живут
// в отдельном describe без skip.
//
// Мутирует seed (каналы заявок, уведомления) → serial + reseed в beforeAll И afterAll.

import { test, expect } from "./fixtures";
import { reseed } from "./helpers/db";
import { CHAPTERS } from "./helpers/seed";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const AUTH = { authorization: `Bearer ${CRON_SECRET}` };
const SLA_HREF = "/api/cron/review-sla";

interface SlaSweepResult {
  ok: boolean;
  due: number;
  escalated: number;
  expired: number;
  returned: number;
}

test.describe("CRON SLA — защита роута", () => {
  test("SLA-01 @critical: без Bearer и с неверным токеном → 401", async ({ api }) => {
    const ctx = await api();

    const anonymous = await ctx.get(SLA_HREF);
    expect(anonymous.status()).toBe(401);

    const wrong = await ctx.get(SLA_HREF, { headers: { authorization: "Bearer nope-not-the-secret" } });
    expect(wrong.status()).toBe(401);

    // Пустой Bearer тоже не проходит (constant-time сравнение сначала сверяет длину).
    const empty = await ctx.get(SLA_HREF, { headers: { authorization: "Bearer " } });
    expect(empty.status()).toBe(401);
  });
});

test.describe("CRON SLA — свипы сроков", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !CRON_SECRET,
    "CRON_SECRET не задан в .env.test — добавьте строку CRON_SECRET=<hex> и перезапустите стенд",
  );

  test.beforeAll(() => {
    reseed();
  });
  test.afterAll(() => {
    reseed();
  });

  test("SLA-02 @critical: просроченная заявка эскалируется в редакцию, молчащая — возвращается в очередь", async ({
    api,
    asAuthor,
  }) => {
    const ctx = await api();

    await test.step("прогон: due = обе просроченные заявки, эскалация сработала", async () => {
      const res = await ctx.get(SLA_HREF, { headers: AUTH });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as SlaSweepResult;
      expect(body.ok).toBe(true);
      // req_stale (open, просрочена, глава забаненного автора) + req_silent (claimed, просрочена).
      expect(body.due).toBeGreaterThanOrEqual(2);
      // Эскалация не смотрит на видимость главы в очереди — просроченная заявка уходит в редакцию.
      expect(body.escalated).toBeGreaterThanOrEqual(1);
      // Свип 2 работает только по заявкам, уже переведённым в 'editorial' — на первом тике их нет.
      expect(body.expired).toBe(0);
      // Свип 3: `req_silent` взята ревьюером и просрочена, а вся его активность по этой главе
      // (тред и сообщения чата) датирована РАНЬШЕ claim'а — значит признаков работы после взятия
      // нет, и заявка обязана вернуться в очередь. Сид специально держит `claimedAt` позже них.
      expect(body.returned).toBeGreaterThanOrEqual(1);
    });

    await test.step("молчащая заявка вернулась в очередь, ревьюер снят, слот освобождён", async () => {
      await asAuthor.goto("/author");
      const card = asAuthor.page
        .getByRole("region", { name: "Заявки на ревью" })
        .getByRole("listitem")
        .filter({ hasText: CHAPTERS.underReview.title });
      await expect(card).toBeVisible();
      // Больше не «В работе»: исполнителя сняли, заявка снова ждёт ревьюера в общей очереди.
      await expect(card).toContainText("В очереди");
      await expect(card).not.toContainText("Взял в работу");
      // Срок отсчитан заново — заявка не остаётся вечно просроченной.
      await expect(card).toContainText(/осталось \d+ дн|остался 1 день/);
      // Счётчик возвратов виден автору: это сигнал, что канал очереди не сработал.
      await expect(card).toContainText(/возвращалась в очередь/i);
    });
  });

  test("SLA-03 @critical: повторный тик идемпотентен — обработанные заявки не трогаются дважды", async ({
    api,
  }) => {
    const ctx = await api();
    const res = await ctx.get(SLA_HREF, { headers: AUTH });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as SlaSweepResult;
    // Первый тик отодвинул дедлайны вперёд — просроченных заявок не осталось.
    expect(body.due).toBe(0);
    expect(body.escalated).toBe(0);
    expect(body.expired).toBe(0);
    expect(body.returned).toBe(0);
  });
});
