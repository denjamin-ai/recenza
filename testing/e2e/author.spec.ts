// TC-AUTHOR — автор (handle `author`, блог blog_async): кабинет, деталь блога, редактор Variant B,
// шторка «Заявка на ревью» (гейт навыков + состояние живой заявки), блокировка правки на ревью,
// reorder, портфолио, комментарии в своём блоге и негативы ownership/возможностей.
// TC-док: testing/test-cases/TC-AUTHOR.md.
//
// ⚠️ Фаза 14 («Ревью 2.0»): пикер ревьюеров снят целиком — автор НЕ выбирает исполнителя, он
// оставляет ЗАЯВКУ (`POST /api/author/chapters/{id}/review-request`), а ревьюер берёт её из очереди.
// Отсюда правки в этом файле: кнопка редактора — «Заявка на ревью» (была «Отправить на ревью →»)
// и рендерится ВСЕГДА (даже на заблокированной ревизии), кнопка отправки в шторке — «Оставить
// заявку», вкладок «По навыкам»/«Все» и чекбоксов ревьюеров больше нет, а `POST …/submit`
// и `POST /api/author/ratings` удалены (404).
//
// Дисциплина файла — A/S (additive/self-restoring), БЕЗ reseed:
//   - заявка НИКОГДА не подаётся и не отзывается отсюда — это делают flows/* со своим reseed;
//   - гейт навыков (TC-AUTHOR-08) проверяется на chp_changes БЕЗ отправки (у chp_draft в сиде уже
//     висит живая заявка req_open, и шторка показала бы её состояние вместо формы);
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

  test("TC-AUTHOR-01 @smoke: кабинет /author — h1 «Мои блоги», карточка блога, aside «Об авторе», title «Кабинет автора | Recenza»", async ({
    asAuthor,
  }) => {
    const { page } = asAuthor;
    await asAuthor.goto("/author");

    // ui-feedback-4 П1 (прототип author-portal.jsx): eyebrow «Кабинет автора» + h1 «Мои блоги».
    await expect(page.getByRole("heading", { level: 1, name: "Мои блоги" })).toBeVisible();
    await expect(page.getByText("Кабинет автора", { exact: true })).toBeVisible();
    // Единственный надёжный title-маркер роли (MCP-FINDINGS §5).
    await expect(page).toHaveTitle("Кабинет автора | Recenza");
    // Сетка: плитка создания + карточка seed-блога с футером «＋ Глава»
    // («＋» — aria-hidden, accessible name = «Глава»).
    await expect(page.getByRole("button", { name: "Новый блог" })).toBeVisible();
    await expect(page.getByRole("heading", { name: BLOG.title })).toBeVisible();
    await expect(page.getByRole("button", { name: "Глава", exact: true }).first()).toBeVisible();
    // Aside: карточка «Об авторе» (seed-портфолио есть → «Изменить») и секция «События».
    const aboutCard = page.getByRole("region", { name: "Об авторе" });
    await expect(aboutCard).toBeVisible();
    await expect(aboutCard.getByRole("link", { name: "Изменить" })).toBeVisible();
    await expect(page.getByRole("region", { name: "События" })).toBeVisible();

    // Ф14: секции «Оцените ревьюеров» (рейтинг снесён) и «Навыки не совпадают» (приглашения
    // снесены) заменены на список живых ЗАЯВОК с таймером SLA (seed: req_open + req_silent).
    const requests = page.getByRole("region", { name: "Заявки на ревью" });
    await expect(requests).toBeVisible();
    await expect(requests.getByText(CHAPTERS.draft.title)).toBeVisible();
    await expect(requests.getByText("В очереди", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Оцените ревьюеров" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Навыки не совпадают" })).toHaveCount(0);
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
      // Ф14: «Команда» — те, кто ВЗЯЛ заявку (claim пишет chapter_reviewers); согласия/приглашений
      // больше нет, метки «ведущий» в чипах тоже (иерархии внутри команды не существует).
      await expect(rowOf(CHAPTERS.underReview.title).getByText("Команда:")).toBeVisible();
      await expect(rowOf(CHAPTERS.underReview.title).getByText("ведущий")).toHaveCount(0);
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
      // Ф14: кнопка отправки переименована — автор оставляет заявку, а не «отправляет ревьюерам».
      await expect(page.getByRole("button", { name: "Заявка на ревью" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Отправить на ревью →" })).toHaveCount(0);
    });

    await test.step("в кабинете появилась карточка нового блога с черновиковой статистикой", async () => {
      // ui-feedback-4 П1: статус-бейджа «Опубликован/Черновик» на карточке больше нет —
      // черновиковость видна по счётчикам («N глав(ы) · 0 опубл.» + бейдж «N черн.»);
      // точное N не ассертим (создание блога может заводить стартовую главу).
      await asAuthor.goto("/author");
      const card = page.locator("article", { has: page.getByRole("heading", { name: title }) });
      await expect(card).toBeVisible();
      await expect(card.getByText(/глав[аы]? · 0 опубл\./)).toBeVisible();
      await expect(card.getByText(/\d+ черн\./)).toBeVisible();
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
      await editor.fillTitle("Черновик для теста E2E");
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

    await test.step("сохранение → «сохранено»; после перезагрузки контент на месте", async () => {
      await throttleMutation(USERS.author.handle);
      // ui-feedback-3: структурные правки автосейвятся (дебаунс 1.6с) — ручной клик нужен, только
      // если правки ещё не улетели; идемпотентный ретрай против гонки с автосейвом.
      await expect(async () => {
        if (await editor.saveButton.isEnabled()) await editor.saveButton.click({ timeout: 1_000 });
        await expect(editor.saveIndicator("сохранено")).toBeVisible({ timeout: 4_000 });
      }).toPass({ timeout: 20_000 });
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
      await editor.fillTitle("Черновик шорткатов E2E");
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

  // ── TC-AUTHOR-08 — гейт навыков в шторке «Заявка на ревью» (БЕЗ отправки!) ───
  // ⚠️ Ф14: цель кейса — chp_changes (async-await), а НЕ chp_draft: у последней в сиде висит
  // живая заявка req_open, и шторка показала бы её состояние вместо формы (см. TC-AUTHOR-29).
  // Пикер ревьюеров снят целиком — гейтом остаются только 5 пунктов готовности.

  test("TC-AUTHOR-08 @critical: шторка «Заявка на ревью» — без навыков «Оставить заявку» заблокирована; навыки возвращаем и закрываем шторку без отправки", async ({
    asAuthor,
  }) => {
    const { page } = asAuthor;
    const editor = new EditorPage(page);
    const skillsCheckItem = editor.submitSheet.locator("li", { hasText: "Ключевые навыки статьи" });
    const submitBtn = editor.submitSheet.getByRole("button", { name: "Оставить заявку", exact: true });

    await test.step("открываем шторку на async-await: чек-лист «Готовность N/5», чипы навыков на месте, пикера ревьюеров нет", async () => {
      await editor.goto(BLOG.slug, CHAPTERS.changesRequested.slug);
      await editor.openSubmitSheet();
      await expect(editor.readinessHeading).toBeVisible();
      await expect(editor.submitSheet.getByRole("button", { name: "Удалить «Async/Await»" })).toBeVisible();
      await expect(
        editor.submitSheet.getByRole("button", { name: "Удалить «Обработка ошибок»" }),
      ).toBeVisible();
      await expect(skillsCheckItem).toContainText("✓");
      // Ф14: вкладок «Все»/«По навыкам», поиска и чекбоксов ревьюеров в шторке больше нет.
      await expect(editor.submitSheet.getByRole("tab")).toHaveCount(0);
      await expect(editor.submitSheet.getByRole("checkbox")).toHaveCount(0);
      // …зато есть новая подпись: ревью — не условие публикации, а бейдж поверх.
      await expect(
        editor.submitSheet.getByText(/Ревью не требуется для публикации/),
      ).toBeVisible();
    });

    await test.step("удаляем все навыки → пункт чек-листа открыт, футер «Закройте все пункты», «Оставить заявку» disabled", async () => {
      await editor.removeSkill("Async/Await");
      await editor.removeSkill("Обработка ошибок");
      await expect(skillsCheckItem).toContainText("○");
      await expect(editor.readyFooter).toHaveCount(0);
      await expect(editor.submitSheet.getByText("Закройте все пункты")).toBeVisible();
      await expect(submitBtn).toBeDisabled();
      // Подсказка про назначение навыков (Ф14: по ним заявку находит ревьюер, а не подбор — автор).
      await expect(
        editor.submitSheet.getByText("По ним ревьюеры находят заявку в очереди; читателю они тоже видны."),
      ).toBeVisible();
    });

    await test.step("возвращаем навыки «Async/Await», «Обработка ошибок» → пункт снова закрыт", async () => {
      await editor.addSkill("Async/Await");
      await editor.addSkill("Обработка ошибок");
      await expect(editor.submitSheet.getByRole("button", { name: "Удалить «Async/Await»" })).toBeVisible();
      await expect(
        editor.submitSheet.getByRole("button", { name: "Удалить «Обработка ошибок»" }),
      ).toBeVisible();
      await expect(skillsCheckItem).toContainText("✓");
    });

    await test.step("закрываем шторку Escape БЕЗ отправки — статус главы не изменился", async () => {
      await page.keyboard.press("Escape");
      await expect(editor.submitSheet).toBeHidden();
      await asAuthor.goto(`/author/blog/${BLOG.slug}`);
      const row = page.locator("li", { hasText: CHAPTERS.changesRequested.title });
      await expect(row.getByText("Черновик", { exact: true })).toBeVisible();
      await expect(row.getByText("Нужны правки", { exact: true })).toBeVisible();
      // Заявка не подана: пилюли «Ждёт ревьюера» у главы нет.
      await expect(row.getByText("Ждёт ревьюера", { exact: true })).toHaveCount(0);
    });
  });

  // ── TC-AUTHOR-29 — шторка на главе с ЖИВОЙ заявкой (Ф14, read-only) ──────────

  test("TC-AUTHOR-29 @critical: у главы с живой заявкой шторка показывает «Состояние заявки» и «Отозвать заявку» вместо формы", async ({
    asAuthor,
  }) => {
    const { page } = asAuthor;
    const editor = new EditorPage(page);

    await test.step("chp_draft (seed req_open): вместо формы — группа «Состояние заявки»", async () => {
      await editor.goto(BLOG.slug, CHAPTERS.draft.slug);
      await editor.openSubmitSheet();
      await expect(editor.requestState).toBeVisible();
      await expect(editor.requestState.getByText("Заявка в очереди")).toBeVisible();
      await expect(editor.requestState.getByText(/^Срок:/)).toBeVisible();
      // Формы подачи нет: ни чек-листа готовности, ни кнопки «Оставить заявку».
      await expect(editor.readinessHeading).toHaveCount(0);
      await expect(editor.submitSheet.getByRole("button", { name: "Оставить заявку" })).toHaveCount(0);
    });

    await test.step("«Отозвать заявку» доступна, пока заявку не взяли — но НЕ нажимаем (A/S-дисциплина)", async () => {
      await expect(editor.withdrawButton).toBeEnabled();
      await page.keyboard.press("Escape");
      await expect(editor.submitSheet).toBeHidden();
    });
  });

  // ── TC-AUTHOR-10+11 — блокировка правки under-review и published (UI + 409) ─

  // Ф13: блокируется ТОЛЬКО то, что читают ревьюеры прямо сейчас. Опубликованная глава снова
  // редактируема — правка заведёт ревизию-черновик поверх (сам фолк проверяется в flows/publish-free).
  test("TC-AUTHOR-10+11 @critical: глава на ревью — read-only баннер и PATCH → 409; опубликованная снова редактируема", async ({
    asAuthor,
    api,
  }) => {
    const { page } = asAuthor;
    const editor = new EditorPage(page);
    const ctx = await api("author");

    await test.step("на ревью (promises): баннер блокировки, кнопок «Сохранить»/⚙ нет; «Заявка на ревью» остаётся", async () => {
      await editor.goto(BLOG.slug, CHAPTERS.underReview.slug);
      await expect(editor.lockedBanner).toBeVisible();
      await expect(editor.saveButton).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Настройки блога" })).toHaveCount(0);
      // ⚠️ Ф14: кнопка заявки рендерится в ЛЮБОМ состоянии главы — шторка покажет состояние
      // живой заявки (req_silent, claimed), а не форму. Это валидный путь, а не утечка.
      await expect(page.getByRole("button", { name: "Заявка на ревью" })).toBeVisible();
    });

    await test.step("PATCH главы на ревью в обход UI → 409 «нельзя редактировать, пока идёт ревью»", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await ctx.patch(`/api/author/chapters/${CHAPTERS.underReview.id}`, {
        data: { title: "Взломанный заголовок" },
      });
      expect(res.status()).toBe(409);
      expect(((await res.json()) as { error?: string }).error).toBe(
        "Главу нельзя редактировать, пока идёт ревью.",
      );
    });

    await test.step("published (event-loop): read-only баннера нет, есть «Сохранить» и предупреждение о новой версии", async () => {
      await editor.goto(BLOG.slug, CHAPTERS.published.slug);
      await expect(editor.lockedBanner).toHaveCount(0);
      await expect(editor.saveButton).toBeVisible();
      await expect(page.getByText(/Правки создадут новую версию поверх опубликованной/)).toBeVisible();
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
      // Ф13.5: секция называется «О себе» и есть у всех; портфолио внутри неё — по видимости.
      await expect(guest.getByRole("region", { name: "О себе" })).toBeVisible();
      await expect(guest.getByRole("heading", { name: "Об авторе", level: 2 })).toBeVisible();
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

    await test.step("гость на /u/author: таб «О себе» остаётся, но портфолио в нём нет", async () => {
      await asGuest.goto(`/u/${USERS.author.slug}`);
      await expect(guest.getByRole("heading", { name: "Антон Автор" })).toBeVisible();
      // Ф13.5: таб «О себе» есть всегда (там био), скрывается только содержимое портфолио.
      await expect(guest.getByRole("region", { name: "О себе" })).toBeVisible();
      await expect(guest.getByRole("heading", { name: "Об авторе", level: 2 })).toHaveCount(0);
    });

    await test.step("самовосстановление: включаем обратно — гостю снова видно", async () => {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect(toggle).toHaveText("Видно всем");
      await throttleMutation(USERS.author.handle);
      await saveBtn.click();
      await expect(page.getByText("сохранено", { exact: true })).toBeVisible();

      await asGuest.goto(`/u/${USERS.author.slug}`);
      await expect(guest.getByRole("heading", { name: "Об авторе", level: 2 })).toBeVisible();
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

  // ── TC-AUTHOR-23 — автор читает каталог наравне со всеми; скрыт только блог забаненного ─────

  test("TC-AUTHOR-23 @regression: каталог автора — общий «Все блоги» без блога забаненного, прямые URL → 404", async ({
    asAuthor,
  }) => {
    const { page } = asAuthor;
    const reader = new ReaderPage(page, USERS.author.handle);

    await test.step("каталог автора — общий: свои и чужие блоги; блога забаненного ghost нет", async () => {
      // ⚠️ Ф13 (З-07): ролевой изоляции автора нет — restrictAuthorId снят, h1 общий «Все блоги».
      await reader.gotoCatalog();
      await expect(reader.homeHeading("Все блоги")).toBeVisible();
      await expect(page.getByText(BLOG.title).first()).toBeVisible();
      // Скрыт по модерации (ghost.isBlocked), а не по роли зрителя.
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

  // ── TC-AUTHOR-28 — engagement доступен любому аккаунту (Ф13, реверс ui-feedback-5 П4) ────────

  test("TC-AUTHOR-28 @critical: голос/закладка/подписка автору доступны; бар «Реакции», «Лента» и «Закладки» на месте", async ({
    asAuthor,
    api,
  }) => {
    const ctx = await api("author");

    await test.step("API: vote/bookmarks под автором → 200; /bookmarks открывается", async () => {
      await throttleMutation(USERS.author.handle);
      expect((await ctx.post(`/api/blogs/${BLOG.id}/vote`, { data: { value: 1 } })).status()).toBe(200);
      await throttleMutation(USERS.author.handle);
      expect((await ctx.post("/api/bookmarks", { data: { blogId: BLOG.id } })).status()).toBe(200);
      // Подписка на самого себя запрещена по существу (не по роли) — проверяем именно эту причину.
      await throttleMutation(USERS.author.handle);
      const self = await ctx.post("/api/follows", { data: { authorId: USERS.author.id } });
      expect(self.status()).toBe(400);
      expect(((await self.json()) as { error?: string }).error).toBe("Нельзя подписаться на себя.");
      // Страница закладок автору доступна (реверс uif-5 П4).
      const page = await ctx.get("/bookmarks", { maxRedirects: 0 });
      expect(page.status()).toBe(200);
    });

    await test.step("UI: бар «Реакции» есть; «Лента» вернулась в шапку; меню — с «Закладками», без «Все мои блоги»", async () => {
      const { page } = asAuthor;
      await page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);
      await expect(page.locator('[aria-label="Реакции"]').first()).toBeVisible();
      // ⚠️ Ф13 (реверс uif-6 П6): «Лента» в шапке есть у всех — каталог перестал быть ролевым.
      await expect(page.getByRole("banner").getByRole("link", { name: "Лента" })).toBeVisible();

      const reader = new ReaderPage(page, USERS.author.handle);
      await reader.userMenuButton.click();
      const menu = page.getByRole("menu", { name: "Меню пользователя" });
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: "Закладки" })).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: "Мой профиль" })).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: "Кабинет автора" })).toBeVisible();
      // ui-feedback-6 П2: «Сменить аватар» из меню убран (кнопка живёт на своей /u/-странице).
      await expect(menu.getByRole("menuitem", { name: "Сменить аватар" })).toHaveCount(0);
      // Ф13: пункт «Все мои блоги» удалён — каталог общий, свои блоги живут в кабинете.
      await expect(menu.getByRole("menuitem", { name: "Все мои блоги" })).toHaveCount(0);
    });

    // Self-restoring: снимаем голос и закладку, оставленные выше.
    await throttleMutation(USERS.author.handle);
    await ctx.post(`/api/blogs/${BLOG.id}/vote`, { data: { value: 1 } });
    await throttleMutation(USERS.author.handle);
    await ctx.post("/api/bookmarks", { data: { blogId: BLOG.id } });
  });

  // ── TC-AUTHOR-26 — автосейв структурных правок + «Просмотр» (ui-feedback-3, П10) ─

  test("TC-AUTHOR-26 @critical: «+ Блок» автосейвится без «Сохранить»; «Просмотр» сохраняет и открывает превью", async ({
    asAuthor,
    api,
  }) => {
    const { page } = asAuthor;
    const editor = new EditorPage(page);
    const ctx = await api("author");
    const sandbox = await createSandboxBlog(ctx, "Автосейв E2E");

    await test.step("добавление блока → «сохранено» БЕЗ клика по «Сохранить»; после reload блок на месте", async () => {
      await editor.goto(sandbox.blogSlug, sandbox.chapterSlug);
      // Гидрация: правка заголовка включает «не сохранено».
      await editor.fillTitle("Автосейв главы E2E");
      await expect(editor.saveIndicator("не сохранено")).toBeVisible();
      await throttleMutation(USERS.author.handle);
      await editor.addBlockViaMenu("Параграф");
      // Структурная правка планирует дебаунс-автосейв (~1.6с) — ждём индикатор без ручного save.
      await expect(editor.saveIndicator("сохранено")).toBeVisible({ timeout: 10_000 });
      await page.reload();
      await expect(editor.titleInput).toHaveValue("Автосейв главы E2E");
      await expect(editor.blockInput("Параграф")).toBeVisible();
    });

    await test.step("правка текста + «Просмотр» → сохранение и переход на превью со свежим контентом", async () => {
      await editor.blockInput("Параграф").fill("Абзац, который должен доехать до превью.");
      await expect(editor.saveIndicator("не сохранено")).toBeVisible();
      await throttleMutation(USERS.author.handle);
      await page.getByRole("button", { name: "Просмотр" }).click();
      await page.waitForURL("**/preview");
      await expect(page.getByText("Абзац, который должен доехать до превью.")).toBeVisible();
    });
  });

  // ── TC-AUTHOR-27 — «Руководство» для автора (ui-feedback-3, П9) ──────────────

  test("TC-AUTHOR-27 @regression: кнопка «Руководство» показывает «Гид автора»", async ({ asAuthor }) => {
    const { page } = asAuthor;
    await asAuthor.goto("/");
    const dialog = page.getByRole("dialog", { name: "Гид автора" });
    await expect(async () => {
      await page.getByRole("banner").getByRole("button", { name: "Руководство" }).click();
      await expect(dialog).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(dialog.getByText("Тип пользователя · автор")).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Кабинет автора/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
