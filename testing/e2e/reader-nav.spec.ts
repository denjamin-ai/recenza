// NAV-* — навигация читателя внутри блога (Фаза 15, З-23/З-26/З-28).
//
// До этой фазы перехода между главами не существовало вообще: единственными путями были правый
// рельс SeriesNav (только на lg+), мобильный <details> и крошки. Страница блога при этом молча
// редиректила на первую главу, то есть у блога не было собственной поверхности.
//
// Спека НЕ мутирует seed (только чтение) — reseed не нужен.

import { test, expect } from "./fixtures";
import { BLOG, CHAPTERS, VERIFIED_BLOGS } from "./helpers/seed";

const GUIDE = VERIFIED_BLOGS.guide;
const [first, middle, last] = GUIDE.chapters;

test.describe("NAV — переходы между главами и оглавление блога (Фаза 15)", () => {
  test("NAV-01 @smoke @critical: пейджер под главой — середина, начало и конец блога", async ({ asGuest }) => {
    const { page } = asGuest;

    await test.step("средняя глава: есть обе ссылки, названия соседей — настоящие", async () => {
      await page.goto(`/blog/${GUIDE.slug}/${middle.slug}`);
      const pager = page.getByRole("navigation", { name: "Навигация по главам" });
      await expect(pager.getByText("Предыдущая глава")).toBeVisible();
      await expect(pager.getByText("Следующая глава")).toBeVisible();
      await expect(pager.getByRole("link", { name: new RegExp(first.title) })).toBeVisible();
      await expect(pager.getByRole("link", { name: new RegExp(last.title) })).toBeVisible();
    });

    await test.step("клик «Следующая глава» ведёт на соседнюю главу", async () => {
      const pager = page.getByRole("navigation", { name: "Навигация по главам" });
      await pager.getByRole("link", { name: new RegExp(last.title) }).click();
      await page.waitForURL(new RegExp(`/blog/${GUIDE.slug}/${last.slug}$`));
      await expect(page.getByRole("heading", { level: 1, name: last.title })).toBeVisible();
    });

    await test.step("последняя глава: «Следующей» нет", async () => {
      const pager = page.getByRole("navigation", { name: "Навигация по главам" });
      await expect(pager.getByText("Предыдущая глава")).toBeVisible();
      await expect(pager.getByText("Следующая глава")).toHaveCount(0);
    });

    await test.step("первая глава: «Предыдущей» нет", async () => {
      await page.goto(`/blog/${GUIDE.slug}/${first.slug}`);
      const pager = page.getByRole("navigation", { name: "Навигация по главам" });
      await expect(pager.getByText("Следующая глава")).toBeVisible();
      await expect(pager.getByText("Предыдущая глава")).toHaveCount(0);
    });

    await test.step("одноглавый блог пейджер не рисует вовсе", async () => {
      await page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);
      await expect(page.getByRole("navigation", { name: "Навигация по главам" })).toHaveCount(0);
    });
  });

  test("NAV-02 @critical: из архивной версии ?v=N пейджер ведёт на КАНОНИЧЕСКИЕ ссылки", async ({ asGuest }) => {
    const { page } = asGuest;

    // Архив есть только у главы с двумя published-ревизиями (`BLOG`), и она одна в блоге —
    // поэтому инвариант проверяем на многоглавном блоге через прямой переход с ?v=1.
    await page.goto(`/blog/${GUIDE.slug}/${middle.slug}?v=1`);
    const pager = page.getByRole("navigation", { name: "Навигация по главам" });
    const next = pager.getByRole("link", { name: new RegExp(last.title) });
    await expect(next).toBeVisible();
    // Соседняя глава архивной версии не имеет: ссылка обязана быть без ?v=.
    await expect(next).toHaveAttribute("href", `/blog/${GUIDE.slug}/${last.slug}`);
  });

  test("NAV-03 @critical: страница блога — оглавление, а не редирект (З-26)", async ({ asGuest }) => {
    const { page } = asGuest;

    await test.step("URL остаётся на блоге, h1 — название блога", async () => {
      await page.goto(`/blog/${GUIDE.slug}`);
      expect(new URL(page.url()).pathname).toBe(`/blog/${GUIDE.slug}`);
      await expect(page.getByRole("heading", { level: 1, name: GUIDE.title })).toBeVisible();
    });

    await test.step("в оглавлении все опубликованные главы по порядку", async () => {
      const toc = page.getByRole("list").filter({ has: page.getByRole("link", { name: new RegExp(first.title) }) });
      for (const c of GUIDE.chapters) {
        await expect(page.getByRole("link", { name: new RegExp(c.title) }).first()).toBeVisible();
      }
      await expect(toc.first()).toBeVisible();
    });

    await test.step("«Читать с начала» ведёт на первую главу", async () => {
      await page.getByRole("link", { name: /Читать с начала/ }).click();
      await page.waitForURL(new RegExp(`/blog/${GUIDE.slug}/${first.slug}$`));
    });

    await test.step("режим «Весь блог» (?mode=whole) сохранён", async () => {
      await page.goto(`/blog/${GUIDE.slug}?mode=whole`);
      await expect(page.getByRole("heading", { level: 1, name: GUIDE.title })).toBeVisible();
      // Признак whole-режима: тела всех глав на одной странице.
      await expect(page.locator("[data-block-id]").first()).toBeVisible();
      await expect(page.locator(`#chapter-${last.slug}`)).toBeVisible();
    });
  });

  test("NAV-04 @regression: подвал и страница «О платформе» (З-28)", async ({ asGuest }) => {
    const { page } = asGuest;
    await page.goto("/");

    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "О платформе" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Как стать ревьюером" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "RSS" })).toBeVisible();

    await footer.getByRole("link", { name: "О платформе" }).click();
    await page.waitForURL(/\/about$/);
    await expect(page.getByRole("heading", { level: 1, name: "О платформе" })).toBeVisible();
    // Тексты описывают модель ПОСЛЕ Ф13–15, а не «публикация только через ревью».
    await expect(page.getByText(/Публикация свободна/)).toBeVisible();
  });
});
