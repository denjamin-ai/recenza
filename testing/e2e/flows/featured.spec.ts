// FEATURED-* — витрина главной (Фаза 15).
//
// Проверяет то, чего до Ф15 не было: главная перестала быть каталогом «всё подряд» и стала
// подборкой. Ключевые правила (решения владельца, см. журнал Ф15 в PLAN.md):
//   1. на главную пускает ТОЛЬКО независимый бейдж; «проверено приглашённым экспертом» — нет (З-19);
//   2. пока проверенных меньше порога, витрину ведёт редакция («Выбор редакции», `blogs.featured_at`);
//   3. нет ни проверенных, ни закреплённых → ПУСТОЕ состояние со ссылкой на каталог,
//      а НЕ молчаливый откат на «показать всё»;
//   4. каталог `/?view=all` продолжает показывать всё опубликованное — это escape hatch.
//
// Мутирует seed (скрывает блоги, снимает закрепление) → serial + reseed в beforeAll И afterAll.

import { test, expect } from "../fixtures";
import { BLOG, FEATURED_BLOG, INVITED_BLOG, VERIFIED_BLOGS } from "../helpers/seed";
import { reseed } from "../helpers/db";
import { throttleMutation } from "../helpers/throttle";
import { ReaderPage } from "../pages/reader.page";

test.describe("FEATURED — витрина главной (Фаза 15)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    reseed();
  });
  test.afterAll(() => {
    reseed();
  });

  test("FEATURED-01 @smoke @critical: главная = проверенные блоги; invited на неё не попадает", async ({
    asGuest,
  }) => {
    const { page } = asGuest;
    const reader = new ReaderPage(page);
    await reader.gotoFeed();

    await test.step("h1 «Проверенные блоги» — проверенных в сиде ровно порог (3)", async () => {
      await expect(reader.homeHeading("Проверенные блоги")).toBeVisible();
    });

    await test.step("все три independent-блога на витрине", async () => {
      await expect(reader.blogCard(BLOG.title)).toBeVisible();
      await expect(reader.blogCard(VERIFIED_BLOGS.guide.title)).toBeVisible();
      await expect(reader.blogCard(VERIFIED_BLOGS.ops.title)).toBeVisible();
    });

    await test.step("«Проверено приглашённым экспертом» витрину НЕ получает (З-19)", async () => {
      await expect(page.getByText(INVITED_BLOG.title)).toHaveCount(0);
    });

    await test.step("закреплённый редакцией блог показан отдельной секцией, даже без бейджа", async () => {
      await expect(page.getByRole("heading", { name: "Выбор редакции" })).toBeVisible();
      await expect(reader.blogCard(FEATURED_BLOG.title)).toBeVisible();
    });
  });

  test("FEATURED-02 @critical: непроверенный блог доступен по прямой ссылке и виден в профиле автора с пометкой", async ({
    asGuest,
  }) => {
    const { page } = asGuest;

    await test.step("прямая ссылка на invited-блог — 200, а не 404", async () => {
      const res = await page.goto(`/blog/${INVITED_BLOG.slug}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: INVITED_BLOG.title })).toBeVisible();
    });

    await test.step("в профиле автора он есть, а рядом — статус ревью", async () => {
      await page.goto("/u/author");
      await page.getByRole("tab", { name: /^Блоги/ }).click();
      await expect(page.getByText(INVITED_BLOG.title)).toBeVisible();
      // Пометка «Без ревью» — только у блогов без бейджа; у invited рисуется его чип.
      await expect(page.getByText("Проверено приглашённым экспертом").first()).toBeVisible();
    });
  });

  test("FEATURED-03 @regression: каталог ?view=all показывает ВСЁ опубликованное, включая invited", async ({
    asGuest,
  }) => {
    const { page } = asGuest;
    const reader = new ReaderPage(page);
    await reader.gotoCatalog();

    await expect(reader.homeHeading("Все блоги")).toBeVisible();
    await expect(reader.blogCard(INVITED_BLOG.title)).toBeVisible();
    await expect(reader.blogCard(FEATURED_BLOG.title)).toBeVisible();

    await test.step("фильтр «Проверенные» — любой бейдж (independent + invited), без бейджа — мимо (ui-feedback-7)", async () => {
      // «Проверенные» — подстрока чипа сортировки «Сначала проверенные»: скоупим на nav фильтра.
      await page
        .getByRole("navigation", { name: "Фильтр каталога" })
        .getByRole("link", { name: "Проверенные" })
        .click();
      await page.waitForURL(/filter=verified/);
      await expect(reader.blogCard(BLOG.title)).toBeVisible();
      await expect(reader.blogCard(INVITED_BLOG.title)).toBeVisible();
      // Закреплён редакцией, но бейджа нет: закрепление — пропуск на витрину, а не «проверен».
      await expect(reader.blogCard(FEATURED_BLOG.title)).toHaveCount(0);
    });

    await test.step("смена сортировки сохраняет фильтр; чип «Все» сбрасывает его", async () => {
      await page
        .getByRole("navigation", { name: "Сортировка каталога" })
        .getByRole("link", { name: "Популярные" })
        .click();
      await page.waitForURL(/sort=top/);
      expect(page.url()).toContain("filter=verified");
      await expect(reader.blogCard(FEATURED_BLOG.title)).toHaveCount(0);
      await page
        .getByRole("navigation", { name: "Фильтр каталога" })
        .getByRole("link", { name: "Все", exact: true })
        .click();
      await expect(reader.blogCard(FEATURED_BLOG.title)).toBeVisible();
    });

    await test.step("сортировка, фильтр и пагинация не ломают каталог (мусор → дефолт, не 404)", async () => {
      const res = await page.goto(
        "/?view=all&sort=%D0%BC%D1%83%D1%81%D0%BE%D1%80&filter=%D0%BC%D1%83%D1%81%D0%BE%D1%80&page=999",
      );
      expect(res?.status()).toBe(200);
      await expect(reader.homeHeading("Все блоги")).toBeVisible();
      // Мусорный ?filter молча становится «все» — непроверенный блог в выдаче.
      await expect(reader.blogCard(FEATURED_BLOG.title)).toBeVisible();
    });
  });

  test("FEATURED-04 @critical: проверенных стало меньше порога → витрину ведёт «Выбор редакции»", async ({
    api,
    asGuest,
  }) => {
    const admin = await api("admin");
    const { page } = asGuest;
    const reader = new ReaderPage(page);

    await test.step("админ скрывает один проверенный блог → их 2, порог не набран", async () => {
      await throttleMutation("admin-blog");
      const res = await admin.patch(`/api/admin/blogs/${VERIFIED_BLOGS.ops.id}`, {
        data: { hidden: true },
      });
      expect(res.status()).toBe(200);
    });

    await test.step("главная переключилась в режим редакции", async () => {
      await reader.gotoFeed();
      await expect(reader.homeHeading("Выбор редакции")).toBeVisible();
      await expect(reader.blogCard(FEATURED_BLOG.title)).toBeVisible();
      // Скрытый блог исчезает отовсюду — это гейт `blogs.hidden`, а не витринная политика.
      await expect(page.getByText(VERIFIED_BLOGS.ops.title)).toHaveCount(0);
    });

    await test.step("оставшиеся проверенные с витрины не пропадают", async () => {
      await expect(reader.blogCard(BLOG.title)).toBeVisible();
    });
  });

  test("FEATURED-05 @critical: ни проверенных, ни закреплённых → пустое состояние со ссылкой в каталог", async ({
    api,
    asGuest,
  }) => {
    const admin = await api("admin");
    const { page } = asGuest;
    const reader = new ReaderPage(page);

    await test.step("админ снимает закрепление и скрывает оставшиеся проверенные блоги", async () => {
      await throttleMutation("admin-blog");
      expect(
        (await admin.patch(`/api/admin/blogs/${FEATURED_BLOG.id}`, { data: { featured: false } })).status(),
      ).toBe(200);
      await throttleMutation("admin-blog");
      expect((await admin.patch(`/api/admin/blogs/${BLOG.id}`, { data: { hidden: true } })).status()).toBe(200);
      await throttleMutation("admin-blog");
      expect(
        (await admin.patch(`/api/admin/blogs/${VERIFIED_BLOGS.guide.id}`, { data: { hidden: true } })).status(),
      ).toBe(200);
    });

    await test.step("витрина честно пуста — отката на «показать всё подряд» НЕТ", async () => {
      await reader.gotoFeed();
      await expect(page.getByText("Здесь появятся проверенные блоги")).toBeVisible();
      await expect(page.getByText(INVITED_BLOG.title)).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Все блоги →" }).first()).toBeVisible();
    });

    await test.step("каталог по-прежнему отдаёт опубликованное", async () => {
      await reader.gotoCatalog();
      await expect(reader.blogCard(INVITED_BLOG.title)).toBeVisible();
    });
  });

  test("FEATURED-06 @regression: закрепление — только админ; поле featured валидируется", async ({ api }) => {
    const guest = await api();
    const author = await api("author");
    const admin = await api("admin");

    await test.step("гость и автор не могут закреплять", async () => {
      // requireAdmin различает: гость — 401 («войдите»), вошедший не-админ — 403 («не ваше»).
      expect((await guest.patch(`/api/admin/blogs/${BLOG.id}`, { data: { featured: true } })).status()).toBe(401);
      expect((await author.patch(`/api/admin/blogs/${BLOG.id}`, { data: { featured: true } })).status()).toBe(403);
    });

    await test.step("пустое тело → 400 (нужно hidden или featured)", async () => {
      await throttleMutation("admin-blog");
      const res = await admin.patch(`/api/admin/blogs/${BLOG.id}`, { data: {} });
      expect(res.status()).toBe(400);
    });

    await test.step("несуществующий блог → 404", async () => {
      await throttleMutation("admin-blog");
      const res = await admin.patch("/api/admin/blogs/no-such-blog", { data: { featured: true } });
      expect(res.status()).toBe(404);
    });
  });

  test("FEATURED-07 @regression: feed.xml — только проверенное, sitemap.xml — всё опубликованное", async ({
    api,
  }) => {
    // ⚠️ Идём по ЧИСТОМУ сиду: предыдущие тесты этого serial-describe скрывают проверенные блоги,
    // а скрытый блог выпадает и из RSS, и из sitemap — проверять на нём отбор бессмысленно.
    reseed();
    const guest = await api();

    const rss = await (await guest.get("/feed.xml")).text();
    const sitemap = await (await guest.get("/sitemap.xml")).text();

    await test.step("RSS отбирает по бейджу ревизии", async () => {
      expect(rss).toContain(VERIFIED_BLOGS.guide.chapters[0].slug); // проверенная глава
      expect(rss).not.toContain(VERIFIED_BLOGS.guide.chapters[1].slug); // её сосед без бейджа
    });

    await test.step("sitemap отдаёт всё опубликованное, включая непроверенное (решение владельца)", async () => {
      expect(sitemap).toContain(VERIFIED_BLOGS.guide.chapters[1].slug);
      expect(sitemap).toContain(INVITED_BLOG.slug);
    });
  });
});
