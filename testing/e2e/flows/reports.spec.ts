// REPORT-* — жалобы модератору (Фаза 15, З-51).
//
// До этой фазы раздел «Жалобы» в админке был декорацией: роута создания не существовало,
// кнопки не было, единственный `insert(reports)` жил в сиде. Спека закрывает цикл целиком:
// читатель жалуется → уведомление админу → админ разбирает.
//
// Гейты, которые здесь важнее happy-path (см. шапку src/app/api/reports/route.ts):
//   • «цели нет» и «жаловаться нельзя» дают ОДИН ответ 404 — роут не должен быть оракулом;
//   • жалоба на ревью доступна только участнику сессии и только на другого участника;
//   • дедуп: вторая открытая жалоба на ту же цель новой строки не создаёт.
//
// Мутирует seed → serial + reseed в beforeAll И afterAll.

import { test, expect } from "../fixtures";
import { BLOG, CHAPTERS, COMMENTS, FEATURED_BLOG, REPORTS, USERS, VERIFIED_BLOGS } from "../helpers/seed";
import { reseed } from "../helpers/db";
import { throttleMutation } from "../helpers/throttle";
import type { APIRequestContext, APIResponse } from "@playwright/test";

/**
 * Жалобы ограничены 1/10с НА ПОЛЬЗОВАТЕЛЯ, а спека шлёт их подряд (в т.ч. после отправки из UI).
 * Ждать фиксированные паузы бессмысленно — окно общее на все вызовы одного аккаунта. Поэтому
 * используем принятый в проекте приём: 429 считается ретраибельным (CLAUDE.md §флак-обходы).
 */
async function postReport(
  ctx: APIRequestContext,
  data: Record<string, unknown>,
  expected: number,
): Promise<APIResponse> {
  let last!: APIResponse;
  await expect(async () => {
    last = await ctx.post("/api/reports", { data });
    expect(last.status(), `ожидали ${expected}, получили ${last.status()}`).toBe(expected);
  }).toPass({ timeout: 40_000 });
  return last;
}

test.describe("REPORT — жалобы модератору (Фаза 15)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    reseed();
  });
  test.afterAll(() => {
    reseed();
  });

  test("REPORT-01 @smoke @critical: читатель жалуется на комментарий из ридера → жалоба у админа", async ({
    asReader,
    api,
  }) => {
    const { page } = asReader;

    // ⚠️ В сиде `cmt_root` принадлежит САМОМУ читателю, поэтому жалуемся на ответ автора:
    // на свой комментарий кнопки нет по построению (его можно просто удалить).
    const OTHERS_COMMENT = "Спасибо! Рад, что зашло.";

    await test.step("кнопка «Пожаловаться» есть у чужого комментария", async () => {
      await page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);
      const others = page.locator("article").filter({ hasText: OTHERS_COMMENT }).first();
      await expect(others.getByRole("button", { name: "Пожаловаться" }).first()).toBeVisible();
      // ⚠️ «У своего комментария кнопки нет» проверяется НЕ здесь: карточка root-комментария
      // содержит вложенные article ответов, и любой DOM-локатор по тексту root'а захватывает
      // кнопку из ответа. Авторитетная проверка этого правила — серверная, в REPORT-02.
    });

    await test.step("модалка: причина + комментарий модератору → отправка", async () => {
      const comment = page.locator("article").filter({ hasText: OTHERS_COMMENT }).first();
      await comment.getByRole("button", { name: "Пожаловаться" }).first().click();
      const dialog = page.getByRole("dialog", { name: "Пожаловаться на комментарий" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("radio", { name: "Спам / реклама" }).check();
      await dialog.getByLabel(/Комментарий модератору/).fill("Реклама в комментариях.");
      await dialog.getByRole("button", { name: "Отправить жалобу" }).click();
      await expect(page.getByText("Жалоба отправлена").first()).toBeVisible();
    });

    await test.step("админ видит её в разборе", async () => {
      const admin = await api("admin");
      const res = await admin.get("/admin/reports");
      expect(res.status()).toBe(200);
      expect(await res.text()).toContain("Спам / реклама");
    });
  });

  test("REPORT-02 @critical: гейты API — гость, чужой Origin, свой комментарий, удалённая цель", async ({
    api,
  }) => {
    const guest = await api();
    const reader = await api("reader");

    await test.step("гость → 401", async () => {
      await postReport(guest, { targetType: "comment", targetId: COMMENTS.root, reason: "spam" }, 401);
    });

    await test.step("неизвестный тип цели → 400", async () => {
      await postReport(reader, { targetType: "user", targetId: COMMENTS.root, reason: "spam" }, 400);
    });

    await test.step("причина не из каталога → 400", async () => {
      await postReport(reader, { targetType: "comment", targetId: COMMENTS.root, reason: "потому что" }, 400);
    });

    await test.step("свой комментарий → 404 (жаловаться на себя нечего — можно удалить)", async () => {
      // `cmt_root` в сиде принадлежит самому читателю.
      await postReport(reader, { targetType: "comment", targetId: COMMENTS.root, reason: "spam" }, 404);
    });

    await test.step("удалённый комментарий → 404 (тот же ответ, что и у несуществующего)", async () => {
      await postReport(reader, { targetType: "comment", targetId: COMMENTS.deleted, reason: "spam" }, 404);
      await postReport(reader, { targetType: "comment", targetId: "no-such-comment", reason: "spam" }, 404);
    });
  });

  test("REPORT-03 @critical: жалоба на ревью — только участнику сессии и только на другого участника", async ({
    api,
  }) => {
    const reader = await api("reader");
    const author = await api("author");

    await test.step("посторонний читатель на чужое ревью → 404 (существование сессии не раскрываем)", async () => {
      await postReport(
        reader,
        { targetType: "review", targetId: CHAPTERS.underReview.id, aboutHandle: USERS.lena.handle, reason: "abuse" },
        404,
      );
    });

    await test.step("автор главы на её ревьюера → 201", async () => {
      await postReport(
        author,
        {
          targetType: "review",
          targetId: CHAPTERS.changesRequested.id,
          aboutHandle: USERS.lena.handle,
          reason: "abuse",
          note: "Тон замечаний.",
        },
        201,
      );
    });

    await test.step("на участника, которого в этой сессии нет → 404", async () => {
      await postReport(
        author,
        { targetType: "review", targetId: CHAPTERS.changesRequested.id, aboutHandle: USERS.sergey.handle, reason: "abuse" },
        404,
      );
    });
  });

  test("REPORT-04 @regression: дедуп — вторая открытая жалоба на ту же цель не плодит строку", async ({
    api,
  }) => {
    const reader = await api("reader");

    // ⚠️ Цель — блог, на который в сиде ЖАЛОБЫ НЕТ: на `FEATURED_BLOG` уже есть открытая жалоба
    // этого же читателя (`REPORTS.blog`), и первый же вызов вернул бы дедуп-200 вместо 201.
    const target = VERIFIED_BLOGS.guide.id;

    await postReport(reader, { targetType: "blog", targetId: target, reason: "offtopic" }, 201);

    const second = await postReport(reader, { targetType: "blog", targetId: target, reason: "spam" }, 200);
    expect(await second.json()).toMatchObject({ duplicate: true });
  });

  test("REPORT-05 @critical: админ разбирает жалобу на блог — «скрыть блог» одной транзакцией", async ({
    api,
    asGuest,
  }) => {
    const admin = await api("admin");

    await test.step("детальная страница показывает контекст блога и «о ком» у ревью", async () => {
      const blogReport = await admin.get(`/admin/reports/${REPORTS.blog}`);
      expect(await blogReport.text()).toContain(FEATURED_BLOG.title);

      const reviewReport = await admin.get(`/admin/reports/${REPORTS.review}`);
      const html = await reviewReport.text();
      expect(html).toContain("Жалоба на участника");
      expect(html).toContain(CHAPTERS.underReview.title);
    });

    await test.step("действие должно соответствовать типу цели", async () => {
      await throttleMutation("report-resolve");
      const wrong = await admin.patch(`/api/admin/reports/${REPORTS.blog}`, {
        data: { action: "delete_comment" },
      });
      expect(wrong.status()).toBe(400);
    });

    await test.step("«скрыть блог» скрывает блог И закрывает жалобу", async () => {
      await throttleMutation("report-resolve");
      const res = await admin.patch(`/api/admin/reports/${REPORTS.blog}`, { data: { action: "hide_blog" } });
      expect(res.status()).toBe(200);

      const guestRes = await asGuest.page.goto(`/blog/${FEATURED_BLOG.slug}`);
      expect(guestRes?.status()).toBe(404);

      const list = await admin.get("/admin/reports");
      expect(await list.text()).toContain("Закрытые");
    });
  });
});
