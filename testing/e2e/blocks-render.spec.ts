// BLK-RENDER — рендер «тяжёлых» блоков Фазы 12: mermaid-js (клиентский, ленивый) и KaTeX
// (серверный: блок latex + инлайн $...$). Дисциплина: additive — песочница-блог через API
// (паттерн SEC-XSS-01), seed не мутируем; mermaid смотрим на seed-главе event-loop (read-only).

import { test, expect } from "./fixtures";
import { ReaderPage } from "./pages/reader.page";
import { BLOG, CHAPTERS } from "./helpers/seed";

test.describe("BLK-RENDER — mermaid и KaTeX", () => {
  test("BLK-MERMAID @smoke: диаграмма seed-главы рендерится в SVG, исходник — за <details>", async ({
    asGuest,
  }) => {
    const reader = new ReaderPage(asGuest.page);
    await reader.gotoChapter(BLOG.slug, CHAPTERS.published.slug);

    const figure = asGuest.page.locator("figure").filter({ hasText: "Диаграмма (Mermaid)" });
    await expect(figure).toHaveCount(1);
    await figure.scrollIntoViewIfNeeded(); // рендер по IntersectionObserver

    // Ленивый импорт mermaid (~2МБ) на dev-стенде компилируется долго — щедрый таймаут.
    await expect(figure.locator("svg")).toBeVisible({ timeout: 45_000 });
    // Исходник остаётся доступен за <details>.
    await figure.getByText("Показать исходник").click();
    await expect(figure.locator("pre code")).toBeVisible();
  });

  test("BLK-LATEX @critical: блок latex и инлайн $...$ рендерятся KaTeX; цена «$5» остаётся литералом; ошибка формулы — fallback", async ({
    asAuthor,
    api,
  }) => {
    const ctx = await api("author");

    const created = await test.step("Песочница: блог + глава с latex-блоком, инлайн-формулой, ценами и битой формулой", async () => {
      const blogRes = await ctx.post("/api/author/blogs", { data: { title: `KaTeX Sandbox ${Date.now()}` } });
      expect(blogRes.ok()).toBeTruthy();
      const blog = (await blogRes.json()) as { blogSlug: string; chapterSlug: string; chapterId: string };

      const patch = await ctx.patch(`/api/author/chapters/${blog.chapterId}`, {
        data: {
          blocks: [
            { type: "latex", text: "c = \\pm\\sqrt{a^2 + b^2}" },
            { type: "p", text: "Энергия покоя: $E=mc^2$ — это инлайн-формула." },
            { type: "p", text: "Цена $5 и 10$ рублей — не формулы." },
            { type: "latex", text: "\\frac{незакрытая{" },
          ],
        },
      });
      expect(patch.ok()).toBeTruthy();
      return blog;
    });

    await test.step("Предпросмотр: KaTeX-вёрстка есть у блока и инлайна, цены — литерал, ошибка — русский fallback", async () => {
      await asAuthor.page.goto(`/author/blog/${created.blogSlug}/${created.chapterSlug}/preview`);
      const article = asAuthor.page.locator("article");

      // Display-блок + инлайн: два .katex-вхождения минимум.
      await expect(article.locator(".katex").first()).toBeVisible();
      expect(await article.locator(".katex").count()).toBeGreaterThanOrEqual(2);

      // Инлайн-параграф действительно содержит KaTeX (m c², а не сырой $E=mc^2$).
      const inlinePara = article.locator("p", { hasText: "Энергия покоя" });
      await expect(inlinePara.locator(".katex")).toHaveCount(1);
      await expect(article.getByText("$E=mc^2$")).toHaveCount(0);

      // Анти-ценовое правило: «$5 … 10$» — литеральный текст без KaTeX.
      const pricePara = article.locator("p", { hasText: "не формулы" });
      await expect(pricePara).toContainText("Цена $5 и 10$ рублей");
      await expect(pricePara.locator(".katex")).toHaveCount(0);

      // Битая формула не роняет страницу — fallback с исходником.
      await expect(article.getByText("Ошибка в формуле")).toBeVisible();
      await expect(article.getByText("\\frac{незакрытая{")).toBeVisible();
    });
  });
});
