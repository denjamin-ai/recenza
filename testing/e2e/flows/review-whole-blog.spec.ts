/**
 * REV-WHOLE-BLOG — ревью всего блога: strip глав, независимые статусы, режим «Весь блог» (TC-FLOWS.md).
 *
 * Факты MCP-FINDINGS §1 (сценарий 2) + секция 04 + исходники:
 * - Strip глав на ReviewPage = tablist «Главы блога» («01 Цикл событий» … «04 Генераторы и итераторы»,
 *   [selected] у текущей). В POV автора клик по табу = навигация на review-URL той главы.
 * - У ревьюера strip — СТАТУСНЫЙ КОНТЕКСТ (review-header.tsx): табы — span без href, клик не навигирует;
 *   не назначенная глава по прямому URL → серверный redirect в инбокс /reviewer
 *   (src/app/reviewer/(protected)/review/[chapterId]/page.tsx). Это фактическое поведение —
 *   ожидание TC-дока «показывает только назначенные главы» коду не соответствует.
 * - Тумблер «Весь блог» есть ТОЛЬКО в ридере (group «Режим чтения», ссылки «Глава»/«Весь блог»,
 *   ?mode=whole) и рендерится лишь при >1 published-главы; на ReviewPage его нет.
 *
 * Тест 3 мутирует seed (admin force-approve публикует «Промисы изнутри», чтобы в ридере стало
 * ≥2 published-глав и тумблер отрисовался) → serial + reseed в beforeAll.
 */
import { test, expect } from "../fixtures";
import { ReviewPage } from "../pages/review.page";
import { ReaderPage } from "../pages/reader.page";
import { CommentsPage } from "../pages/comments.page";
import { BLOG, CHAPTERS, COMMENTS, USERS } from "../helpers/seed";
import { reseed } from "../helpers/db";
import { throttleMutation } from "../helpers/throttle";

test.describe("REV-WHOLE-BLOG: ревью всего блога — strip глав, статусы, режим «Весь блог»", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    // Третий тест публикует «Промисы изнутри» force-approve'ом — стартуем от чистого seed.
    reseed();
  });

  // Восстанавливаем seed после файла — чтобы любой grep-срез был самодостаточен.
  test.afterAll(() => {
    reseed();
  });

  test("REV-WHOLE-BLOG-strip @critical: strip глав автора — табы с номерами, клик = навигация на review главы, статусы независимы", async ({
    asAuthor,
  }) => {
    const page = asAuthor.page;
    const review = new ReviewPage(page);
    const strip = page.getByRole("tablist", { name: "Главы блога" });

    await test.step("Открыть review «Промисы изнутри»: tablist «Главы блога» с 4 нумерованными табами", async () => {
      await review.gotoAsAuthor(BLOG.slug, CHAPTERS.underReview.slug);
      await expect(strip).toBeVisible();
      await expect(review.chapterTab(/01 Цикл событий/)).toBeVisible();
      await expect(review.chapterTab(/02 Промисы изнутри/)).toBeVisible();
      await expect(review.chapterTab(/03 Async\/await на практике/)).toBeVisible();
      await expect(review.chapterTab(/04 Генераторы и итераторы/)).toBeVisible();
      // [selected] — у текущей главы, у соседних снят.
      await expect(review.chapterTab(/02 Промисы изнутри/)).toHaveAttribute("aria-selected", "true");
      await expect(review.chapterTab(/03 Async\/await на практике/)).toHaveAttribute("aria-selected", "false");
      // Шапка: h1 = глава, пилюля статуса «На ревью» (rev_ur_1 — under-review).
      await expect(page.getByRole("heading", { level: 1, name: CHAPTERS.underReview.title })).toBeVisible();
      await expect(page.getByText("На ревью", { exact: true }).first()).toBeVisible();
    });

    await test.step("Клик по табу «03 Async/await…» — URL сменился на review той главы, [selected] переехал", async () => {
      // Таб в POV автора — Link (<a>): навигация работает и до гидрации; ретрай — страховка
      // от потери клика (MCP-FINDINGS §5). Повторный клик идемпотентен (активный таб — span).
      await expect(async () => {
        await review.chapterTab(/03 Async\/await на практике/).click();
        await page.waitForURL(
          new RegExp(`/author/blog/${BLOG.slug}/${CHAPTERS.changesRequested.slug}/review$`),
          { timeout: 5_000 },
        );
      }).toPass();
      await expect(page.getByRole("heading", { level: 1, name: CHAPTERS.changesRequested.title })).toBeVisible();
      await expect(review.chapterTab(/03 Async\/await на практике/)).toHaveAttribute("aria-selected", "true");
      await expect(review.chapterTab(/02 Промисы изнутри/)).toHaveAttribute("aria-selected", "false");
    });

    await test.step("Статусы глав независимы: пилюля сменилась на «Нужны правки», «На ревью» исчезла", async () => {
      // rev_cr_1 (async-await) — changes-requested: у каждой главы свой статус, контекст не «протекает».
      await expect(page.getByText("Нужны правки", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("На ревью", { exact: true })).toHaveCount(0);
    });
  });

  test("REV-WHOLE-BLOG-reviewer @regression: strip у ревьюера — статусный контекст без навигации; чужая глава по URL → редирект в инбокс", async ({
    asReviewer,
  }) => {
    const page = asReviewer.page;
    const review = new ReviewPage(page);
    const strip = page.getByRole("tablist", { name: "Главы блога" });

    await test.step("Strip виден ревьюеру: все главы блога (включая недоступный черновик) как контекст", async () => {
      await review.gotoAsReviewer(CHAPTERS.underReview.id);
      await expect(strip).toBeVisible();
      await expect(review.chapterTab(/02 Промисы изнутри/)).toHaveAttribute("aria-selected", "true");
      await expect(review.chapterTab(/01 Цикл событий/)).toBeVisible();
      await expect(review.chapterTab(/03 Async\/await на практике/)).toBeVisible();
      await expect(review.chapterTab(/04 Генераторы и итераторы/)).toBeVisible();
    });

    await test.step("Табы у ревьюера — НЕ ссылки: клик по чужой главе не навигирует", async () => {
      // Фактическое поведение (review-header.tsx): в POV ревьюера все табы — span без href;
      // структурный ассерт «ни одной ссылки в strip» + клик по табу черновика ничего не меняет.
      await expect(strip.locator("a")).toHaveCount(0);
      await review.chapterTab(/04 Генераторы и итераторы/).click();
      await expect(page).toHaveURL(new RegExp(`/reviewer/review/${CHAPTERS.underReview.id}$`));
      await expect(page.getByRole("heading", { level: 1, name: CHAPTERS.underReview.title })).toBeVisible();
    });

    await test.step("Не назначенная глава по прямому URL → серверный редирект в /reviewer", async () => {
      // chp_draft без chapter_reviewers → isAssignedReviewer=false → redirect("/reviewer") на сервере.
      await review.gotoAsReviewer(CHAPTERS.draft.id);
      await expect(page).toHaveURL(/\/reviewer$/);
      // Инбокс отрисован (плитка «Активные ревью» — есть и при пустых приглашениях).
      await expect(page.getByText("Активные ревью").first()).toBeVisible();
    });
  });

  test("REV-WHOLE-BLOG-reader-mode @regression: тумблер «Весь блог» — только в ридере (?mode=whole); на ReviewPage его нет", async ({
    asGuest,
    asAuthor,
    api,
  }) => {
    await test.step("Подготовка: вторая published-глава — админ force-approve «Промисы изнутри»", async () => {
      // На чистом seed published-глава одна (event-loop), а group «Режим чтения» рендерится
      // только при >1 published-главы — публикуем promises в обход гейта (admin-API).
      const admin = await api("admin");
      const res = await admin.post(`/api/admin/review/${CHAPTERS.underReview.id}/force-approve`);
      expect(res.status()).toBe(200);
    });

    const page = asGuest.page;
    const reader = new ReaderPage(page);

    await test.step("Гость в ридере: group «Режим чтения» → ссылка «Весь блог» → ?mode=whole", async () => {
      await reader.gotoChapter(BLOG.slug, CHAPTERS.published.slug);
      await expect(page.getByRole("group", { name: "Режим чтения" })).toBeVisible();
      // «Весь блог» — обычная ссылка: клик + ожидание URL (ретрай — страховка от потери клика).
      await expect(async () => {
        await reader.readingModeLink("Весь блог").click();
        await page.waitForURL(new RegExp(`/blog/${BLOG.slug}\\?mode=whole`), { timeout: 5_000 });
      }).toPass();
      await expect(reader.readingModeLink("Весь блог")).toHaveAttribute("aria-current", "page");
    });

    await test.step("Whole-режим: h1 = название блога, контент нескольких глав подряд (заголовки глав = h2)", async () => {
      await expect(page.getByRole("heading", { level: 1, name: BLOG.title })).toBeVisible();
      // Заголовок главы-h2 может дублироваться одноимённым заголовком-блоком в контенте — берём первый.
      await expect(page.getByRole("heading", { level: 2, name: CHAPTERS.published.title }).first()).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: CHAPTERS.underReview.title }).first()).toBeVisible();
    });

    await test.step("На ReviewPage тумблера «Режим чтения» нет (только в ридере)", async () => {
      const review = new ReviewPage(asAuthor.page);
      await review.gotoAsAuthor(BLOG.slug, CHAPTERS.changesRequested.slug);
      await expect(asAuthor.page.getByRole("tablist", { name: "Главы блога" })).toBeVisible();
      await expect(asAuthor.page.getByRole("group", { name: "Режим чтения" })).toHaveCount(0);
    });
  });

  // Зависит от теста выше (force-approve promises → 2 published-главы в whole-режиме).
  test("REV-WHOLE-BLOG-comments @regression: whole-режим — ОДИН merged-блок комментариев с eyebrow глав, «Блог ревьюили», постинг через селект главы (ui-feedback-4 П8)", async ({
    asReader,
  }) => {
    const page = asReader.page;
    const comments = new CommentsPage(page, USERS.reader.handle);
    await page.goto(`/blog/${BLOG.slug}?mode=whole`);

    await test.step("Один регион «Комментарии» на весь блог; per-chapter блоков нет", async () => {
      await expect(comments.region).toHaveCount(1);
      // Карточек «Эту версию проверяли» после каждой главы больше нет —
      await expect(page.getByRole("region", { name: "Ревьюеры главы" })).toHaveCount(0);
      // — вместо них ОДНА агрегированная карточка «Блог ревьюили».
      const blogCredit = page.getByRole("region", { name: "Ревьюеры блога" });
      await expect(blogCredit).toBeVisible();
      await expect(blogCredit.getByRole("heading", { name: "Блог ревьюили" })).toBeVisible();
    });

    await test.step("Seed-комментарий «Цикла событий» виден с eyebrow своей главы", async () => {
      const rootNode = comments.node(COMMENTS.root);
      await expect(rootNode).toBeVisible();
      await expect(rootNode.getByText(CHAPTERS.published.title, { exact: true })).toBeVisible();
    });

    await test.step("Композер: селект «К главе» → постинг в «Промисы изнутри» → eyebrow новой главы", async () => {
      const text = `Merged-комментарий e2e ${Date.now()}`;
      // Без якоря целевую главу задаёт селект (default — последняя published).
      await page.getByLabel("К главе:").selectOption({ label: CHAPTERS.underReview.title });
      await throttleMutation(USERS.reader.handle);
      const id = await comments.addRoot(text);
      const node = comments.node(id);
      await expect(node).toBeVisible();
      await expect(node.getByText(CHAPTERS.underReview.title, { exact: true })).toBeVisible();
    });

    await test.step("Спойлер «прошлых версий» присутствует и в merged-режиме (cmt_old_revision)", async () => {
      await expect(comments.pastVersionsSpoiler).toBeVisible();
    });
  });
});
