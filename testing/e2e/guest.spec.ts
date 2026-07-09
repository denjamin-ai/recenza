// TC-GUEST — гость (аноним): публичное чтение, редиректы на логин, intent-replay,
// скрытие непубличного контента. TC-док: testing/test-cases/TC-GUEST.md.
// Файл read-only/self-restoring: seed не мутируется (TC-GUEST-07 — toggle туда-обратно),
// reseed не требуется, порядок других спеков не важен.
// Локаторы и точные тексты — testing/mcp/MCP-FINDINGS.md §2/§5.

import { test, expect } from "./fixtures";
import { loginViaUi } from "./helpers/auth";
import { throttleMutation } from "./helpers/throttle";
import { BLOG, CHAPTERS, COMMENTS, HIDDEN_BLOG, USERS } from "./helpers/seed";
import { ReaderPage } from "./pages/reader.page";
import { CommentsPage } from "./pages/comments.page";

test.describe("Гость (аноним)", () => {
  // ── TC-GUEST-01 (SMK-01) ────────────────────────────────────────────────────

  test("TC-GUEST-01 @smoke: лента гостю — карточка блога, карусель «Промо» и модалка «Поддержать проект»", async ({
    asGuest,
  }) => {
    const { page } = asGuest;
    const reader = new ReaderPage(page);

    await test.step("лента отдаётся гостю: «Войти» в шапке, карточка блога видна", async () => {
      await reader.gotoFeed();
      await expect(page.getByRole("banner").getByRole("link", { name: "Войти" })).toBeVisible();
      await expect(page.getByText(BLOG.title).first()).toBeVisible();
    });

    await test.step("карусель «Промо»: фиксируем слайд точкой «Баннер 3» (donate-баннер)", async () => {
      await expect(reader.promo).toBeVisible();
      // Авторотация ~5-6с + гидрация: клик по точке ретраим до появления donate-слайда.
      await expect(async () => {
        await reader.pinPromoSlide(3);
        await expect(reader.promo.getByText("Поддержите проект")).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
    });

    const donateDialog = page.getByRole("dialog", { name: "Поддержать проект" });

    await test.step("CTA «Поддержать» открывает модалку: ссылка DonationAlerts + QR СБП", async () => {
      await expect(async () => {
        await reader.promo.getByRole("button", { name: "Поддержать", exact: true }).click();
        await expect(donateDialog).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 15_000 });
      await expect(donateDialog.getByRole("heading", { name: "Поддержать Recenza" })).toBeVisible();
      await expect(donateDialog.getByRole("link", { name: /DonationAlerts/ })).toBeVisible();
      await expect(donateDialog.getByAltText("QR-код: СБП")).toBeVisible();
    });

    await test.step("модалка закрывается кнопкой «Закрыть»", async () => {
      await donateDialog.getByRole("button", { name: "Закрыть" }).click();
      await expect(donateDialog).toBeHidden();
    });

    await test.step("Alpha-бейдж в шапке: поповер о статусе открывается и закрывается Escape", async () => {
      const badgeTrigger = page.getByRole("banner").getByRole("button", { name: "О статусе альфа-версии" });
      await expect(badgeTrigger).toBeVisible();
      const alphaDialog = page.getByRole("dialog", { name: "Альфа-версия" });
      // Клик до гидрации может потеряться — идемпотентный ретрай (повторный клик закрыл бы поповер).
      await expect(async () => {
        if ((await badgeTrigger.getAttribute("aria-expanded")) !== "true") {
          await badgeTrigger.click();
        }
        await expect(alphaDialog).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 15_000 });
      await expect(alphaDialog.getByText("активно разрабатывается")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(alphaDialog).toBeHidden();
    });
  });

  // ── TC-GUEST-02 (SMK-02) — регресс-ловушка article ─────────────────────────

  test("TC-GUEST-02 @smoke @critical: рендер блога и главы data-driven — title меняется, блоки есть, только published; несуществующий блог → 404", async ({
    asGuest,
  }) => {
    const { page } = asGuest;

    await test.step("страница блога: data-driven BlogReaderScreen, title — от контента (авторендер первой published-главы)", async () => {
      await page.goto(`/blog/${BLOG.slug}`);
      // Роут /blog/[slug] рендерит data-driven ридер, а не легаси single-article: title берётся из
      // контента (первая published-глава «Цикл событий»), блоки размечены [data-block-id].
      await expect(page).toHaveTitle(new RegExp(CHAPTERS.published.title));
      await expect(page.locator("[data-block-id]").first()).toBeVisible();
    });

    await test.step("гостю доступна только published-глава (draft/under-review/changes-requested скрыты)", async () => {
      await expect(page.getByText(CHAPTERS.underReview.title)).toHaveCount(0);
      await expect(page.getByText(CHAPTERS.changesRequested.title)).toHaveCount(0);
      await expect(page.getByText(CHAPTERS.draft.title)).toHaveCount(0);
    });

    await test.step("прямой URL главы event-loop: title от контента, блоки отрендерены", async () => {
      await page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);
      await expect(page).toHaveTitle(new RegExp(CHAPTERS.published.title));
      await expect(page.locator("[data-block-id]").first()).toBeVisible();
    });

    await test.step("несуществующий блог → 404", async () => {
      const res = await page.goto("/blog/no-such-blog");
      expect(res?.status()).toBe(404);
    });
  });

  // ── TC-GUEST-03 — REV-VERSIONS (гостевая проекция кредита) ─────────────────

  test("TC-GUEST-03 @regression: чипы ревьюеров главы — «Эту версию проверяли» + бейдж «ведущий», «Прошлые версии» за раскрытием", async ({
    asGuest,
  }) => {
    const { page } = asGuest;
    const reader = new ReaderPage(page);
    await reader.gotoChapter(BLOG.slug, CHAPTERS.published.slug);

    const lenaChip = reader.reviewersRegion.getByRole("link", { name: /Лена Базы/ });

    await test.step("текущая версия (v2): регион, заголовок, чипы и бейдж «ведущий»", async () => {
      await expect(reader.reviewersRegion).toBeVisible();
      await expect(reader.reviewersRegion.getByRole("heading", { name: "Эту версию проверяли" })).toBeVisible();
      await expect(reader.reviewersRegion.getByRole("link", { name: /Раиса Ревьюер/ })).toBeVisible();
      await expect(reader.reviewersRegion.getByRole("link", { name: /Макс Девопс/ })).toBeVisible();
      await expect(reader.reviewersRegion.getByText("ведущий", { exact: true }).first()).toBeVisible();
      // Ревьюер прошлой версии спрятан внутри свёрнутого <details>
      await expect(lenaChip).toBeHidden();
    });

    await test.step("раскрытие «Прошлые версии» → «к версии v1» с составом v1", async () => {
      await reader.expandPastVersions();
      await expect(reader.reviewersRegion.getByText("к версии v1")).toBeVisible();
      await expect(lenaChip).toBeVisible();
    });
  });

  // ── TC-GUEST-04/05/06 (SMK-03) — серверные редиректы без сессии ────────────

  test("TC-GUEST-04 @smoke @critical: GET /author без сессии → 307 на /login (без ?next)", async ({ api }) => {
    const ctx = await api();
    const res = await ctx.get("/author", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const location = res.headers()["location"] ?? "";
    expect(location).toMatch(/\/login$/);
    expect(location).not.toContain("next=");
  });

  test("TC-GUEST-05 @smoke @critical: GET /reviewer без сессии → 307 на /login (без ?next)", async ({ api }) => {
    const ctx = await api();
    const res = await ctx.get("/reviewer", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const location = res.headers()["location"] ?? "";
    expect(location).toMatch(/\/login$/);
    expect(location).not.toContain("next=");
  });

  test("TC-GUEST-06 @smoke @critical: GET /admin/dashboard без сессии → 307 на /admin/login", async ({ api }) => {
    const ctx = await api();
    const res = await ctx.get("/admin/dashboard", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const location = res.headers()["location"] ?? "";
    expect(location).toMatch(/\/admin\/login$/);
  });

  // ── TC-GUEST-07 — intent-replay голоса ──────────────────────────────────────
  // sergey_review без seed-голоса → реплей = чистая установка. reader НЕ использовать:
  // у него seed-голос, а реплей — toggle и снял бы его (баг №4, MCP-FINDINGS §6).

  test("TC-GUEST-07 @critical: голос гостя → /login с intent=vote, после входа sergey_review голос реплеится", async ({
    asGuest,
  }) => {
    const { page } = asGuest;
    const reader = new ReaderPage(page, USERS.sergey.handle);
    const chapterPath = `/blog/${BLOG.slug}/${CHAPTERS.published.slug}`;

    await test.step("клик «Полезно» гостем → редирект на /login с next и intent", async () => {
      await reader.gotoChapter(BLOG.slug, CHAPTERS.published.slug);
      // Гидрация engagement-бара: «мёртвый» клик ретраим до ухода на /login.
      await expect(async () => {
        await reader.voteUpButton().click();
        await page.waitForURL((url) => url.pathname === "/login", { timeout: 3_000 });
      }).toPass({ timeout: 20_000 });

      const url = new URL(page.url());
      expect(url.searchParams.get("intent")).toBe(`vote:${CHAPTERS.published.id}:1`);
      expect(url.searchParams.get("next")).toBe(chapterPath);
    });

    await test.step("вход sergey_review → возврат по next, реплей ставит голос", async () => {
      await loginViaUi(page, USERS.sergey.handle);
      await page.waitForURL(`**${chapterPath}`);
      await expect(reader.voteUpButton()).toHaveAttribute("aria-pressed", "true");
    });

    await test.step("самовосстановление: повторный клик снимает голос (toggle)", async () => {
      // Реплей-POST только что прошёл — отмечаем его как мутацию, чтобы voteUp() выждал rate-limit.
      await throttleMutation(USERS.sergey.handle);
      await reader.voteUp();
      await expect(reader.voteUpButton()).toHaveAttribute("aria-pressed", "false");
    });
  });

  // ── TC-GUEST-08 — закладка гостем ───────────────────────────────────────────

  test("TC-GUEST-08 @regression: закладка гостем → редирект на /login с intent=bookmark", async ({ asGuest }) => {
    const { page } = asGuest;
    const reader = new ReaderPage(page);
    const chapterPath = `/blog/${BLOG.slug}/${CHAPTERS.published.slug}`;

    await reader.gotoChapter(BLOG.slug, CHAPTERS.published.slug);
    await expect(async () => {
      await reader.bookmarkButton().click();
      await page.waitForURL((url) => url.pathname === "/login", { timeout: 3_000 });
    }).toPass({ timeout: 20_000 });

    const url = new URL(page.url());
    expect(url.searchParams.get("intent")).toBe(`bookmark:${BLOG.id}`);
    expect(url.searchParams.get("next")).toBe(chapterPath);
  });

  // ── TC-GUEST-09 — комментарии read-only ─────────────────────────────────────

  test("TC-GUEST-09 @regression: комментарии гостю read-only — дерево видно, композера нет, приглашение войти", async ({
    asGuest,
  }) => {
    const { page } = asGuest;
    const comments = new CommentsPage(page);
    await page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);

    await test.step("секция и дерево комментариев отрендерены сервером", async () => {
      await expect(comments.region).toBeVisible();
      await expect(comments.heading).toBeVisible();
      await expect(comments.node(COMMENTS.root)).toBeVisible();
      await expect(comments.node(COMMENTS.replyAuthor)).toBeVisible();
      await expect(comments.node(COMMENTS.replyReader)).toBeVisible();
    });

    await test.step("формы нет — вместо неё «Войдите, чтобы оставить комментарий.»", async () => {
      await expect(comments.composer).toHaveCount(0);
      await expect(page.getByText("чтобы оставить комментарий.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Войдите", exact: true })).toBeVisible();
      // Органов управления у гостя нет ни на одном комментарии
      await expect(comments.region.getByRole("button", { name: "Изменить" })).toHaveCount(0);
      await expect(comments.region.getByRole("button", { name: "Удалить" })).toHaveCount(0);
    });
  });

  // ── TC-GUEST-10 — POST /api/comments без сессии ─────────────────────────────

  test("TC-GUEST-10 @regression: POST /api/comments гостем → 401 «Требуется вход.»", async ({ api }) => {
    const ctx = await api();
    const res = await ctx.post("/api/comments", {
      data: { blogSlug: BLOG.slug, chapterSlug: CHAPTERS.published.slug, text: "guest-api-probe" },
    });
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Требуется вход.");
  });

  // ── TC-GUEST-11 — скрытый блог ──────────────────────────────────────────────

  test("TC-GUEST-11 @regression: скрытый блог — нет в ленте/каталоге, прямой URL → 404 без утечки данных", async ({
    asGuest,
  }) => {
    const { page } = asGuest;
    const reader = new ReaderPage(page);

    await test.step("лента: «Скрытый блог» отсутствует", async () => {
      await reader.gotoFeed();
      await expect(page.getByText(BLOG.title).first()).toBeVisible(); // лента загрузилась
      await expect(page.getByText(HIDDEN_BLOG.title)).toHaveCount(0);
    });

    await test.step("каталог: карточки «Скрытый блог» нет", async () => {
      await reader.feedTab("Каталог").click();
      await expect(page.getByText(BLOG.title).first()).toBeVisible(); // каталог загрузился
      await expect(page.getByText(HIDDEN_BLOG.title)).toHaveCount(0);
    });

    await test.step("прямой URL блога → 404, название не просачивается в разметку", async () => {
      const res = await page.goto(`/blog/${HIDDEN_BLOG.slug}`);
      expect(res?.status()).toBe(404);
      await expect(page.getByText(HIDDEN_BLOG.title)).toHaveCount(0);
    });
  });

  // ── TC-GUEST-12 — публичная доска /board ────────────────────────────────────

  test("TC-GUEST-12 @regression: /board гостю — направления видны, форма «Заявка на ревью» с полем «Имя» (без отправки)", async ({
    asGuest,
  }) => {
    const { page } = asGuest;
    await page.goto("/board");

    await test.step("доска отдаётся: h1, направления seed, кнопка «Откликнуться»", async () => {
      await expect(
        page.getByRole("heading", { name: "Помогите авторам выпускать качественные статьи" }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Frontend" })).toBeVisible(); // bc_frontend
      await expect(page.getByRole("heading", { name: "Backend" })).toBeVisible(); // bc_backend
      await expect(page.getByText("срочно")).toBeVisible(); // hot-бейдж bc_frontend
      await expect(page.getByRole("button", { name: "Откликнуться" }).first()).toBeVisible();
    });

    const dialog = page.getByRole("dialog", { name: "Заявка на ревью" });

    await test.step("«Стать ревьюером» открывает форму, у гостя есть поле «Имя»; не отправляем", async () => {
      await expect(async () => {
        await page.getByRole("button", { name: "Стать ревьюером" }).click();
        await expect(dialog).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 15_000 });
      await expect(dialog.getByLabel("Имя", { exact: true })).toBeVisible();
      await expect(dialog.getByLabel("Направление", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Отправить заявку" })).toBeVisible();
      // Заявку НЕ отправляем — кейс read-only; закрываем модалку.
      await dialog.getByRole("button", { name: "Закрыть" }).click();
      await expect(dialog).toBeHidden();
    });
  });

  // ── TC-GUEST-13 — SEO-эндпоинты ─────────────────────────────────────────────

  test("TC-GUEST-13 @regression: /feed.xml, /sitemap.xml, /robots.txt отдаются гостю и не светят скрытый блог", async ({
    api,
  }) => {
    const ctx = await api();

    await test.step("feed.xml: 200, есть published-глава, нет hidden-blog", async () => {
      const res = await ctx.get("/feed.xml");
      expect(res.status()).toBe(200);
      const text = await res.text();
      expect(text).toContain(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);
      expect(text).not.toContain(HIDDEN_BLOG.slug);
    });

    await test.step("sitemap.xml: 200, есть публичный блог, нет hidden-blog", async () => {
      const res = await ctx.get("/sitemap.xml");
      expect(res.status()).toBe(200);
      const text = await res.text();
      expect(text).toContain(BLOG.slug);
      expect(text).not.toContain(HIDDEN_BLOG.slug);
    });

    await test.step("robots.txt: 200 c User-agent", async () => {
      const res = await ctx.get("/robots.txt");
      expect(res.status()).toBe(200);
      expect(await res.text()).toMatch(/User-agent/i);
    });
  });

  // ── TC-GUEST-14 — публичный профиль по slug ─────────────────────────────────

  test("TC-GUEST-14 @regression: /u/author доступен гостю с портфолио; /u/{handle} с подчёркиванием → 404, по slug → 200", async ({
    asGuest,
  }) => {
    const { page } = asGuest;

    await test.step("профиль автора: имя, роль, портфолио «Об авторе» видно", async () => {
      const res = await page.goto(`/u/${USERS.author.slug}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "Антон Автор" })).toBeVisible();
      await expect(page.getByText(`@${USERS.author.handle}`)).toBeVisible();
      await expect(page.getByRole("region", { name: "Об авторе" })).toBeVisible();
    });

    await test.step("handle с подчёркиванием (/u/lena_review) → 404", async () => {
      const res = await page.goto(`/u/${USERS.lena.handle}`);
      expect(res?.status()).toBe(404);
    });

    await test.step("slug с дефисом (/u/lena-review) → 200", async () => {
      const res = await page.goto(`/u/${USERS.lena.slug}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "Лена Базы" })).toBeVisible();
    });
  });
});
