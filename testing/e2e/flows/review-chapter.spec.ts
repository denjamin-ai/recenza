// REV-CHAPTER / REV-PRIMARY — сквозной редакционный цикл главы и смена ведущего.
// TC-док: testing/test-cases/TC-FLOWS.md. Пошаговый удачный проход — MCP-FINDINGS §1 + sections/04.
// Мутирует seed целиком → serial + reseed() в beforeAll. Multi-context: asAuthor/asReviewer/asAdmin/loginAs.

import { test, expect } from "../fixtures";
import { reseed } from "../helpers/db";
import { BLOG, CHAPTERS, USERS } from "../helpers/seed";
import { EditorPage } from "../pages/editor.page";
import { ReviewPage } from "../pages/review.page";

test.describe.configure({ mode: "serial" });

test.describe("REV-CHAPTER / REV-PRIMARY", () => {
  test.beforeAll(() => {
    reseed();
  });

  // Публикует chp_draft — восстанавливаем seed после файла, чтобы --grep @smoke был самодостаточен.
  test.afterAll(() => {
    reseed();
  });

  // ── REV-CHAPTER — draft → published целиком ──────────────────────────────────

  test("REV-CHAPTER @smoke @critical: submit → accept → тред-правка → применить и закрыть → одобрить → опубликовать → ридер", async ({
    asAuthor,
    asReviewer,
    asGuest,
    api,
  }) => {
    const editor = new EditorPage(asAuthor.page);
    const reviewByReviewer = new ReviewPage(asReviewer.page);
    const reviewByAuthor = new ReviewPage(asAuthor.page);

    await test.step("0. подготовка: у «Генераторы» ≥3 содержательных блоков (гейт готовности)", async () => {
      // Сидовый черновик = H2 + абзац (2 блока) — чек-лист требует ≥3. Насыщаем через API (draft редактируем).
      const ctx = await api("author");
      const res = await ctx.patch(`/api/author/chapters/${CHAPTERS.draft.id}`, {
        data: {
          blocks: [
            { type: "h2", text: "Генераторы e2e" },
            { type: "p", text: "Первый содержательный абзац для готовности главы." },
            { type: "p", text: "Второй содержательный абзац для готовности главы." },
            { type: "p", text: "Третий содержательный абзац для готовности главы." },
          ],
        },
      });
      expect(res.ok()).toBe(true);
    });

    await test.step("1. автор отправляет «Генераторы» на ревью (Простая, ведущий — Раиса Ревьюер)", async () => {
      await editor.goto(BLOG.slug, CHAPTERS.draft.slug);
      await editor.openSubmitSheet();
      // Простая сложность → допускается 1 ревьюер (иначе чек-лист требует 2–3).
      await editor.submitSheet.getByRole("button", { name: /^Простая/ }).click();
      // Навыки уже заданы в seed («Генераторы, Итераторы»); под навыки матчей нет (0%) → вкладка «Все».
      await editor.reviewersFilterTab("Все").click();
      await editor.reviewerCheckbox(/Раиса Ревьюер/).check();
      await editor.makePrimary(/Раиса Ревьюер/);
      await expect(editor.readyFooter).toBeVisible();
      await editor.submit(BLOG.slug);
    });

    await test.step("2. ревьюер принимает приглашение → глава в активных", async () => {
      await asReviewer.goto("/reviewer");
      await expect(async () => {
        await asReviewer.page.getByRole("button", { name: "Принять" }).first().click();
        await expect(asReviewer.page.getByRole("link", { name: new RegExp(CHAPTERS.draft.title) })).toBeVisible({
          timeout: 3_000,
        });
      }).toPass({ timeout: 20_000 });
    });

    const suggestionText = `Исправленный текст e2e ${Date.now()}`;

    await test.step("3. ревьюер создаёт тред-правку (suggestion) на блоке", async () => {
      await reviewByReviewer.gotoAsReviewer(CHAPTERS.draft.id);
      const firstBlockId = await asReviewer.page.locator("[data-block-id]").first().getAttribute("data-block-id");
      await expect(async () => {
        await reviewByReviewer.startThreadOnBlock(firstBlockId!);
        await expect(reviewByReviewer.composerMode("Правка")).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
      await reviewByReviewer.composerMode("Правка").click();
      await reviewByReviewer.suggestionInput.fill(suggestionText);
      await reviewByReviewer.proposeButton.click();
      await expect(reviewByReviewer.threadsRail.getByText(/правка/).first()).toBeVisible();
    });

    await test.step("4. автор «Применить и закрыть» → блок обновлён, тред решён", async () => {
      await reviewByAuthor.gotoAsAuthor(BLOG.slug, CHAPTERS.draft.slug);
      await expect(async () => {
        await asAuthor.page.getByRole("button", { name: "Применить и закрыть" }).first().click();
        await expect(asAuthor.page.getByText(/решено/).first()).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
      await expect(asAuthor.page.getByText(suggestionText).first()).toBeVisible();
    });

    await test.step("5. ревьюер одобряет", async () => {
      await asReviewer.page.reload();
      await reviewByReviewer.approve();
    });

    await test.step("6. автор публикует (кнопка появилась после единственного approve)", async () => {
      await asAuthor.page.reload();
      await expect(reviewByAuthor.publishButton).toBeVisible();
      await reviewByAuthor.publish();
    });

    await test.step("7. гость видит опубликованную главу с ревьюером", async () => {
      const res = await asGuest.page.goto(`/blog/${BLOG.slug}/${CHAPTERS.draft.slug}`);
      expect(res?.status()).toBe(200);
      await expect(asGuest.page.getByRole("region", { name: "Ревьюеры главы" })).toBeVisible();
      await expect(
        asGuest.page.getByRole("region", { name: "Ревьюеры главы" }).getByText(/Раиса Ревьюер/),
      ).toBeVisible();
    });
  });

  // ── bauble ↔ thread sync ────────────────────────────────────────────────────

  test("REV-CHAPTER-bauble @critical: bauble на блоке связан с карточкой треда, «→ блок» скроллит", async ({
    asReviewer,
  }) => {
    const review = new ReviewPage(asReviewer.page);
    await review.gotoAsReviewer(CHAPTERS.underReview.id);

    // На chp_under_review в seed есть открытые треды (thr_open_1/2) с bauble на блоках.
    await expect(review.threadsRail).toBeVisible();
    const bauble = review.bauble(/тред/).first();
    await expect(bauble).toBeVisible();

    // «→ блок» из первой карточки треда скроллит к блоку обсуждения.
    const firstCard = review.threadsRail.getByRole("button", { name: "Перейти к блоку обсуждения" }).first();
    await firstCard.click();
    // После скролла соответствующий блок в области видимости
    await expect(asReviewer.page.locator("[data-block-id]").first()).toBeInViewport();
  });

  // ── «Нужны правки» → changes-requested ──────────────────────────────────────

  test("REV-REQUEST-CHANGES @critical: вердикт «Нужны правки» → пилюля запроса правок", async ({ asReviewer }) => {
    const review = new ReviewPage(asReviewer.page);
    await review.gotoAsReviewer(CHAPTERS.underReview.id);
    await review.requestChanges();
    await expect(asReviewer.page.getByText(/запрос правок/i).first()).toBeVisible();
  });

  // ── REV-PRIMARY — смена ведущего через админа ────────────────────────────────

  test("REV-PRIMARY @critical: автор запрашивает смену ведущего → админ утверждает → инбокс lena", async ({
    asAuthor,
    asAdmin,
    loginAs,
  }) => {
    const review = new ReviewPage(asAuthor.page);

    await test.step("автор запрашивает смену ведущего на Лену (2 принявших: reviewer+lena)", async () => {
      await review.gotoAsAuthor(BLOG.slug, CHAPTERS.underReview.slug);
      await expect(async () => {
        await review.requestPrimaryChange(/Лена Базы/, "нужен профильный ведущий e2e");
        await expect(review.toast(/смену ведущего/i)).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
    });

    await test.step("админ утверждает запрос смены", async () => {
      await asAdmin.goto("/admin/review");
      await asAdmin.page.getByRole("button", { name: "Утвердить смену" }).first().click();
    });

    await test.step("Лена видит себя ведущей в инбоксе", async () => {
      const lena = await loginAs(USERS.lena.handle);
      await lena.goto("/reviewer");
      await expect(lena.page.getByText("вы ведущий").first()).toBeVisible();
    });
  });
});
