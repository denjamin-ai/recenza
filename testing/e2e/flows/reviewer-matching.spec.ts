// MATCH-INVITE / decline / flag / MATCH-RECRUIT / MATCH-BOARD — подбор ревьюеров, согласие,
// приватная оценка, recruit-запрос и заявка с доски. TC-док: TC-FLOWS.md; проход — sections/05.
// Мутирует seed и роли → serial + reseed() в beforeAll; MATCH-BOARD меняет роль reader → reseed в конце теста.

import { test, expect } from "../fixtures";
import { reseed } from "../helpers/db";
import { newApiContext } from "../helpers/auth";
import { BLOG, CHAPTERS, PASSWORD, USERS } from "../helpers/seed";
import { EditorPage } from "../pages/editor.page";
import { ReviewPage } from "../pages/review.page";
import { AdminPage } from "../pages/admin.page";

test.describe.configure({ mode: "serial" });

// Готовит «Генераторы» к отправке: ≥3 содержательных блока (гейт чек-листа).
async function prepareDraftBlocks(api: (role?: "author") => Promise<import("@playwright/test").APIRequestContext>) {
  const ctx = await api("author");
  const res = await ctx.patch(`/api/author/chapters/${CHAPTERS.draft.id}`, {
    data: {
      blocks: [
        { type: "h2", text: "Генераторы e2e" },
        { type: "p", text: "Первый содержательный абзац для готовности." },
        { type: "p", text: "Второй содержательный абзац для готовности." },
        { type: "p", text: "Третий содержательный абзац для готовности." },
      ],
    },
  });
  expect(res.ok()).toBe(true);
}

test.describe("Подбор ревьюеров (MATCH-*)", () => {
  test.beforeAll(() => {
    reseed();
  });

  // ── MATCH-INVITE — навыки → приглашение → accept → approve → publish → оценка ─

  test("MATCH-INVITE @critical: подбор → приглашение sergey → accept → одобрение → публикация → приватная оценка", async ({
    asAuthor,
    asGuest,
    api,
    loginAs,
  }) => {
    const editor = new EditorPage(asAuthor.page);

    await test.step("подбор: под навыки «Генераторы, Итераторы» матчей нет (0% у всех) — вкладка «По навыкам» пуста", async () => {
      await prepareDraftBlocks(api);
      await editor.goto(BLOG.slug, CHAPTERS.draft.slug);
      await editor.openSubmitSheet();
      await editor.reviewersFilterTab("По навыкам").click();
      await expect(editor.submitSheet.getByText("Ревьюеры под эти навыки не найдены.")).toBeVisible();
    });

    await test.step("приглашаем Сергея (Простая, ведущий) → submit", async () => {
      await editor.submitSheet.getByRole("button", { name: /^Простая/ }).click();
      await editor.reviewersFilterTab("Все").click();
      await editor.reviewerCheckbox(/Сергей Секьюрити/).check();
      await editor.makePrimary(/Сергей Секьюрити/);
      await expect(editor.readyFooter).toBeVisible();
      await editor.submit(BLOG.slug);
    });

    const sergey = await loginAs(USERS.sergey.handle);
    const review = new ReviewPage(sergey.page);

    await test.step("Сергей принимает приглашение и одобряет главу", async () => {
      await sergey.goto("/reviewer");
      await expect(async () => {
        await sergey.page.getByRole("button", { name: "Принять" }).first().click();
        await expect(sergey.page.getByRole("link", { name: new RegExp(CHAPTERS.draft.title) })).toBeVisible({
          timeout: 3_000,
        });
      }).toPass({ timeout: 20_000 });
      await review.gotoAsReviewer(CHAPTERS.draft.id);
      await review.approve();
    });

    await test.step("автор публикует и ставит приватную оценку 4★", async () => {
      const authorReview = new ReviewPage(asAuthor.page);
      await authorReview.gotoAsAuthor(BLOG.slug, CHAPTERS.draft.slug);
      await expect(authorReview.publishButton).toBeVisible();
      await authorReview.publish();

      await asAuthor.goto("/author");
      const ratingCard = asAuthor.page.getByRole("heading", { name: "Оцените ревьюеров" });
      await expect(ratingCard).toBeVisible();
      // Клик по звезде ретраим (потеря до гидрации); успех — секция исчезает после refresh.
      await expect(async () => {
        await asAuthor.page.getByRole("button", { name: "4 — Хорошо" }).first().click();
        await expect(ratingCard).toBeHidden({ timeout: 4_000 });
      }).toPass({ timeout: 25_000 });
    });

    await test.step("приватность: на /u/sergey-review виден только агрегат, без индивидуальной оценки", async () => {
      await asGuest.page.goto(`/u/${USERS.sergey.slug}`);
      await expect(asGuest.page.getByText(/оцен/i).first()).toBeVisible(); // агрегат «★ … · N оценок»
      // «Оценка приватная …» — подпись только в кабинете автора, не на публичном профиле
      await expect(asGuest.page.getByText("Оценка приватная")).toHaveCount(0);
    });
  });

  // ── MATCH-DECLINE — отклонение приглашения ──────────────────────────────────

  test("MATCH-DECLINE @critical: ревьюер отклоняет приглашение → автор уведомлён", async ({
    asAuthor,
    api,
    loginAs,
  }) => {
    reseed();
    const editor = new EditorPage(asAuthor.page);

    await test.step("автор приглашает Макса на «Генераторы»", async () => {
      await prepareDraftBlocks(api);
      await editor.goto(BLOG.slug, CHAPTERS.draft.slug);
      await editor.openSubmitSheet();
      await editor.submitSheet.getByRole("button", { name: /^Простая/ }).click();
      await editor.reviewersFilterTab("Все").click();
      await editor.reviewerCheckbox(/Макс Девопс/).check();
      await editor.makePrimary(/Макс Девопс/);
      await expect(editor.readyFooter).toBeVisible();
      await editor.submit(BLOG.slug);
    });

    await test.step("Макс отклоняет → его инбокс пуст", async () => {
      const max = await loginAs(USERS.max.handle);
      await max.goto("/reviewer");
      await expect(async () => {
        await max.page.getByRole("button", { name: "Отклонить" }).first().click();
        await expect(max.page.getByText("Новых приглашений нет.")).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
    });

    await test.step("автор видит уведомление об отказе", async () => {
      await asAuthor.goto("/author");
      await asAuthor.page.reload();
      await asAuthor.page.getByRole("button", { name: /^Уведомления/ }).click();
      await expect(asAuthor.page.getByRole("menu", { name: "Уведомления" }).getByText(/отклонил/i)).toBeVisible();
    });
  });

  // ── MATCH-FLAG — «навыки не совпадают» ──────────────────────────────────────

  test("MATCH-FLAG @critical: flag «навыки не совпадают» (match<50%) → глава снята с ревью", async ({
    asAuthor,
    loginAs,
  }) => {
    reseed();
    // Сидовое pending-приглашение inv_pending: sergey → «Промисы изнутри» (0% совпадение).
    const sergey = await loginAs(USERS.sergey.handle);
    await sergey.goto("/reviewer");
    await expect(async () => {
      await sergey.page.getByRole("button", { name: "Навыки не совпадают" }).first().click();
      // Приглашение исчезает из входящих
      await expect(sergey.page.getByText("Новых приглашений нет.")).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });

    await test.step("автор: в кабинете секция «Навыки не совпадают» (глава снята с ревью)", async () => {
      // Секция flag-алерта — в кабинете /author, не на детали блога (MCP-FINDINGS §2).
      await asAuthor.goto("/author");
      await asAuthor.page.reload();
      await expect(asAuthor.page.getByRole("heading", { name: "Навыки не совпадают" })).toBeVisible();
    });
  });

  // ── MATCH-RECRUIT — запрос админу → одобрение → доска ────────────────────────

  test("MATCH-RECRUIT @critical: нет совпадений → запрос админу → одобрение → направление на доске", async ({
    asAuthor,
    asAdmin,
    asGuest,
    api,
  }) => {
    reseed();
    const editor = new EditorPage(asAuthor.page);

    await test.step("автор: пустой подбор → «Запросить ревьюеров у админа»", async () => {
      await prepareDraftBlocks(api);
      await editor.goto(BLOG.slug, CHAPTERS.draft.slug);
      await editor.openSubmitSheet();
      await editor.reviewersFilterTab("По навыкам").click();
      await expect(async () => {
        await editor.submitSheet.getByRole("button", { name: "Запросить ревьюеров у админа" }).click();
        await expect(asAuthor.page.getByText(/Запрос отправлен админу/)).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
    });

    await test.step("админ одобряет запрос → публикует направление на доске", async () => {
      const admin = new AdminPage(asAdmin.page);
      await asAdmin.goto("/admin/recruit");
      const row = asAdmin.page.locator("li", { hasText: "Генераторы" }).first();
      await admin.approveRecruit(row, "Генераторы и итераторы");
    });

    await test.step("гость видит направление на /board", async () => {
      await asGuest.page.goto("/board");
      await expect(asGuest.page.getByRole("heading", { name: /Генераторы/ })).toBeVisible();
    });
  });

  // ── MATCH-BOARD — заявка с доски → выдача роли (ПОСЛЕДНИЙ: меняет роль reader) ─

  test("MATCH-BOARD @critical: заявка с доски → админ принимает → reader становится ревьюером", async ({
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

    await test.step("админ принимает заявку с выдачей роли", async () => {
      await asAdmin.goto("/admin/recruit");
      const row = asAdmin.page.locator("li", { hasText: "Рина Читатель" }).first();
      await expect(async () => {
        await row.getByRole("button", { name: /Принять/ }).first().click();
        await expect(row.getByRole("button", { name: /Принять/ })).toHaveCount(0, { timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
    });

    await test.step("reader теперь reviewer: логин ведёт роль reviewer", async () => {
      const ctx = await newApiContext();
      const login = await ctx.post("/api/auth/user", { data: { handle: USERS.reader.handle, password: PASSWORD } });
      expect(login.ok()).toBe(true);
      const me = await ctx.get("/api/auth/user");
      const body = (await me.json()) as { user?: { role?: string } };
      expect(body.user?.role).toBe("reviewer");
      await ctx.dispose();
    });

    // Возвращаем роль reader для последующих прогонов/спеков.
    reseed();
  });
});
