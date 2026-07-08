// TC-READER — читатель: логин, engagement (голос/закладка/подписка), уведомления,
// комментирование (дерево ≤2, окно правки, tombstone, спойлер), негативы матрицы ролей.
// TC-док: testing/test-cases/TC-READER.md. Категория A/S: seed не ломаем — toggle-мутации
// возвращаются в исходное состояние, новые комментарии аддитивны; reseed не требуется.
// Локаторы/тексты — MCP-FINDINGS §2/§5. Формы API сверены с src/app/api/**.

import { test, expect } from "./fixtures";
import { loginViaUi, newApiContext, uniqueXff } from "./helpers/auth";
import { BLOG, CHAPTERS, COMMENTS, PASSWORD, USERS } from "./helpers/seed";
import { ReaderPage } from "./pages/reader.page";
import { CommentsPage } from "./pages/comments.page";

test.describe("Читатель", () => {
  // ── TC-READER-01 (SMK-04) ───────────────────────────────────────────────────

  test("TC-READER-01 @smoke: логин читателя через UI → редирект на главную, меню пользователя", async ({
    asGuest,
  }) => {
    const { page } = asGuest;
    await loginViaUi(page, USERS.reader.handle);
    await expect(page).toHaveURL(new RegExp(`${"http://localhost:3001"}/?$`));
    await expect(page.getByRole("button", { name: "Меню пользователя" })).toBeVisible();
  });

  // ── TC-READER-02 — неверный пароль (уникальный XFF для изоляции login-лимита) ─

  test("TC-READER-02 @regression: неверный пароль → alert, остались на /login", async ({
    guestWithXff,
  }, testInfo) => {
    const { page } = await guestWithXff(uniqueXff(testInfo));
    await page.goto("/login");
    await page.getByLabel("Никнейм").fill(USERS.reader.handle);
    await page.getByLabel("Пароль").fill("неверный-пароль");
    await page.getByRole("button", { name: "Войти" }).click();
    // На странице есть и пустой aria-live регион, и алерт формы — берём тот, где текст ошибки.
    await expect(page.getByText("Неверный никнейм или пароль.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  // ── TC-READER-03 — заблокированный ghost (энумерация закрыта) ────────────────

  test("TC-READER-03 @critical: заблокированный ghost не входит, причина не раскрывается", async ({}, testInfo) => {
    const ctx = await newApiContext(undefined, { "x-forwarded-for": uniqueXff(testInfo) });
    const res = await ctx.post("/api/auth/user", { data: { handle: USERS.ghost.handle, password: PASSWORD } });
    expect(res.ok()).toBe(false);
    const body = (await res.json()) as { error?: string };
    // Тот же текст, что и при неверном пароле — без утечки «заблокирован».
    expect(body.error).toMatch(/Неверный никнейм или пароль\./);
    await ctx.dispose();
  });

  // ── TC-READER-05/06 (SMK-05) — голос и закладка toggle (self-restoring) ──────
  // У reader в seed уже есть голос (chv_1) и закладка (bm_1) на blog_async —
  // тест снимает и возвращает, оставляя seed в исходном состоянии.

  test("TC-READER-05 @smoke @critical: голос за главу — toggle снять/вернуть, состояние переживает reload", async ({
    asReader,
  }) => {
    const { page } = asReader;
    const reader = new ReaderPage(page, USERS.reader.handle);
    await reader.gotoChapter(BLOG.slug, CHAPTERS.published.slug);

    const btn = reader.voteUpButton();
    const initial = await btn.getAttribute("aria-pressed");

    await reader.voteUp();
    await expect(btn).toHaveAttribute("aria-pressed", initial === "true" ? "false" : "true");

    await page.reload();
    await expect(btn).toHaveAttribute("aria-pressed", initial === "true" ? "false" : "true");

    await reader.voteUp(); // вернуть исходное
    await expect(btn).toHaveAttribute("aria-pressed", initial ?? "false");
  });

  test("TC-READER-06 @smoke: закладка — toggle и отражение в /bookmarks", async ({ asReader }) => {
    const { page } = asReader;
    const reader = new ReaderPage(page, USERS.reader.handle);
    await reader.gotoChapter(BLOG.slug, CHAPTERS.published.slug);

    const btn = reader.bookmarkButton();
    const initial = await btn.getAttribute("aria-pressed");

    await reader.toggleBookmark();
    await expect(btn).toHaveAttribute("aria-pressed", initial === "true" ? "false" : "true");

    await reader.toggleBookmark(); // вернуть исходное
    await expect(btn).toHaveAttribute("aria-pressed", initial ?? "false");

    await page.goto("/bookmarks");
    await expect(page.getByText(BLOG.title).first()).toBeVisible();
  });

  // ── TC-READER-07 — подписка toggle ──────────────────────────────────────────

  test("TC-READER-07 @regression: подписка на автора — toggle с возвратом в исходное", async ({ asReader }) => {
    const { page } = asReader;
    const reader = new ReaderPage(page, USERS.reader.handle);
    await reader.gotoChapter(BLOG.slug, CHAPTERS.published.slug);

    const btn = reader.followButton();
    const initial = await btn.getAttribute("aria-pressed");

    await reader.toggleFollow();
    await expect(btn).toHaveAttribute("aria-pressed", initial === "true" ? "false" : "true");

    await reader.toggleFollow(); // вернуть исходное (seed: подписан)
    await expect(btn).toHaveAttribute("aria-pressed", initial ?? "false");
  });

  // ── TC-READER-08 — уведомления ──────────────────────────────────────────────

  test("TC-READER-08 @regression: уведомления — список и «Прочитать всё»", async ({ asReader }) => {
    const { page } = asReader;
    const reader = new ReaderPage(page, USERS.reader.handle);
    await reader.gotoFeed();

    const menu = await reader.openNotifications();
    await expect(menu).toBeVisible();
    // «Прочитать всё» → бейдж непрочитанных исчезает
    await menu.getByText("Прочитать всё").click();
    await page.reload();
    await expect(reader.bell).toHaveAccessibleName(/Уведомления/);
    await expect(reader.bell).not.toHaveAccessibleName(/непрочитанных/);
  });

  // ── TC-READER-09 (SMK-06) — root-комментарий с якорем ───────────────────────

  test("TC-READER-09 @smoke: root-комментарий с привязкой к фрагменту (anchor)", async ({ asReader }) => {
    const { page } = asReader;
    const comments = new CommentsPage(page, USERS.reader.handle);
    await page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);

    const firstBlockId = await page.locator("[data-block-id]").first().getAttribute("data-block-id");
    const text = `Вопрос читателя e2e ${Date.now()}`;

    await comments.addAnchoredToBlock(firstBlockId!, text);
    await expect(comments.region.getByText(text)).toBeVisible();
    // Чип якоря присутствует в дереве
    await expect(comments.region.getByText(/К фрагменту/).first()).toBeVisible();
  });

  // ── TC-READER-10 — ответ (глубина 1) ────────────────────────────────────────

  test("TC-READER-10 @regression: ответ на комментарий (глубина 1)", async ({ asReader }) => {
    const { page } = asReader;
    const comments = new CommentsPage(page, USERS.reader.handle);
    await page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);

    const text = `Ответ читателя e2e ${Date.now()}`;
    await comments.replyTo(COMMENTS.root, text);
    await expect(comments.region.getByText(text)).toBeVisible();
  });

  // ── TC-READER-11 — глубина 2 запрещена ──────────────────────────────────────

  test("TC-READER-11 @critical: ответ на глубину 2 — UI без «Ответить», API → 409", async ({
    asReader,
    api,
  }) => {
    const { page } = asReader;
    const comments = new CommentsPage(page, USERS.reader.handle);
    await page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);

    await test.step("UI: у узла глубины 2 нет кнопки «Ответить»", async () => {
      await expect(comments.node(COMMENTS.replyReader)).toBeVisible();
      await expect(comments.node(COMMENTS.replyReader).getByRole("button", { name: "Ответить" })).toHaveCount(0);
    });

    await test.step("API: ответ на глубину 2 → 409 «Слишком глубокая вложенность.»", async () => {
      const ctx = await api("reader");
      const res = await ctx.post("/api/comments", {
        data: {
          blogSlug: BLOG.slug,
          chapterSlug: CHAPTERS.published.slug,
          parentId: COMMENTS.replyReader,
          text: "слишком глубоко",
        },
      });
      expect(res.status()).toBe(409);
      expect(((await res.json()) as { error?: string }).error).toBe("Слишком глубокая вложенность.");
    });
  });

  // ── TC-READER-12 — окно правки (recency: свой свежий комментарий) ────────────

  test("TC-READER-12 @critical: правка своего свежего комментария в окне 15 минут", async ({ asReader }) => {
    const { page } = asReader;
    const comments = new CommentsPage(page, USERS.reader.handle);
    await page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);

    const original = `Свежий коммент e2e ${Date.now()}`;
    const commentId = await comments.addRoot(original);
    const edited = `${original} — правка`;
    await comments.edit(commentId, edited);
    await expect(comments.region.getByText(edited)).toBeVisible();
    await expect(comments.node(commentId).getByText("изменено")).toBeVisible();
  });

  // ── TC-READER-13 — вне окна правки → 403 ────────────────────────────────────

  test("TC-READER-13 @critical: правка комментария старше 15 минут → 403, кнопки «Изменить» нет", async ({
    asReader,
    api,
  }) => {
    const { page } = asReader;
    const comments = new CommentsPage(page, USERS.reader.handle);
    await page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);

    await test.step("UI: у cmt_stale (2ч) кнопки «Изменить» нет", async () => {
      await expect(comments.node(COMMENTS.stale)).toBeVisible();
      await expect(comments.node(COMMENTS.stale).getByRole("button", { name: "Изменить" })).toHaveCount(0);
    });

    await test.step("API: PATCH своего устаревшего → 403 «Окно редактирования истекло.»", async () => {
      const ctx = await api("reader");
      // Предыдущие мутации читателя могут временно дать 429 (rate-limit 1/сек) — ретраим до устойчивого 403.
      await expect(async () => {
        const res = await ctx.patch(`/api/comments/${COMMENTS.stale}`, { data: { text: "поздняя правка" } });
        expect(res.status()).toBe(403);
        expect(((await res.json()) as { error?: string }).error).toBe("Окно редактирования истекло.");
      }).toPass({ timeout: 15_000 });
    });
  });

  // ── TC-READER-14 — tombstone при живых потомках ─────────────────────────────

  test("TC-READER-14 @regression: удаление комментария с ответом → tombstone, ответ жив", async ({
    asReader,
    asAuthor,
  }) => {
    // reader создаёт root в опубликованной главе своего блога, author (участник) отвечает,
    // reader удаляет root → остаётся tombstone (ответ жив).
    const marker = Date.now();
    const rootText = `Root для tombstone e2e ${marker}`;
    const replyText = `Ответ автора e2e ${marker}`;

    const readerComments = new CommentsPage(asReader.page, USERS.reader.handle);
    await asReader.page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);
    const rootId = await readerComments.addRoot(rootText);

    const authorComments = new CommentsPage(asAuthor.page, USERS.author.handle);
    await asAuthor.page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);
    await authorComments.replyTo(rootId, replyText);
    await expect(authorComments.region.getByText(replyText)).toBeVisible();

    await asReader.page.reload();
    await readerComments.remove(rootId);
    // Ответ жив, а текст root заменён на tombstone
    await expect(readerComments.region.getByText(replyText)).toBeVisible();
    await expect(readerComments.region.getByText(rootText)).toHaveCount(0);
  });

  // ── TC-READER-15/16 — голос за комментарий, спойлер прошлых версий ───────────

  test("TC-READER-15 @regression: голос за чужой комментарий — toggle", async ({ asReader }) => {
    const { page } = asReader;
    const comments = new CommentsPage(page, USERS.reader.handle);
    await page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);

    // cmt_reply_author — не свой (автор), голосовать можно
    const btn = comments.voteButton(COMMENTS.replyAuthor, "up");
    const initial = await btn.getAttribute("aria-pressed");
    await comments.vote(COMMENTS.replyAuthor, "up");
    await expect(btn).toHaveAttribute("aria-pressed", initial === "true" ? "false" : "true");
    await comments.vote(COMMENTS.replyAuthor, "up"); // вернуть
    await expect(btn).toHaveAttribute("aria-pressed", initial ?? "false");
  });

  test("TC-READER-16 @regression: спойлер «прошлые версии» с cmt_old_revision и бейджем «к версии v1»", async ({
    asReader,
  }) => {
    const { page } = asReader;
    const comments = new CommentsPage(page, USERS.reader.handle);
    await page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);
    await expect(comments.pastVersionsSpoiler).toBeVisible();
    await comments.pastVersionsSpoiler.click();
    await expect(comments.region.getByText("к версии v1").first()).toBeVisible();
  });

  // ── TC-READER-17 — commentingBlocked (troll) ────────────────────────────────

  test("TC-READER-17 @critical: troll (commentingBlocked) — формы нет, POST → 403", async ({ loginAs }) => {
    const troll = await loginAs(USERS.troll.handle);
    const comments = new CommentsPage(troll.page, USERS.troll.handle);
    await troll.page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);

    await test.step("UI: формы нет, текст «Комментирование ограничено.»", async () => {
      await expect(comments.composer).toHaveCount(0);
      await expect(troll.page.getByText("Комментирование ограничено.")).toBeVisible();
    });

    await test.step("API: POST → 403", async () => {
      const ctx = await newApiContext();
      const login = await ctx.post("/api/auth/user", { data: { handle: USERS.troll.handle, password: PASSWORD } });
      expect(login.ok()).toBe(true);
      const res = await ctx.post("/api/comments", {
        data: { blogSlug: BLOG.slug, chapterSlug: CHAPTERS.published.slug, text: "troll probe" },
      });
      expect(res.status()).toBe(403);
      await ctx.dispose();
    });
  });

  // ── TC-READER-18/19/20 — негативы матрицы ролей ─────────────────────────────

  test("TC-READER-18 @critical: читатель не создаёт блоги и не отправляет на ревью → 403", async ({ api }) => {
    const ctx = await api("reader");
    const blog = await ctx.post("/api/author/blogs", { data: { title: "Блог читателя", description: "нет" } });
    expect(blog.status()).toBe(403);
    const submit = await ctx.post(`/api/author/chapters/${CHAPTERS.draft.id}/submit`, { data: {} });
    expect(submit.status()).toBe(403);
  });

  test("TC-READER-19 @critical: protected-страницы чужих ролей читателю → 307 на /", async ({ api }) => {
    const ctx = await api("reader");
    for (const path of ["/author", "/author/portfolio", "/reviewer", "/admin"]) {
      const res = await ctx.get(path, { maxRedirects: 0 });
      expect(res.status(), `${path} должен редиректить`).toBe(307);
      expect(res.headers()["location"]).toMatch(/^https?:\/\/[^/]+\/$|\/$/);
    }
  });

  test("TC-READER-20 @critical: читатель не рецензирует — verdict-роут → 403", async ({ api }) => {
    const ctx = await api("reader");
    const res = await ctx.post(`/api/review/${CHAPTERS.underReview.id}/verdict`, { data: { verdict: "approve" } });
    expect(res.status()).toBe(403);
  });
});
