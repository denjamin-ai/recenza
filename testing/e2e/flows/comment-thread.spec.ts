// ─────────────────────────────────────────────────────────────────────────────
// Сквозные флоу публичных комментариев (TC-FLOWS.md): COM-EDIT-WINDOW, COM-THREAD,
// COM-STALE, COM-GATING, COM-DEPTH. Глава-мишень — опубликованный «Цикл событий» (v2).
//
// Файл мутирует seed-состояние (новые комментарии/правки/уведомления) → serial +
// reseed() в beforeAll. ⚠️ Порядок тестов не случаен: COM-EDIT-WINDOW идёт ПЕРВЫМ
// (recency: окно правки 15 минут отсчитывается от createdAt, файл гоняется сразу
// после reseed).
//
// Кросс-экранный sync — через page.reload()/повторный goto (поллинг 30–45 с не ждём,
// MCP-FINDINGS §4). Негативные API-проверки — через api(role)/apiLoginUser, а не
// page.evaluate(fetch): браузерные 4xx-логи роняют console-guard.
// ─────────────────────────────────────────────────────────────────────────────

import { type Locator, type Page, type Response } from "@playwright/test";
import { test, expect } from "../fixtures";
import { BLOG, CHAPTERS, COMMENTS, HIDDEN_BLOG, USERS } from "../helpers/seed";
import { apiLoginUser } from "../helpers/auth";
import { reseed } from "../helpers/db";
import { throttleMutation } from "../helpers/throttle";
import { CommentsPage } from "../pages/comments.page";
import { ReaderPage } from "../pages/reader.page";

const CHAPTER_PATH = `/blog/${BLOG.slug}/${CHAPTERS.published.slug}`;
/** Первый блок «Цикла событий» (v2) — заголовок «Что такое цикл событий» (seed-core). */
const FIRST_BLOCK_ID = "blk_el_h2_1";

const FRESH_TEXT = "Комментарий e2e в окне правки.";
const EDITED_TEXT = "Комментарий e2e отредактирован внутри окна правки.";
const READER_QUESTION = "Вопрос читателя e2e: как это работает в Node?";
const AUTHOR_REPLY = "Ответ автора e2e: в Node отличий два.";
const READER_FOLLOW_UP = "Уточнение читателя e2e: спасибо, понял (глубина 2).";

/** POST-создание комментария: точный путь /api/comments (не /api/comments/{id}). */
function isCommentCreate(res: Response): boolean {
  return new URL(res.url()).pathname === "/api/comments" && res.request().method() === "POST";
}

/** Корневой комментарий через POM + захват id из ответа сервера (нужен для li#comment-{id}). */
async function addRootAndGetId(page: Page, comments: CommentsPage, text: string): Promise<string> {
  const [res] = await Promise.all([page.waitForResponse(isCommentCreate), comments.addRoot(text)]);
  if (!res.ok()) throw new Error(`POST /api/comments → ${res.status()}: ${await res.text()}`);
  const body = (await res.json()) as { id?: string };
  if (!body.id) throw new Error("POST /api/comments не вернул id комментария");
  return body.id;
}

/**
 * Ответ на комментарий (аналог CommentsPage.replyTo) + захват id из ответа сервера —
 * POM id не возвращает, а он нужен для адресных ассертов li#comment-{id}.
 * Сабмитим штатным хоткеем композера Ctrl+Enter (comment-composer.tsx onKeyDown) —
 * так нет неоднозначности двух кнопок «Ответить» (действие узла и сабмит реплай-композера).
 */
async function replyAndGetId(
  page: Page,
  comments: CommentsPage,
  parentId: string,
  text: string,
): Promise<string> {
  await comments.node(parentId).getByRole("button", { name: "Ответить" }).click();
  const box = page.getByPlaceholder("Ваш ответ…");
  await box.fill(text);
  const [res] = await Promise.all([page.waitForResponse(isCommentCreate), box.press("Control+Enter")]);
  if (!res.ok()) throw new Error(`POST /api/comments (ответ) → ${res.status()}: ${await res.text()}`);
  const body = (await res.json()) as { id?: string };
  if (!body.id) throw new Error("POST /api/comments не вернул id ответа");
  return body.id;
}

/** Открытие колокольчика с ретраем: клики до гидрации молча теряются (MCP-FINDINGS §6 №16). */
async function openBellMenu(page: Page, screen: ReaderPage): Promise<Locator> {
  const menu = page.getByRole("menu", { name: "Уведомления" });
  await expect(async () => {
    if (!(await menu.isVisible())) await screen.bell.click();
    await expect(menu).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
  return menu;
}

// Файл мутирует seed сильнее, чем additive: правки, ветки диалога, уведомления.
test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  // Свежий seed обязателен и для recency-теста окна правки (первый тест ниже).
  reseed();
});

// Восстанавливаем seed после файла — чтобы любой grep-срез (напр. --grep @smoke) был самодостаточен.
test.afterAll(() => {
  reseed();
});

// ─────────────────────────────────────────────────────────────────────────────
// COM-EDIT-WINDOW — ПЕРВЫЙ в файле (recency: окно правки ≤15 мин от reseed)
// ─────────────────────────────────────────────────────────────────────────────
test("COM-EDIT-WINDOW @critical: правка своего комментария в окне 15 минут; вне окна PATCH → 403", async ({
  asReader,
  api,
}) => {
  const comments = new CommentsPage(asReader.page, USERS.reader.handle);
  let freshId = "";

  await test.step("Читатель создаёт корневой комментарий (заведомо в окне правки)", async () => {
    await asReader.goto(CHAPTER_PATH);
    await expect(comments.heading).toBeVisible();
    await throttleMutation(USERS.reader.handle);
    freshId = await addRootAndGetId(asReader.page, comments, FRESH_TEXT);
    await expect(comments.node(freshId).getByText(FRESH_TEXT)).toBeVisible();
  });

  await test.step("Правка внутри окна → текст обновлён, метка «· изменено»", async () => {
    await throttleMutation(USERS.reader.handle);
    await comments.edit(freshId, EDITED_TEXT);
    await expect(comments.node(freshId).getByText(EDITED_TEXT)).toBeVisible();
    await expect(comments.node(freshId).getByText("· изменено")).toBeVisible();
  });

  await test.step("UI: у cmt_stale (создан 2 часа назад) кнопки «Изменить» нет", async () => {
    await expect(comments.node(COMMENTS.stale)).toBeVisible();
    await expect(comments.node(COMMENTS.stale).getByRole("button", { name: "Изменить" })).toHaveCount(0);
  });

  await test.step("API: PATCH cmt_stale вне окна → 403 «Окно редактирования истекло.»", async () => {
    const ctx = await api("reader");
    // Предыдущий UI-edit — свежая серверная мутация; PATCH может поймать 1/сек rate-limit (429).
    // Ретраим до устойчивого 403 (окно правки истекло — статус детерминирован после спада лимита).
    await expect(async () => {
      const res = await ctx.patch(`/api/comments/${COMMENTS.stale}`, { data: { text: "правка вне окна e2e" } });
      expect(res.status()).toBe(403);
      expect(((await res.json()) as { error?: string }).error).toBe("Окно редактирования истекло.");
    }).toPass({ timeout: 15_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COM-THREAD — multi-context диалог читатель ↔ автор
// ─────────────────────────────────────────────────────────────────────────────
test("COM-THREAD @critical: диалог читатель ↔ автор — якорь к блоку, уведомления в обе стороны, ответ глубины 2", async ({
  asReader,
  asAuthor,
}) => {
  const readerComments = new CommentsPage(asReader.page, USERS.reader.handle);
  const readerScreen = new ReaderPage(asReader.page, USERS.reader.handle);
  const authorComments = new CommentsPage(asAuthor.page, USERS.author.handle);
  const authorScreen = new ReaderPage(asAuthor.page, USERS.author.handle);

  let rootId = "";
  let authorReplyId = "";

  await test.step("Читатель: якорный комментарий к первому блоку главы", async () => {
    await asReader.goto(CHAPTER_PATH);
    await expect(readerComments.heading).toBeVisible();

    // Шаги CommentsPage.addAnchoredToBlock, но раздельно — чтобы успеть проверить чип
    // «К фрагменту» в композере ДО отправки (после отправки чип очищается).
    const anchorButton = asReader.page.locator('[aria-label="Прокомментировать выделенный фрагмент"]');
    await expect(async () => {
      // Тройной клик = выделение текста блока; до гидрации выделение теряется — ретраим.
      await readerScreen.block(FIRST_BLOCK_ID).click({ clickCount: 3 });
      await expect(anchorButton).toBeVisible({ timeout: 1_500 });
    }).toPass({ timeout: 15_000 });
    await anchorButton.click();

    // Чип привязки в композере (регистр «К…» отличает чип от кнопки «к фрагменту» в узлах).
    await expect(asReader.page.getByText(/^К фрагменту/)).toBeVisible();
    await expect(asReader.page.getByRole("button", { name: "Убрать привязку к фрагменту" })).toBeVisible();

    await throttleMutation(USERS.reader.handle);
    rootId = await addRootAndGetId(asReader.page, readerComments, READER_QUESTION);

    await expect(readerComments.node(rootId).getByText(READER_QUESTION)).toBeVisible();
    // У созданного комментария есть привязка к фрагменту.
    await expect(readerComments.goToFragment(rootId)).toBeVisible();
  });

  await test.step("Автор: уведомление о новом комментарии и ответ (глубина 1)", async () => {
    await asAuthor.goto(CHAPTER_PATH);
    const menu = await openBellMenu(asAuthor.page, authorScreen);
    // Свежая нотификация — первая в списке (сортировка desc по createdAt). Кликабельность
    // не ассертим: сид-payload без href некликабелен (баг №7 MCP-FINDINGS §6) — достаточно
    // наличия в списке.
    await expect(menu.locator("ul").getByRole("menuitem").first()).toContainText(
      `Новый комментарий: ${CHAPTERS.published.title}`,
    );
    await asAuthor.page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    await expect(authorComments.node(rootId)).toBeVisible();
    await throttleMutation(USERS.author.handle);
    authorReplyId = await replyAndGetId(asAuthor.page, authorComments, rootId, AUTHOR_REPLY);
    await expect(authorComments.node(authorReplyId).getByText(AUTHOR_REPLY)).toBeVisible();
  });

  await test.step("Читатель: уведомление об ответе и уточнение (глубина 2)", async () => {
    await asReader.page.reload();
    const menu = await openBellMenu(asReader.page, readerScreen);
    await expect(menu.locator("ul").getByRole("menuitem").first()).toContainText(
      "Ответ на ваш комментарий",
    );
    await asReader.page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    await expect(readerComments.node(authorReplyId)).toBeVisible();
    await throttleMutation(USERS.reader.handle);
    const followUpId = await replyAndGetId(
      asReader.page,
      readerComments,
      authorReplyId,
      READER_FOLLOW_UP,
    );
    await expect(readerComments.node(followUpId).getByText(READER_FOLLOW_UP)).toBeVisible();
  });

  await test.step("«Перейти к фрагменту в тексте» скроллит к [data-block-id]", async () => {
    await readerComments.goToFragment(rootId).click();
    await expect(readerScreen.block(FIRST_BLOCK_ID)).toBeInViewport();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COM-STALE — спойлер «прошлых версий»
// ─────────────────────────────────────────────────────────────────────────────
test("COM-STALE @regression: комментарий к прошлой ревизии — под спойлером с бейджем «к версии v1»", async ({
  asReader,
}) => {
  const comments = new CommentsPage(asReader.page, USERS.reader.handle);
  await asReader.goto(CHAPTER_PATH);
  await expect(comments.heading).toBeVisible();

  await test.step("Комментарии текущей ревизии (v2) — в основном дереве", async () => {
    await expect(comments.node(COMMENTS.root).getByText("Отличное объяснение микротасок!")).toBeVisible();
    await expect(comments.node(COMMENTS.stale)).toBeVisible();
  });

  await test.step("cmt_old_revision скрыт в свёрнутом спойлере", async () => {
    await expect(comments.pastVersionsSpoiler).toBeVisible();
    await expect(comments.node(COMMENTS.oldRevision)).toBeHidden();
  });

  await test.step("Раскрытие спойлера: старый комментарий с бейджем «к версии v1»", async () => {
    await comments.pastVersionsSpoiler.click();
    const oldNode = comments.node(COMMENTS.oldRevision);
    await expect(oldNode.getByText("Комментарий к первой версии главы.")).toBeVisible();
    await expect(oldNode.getByText("к версии v1")).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COM-GATING — серверный commentGate по ролям (негативы через API-контексты)
// ─────────────────────────────────────────────────────────────────────────────
test("COM-GATING @critical: серверный гейт комментирования — ревьюер 403, troll 403, гость 401, чужая глава 404", async ({
  api,
  asReviewer,
}) => {
  const target = { blogSlug: BLOG.slug, chapterSlug: CHAPTERS.published.slug };

  await test.step("(а) Ревьюер: POST /api/comments → 403 «Ревьюеры не участвуют…»", async () => {
    const ctx = await api("reviewer");
    const res = await ctx.post("/api/comments", {
      data: { ...target, text: "попытка ревьюера e2e" },
    });
    expect(res.status()).toBe(403);
    expect(((await res.json()) as { error?: string }).error).toBe(
      "Ревьюеры не участвуют в публичных обсуждениях.",
    );
  });

  await test.step("(б) troll (commentingBlocked): POST → 403 «Комментирование ограничено.»", async () => {
    const ctx = await apiLoginUser(USERS.troll.handle);
    try {
      const res = await ctx.post("/api/comments", {
        data: { ...target, text: "попытка troll e2e" },
      });
      expect(res.status()).toBe(403);
      expect(((await res.json()) as { error?: string }).error).toBe("Комментирование ограничено.");
    } finally {
      await ctx.dispose();
    }
  });

  await test.step("(в) Гость: POST → 401 «Требуется вход.»", async () => {
    const ctx = await api();
    const res = await ctx.post("/api/comments", {
      data: { ...target, text: "попытка гостя e2e" },
    });
    expect(res.status()).toBe(401);
    expect(((await res.json()) as { error?: string }).error).toBe("Требуется вход.");
  });

  await test.step("(г) Автор в чужую главу (hidden-blog/intro): POST → 404", async () => {
    const ctx = await api("author");
    const res = await ctx.post("/api/comments", {
      data: {
        blogSlug: HIDDEN_BLOG.slug,
        chapterSlug: CHAPTERS.ghost.slug,
        text: "попытка автора в чужой главе e2e",
      },
    });
    // Ownership/скрытие маскируются под отсутствие ресурса: блог скрыт (автор заблокирован),
    // публикаций нет → resolveCommentTarget = null → «Глава не найдена.»
    expect(res.status()).toBe(404);
    expect(((await res.json()) as { error?: string }).error).toBe("Глава не найдена.");
  });

  await test.step("(д) UI: у ревьюера нет формы комментария, виден гейт-текст", async () => {
    const comments = new CommentsPage(asReviewer.page, USERS.reviewer.handle);
    await asReviewer.goto(CHAPTER_PATH);
    await expect(comments.heading).toBeVisible();
    await expect(
      asReviewer.page.getByText("Ревьюеры не участвуют в публичных обсуждениях."),
    ).toBeVisible();
    await expect(comments.composer).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COM-DEPTH — гейт вложенности ≤2 (глубина считается от 0)
// ─────────────────────────────────────────────────────────────────────────────
test("COM-DEPTH @critical: вложенность ≤2 — POST на узел глубины 2 → 409, в UI у него нет «Ответить»", async ({
  api,
  asReader,
}) => {
  await test.step("API: parentId = cmt_reply_reader (глубина 2) → 409 «Слишком глубокая вложенность.»", async () => {
    const ctx = await api("reader");
    await throttleMutation(USERS.reader.handle);
    const res = await ctx.post("/api/comments", {
      data: {
        blogSlug: BLOG.slug,
        chapterSlug: CHAPTERS.published.slug,
        parentId: COMMENTS.replyReader,
        text: "слишком глубоко e2e",
      },
    });
    expect(res.status()).toBe(409);
    expect(((await res.json()) as { error?: string }).error).toBe("Слишком глубокая вложенность.");
  });

  await test.step("UI: у узла глубины 2 нет кнопки «Ответить» (у родителя глубины 1 — есть)", async () => {
    const comments = new CommentsPage(asReader.page, USERS.reader.handle);
    await asReader.goto(CHAPTER_PATH);
    const deepNode = comments.node(COMMENTS.replyReader);
    await expect(deepNode.getByText("Будет ли глава про воркеры?")).toBeVisible();
    // Ряд действий у узла отрисован («Удалить» — свой комментарий), а «Ответить» — нет.
    await expect(deepNode.getByRole("button", { name: "Удалить" })).toBeVisible();
    await expect(deepNode.getByRole("button", { name: "Ответить" })).toHaveCount(0);
    // Контроль: у родителя (глубина 1) «Ответить» доступна.
    await expect(
      comments.node(COMMENTS.replyAuthor).getByRole("button", { name: "Ответить" }),
    ).toBeVisible();
  });
});
