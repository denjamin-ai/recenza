// REV-CHAPTER — сквозной редакционный цикл главы (Фаза 14: заявка → claim → тред → вердикт →
// публикация → бейдж в ридере). TC-док: testing/test-cases/TC-FLOWS.md.
//
// ⚠️ Что изменилось против Ф9–Ф13 и почему шаги переписаны:
//   • автор больше НЕ выбирает исполнителя — пикер ревьюеров, приглашения и согласие сняты;
//     он оставляет ЗАЯВКУ (`POST /api/author/chapters/{id}/review-request`);
//   • ревьюер берёт заявку сам из таба «Очередь» кабинета («Взять» →
//     `POST /api/reviewer/requests/{id}/claim`) — именно claim создаёт `chapter_reviewers`,
//     поэтому весь downstream (треды/вердикты/чат) остался прежним;
//   • REV-PRIMARY («смена ведущего») УДАЛЁН: роли, таблицы и обоих роутов больше нет —
//     остался только негатив REV-NO-PRIMARY (404).
//
// Мутирует seed целиком → serial + reseed() в beforeAll И afterAll.
// Multi-context: asAuthor/asReviewer/asGuest/api.

import { test, expect } from "../fixtures";
import { reseed } from "../helpers/db";
import { BLOG, CHAPTERS, USERS } from "../helpers/seed";
import { throttleMutation } from "../helpers/throttle";
import { EditorPage } from "../pages/editor.page";
import { ReviewPage } from "../pages/review.page";

test.describe.configure({ mode: "serial" });

test.describe("REV-CHAPTER", () => {
  test.beforeAll(() => {
    reseed();
  });

  // Публикует chp_draft — восстанавливаем seed после файла, чтобы --grep @smoke был самодостаточен.
  test.afterAll(() => {
    reseed();
  });

  // ── REV-CHAPTER — draft → published целиком ──────────────────────────────────

  test("REV-CHAPTER @smoke @critical: заявка → ревьюер берёт из очереди → тред-правка → применить и закрыть → одобрить → опубликовать → бейдж в ридере", async ({
    asAuthor,
    asReviewer,
    asGuest,
    api,
  }) => {
    test.slow(); // мультиролевой флоу: 8+ навигаций, на холодном dev-сервере first-compile до 10 с/роут
    const editor = new EditorPage(asAuthor.page);
    const reviewByReviewer = new ReviewPage(asReviewer.page);
    const reviewByAuthor = new ReviewPage(asAuthor.page);
    const ctx = await api("author");

    await test.step("0. подготовка: у «Генераторы» ≥3 содержательных блоков (гейт готовности)", async () => {
      // Сидовый черновик = H2 + абзац (2 блока) — чек-лист требует ≥3. Насыщаем через API (draft редактируем).
      // Живой заявки на этой главе сид намеренно не держит (иначе `requested` заблокировал бы
      // редактор), поэтому шторка сразу показывает ФОРМУ.
      await throttleMutation(USERS.author.handle);
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

    await test.step("1. автор оставляет заявку на ревью «Генераторы» (навыки из сида уже заданы)", async () => {
      await editor.goto(BLOG.slug, CHAPTERS.draft.slug);
      await editor.openSubmitSheet();
      // Пикера ревьюеров нет: гейт — только чек-лист готовности (5 пунктов).
      await expect(editor.readinessHeading).toBeVisible();
      await expect(editor.readyFooter).toBeVisible();
      await throttleMutation(USERS.author.handle);
      await editor.submit(BLOG.slug); // «Оставить заявку» → редирект в кабинет блога
      // Ось ревью сдвинулась: у главы появилась пилюля ожидания ревьюера.
      await expect(
        asAuthor.page.locator("li", { hasText: CHAPTERS.draft.title }).getByText("Ждёт ревьюера", { exact: true }),
      ).toBeVisible();
    });

    await test.step("2. ревьюер берёт заявку из таба «Очередь» → глава уходит в «Мои ревью»", async () => {
      await asReviewer.goto("/reviewer");
      const tabs = asReviewer.page.getByRole("tablist", { name: "Разделы кабинета ревьюера" });
      await expect(tabs.getByRole("tab", { name: /^Очередь/ })).toBeVisible();

      // ⚠️ Панели табов рендерятся ВСЕ (неактивные скрыты `hidden`), поэтому карточку ищем
      // строго внутри панели очереди — иначе после claim'а её «нашёл» бы одноимённый пункт
      // в «Моих ревью» и ассерт исчезновения не сработал бы.
      const queuePanel = asReviewer.page.getByRole("tabpanel", { name: /Очередь/ });
      const card = queuePanel.locator("li").filter({ hasText: CHAPTERS.draft.title });
      await expect(card).toBeVisible();
      await throttleMutation(USERS.reviewer.handle);
      // Клик до гидрации молча теряется (MCP-FINDINGS §4); повторный claim идемпотентен по эффекту
      // (сервер ответит 409 «Заявку уже взяли») — ретраим до исчезновения карточки из очереди.
      await expect(async () => {
        await card.getByRole("button", { name: "Взять" }).click();
        await expect(card).toHaveCount(0, { timeout: 3_000 });
      }).toPass({ timeout: 20_000 });

      await tabs.getByRole("tab", { name: /^Мои ревью/ }).click();
      const activePanel = asReviewer.page.getByRole("tabpanel", { name: /Мои ревью/ });
      await expect(activePanel.getByRole("link", { name: new RegExp(CHAPTERS.draft.title) })).toBeVisible();
      // Вердикта ещё нет — глава помечена «ваш ход».
      await expect(activePanel.getByText("ваш ход").first()).toBeVisible();
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

    await test.step("6. автор публикует (кнопка доступна всегда — гейта нет с Ф13)", async () => {
      await asAuthor.page.reload();
      await expect(reviewByAuthor.publishButton).toBeVisible();
      await throttleMutation(USERS.author.handle);
      await reviewByAuthor.publish();
    });

    await test.step("7. гость видит опубликованную главу с ревьюером и бейджем «Проверено на Recenza»", async () => {
      const res = await asGuest.page.goto(`/blog/${BLOG.slug}/${CHAPTERS.draft.slug}`);
      expect(res?.status()).toBe(200);
      const credit = asGuest.page.getByRole("region", { name: "Ревьюеры главы" });
      await expect(credit).toBeVisible();
      await expect(credit.getByText(/Раиса Ревьюер/)).toBeVisible();
      // ⚠️ Ф14: уровень бейджа — по происхождению кредитованных. Раиса автором НЕ приведена
      // (`users.introduced_by` пуст) → `independent`, а не `invited`.
      await expect(credit.getByText("Проверено на Recenza")).toBeVisible();
      await expect(asGuest.page.getByText("Проверено приглашённым экспертом")).toHaveCount(0);
      // Тот же бейдж — в ряду метаданных под h1 (карточка кредита — <section>, а не div).
      await expect(
        asGuest.page.locator("article > div").filter({ hasText: "Проверено на Recenza" }),
      ).toHaveCount(1);
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

  // ── REV-NO-PRIMARY — роль «ведущего» снесена (негатив вместо REV-PRIMARY) ────

  test("REV-NO-PRIMARY @critical: «ведущего» больше нет — роут смены → 404, в UI ревью метки «ведущий» не осталось", async ({
    asAuthor,
    api,
  }) => {
    const review = new ReviewPage(asAuthor.page);

    await test.step("POST /api/review/{id}/primary-change → 404 (сегмент App Router удалён)", async () => {
      const ctx = await api("author");
      const res = await ctx.post(`/api/review/${CHAPTERS.underReview.id}/primary-change`, {
        data: { handle: USERS.lena.handle, reason: "e2e" },
      });
      expect(res.status()).toBe(404);
    });

    await test.step("ReviewPage автора: ни кнопки «Сменить ведущего», ни метки «ведущий» в presence-полосе", async () => {
      await review.gotoAsAuthor(BLOG.slug, CHAPTERS.underReview.slug);
      await expect(asAuthor.page.getByRole("heading", { level: 1, name: CHAPTERS.underReview.title })).toBeVisible();
      await expect(asAuthor.page.getByRole("button", { name: /Сменить ведущего/ })).toHaveCount(0);
      await expect(asAuthor.page.getByText("ведущий")).toHaveCount(0);
      // Presence-полоса «Команда ревью»: title аватара — «@handle · онлайн|был недавно», без роли.
      // (TeamSheet-модалку не открываем: её кнопка `md:hidden` и на десктопном вьюпорте скрыта.)
      await expect(review.team.locator('span[title*="ведущий"]')).toHaveCount(0);
      await expect(review.team.locator('span[title*="@reviewer"]')).toHaveCount(1);
    });
  });
});
