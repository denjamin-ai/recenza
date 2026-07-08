// TC-AUTHOR — автор (handle `author`, блог blog_async): кабинет, деталь блога, редактор Variant B,
// SubmitSheet-гейт навыков, блокировка правки under-review/published, reorder, портфолио,
// комментарии в своём блоге и негативы ownership/ролей. TC-док: testing/test-cases/TC-AUTHOR.md.
// Дисциплина файла — A/S (additive/self-restoring), БЕЗ reseed:
//   - chp_draft (generators) НИКОГДА не отправляется на ревью — это делают flows/*;
//   - submit-гейт (TC-AUTHOR-08) проверяется БЕЗ отправки (навыки возвращаются, шторка закрывается Escape);
//   - новые блоги-песочницы создаются с уникальными title и НЕ удаляются (additive);
//   - reorder (TC-AUTHOR-12) и видимость портфолио (TC-AUTHOR-14+15) — toggle туда-обратно.
// Локаторы и точные тексты — testing/mcp/MCP-FINDINGS.md §2/§5; известные баги §6 не ассертим как рабочие.

import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./fixtures";
import { throttleMutation } from "./helpers/throttle";
import { BASE_URL, BLOG, CHAPTERS, HIDDEN_BLOG, USERS } from "./helpers/seed";
import { EditorPage } from "./pages/editor.page";
import { ReaderPage } from "./pages/reader.page";
import { CommentsPage } from "./pages/comments.page";

/**
 * Блог-песочница через API (create-then-edit): POST /api/author/blogs создаёт блог
 * И первую главу-черновик (slug приходит в ответе). Уникальный title → уникальный slug,
 * повторные прогоны без reseed не конфликтуют (additive).
 */
async function createSandboxBlog(
  ctx: APIRequestContext,
  titlePrefix: string,
): Promise<{ blogSlug: string; chapterSlug: string; title: string }> {
  await throttleMutation(USERS.author.handle);
  const title = `${titlePrefix} ${Date.now()}`;
  const res = await ctx.post("/api/author/blogs", { data: { title } });
  if (!res.ok()) {
    throw new Error(`Не удалось создать блог-песочницу: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { blogSlug: string; chapterSlug: string };
  return { blogSlug: body.blogSlug, chapterSlug: body.chapterSlug, title };
}

test.describe("Автор (author)", () => {
  // ── TC-AUTHOR-01 (SMK-07) ───────────────────────────────────────────────────

  test("TC-AUTHOR-01 @smoke: кабинет /author — h1 «Кабинет автора», карточка блога, title «Кабинет автора | Recenza»", async ({
    asAuthor,
  }) => {
    const { page } = asAuthor;
    await asAuthor.goto("/author");

    await expect(page.getByRole("heading", { level: 1, name: "Кабинет автора" })).toBeVisible();
    // Единственный надёжный title-маркер роли (MCP-FINDINGS §5).
    await expect(page).toHaveTitle("Кабинет автора | Recenza");
    // Секция «Мои блоги»: плитка создания + карточка seed-блога.
    await expect(page.getByRole("button", { name: "Новый блог" })).toBeVisible();
    await expect(page.getByRole("heading", { name: BLOG.title })).toBeVisible();
    await expect(page.getByRole("link", { name: "Об авторе →" })).toBeVisible();
  });

  // ── TC-AUTHOR-02 — деталь блога: фильтр-чипы и независимые статусы глав ─────

  test("TC-AUTHOR-02 @regression: деталь блога — tablist «Фильтр глав», независимые статус-пилюли 4 глав", async ({
    asAuthor,
  }) => {
    const { page } = asAuthor;
    await asAuthor.goto(`/author/blog/${BLOG.slug}`);

    const tablist = page.getByRole("tablist", { name: "Фильтр глав" });
    const rowOf = (title: string) => page.locator("li", { hasText: title });

    await test.step("фильтр-чипы на месте («Все (N)» — точные N не ассертим)", async () => {
      await expect(page.getByRole("heading", { level: 1, name: BLOG.title })).toBeVisible();
      await expect(tablist).toBeVisible();
      await expect(tablist.getByRole("tab", { name: /^Все \(\d+\)$/ })).toBeVisible();
      await expect(tablist.getByRole("tab", { name: /^Черновики \(\d+\)$/ })).toBeVisible();
      await expect(tablist.getByRole("tab", { name: /^Нужны правки \(\d+\)$/ })).toBeVisible();
      await expect(tablist.getByRole("tab", { name: /^На ревью \(\d+\)$/ })).toBeVisible();
      await expect(tablist.getByRole("tab", { name: /^Опубликовано \(\d+\)$/ })).toBeVisible();
    });

    await test.step("у каждой seed-главы своя статус-пилюля", async () => {
      await expect(rowOf(CHAPTERS.published.title).getByText("Опубликовано", { exact: true })).toBeVisible();
      await expect(rowOf(CHAPTERS.underReview.title).getByText("На ревью", { exact: true })).toBeVisible();
      await expect(rowOf(CHAPTERS.changesRequested.title).getByText("Нужны правки", { exact: true })).toBeVisible();
      await expect(rowOf(CHAPTERS.draft.title).getByText("Черновик", { exact: true })).toBeVisible();
      // Команда ревьюеров видна у главы на ревью (принявшие приглашение).
      await expect(rowOf(CHAPTERS.underReview.title).getByText("Команда:")).toBeVisible();
    });

    await test.step("фильтр «На ревью» оставляет только «Промисы изнутри» с кнопкой «Ревью»", async () => {
      // Первый клик по чипу ретраим — до гидрации клики молча теряются (MCP-FINDINGS §4).
      await expect(async () => {
        await tablist.getByRole("tab", { name: /^На ревью/ }).click();
        await expect(rowOf(CHAPTERS.published.title)).toHaveCount(0, { timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await expect(rowOf(CHAPTERS.underReview.title)).toBeVisible();
      await expect(rowOf(CHAPTERS.underReview.title).getByRole("link", { name: "Ревью" }).first()).toBeVisible();
    });

    await test.step("возврат фильтра «Все» — все 4 главы снова видны", async () => {
      await tablist.getByRole("tab", { name: /^Все/ }).click();
      await expect(rowOf(CHAPTERS.published.title)).toBeVisible();
      await expect(rowOf(CHAPTERS.draft.title)).toBeVisible();
    });
  });

  // ── TC-AUTHOR-03+04 — создание блога и главы (additive: сущности остаются) ──

  test("TC-AUTHOR-03+04 @regression: «Новый блог» → create-then-edit, в новом блоге «+ Новая глава» → редактор", async ({
    asAuthor,
  }) => {
    const { page } = asAuthor;
    const editor = new EditorPage(page);
    const title = `Тестовый блог E2E ${Date.now()}`;

    await test.step("плитка «Новый блог» разворачивается в форму (клик ретраится до гидрации)", async () => {
      await asAuthor.goto("/author");
      const titleField = page.getByLabel("Название блога");
      await expect(async () => {
        if (!(await titleField.isVisible())) {
          await page.getByRole("button", { name: "Новый блог" }).click();
        }
        await expect(titleField).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
    });

    await test.step("«Создать» неактивна при пустом поле, после ввода — создание и редирект", async () => {
      const createBtn = page.getByRole("button", { name: "Создать", exact: true });
      await expect(createBtn).toBeDisabled();
      await page.getByLabel("Название блога").fill(title);
      await expect(createBtn).toBeEnabled();
      await throttleMutation(USERS.author.handle);
      await createBtn.click();
      // Slug — транслитерированная латиница (src/lib/slug.ts).
      await page.waitForURL(/\/author\/blog\/[a-z0-9-]+$/);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    });

    await test.step("«+ Новая глава» → редирект в редактор Variant B", async () => {
      await throttleMutation(USERS.author.handle);
      await page.getByRole("button", { name: "+ Новая глава" }).click();
      await page.waitForURL(/\/author\/blog\/[a-z0-9-]+\/[a-z0-9-]+\/edit$/);
      await expect(editor.titleInput).toBeVisible();
      await expect(editor.titleInput).toHaveValue("Новая глава");
      await expect(editor.saveIndicator("нет изменений")).toBeVisible();
      await expect(page.getByRole("button", { name: "Отправить на ревью →" })).toBeVisible();
    });

    await test.step("в кабинете появилась карточка нового блога с бейджем «Черновик»", async () => {
      await asAuthor.goto("/author");
      const card = page.locator("article", { has: page.getByRole("heading", { name: title }) });
      await expect(card).toBeVisible();
      await expect(card.getByText("Черновик", { exact: true })).toBeVisible();
    });
  });

  // ── TC-AUTHOR-05 — редактор: блоки, слэш-меню, сохранение ────────────────────

  test("TC-AUTHOR-05 @critical: редактор — заголовок, «Параграф», слэш-меню «/» → «Заголовок 2», save → «сохранено» и персистентность", async ({
    asAuthor,
    api,
  }) => {
    const { page } = asAuthor;
    const editor = new EditorPage(page);
    const ctx = await api("author");
    // Песочница, чтобы не трогать seed-главы blog_async (additive, самодостаточно).
    const sandbox = await createSandboxBlog(ctx, "Редактор E2E");

    await test.step("заголовок главы → индикатор «не сохранено» (доказательство гидрации)", async () => {
      await editor.goto(sandbox.blogSlug, sandbox.chapterSlug);
      await editor.titleInput.fill("Черновик для теста E2E");
      await expect(editor.saveIndicator("не сохранено")).toBeVisible();
      await expect(editor.saveButton).toBeEnabled();
    });

    await test.step("первый блок «Параграф» через «+ Блок»", async () => {
      await expect(page.getByText("Пустой документ. Добавьте первый блок.")).toBeVisible();
      await editor.addBlockViaMenu("Параграф");
      await editor.blockInput("Параграф").fill("Первый абзац содержательного текста.");
    });

    await test.step("слэш-меню «/» в пустом параграфе → «Заголовок 2»", async () => {
      await editor.addBlockViaMenu("Параграф");
      await editor.slashInsert("Заголовок 2", editor.blockInput("Параграф", 1));
      await expect(page.getByRole("listbox", { name: "Вставить блок" })).toHaveCount(0);
      await editor.blockInput("Заголовок 2").fill("Раздел один");
    });

    await test.step("«Сохранить» → «сохранено»; после перезагрузки контент на месте", async () => {
      await throttleMutation(USERS.author.handle);
      await editor.save();
      await page.reload();
      await expect(editor.titleInput).toHaveValue("Черновик для теста E2E");
      await expect(editor.blockInput("Параграф")).toHaveValue("Первый абзац содержательного текста.");
      await expect(editor.blockInput("Заголовок 2")).toHaveValue("Раздел один");
    });
  });

  // ── TC-AUTHOR-06 — markdown-шорткат «## » ────────────────────────────────────
  // ⚠️ Баг №6 (MCP-FINDINGS §6): при конвертации фокус НЕ переносится в новый INPUT,
  // текст после «## » уходит в никуда. Ассертим ТОЛЬКО смену типа блока, не перенос текста.

  test("TC-AUTHOR-06 @regression: markdown-шорткат «## » конвертирует параграф в «Заголовок 2» (перенос текста не ассертим — баг №6)", async ({
    asAuthor,
    api,
  }) => {
    const { page } = asAuthor;
    const editor = new EditorPage(page);
    const ctx = await api("author");
    const sandbox = await createSandboxBlog(ctx, "Шорткаты E2E");

    await test.step("гидрация: правка заголовка включает «не сохранено»", async () => {
      await editor.goto(sandbox.blogSlug, sandbox.chapterSlug);
      await editor.titleInput.fill("Черновик шорткатов E2E");
      await expect(editor.saveIndicator("не сохранено")).toBeVisible();
    });

    await test.step("«## » в пустом параграфе → блок становится «Заголовок 2»", async () => {
      await editor.addBlockViaMenu("Параграф");
      const paragraph = editor.blockInput("Параграф");
      await paragraph.click();
      await paragraph.pressSequentially("## ");
      await expect(editor.blockInput("Заголовок 2")).toBeVisible();
      // Параграф заменён (не добавлен рядом) — маркер «## » не «протёк» в текст.
      await expect(editor.blockInput("Параграф")).toHaveCount(0);
      await expect(editor.blockInput("Заголовок 2")).toHaveValue("");
    });
  });

  // ── TC-AUTHOR-08 — гейт навыков в SubmitSheet (БЕЗ отправки!) ────────────────

  test("TC-AUTHOR-08 @critical: SubmitSheet — без навыков submit заблокирован; навыки возвращаем и закрываем шторку без отправки", async ({
    asAuthor,
  }) => {
    const { page } = asAuthor;
    const editor = new EditorPage(page);
    const skillsCheckItem = editor.submitSheet.locator("li", { hasText: "Ключевые навыки статьи" });
    const submitBtn = editor.submitSheet.getByRole("button", { name: "Отправить", exact: true });

    await test.step("открываем шторку на seed-черновике generators: чек-лист «Готовность N/7», чипы навыков на месте", async () => {
      await editor.goto(BLOG.slug, CHAPTERS.draft.slug);
      await editor.openSubmitSheet();
      await expect(editor.readinessHeading).toBeVisible();
      await expect(editor.submitSheet.getByRole("button", { name: "Удалить «Генераторы»" })).toBeVisible();
      await expect(editor.submitSheet.getByRole("button", { name: "Удалить «Итераторы»" })).toBeVisible();
      await expect(skillsCheckItem).toContainText("✓");
    });

    await test.step("удаляем все навыки → пункт чек-листа открыт, футер «Закройте все пункты», «Отправить» disabled", async () => {
      await editor.removeSkill("Генераторы");
      await editor.removeSkill("Итераторы");
      await expect(skillsCheckItem).toContainText("○");
      await expect(editor.readyFooter).toHaveCount(0);
      await expect(editor.submitSheet.getByText("Закройте все пункты")).toBeVisible();
      await expect(submitBtn).toBeDisabled();
      // Подбор без навыков не работает (вкладка «По навыкам» — дефолтная).
      await expect(
        editor.submitSheet.getByText("Добавьте навыки статьи — по ним подбираются ревьюеры."),
      ).toBeVisible();
    });

    await test.step("возвращаем навыки «Генераторы», «Итераторы» → пункт снова закрыт", async () => {
      await editor.addSkill("Генераторы");
      await editor.addSkill("Итераторы");
      await expect(editor.submitSheet.getByRole("button", { name: "Удалить «Генераторы»" })).toBeVisible();
      await expect(editor.submitSheet.getByRole("button", { name: "Удалить «Итераторы»" })).toBeVisible();
      await expect(skillsCheckItem).toContainText("✓");
    });

    await test.step("закрываем шторку Escape БЕЗ отправки — глава остаётся черновиком", async () => {
      await page.keyboard.press("Escape");
      await expect(editor.submitSheet).toBeHidden();
      await asAuthor.goto(`/author/blog/${BLOG.slug}`);
      await expect(
        page.locator("li", { hasText: CHAPTERS.draft.title }).getByText("Черновик", { exact: true }),
      ).toBeVisible();
    });
  });

  // ── TC-AUTHOR-10+11 — блокировка правки under-review и published (UI + 409) ─

  test("TC-AUTHOR-10+11 @critical: главы under-review и published — read-only баннер без «Сохранить», PATCH → 409", async ({
    asAuthor,
    api,
  }) => {
    const { page } = asAuthor;
    const editor = new EditorPage(page);
    const ctx = await api("author");

    await test.step("under-review (promises): баннер блокировки, кнопок «Сохранить»/⚙/«Отправить» нет", async () => {
      await editor.goto(BLOG.slug, CHAPTERS.underReview.slug);
      await expect(editor.lockedBanner).toBeVisible();
      await expect(editor.saveButton).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Отправить на ревью →" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Настройки блога" })).toHaveCount(0);
    });

    await test.step("PATCH under-review в обход UI → 409 «Главу нельзя редактировать в текущем статусе.»", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await ctx.patch(`/api/author/chapters/${CHAPTERS.underReview.id}`, {
        data: { title: "Взломанный заголовок" },
      });
      expect(res.status()).toBe(409);
      expect(((await res.json()) as { error?: string }).error).toBe(
        "Главу нельзя редактировать в текущем статусе.",
      );
    });

    await test.step("published (event-loop): та же блокировка UI и 409 API", async () => {
      await editor.goto(BLOG.slug, CHAPTERS.published.slug);
      await expect(editor.lockedBanner).toBeVisible();
      await expect(editor.saveButton).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Отправить на ревью →" })).toHaveCount(0);

      await throttleMutation(USERS.author.handle);
      const res = await ctx.patch(`/api/author/chapters/${CHAPTERS.published.id}`, {
        data: { title: "Взломанный заголовок" },
      });
      expect(res.status()).toBe(409);
      expect(((await res.json()) as { error?: string }).error).toBe(
        "Главу нельзя редактировать в текущем статусе.",
      );
    });

    await test.step("заголовки глав не изменились", async () => {
      await asAuthor.goto(`/author/blog/${BLOG.slug}`);
      await expect(page.locator("li", { hasText: CHAPTERS.underReview.title })).toBeVisible();
      await expect(page.locator("li", { hasText: CHAPTERS.published.title })).toBeVisible();
      await expect(page.getByText("Взломанный заголовок")).toHaveCount(0);
    });
  });

  // ── TC-AUTHOR-12 — reorder глав (self-restoring: вниз, затем вверх обратно) ──

  test("TC-AUTHOR-12 @regression: reorder — «Опустить главу…» затем «Поднять…» обратно, краевые кнопки disabled", async ({
    asAuthor,
  }) => {
    const { page } = asAuthor;
    const tablist = page.getByRole("tablist", { name: "Фильтр глав" });
    const upFirst = page.getByRole("button", { name: /^Поднять главу/ }).first();
    const downLast = page.getByRole("button", { name: /^Опустить главу/ }).last();
    const upPublished = page.getByRole("button", { name: `Поднять главу «${CHAPTERS.published.title}»` });
    const downPublished = page.getByRole("button", { name: `Опустить главу «${CHAPTERS.published.title}»` });
    const waitReorder = () =>
      page.waitForResponse((r) => r.url().includes("/api/author/chapters/reorder"), { timeout: 10_000 });

    await test.step("исходное состояние: у первой главы ▲ disabled, у последней ▼ disabled", async () => {
      await asAuthor.goto(`/author/blog/${BLOG.slug}`);
      await expect(upFirst).toBeDisabled();
      await expect(downLast).toBeDisabled();
      await expect(upPublished).toBeDisabled(); // «Цикл событий» — первая по seed-порядку
    });

    await test.step("гидрация: в фильтре «Черновики» reorder-кнопки скрыты, в «Все» — видны", async () => {
      await expect(async () => {
        await tablist.getByRole("tab", { name: /^Черновики/ }).click();
        await expect(page.getByRole("button", { name: /^Поднять главу/ })).toHaveCount(0, { timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await tablist.getByRole("tab", { name: /^Все/ }).click();
      await expect(upFirst).toBeVisible();
    });

    await test.step("▼ у «Цикл событий»: порядок меняется и сохраняется после reload", async () => {
      await throttleMutation(USERS.author.handle);
      const done = waitReorder();
      await downPublished.click();
      expect((await done).ok()).toBeTruthy();
      await page.reload();
      await expect(upPublished).toBeEnabled(); // больше не первая
      await expect(upFirst).toBeDisabled(); // новый первый ряд — с disabled ▲
    });

    await test.step("самовосстановление: ▲ возвращает исходный порядок", async () => {
      await throttleMutation(USERS.author.handle);
      const done = waitReorder();
      await upPublished.click();
      expect((await done).ok()).toBeTruthy();
      await page.reload();
      await expect(upPublished).toBeDisabled(); // снова первая
      await expect(downLast).toBeDisabled();
    });
  });

  // ── TC-AUTHOR-14+15 — портфолио: тумблер видимости (self-restoring) ──────────

  test("TC-AUTHOR-14+15 @regression: портфолио — «Видно всем»/«Скрыто» (aria-pressed); скрытое не видно гостю на /u/author, возврат восстанавливает", async ({
    asAuthor,
    asGuest,
  }) => {
    const { page } = asAuthor;
    const guest = asGuest.page;
    const toggle = page.getByRole("button", { name: /^(Видно всем|Скрыто)$/ });
    const saveBtn = page.getByRole("button", { name: "Сохранить" });

    await test.step("исходно портфолио «Видно всем» (aria-pressed=true) и видно гостю", async () => {
      await asAuthor.goto("/author/portfolio");
      await expect(toggle).toHaveText("Видно всем");
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await asGuest.goto(`/u/${USERS.author.slug}`);
      await expect(guest.getByRole("region", { name: "Об авторе" })).toBeVisible();
    });

    await test.step("выключаем видимость и сохраняем (клик ретраится до гидрации)", async () => {
      await expect(async () => {
        if ((await toggle.getAttribute("aria-pressed")) === "true") {
          await toggle.click();
        }
        await expect(toggle).toHaveAttribute("aria-pressed", "false", { timeout: 1_500 });
      }).toPass({ timeout: 20_000 });
      await expect(toggle).toHaveText("Скрыто");
      await expect(page.getByText("не сохранено", { exact: true })).toBeVisible();
      await throttleMutation(USERS.author.handle);
      await saveBtn.click();
      await expect(page.getByText("сохранено", { exact: true })).toBeVisible();
    });

    await test.step("гость на /u/author: секции и таба «Об авторе» нет", async () => {
      await asGuest.goto(`/u/${USERS.author.slug}`);
      await expect(guest.getByRole("heading", { name: "Антон Автор" })).toBeVisible();
      await expect(guest.getByRole("region", { name: "Об авторе" })).toHaveCount(0);
      await expect(guest.getByRole("tab", { name: "Об авторе" })).toHaveCount(0);
    });

    await test.step("самовосстановление: включаем обратно — гостю снова видно", async () => {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect(toggle).toHaveText("Видно всем");
      await throttleMutation(USERS.author.handle);
      await saveBtn.click();
      await expect(page.getByText("сохранено", { exact: true })).toBeVisible();

      await asGuest.goto(`/u/${USERS.author.slug}`);
      await expect(guest.getByRole("region", { name: "Об авторе" })).toBeVisible();
    });
  });

  // ── TC-AUTHOR-20 — автор комментирует свой блог (additive) ──────────────────

  test("TC-AUTHOR-20 @regression: автор комментирует свой блог — композер доступен, отправка ок", async ({
    asAuthor,
  }) => {
    const { page } = asAuthor;
    const comments = new CommentsPage(page, USERS.author.handle);
    const text = `Спасибо за вопросы, дополню главу. [e2e-${Date.now()}]`;

    await test.step("композер доступен (автор — участник своего блога)", async () => {
      await asAuthor.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);
      await expect(comments.region).toBeVisible();
      await expect(comments.composer).toBeVisible();
    });

    await test.step("отправка top-level комментария — появился в списке", async () => {
      const sendBtn = comments.region.getByRole("button", { name: "Отправить" }).first();
      await comments.composer.fill(text);
      // disabled→enabled после ввода = гидрация состоялась, клик не потеряется.
      await expect(sendBtn).toBeEnabled();
      await throttleMutation(USERS.author.handle);
      await sendBtn.click();
      await expect(comments.region.getByText(text)).toBeVisible();
    });
  });

  // ── TC-AUTHOR-21 — НЕГАТИВ: PATCH чужой главы ────────────────────────────────

  test("TC-AUTHOR-21 @critical: PATCH чужой главы chp_ghost → 404 «Глава не найдена.» (ownership маскируется)", async ({
    api,
  }) => {
    const ctx = await api("author");
    await throttleMutation(USERS.author.handle);
    const res = await ctx.patch(`/api/author/chapters/${CHAPTERS.ghost.id}`, {
      data: { title: "Перехват" },
    });
    expect(res.status()).toBe(404);
    expect(((await res.json()) as { error?: string }).error).toBe("Глава не найдена.");
  });

  // ── TC-AUTHOR-22 — НЕГАТИВ: комментарий в чужом блоге ────────────────────────

  test("TC-AUTHOR-22 @critical: POST /api/comments в чужой скрытый блог → 4xx (403/404), комментарий не создан", async ({
    api,
  }, testInfo) => {
    const ctx = await api("author");
    await throttleMutation(USERS.author.handle);
    const res = await ctx.post("/api/comments", {
      data: { blogSlug: HIDDEN_BLOG.slug, chapterSlug: CHAPTERS.ghost.slug, text: "Чужой блог — probe" },
    });
    // Скрытый чужой блог не резолвится: допустимы 403 (commentGate) и 404 (не раскрывать ресурс).
    // Фактически реализация отдаёт 404 «Глава не найдена» (TC-AUTHOR.md, Notes).
    expect([403, 404]).toContain(res.status());
    testInfo.annotations.push({ type: "фактический статус", description: String(res.status()) });
  });

  // ── TC-AUTHOR-23 — чужие блоги скрыты из ленты/каталога автора ───────────────

  test("TC-AUTHOR-23 @regression: в ленте/каталоге автора нет чужого «Скрытый блог», прямые URL → 404", async ({
    asAuthor,
  }) => {
    const { page } = asAuthor;
    const reader = new ReaderPage(page, USERS.author.handle);

    await test.step("лента: свой блог виден, «Скрытый блог» отсутствует", async () => {
      await reader.gotoFeed();
      await expect(page.getByText(BLOG.title).first()).toBeVisible();
      await expect(page.getByText(HIDDEN_BLOG.title)).toHaveCount(0);
    });

    await test.step("каталог: только свои блоги, чужого нет", async () => {
      await reader.feedTab("Каталог").click();
      await expect(page.getByText(BLOG.title).first()).toBeVisible();
      await expect(page.getByText(HIDDEN_BLOG.title)).toHaveCount(0);
    });

    await test.step("прямой URL чужого блога и его главы → 404 без утечки названия", async () => {
      const resBlog = await page.goto(`/blog/${HIDDEN_BLOG.slug}`);
      expect(resBlog?.status()).toBe(404);
      await expect(page.getByText(HIDDEN_BLOG.title)).toHaveCount(0);

      const resChapter = await page.goto(`/blog/${HIDDEN_BLOG.slug}/${CHAPTERS.ghost.slug}`);
      expect(resChapter?.status()).toBe(404);
    });
  });

  // ── TC-AUTHOR-24+25 — НЕГАТИВ: reviewer-API и чужие protected-сегменты ───────

  test("TC-AUTHOR-24+25 @critical: verdict-API автору → 403; GET /admin и /reviewer под автором → 307", async ({
    api,
  }) => {
    const ctx = await api("author");

    await test.step("POST verdict на свою главу → 403 «Вердикт ставит только назначенный ревьюер.»", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await ctx.post(`/api/review/${CHAPTERS.underReview.id}/verdict`, {
        data: { verdict: "approve" },
      });
      expect(res.status()).toBe(403);
      expect(((await res.json()) as { error?: string }).error).toBe(
        "Вердикт ставит только назначенный ревьюер.",
      );
    });

    await test.step("GET /admin с сессией автора → 307 (admin-портал не рендерится)", async () => {
      const res = await ctx.get("/admin", { maxRedirects: 0 });
      expect(res.status()).toBe(307);
    });

    await test.step("GET /reviewer с сессией автора → 307 на / (не та роль)", async () => {
      const res = await ctx.get("/reviewer", { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      const location = res.headers()["location"] ?? "";
      expect(new URL(location, BASE_URL).pathname).toBe("/");
    });
  });
});
