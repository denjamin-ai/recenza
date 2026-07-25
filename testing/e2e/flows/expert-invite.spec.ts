// EXP-* — инвайт-ссылка эксперта (Фаза 14, канал 2 из трёх).
//
// Канал нужен там, где очередь бессильна: на платформе может не быть ревьюера с нужными
// компетенциями, и автор приводит своего эксперта. Плата за это — прозрачность: одобрение
// приведённого автором эксперта даёт бейдж уровня `invited` (проверяется в review-queue.spec).
//
// Ключевой инвариант безопасности — АНТИ-ОРАКУЛ: несуществующий, отработавший и истёкший токен
// обязаны давать один и тот же ответ и одну и ту же страницу. Иначе публичная страница
// превращается в проверялку существования токенов (EXP-02/03).
//
// ⚠️ Выпуск ссылки UI-точки входа не имеет (панели «Пригласить эксперта» в кабинете нет) —
// работаем с `POST /api/author/expert-invites` напрямую, как и предписано контрактом фазы.
//
// Мутирует seed (гасит инвайты, создаёт анкеты) → serial + reseed в beforeAll И afterAll.

import { test, expect } from "../fixtures";
import { newApiContext } from "../helpers/auth";
import { reseed } from "../helpers/db";
import { EXPERT_INVITES, CHAPTERS, USERS } from "../helpers/seed";
import { throttleMutation } from "../helpers/throttle";

test.describe.configure({ mode: "serial" });

/** Публичная отправка анкеты лимитирована 1/5с по IP → каждому вызову свой X-Forwarded-For. */
async function guestApi(xff: string) {
  return newApiContext(undefined, { "x-forwarded-for": xff });
}

const applyHref = (token: string) => `/api/invite/${token}/apply`;
const APPLY_BODY = { name: "Пётр Эксперт", area: "Наблюдаемость", skills: ["OpenTelemetry"] };

interface InviteCreated {
  ok: boolean;
  token: string;
  url: string;
  expiresAt: number;
}

test.describe("Инвайт-ссылка эксперта (EXP-*)", () => {
  test.beforeAll(() => {
    reseed();
  });
  test.afterAll(() => {
    reseed();
  });

  // ── EXP-01 — выпуск ссылки → анкета гостя → разбор у админа ──────────────────

  test("EXP-01 @critical: автор выпускает ссылку → гость заполняет анкету → она у админа", async ({
    api,
    asAuthor,
    asGuest,
    asAdmin,
  }) => {
    const author = await api("author");
    const NAME = "Ольга Эксперт E2E";
    const AREA = "Наблюдаемость";
    let token = "";

    await test.step("POST /api/author/expert-invites → 201 с токеном и сроком жизни", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await author.post("/api/author/expert-invites", {
        data: { chapterId: CHAPTERS.draft.id },
      });
      expect(res.status()).toBe(201);
      const body = (await res.json()) as InviteCreated;
      expect(body.ok).toBe(true);
      expect(body.token).toBeTruthy();
      expect(body.url).toBe(`/invite/${body.token}`);
      expect(body.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
      token = body.token;
    });

    await test.step("выпущенная ссылка видна автору в панели кабинета", async () => {
      await asAuthor.goto("/author");
      const panel = asAuthor.page.getByRole("region", { name: "Пригласить эксперта" });
      // Сидовая einv_active тоже привязана к этой главе — карточек две, берём первую.
      const items = panel.getByRole("listitem").filter({ hasText: CHAPTERS.draft.title });
      await expect(items.first()).toBeVisible();
      await expect(items.first()).toContainText("Ждёт ответа");
      expect(await items.count()).toBeGreaterThanOrEqual(2);
    });

    await test.step("гость открывает ссылку: приглашение от автора + повод (глава)", async () => {
      await asGuest.goto(`/invite/${token}`);
      await expect(
        asGuest.page.getByRole("heading", { name: /приглашает вас рецензировать/ }),
      ).toBeVisible();
      await expect(asGuest.page.getByText(new RegExp(CHAPTERS.draft.title))).toBeVisible();
    });

    await test.step("анкета отправляется и подтверждается экраном «спасибо»", async () => {
      const { page } = asGuest;
      await page.getByLabel("Имя", { exact: true }).fill(NAME);
      await page.getByLabel("Направление", { exact: true }).fill(AREA);
      const skill = page.getByLabel("Добавить навык");
      await skill.fill("OpenTelemetry");
      await skill.press("Enter");
      await page.getByLabel("О вашем опыте").fill("Веду наблюдаемость в проде пять лет.");

      await expect(async () => {
        await page.getByRole("button", { name: "Отправить анкету" }).click();
        await expect(
          page.getByText("Анкета отправлена. Редакция свяжется с вами и заведёт аккаунт."),
        ).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: 30_000 });
    });

    await test.step("анкета видна админу в разборе откликов", async () => {
      // ⚠️ Пометки «пришло по приглашению автора» в админке НЕТ: `reviewer_applications.invited_by`
      // пишется, но `getAdminRecruit` его не выбирает и страница не рендерит (см. отчёт фазы).
      // Проверяем то, что реально доходит до админа: имя, направление и навыки анкеты.
      await asAdmin.goto("/admin/recruit");
      const row = asAdmin.page.getByRole("listitem").filter({ hasText: NAME });
      await expect(row).toBeVisible();
      await expect(row).toContainText(AREA);
      await expect(row).toContainText("OpenTelemetry");
    });

    await test.step("повторная отправка по уже использованной ссылке → 409", async () => {
      const guest = await guestApi("10.44.0.1");
      try {
        const res = await guest.post(applyHref(token), { data: APPLY_BODY });
        expect(res.status()).toBe(409);
        expect(((await res.json()) as { error?: string }).error).toBe("Ссылка недействительна.");
      } finally {
        await guest.dispose();
      }
    });
  });

  // ── EXP-02 — истёкший токен ─────────────────────────────────────────────────

  test("EXP-02 @critical: истёкшая ссылка — нейтральная заглушка и 409 на отправку", async ({
    asGuest,
  }) => {
    await test.step("страница отдаёт «Ссылка недействительна» без деталей", async () => {
      await asGuest.goto(`/invite/${EXPERT_INVITES.expired.token}`);
      await expect(
        asGuest.page.getByRole("heading", { name: "Ссылка недействительна" }),
      ).toBeVisible();
      // Ни автора, ни главы, ни формы: истёкший токен не раскрывает ничего.
      await expect(asGuest.page.getByRole("button", { name: "Отправить анкету" })).toHaveCount(0);
      await expect(asGuest.page.getByText(/приглашает вас рецензировать/)).toHaveCount(0);
    });

    await test.step("POST по истёкшему токену → 409", async () => {
      const guest = await guestApi("10.44.0.2");
      try {
        const res = await guest.post(applyHref(EXPERT_INVITES.expired.token), { data: APPLY_BODY });
        expect(res.status()).toBe(409);
        expect(((await res.json()) as { error?: string }).error).toBe("Ссылка недействительна.");
      } finally {
        await guest.dispose();
      }
    });
  });

  // ── EXP-03 — анти-оракул: несуществующий = истёкший ─────────────────────────

  test("EXP-03 @critical: несуществующий токен неотличим от истёкшего (анти-оракул)", async ({
    asGuest,
  }) => {
    const MISSING = "e2e-token-which-never-existed";

    await test.step("страницы совпадают дословно", async () => {
      await asGuest.goto(`/invite/${EXPERT_INVITES.expired.token}`);
      const expiredCard = await asGuest.page
        .getByRole("heading", { name: "Ссылка недействительна" })
        .locator("xpath=..")
        .innerText();

      await asGuest.goto(`/invite/${MISSING}`);
      const missingCard = await asGuest.page
        .getByRole("heading", { name: "Ссылка недействительна" })
        .locator("xpath=..")
        .innerText();

      expect(missingCard).toBe(expiredCard);
    });

    await test.step("ответы API совпадают по статусу и телу", async () => {
      const a = await guestApi("10.44.0.3");
      const b = await guestApi("10.44.0.4");
      try {
        const expired = await a.post(applyHref(EXPERT_INVITES.expired.token), { data: APPLY_BODY });
        const missing = await b.post(applyHref(MISSING), { data: APPLY_BODY });
        expect(missing.status()).toBe(expired.status());
        expect(missing.status()).toBe(409);
        expect(await missing.json()).toEqual(await expired.json());
      } finally {
        await a.dispose();
        await b.dispose();
      }
    });
  });

  // ── EXP-04 — одноразовость токена ───────────────────────────────────────────

  test("EXP-04 @critical: свежая ссылка срабатывает один раз — вторая отправка 409", async ({
    api,
  }) => {
    const author = await api("author");
    await throttleMutation(USERS.author.handle);
    const created = await author.post("/api/author/expert-invites", { data: {} });
    expect(created.status()).toBe(201);
    const { token } = (await created.json()) as InviteCreated;

    const first = await guestApi("10.44.0.5");
    const second = await guestApi("10.44.0.6");
    try {
      const ok = await first.post(applyHref(token), {
        data: { ...APPLY_BODY, name: "Одноразовый Эксперт" },
      });
      expect(ok.status()).toBe(200);
      expect(((await ok.json()) as { ok?: boolean }).ok).toBe(true);

      const again = await second.post(applyHref(token), { data: APPLY_BODY });
      expect(again.status()).toBe(409);
      expect(((await again.json()) as { error?: string }).error).toBe("Ссылка недействительна.");
    } finally {
      await first.dispose();
      await second.dispose();
    }
  });

  // ── EXP-05 — выпуск и отзыв ссылки из кабинета автора ───────────────────────

  test("EXP-05 @critical: автор создаёт и отзывает ссылку из кабинета; чужой id → 404", async ({
    asAuthor,
    api,
  }) => {
    const panel = asAuthor.page.getByRole("region", { name: "Пригласить эксперта" });
    const generic = panel.getByRole("listitem").filter({ hasText: "Приглашение в платформу" });

    await test.step("«Создать ссылку» добавляет карточку без привязки к главе", async () => {
      await asAuthor.goto("/author");
      await expect(async () => {
        await panel.getByRole("button", { name: "Создать ссылку" }).click();
        await expect(generic.first()).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: 30_000 });
    });

    await test.step("«Отозвать» убирает её из активных", async () => {
      const before = await generic.count();
      await expect(async () => {
        await generic.first().getByRole("button", { name: "Отозвать" }).click();
        await expect(generic).toHaveCount(before - 1, { timeout: 5_000 });
      }).toPass({ timeout: 30_000 });
    });

    await test.step("DELETE несуществующей ссылки → 404 (чужую не отличить от отсутствующей)", async () => {
      const author = await api("author");
      // Отзыв из UI только что израсходовал окно action-rate-limit (1/сек) — 429 ретраим.
      await expect(async () => {
        await throttleMutation(USERS.author.handle);
        const res = await author.delete("/api/author/expert-invites/einv-not-a-real-id");
        expect(res.status()).toBe(404);
      }).toPass({ timeout: 20_000 });
    });
  });
});
