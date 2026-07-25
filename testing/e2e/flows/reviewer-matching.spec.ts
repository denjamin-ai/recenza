// MATCH-* — подбор ревьюеров ПОСЛЕ Фазы 14.
//
// ⚠️ Что здесь больше не проверяется и почему: приглашений (`review_invitations`), согласия,
// отказа, флага «навыки не совпадают», роли «ведущего» и приватной оценки ★ в модели НЕТ.
// Автор не выбирает исполнителя — он оставляет заявку, а ревьюер берёт её сам (это канал 1,
// его сквозной флоу живёт в flows/review-queue.spec.ts). Здесь остались:
//   · MATCH-QUEUE   — как очередь ранжируется под компетенции конкретного ревьюера;
//   · MATCH-RECRUIT — канал 3: запрос в редакцию, когда очередь не помогла (одобрение → доска);
//   · MATCH-BOARD   — публичная доска и отклик на неё (вход новых ревьюеров).
//
// Мутирует seed и возможности аккаунтов → serial + reseed в beforeAll И afterAll.

import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { reseed } from "../helpers/db";
import { newApiContext } from "../helpers/auth";
import { CHAPTERS, DUO_BLOG, PASSWORD, USERS } from "../helpers/seed";
import { throttleMutation } from "../helpers/throttle";
import { AdminPage } from "../pages/admin.page";

test.describe.configure({ mode: "serial" });

/** Панель активного таба кабинета ревьюера (скрытые панели в a11y-дерево не попадают). */
function queueItems(page: Page) {
  return page.getByRole("tabpanel", { name: /Очередь/ }).getByRole("listitem");
}

test.describe("Подбор ревьюеров (MATCH-*)", () => {
  test.beforeAll(() => {
    reseed();
  });

  // Меняет возможности аккаунтов и публикует направления — возвращаем seed, чтобы grep-срез
  // оставался самодостаточным.
  test.afterAll(() => {
    reseed();
  });

  // ── MATCH-QUEUE — очередь ранжируется по компетенциям смотрящего ─────────────

  test("MATCH-QUEUE @critical: очередь отсортирована по совпадению компетенций ревьюера", async ({
    api,
    loginAs,
  }) => {
    const author = await api("author");

    await test.step("автор оставляет заявку с навыками из компетенций Сергея (Безопасность)", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await author.post(
        `/api/author/chapters/${CHAPTERS.changesRequested.id}/review-request`,
        { data: { skills: ["Безопасность"] } },
      );
      expect(res.status()).toBe(201);
    });

    await test.step("в очереди Сергея его заявка первая (100%), непрофильные — ниже (0%)", async () => {
      // Компетенции sergey_review — «Безопасность/Криптография»; сидовые заявки
      // («Генераторы/Итераторы», «Тайм-менеджмент») не пересекаются с ними вовсе.
      const sergey = await loginAs(USERS.sergey.handle);
      await sergey.goto("/reviewer");

      const items = queueItems(sergey.page);
      await expect(items.first()).toBeVisible();
      expect(await items.count()).toBeGreaterThanOrEqual(2);

      const first = items.first();
      await expect(first).toContainText(CHAPTERS.changesRequested.title);
      await expect(first).toContainText("совпадение 100%");

      // Непрофильная заявка в очереди есть, но с нулевым совпадением и ниже профильной.
      const offTopic = items.filter({ hasText: DUO_BLOG.chapter.title });
      await expect(offTopic).toContainText("совпадение 0%");
      expect(await items.filter({ hasText: "совпадение 100%" }).count()).toBe(1);
    });

    await test.step("ревьюеру с другими компетенциями та же заявка не выигрывает сортировку", async () => {
      // У max_review компетенции DevOps/Docker/CI-CD — «Безопасность» ему не подходит,
      // значит порядок очереди зависит от СМОТРЯЩЕГО, а не от самой заявки.
      const max = await loginAs(USERS.max.handle);
      await max.goto("/reviewer");
      const items = queueItems(max.page);
      await expect(items.first()).toBeVisible();
      await expect(items.filter({ hasText: CHAPTERS.changesRequested.title })).toContainText(
        "совпадение 0%",
      );
      await expect(items.filter({ hasText: "совпадение 100%" })).toHaveCount(0);
    });
  });

  // ── MATCH-RECRUIT — канал 3: запрос в редакцию → одобрение → доска ───────────

  test("MATCH-RECRUIT @critical: очередь не помогла → запрос админу → направление на доске", async ({
    api,
    asAdmin,
    asGuest,
  }) => {
    reseed();
    const DIRECTION = "Промисы и асинхронность";
    const author = await api("author");

    await test.step("автор просит редакцию подобрать ревьюеров под главу", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await author.post("/api/author/recruit-requests", {
        data: { chapterId: CHAPTERS.underReview.id, skills: ["Промисы", "Событийный цикл"] },
      });
      expect(res.status()).toBe(200);
      expect(((await res.json()) as { ok?: boolean }).ok).toBe(true);
    });

    await test.step("админ видит запрос и одобряет его, публикуя направление", async () => {
      const admin = new AdminPage(asAdmin.page);
      await asAdmin.goto("/admin/recruit");
      const row = asAdmin.page.getByRole("listitem").filter({ hasText: CHAPTERS.underReview.title });
      await expect(row).toBeVisible();
      await admin.approveRecruit(row, DIRECTION);
    });

    await test.step("гость видит направление на публичной доске", async () => {
      await asGuest.goto("/board");
      await expect(asGuest.page.getByRole("heading", { name: DIRECTION })).toBeVisible();
    });
  });

  // ── MATCH-BOARD — отклик с доски → возможность «ревьюер» (ПОСЛЕДНИЙ: меняет аккаунт) ─

  test("MATCH-BOARD @critical: заявка с доски → админ принимает → читатель становится ревьюером", async ({
    asReader,
    asAdmin,
  }) => {
    reseed();

    await test.step("reader подаёт заявку с доски (без поля «Имя» — identity из сессии)", async () => {
      await asReader.page.goto("/board");
      const dialog = asReader.page.getByRole("dialog", { name: "Заявка на ревью" });
      await expect(async () => {
        await asReader.page.getByRole("button", { name: "Стать ревьюером" }).click();
        await expect(dialog).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 15_000 });
      await expect(dialog.getByLabel("Имя", { exact: true })).toHaveCount(0);
      await dialog.getByLabel("Направление", { exact: true }).fill("Node.js");
      const skill = dialog.getByPlaceholder(/навык/i);
      await skill.fill("Node.js");
      await skill.press("Enter");
      await dialog.getByRole("button", { name: "Отправить заявку" }).click();
      await expect(asReader.page.getByText("Заявка отправлена! Администратор её рассмотрит.")).toBeVisible();
    });

    await test.step("админ принимает заявку с выдачей возможности", async () => {
      await asAdmin.goto("/admin/recruit");
      const row = asAdmin.page.locator("li", { hasText: "Рина Читатель" }).first();
      await expect(async () => {
        await row.getByRole("button", { name: /Принять/ }).first().click();
        await expect(row.getByRole("button", { name: /Принять/ })).toHaveCount(0, { timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
    });

    await test.step("аккаунт получил ВОЗМОЖНОСТЬ «ревьюер» и доступ к кабинету с очередью", async () => {
      const ctx = await newApiContext();
      const login = await ctx.post("/api/auth/user", {
        data: { handle: USERS.reader.handle, password: PASSWORD },
      });
      expect(login.ok()).toBe(true);
      const me = await ctx.get("/api/auth/user");
      const body = (await me.json()) as { user?: { isReviewer?: boolean; canAuthor?: boolean } };
      // Ф13: приём заявки выдаёт возможность, а не legacy-роль.
      expect(body.user?.isReviewer).toBe(true);
      // Базовые возможности не тронуты — аккаунт не «сменил роль», а получил новую.
      expect(body.user?.canAuthor).toBe(false);
      // Гейт кабинета читает возможность из БД — редиректа на / больше нет.
      const cabinet = await ctx.get("/reviewer", { maxRedirects: 0 });
      expect(cabinet.status()).toBe(200);
      // Ф14: новый ревьюер сразу видит общую очередь — чужие открытые заявки ему доступны.
      const html = await (await ctx.get("/reviewer")).text();
      expect(html).toContain(DUO_BLOG.title);
      expect(html).toContain(DUO_BLOG.chapter.title);
      await ctx.dispose();
    });

    // Возвращаем исходные возможности для последующих прогонов/спеков.
    reseed();
  });
});
