/**
 * Сквозные флоу публикации (TC-FLOWS.md: PUB-GATE/PUB-DRAFT/PUB-CHAPTER-V2/PUB-ARTICLE/
 * PUB-PORTFOLIO + REV-VERSIONS write-side).
 *
 * Спек тяжело мутирует seed (публикует promises и async-await v2, правит портфолио) →
 * serial + reseed в beforeAll; порядок тестов внутри файла значим:
 *   1. PUB-GATE — 409-гейт на ещё НЕопубликованной promises (до force-approve);
 *   2. PUB-DRAFT — админ force-approve публикует promises;
 *   3. PUB-CHAPTER-V2 — async-await: правка → v2 → approve всех → publish;
 *   4. PUB-ARTICLE — обе свежие публикации в ленте гостя (+fixme про уведомление);
 *   5. PUB-PORTFOLIO — портфолио минуя review-flow (show/hide самовосстанавливается).
 *
 * Факты поведения — MCP-FINDINGS §3б/§5 и sections/04: кнопка «Опубликовать» ОТСУТСТВУЕТ
 * в DOM до всех approve (сервер 409); carry-forward v2 требует approve КАЖДОГО перенесённого;
 * у async-await «Прошлых версий» нет (v1 не публиковалась) — эталон раскрытия — event-loop.
 */
import { type Locator, type Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { EditorPage } from "../pages/editor.page";
import { ReviewPage } from "../pages/review.page";
import { ReaderPage } from "../pages/reader.page";
import { AdminPage } from "../pages/admin.page";
import { USERS, BLOG, CHAPTERS } from "../helpers/seed";
import { reseed } from "../helpers/db";
import { throttleMutation } from "../helpers/throttle";

/** Точная строка серверного publish-гейта (MCP-FINDINGS §5). */
const PUBLISH_GATE_ERROR = "Опубликовать можно только когда все ревьюеры одобрили.";

/** Текст правки параграфа async-await для второй версии — по нему сверяем v2 у ревьюера и гостя. */
const V2_TEXT = "async/await — синтаксический сахар над промисами. Правка автора для второй версии (e2e).";

/** Новый текст параграфа портфолио. */
const PF_TEXT = "Пишу про асинхронность и внутренности движков. Обновлено e2e — публикуется сразу, без ревью.";

/** Карточка главы в очереди /admin/review (Card = <section>, внутри ссылка с названием главы). */
function reviewCard(page: Page, chapterTitle: string): Locator {
  return page.locator("section").filter({ has: page.getByRole("link", { name: chapterTitle }) });
}

/**
 * Заполнение блочного textarea с ретраем: до гидрации редактора fill может не дойти
 * до React-стейта (MCP-FINDINGS §4) — повторяем, пока «Сохранить» не станет активной.
 */
async function fillBlockUntilDirty(page: Page, block: Locator, text: string): Promise<void> {
  await expect(async () => {
    await block.fill(text);
    await expect(page.getByRole("button", { name: "Сохранить" })).toBeEnabled({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/**
 * Идемпотентный тумблер видимости портфолио: кликает только если состояние отличается
 * от целевого (потерянный до гидрации клик ретраится, двойное переключение исключено).
 */
async function setPortfolioVisibility(page: Page, target: "Видно всем" | "Скрыто"): Promise<void> {
  const toggle = page.getByRole("button", { name: /Видно всем|Скрыто/ });
  await expect(async () => {
    if (((await toggle.textContent()) ?? "").trim() !== target) {
      await toggle.click();
    }
    await expect(toggle).toHaveText(target, { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
}

/** Сохранение портфолио: PUT /api/author/portfolio → 200 + индикатор «сохранено». */
async function savePortfolio(page: Page): Promise<void> {
  await throttleMutation(USERS.author.handle);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/author/portfolio") && r.request().method() === "PUT"),
    page.getByRole("button", { name: "Сохранить" }).click(),
  ]);
  expect(res.status()).toBe(200);
  await expect(page.getByText("сохранено", { exact: true })).toBeVisible();
}

test.describe("Флоу публикации: гейт all-approve, force-approve, v2, дистрибуция, портфолио", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    // Файл публикует promises и async-await v2 и правит портфолио — стартуем от чистого seed.
    reseed();
  });

  test("PUB-GATE @critical: publish без всех approve — 409 на API, у автора нет кнопки «Опубликовать»", async ({
    api,
    asAuthor,
  }) => {
    await test.step("API: POST publish автором на chp_under_review → 409 с точным текстом гейта", async () => {
      const authorApi = await api("author");
      const res = await authorApi.post(`/api/review/${CHAPTERS.underReview.id}/publish`);
      expect(res.status()).toBe(409);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toBe(PUBLISH_GATE_ERROR);
    });

    await test.step("UI: на review-странице автора кнопки «Опубликовать» НЕТ в DOM, есть пилюля «есть запрос правок»", async () => {
      const review = new ReviewPage(asAuthor.page);
      await review.gotoAsAuthor(BLOG.slug, CHAPTERS.underReview.slug);
      // Вердикты v1: lena_review — request-changes (seed) → пилюля запроса правок.
      await expect(asAuthor.page.getByText("есть запрос правок")).toBeVisible();
      // Условный рендер action-bar: кнопка отсутствует в DOM, не disabled (MCP-FINDINGS §3б).
      await expect(review.publishButton).toHaveCount(0);
      // Вместо неё автору доступна «Отправить v2».
      await expect(asAuthor.page.getByRole("button", { name: "Отправить v2" })).toBeVisible();
    });
  });

  test("PUB-DRAFT @critical: force-approve админом публикует «Промисы изнутри» в обход гейта, глава читается гостем", async ({
    asAdmin,
    asGuest,
    api,
  }) => {
    const admin = new AdminPage(asAdmin.page);

    await test.step("Админ: /admin/review → Force-approve «Промисы изнутри» с инлайн-подтверждением", async () => {
      await asAdmin.goto("/admin/review");
      const card = reviewCard(asAdmin.page, CHAPTERS.underReview.title);
      await expect(card).toHaveCount(1);
      await admin.forceApprove(card); // «Опубликовать в обход гейта?» → «Да, опубликовать»
      // Опубликованная глава уходит из очереди активного ревью.
      await expect(card).toHaveCount(0);
    });

    await test.step("Гость: глава published — HTTP 200 и рендер в ридере", async () => {
      const guestApi = await api();
      const res = await guestApi.get(`/blog/${BLOG.slug}/${CHAPTERS.underReview.slug}`, { maxRedirects: 0 });
      expect(res.status()).toBe(200);

      const reader = new ReaderPage(asGuest.page);
      await reader.gotoChapter(BLOG.slug, CHAPTERS.underReview.slug);
      await expect(
        asGuest.page.getByRole("heading", { name: CHAPTERS.underReview.title, level: 1 }),
      ).toBeVisible();
      // Кредит команды зафиксирован публикацией (force-approve пишет reviewer_history).
      await expect(reader.reviewersRegion.getByRole("heading", { name: "Эту версию проверяли" })).toBeVisible();
    });
  });

  test("PUB-CHAPTER-V2 @critical: правка → «Отправить v2» → сброс вердиктов → approve всех перенесённых → публикация v2 (+REV-VERSIONS)", async ({
    asAuthor,
    asReviewer,
    asGuest,
    loginAs,
  }) => {
    test.slow(); // мультиролевой флоу: 6+ навигаций, на холодном dev-сервере first-compile до 10 с/роут
    const authorReview = new ReviewPage(asAuthor.page);

    await test.step("Автор: changes-requested редактируется — правка параграфа и сохранение", async () => {
      const editor = new EditorPage(asAuthor.page);
      await editor.goto(BLOG.slug, CHAPTERS.changesRequested.slug);
      // Нет баннера блокировки (в отличие от under-review/published).
      await expect(editor.lockedBanner).toHaveCount(0);
      await fillBlockUntilDirty(asAuthor.page, editor.blockInput("Параграф", 0), V2_TEXT);
      await throttleMutation(USERS.author.handle);
      await editor.save(); // индикатор «сохранено», тостов нет
    });

    await test.step("Автор: «Отправить v2» — rev 2, вердикты v1 обнулены", async () => {
      await authorReview.gotoAsAuthor(BLOG.slug, CHAPTERS.changesRequested.slug);
      // Вердикты v1 ещё видны: lena request-changes → пилюля «есть запрос правок».
      await expect(asAuthor.page.getByText("есть запрос правок")).toBeVisible();

      const submitV2 = asAuthor.page.getByRole("button", { name: "Отправить v2" });
      await expect(submitV2).toBeVisible();
      await throttleMutation(USERS.author.handle);
      const [res] = await Promise.all([
        asAuthor.page.waitForResponse(
          (r) => r.url().includes("/submit-revision") && r.request().method() === "POST",
        ),
        submitV2.click(),
      ]);
      expect(res.status()).toBe(200);

      // Ревизия 2 создана, вердикты обнулены (пилюли сброшены), кнопка стала «Отправить v3».
      await expect(asAuthor.page.getByText("rev 2", { exact: true })).toBeVisible();
      await expect(asAuthor.page.getByText("есть запрос правок")).toHaveCount(0);
      await expect(asAuthor.page.getByText("все одобрили")).toHaveCount(0);
      await expect(asAuthor.page.getByRole("button", { name: "Отправить v3" })).toBeVisible();
    });

    await test.step("lena_review (carry-forward, ведущий): видит v2 с правкой → «Одобрить»; одного approve мало", async () => {
      const lena = await loginAs(USERS.lena.handle);
      const lenaReview = new ReviewPage(lena.page);
      await lenaReview.gotoAsReviewer(CHAPTERS.changesRequested.id);
      // Команда перенесена без повторного согласия; контент — v2 с правкой автора.
      await expect(lena.page.getByText("rev 2", { exact: true })).toBeVisible();
      await expect(lena.page.getByText(V2_TEXT)).toBeVisible();

      await expect(lena.page.getByRole("button", { name: "Одобрить" })).toBeEnabled();
      await throttleMutation(USERS.lena.handle);
      await lenaReview.approve(); // тост «✓ Вы одобрили главу.» — внутри POM

      // Carry-forward: «все одобрили» требует approve КАЖДОГО перенесённого (sync через reload).
      await lena.page.reload();
      await expect(lena.page.getByText("rev 2", { exact: true })).toBeVisible();
      await expect(lena.page.getByText("все одобрили")).toHaveCount(0);
    });

    await test.step("reviewer (перенесённый второй): «Одобрить» — консенсус собран", async () => {
      const raisaReview = new ReviewPage(asReviewer.page);
      await raisaReview.gotoAsReviewer(CHAPTERS.changesRequested.id);
      await expect(asReviewer.page.getByRole("button", { name: "Одобрить" })).toBeEnabled();
      await throttleMutation(USERS.reviewer.handle);
      await raisaReview.approve();
    });

    await test.step("Автор: кнопка «Опубликовать» появилась → публикация v2", async () => {
      // Кросс-экранный sync — не ждём поллинг 30 с, перезагружаем страницу свежей навигацией.
      await authorReview.gotoAsAuthor(BLOG.slug, CHAPTERS.changesRequested.slug);
      await expect(asAuthor.page.getByText("все одобрили")).toBeVisible();
      await throttleMutation(USERS.author.handle);
      await authorReview.publish(); // ждёт «Глава опубликована.» — внутри POM
    });

    await test.step("Гость: контент v2 и чипы ревьюеров текущей версии (Лена — ведущий, Раиса)", async () => {
      const reader = new ReaderPage(asGuest.page);
      await reader.gotoChapter(BLOG.slug, CHAPTERS.changesRequested.slug);
      await expect(asGuest.page.getByText(V2_TEXT)).toBeVisible();

      const region = reader.reviewersRegion;
      await expect(region.getByRole("heading", { name: "Эту версию проверяли" })).toBeVisible();
      await expect(region.getByRole("link", { name: "Лена Базы" })).toBeVisible();
      await expect(region.locator("li", { hasText: "Лена Базы" }).getByText("ведущий")).toBeVisible();
      await expect(region.getByRole("link", { name: "Раиса Ревьюер" })).toBeVisible();
      // Write-side REV-VERSIONS: у async-await v1 НЕ публиковалась → «Прошлых версий» нет
      // (фантомный кредит за неопубликованную ревизию не появился) — MCP sections/04.
      await expect(reader.pastVersions).toHaveCount(0);
    });

    await test.step("REV-VERSIONS: эталон раскрытия «Прошлые версии» на event-loop — «к версии v1» с Леной", async () => {
      const reader = new ReaderPage(asGuest.page);
      await reader.gotoChapter(BLOG.slug, CHAPTERS.published.slug);
      // Лена участвовала только в v1 — до раскрытия её в регионе не видно.
      await expect(reader.reviewersRegion.getByText("Лена Базы")).toBeHidden();
      await reader.expandPastVersions();
      await expect(reader.reviewersRegion.getByText("к версии v1")).toBeVisible();
      await expect(reader.reviewersRegion.getByText("Лена Базы")).toBeVisible();
    });
  });

  test("PUB-ARTICLE @critical: обе свежеопубликованные главы видны гостю в ленте", async ({ asGuest }) => {
    // После PUB-DRAFT (promises) и PUB-CHAPTER-V2 (async-await v2) лента гостя
    // содержит карточки обеих глав (article с link «Блог + Глава»).
    const reader = new ReaderPage(asGuest.page);
    await reader.gotoFeed();
    await expect(
      asGuest.page.getByRole("link", { name: /Промисы изнутри/ }).first(),
    ).toBeVisible();
    await expect(
      asGuest.page.getByRole("link", { name: /Async\/await на практике/ }).first(),
    ).toBeVisible();
  });

  test("PUB-ARTICLE @critical: подписчик получает уведомление «Новая глава» после публикации", async () => {
    // reader подписан на author (seed follows), но publish уведомляет только команду ревью.
    test.fixme(true, "Баг №1 MCP-FINDINGS §6: publish не уведомляет подписчиков — исправление в Фазе 12");
  });

  test("PUB-PORTFOLIO @critical: портфолио публикуется без ревью — правка, show/hide для гостя, self-view владельца", async ({
    asAuthor,
    asGuest,
  }) => {
    test.slow(); // 3 сохранения с троттлингом + перекрёстные проверки гостем

    await test.step("Автор: /author/portfolio — правка текста → PUT 200, «сохранено», «Видно всем»", async () => {
      await asAuthor.goto("/author/portfolio");
      // Публикация минуя review-flow — подпись прямо в редакторе.
      await expect(asAuthor.page.getByText("Об авторе · публикуется сразу, без ревью")).toBeVisible();
      const toggle = asAuthor.page.getByRole("button", { name: /Видно всем|Скрыто/ });
      await expect(toggle).toHaveText("Видно всем"); // seed: isVisible=true
      await expect(toggle).toHaveAttribute("aria-pressed", "true");

      const paragraph = asAuthor.page.getByRole("textbox", { name: "Параграф" });
      await fillBlockUntilDirty(asAuthor.page, paragraph, PF_TEXT);
      await savePortfolio(asAuthor.page);
      // Видимость не тронута сохранением текста.
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
    });

    await test.step("Гость: /u/author — обновлённое портфолио видно, владельческих контролов нет", async () => {
      await asGuest.goto(`/u/${USERS.author.slug}`);
      await expect(asGuest.page.getByText(PF_TEXT)).toBeVisible();
      // «Редактировать»/«видно всем» — только владельцу.
      await expect(asGuest.page.getByRole("link", { name: "Редактировать" })).toHaveCount(0);
      await expect(asGuest.page.getByText("Опубликовано · видно всем")).toHaveCount(0);
    });

    await test.step("Автор: тумблер «Скрыто» + сохранить", async () => {
      await setPortfolioVisibility(asAuthor.page, "Скрыто");
      await expect(asAuthor.page.getByRole("button", { name: "Скрыто" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await savePortfolio(asAuthor.page);
    });

    await test.step("Гость: reload — портфолио скрыто (нет таба «Об авторе»), блоги видны", async () => {
      await asGuest.page.reload();
      await expect(asGuest.page.getByText(PF_TEXT)).toHaveCount(0);
      // Без видимого портфолио табов профиля нет вовсе — сразу панель блогов.
      await expect(asGuest.page.getByRole("tab", { name: "Об авторе" })).toHaveCount(0);
      await expect(asGuest.page.getByText(BLOG.title).first()).toBeVisible();
    });

    await test.step("Владелец: self-view скрытого портфолио с «Редактировать»", async () => {
      await asAuthor.goto(`/u/${USERS.author.slug}`);
      await expect(asAuthor.page.getByText("Скрыто от читателей — видите только вы")).toBeVisible();
      await expect(asAuthor.page.getByRole("link", { name: "Редактировать" })).toBeVisible();
      await expect(asAuthor.page.getByText(PF_TEXT)).toBeVisible();
    });

    await test.step("Автор: вернуть «Видно всем» — гостю портфолио снова доступно", async () => {
      await asAuthor.goto("/author/portfolio");
      await setPortfolioVisibility(asAuthor.page, "Видно всем");
      await expect(asAuthor.page.getByRole("button", { name: "Видно всем" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await savePortfolio(asAuthor.page);

      await asGuest.page.reload();
      await expect(asGuest.page.getByText(PF_TEXT)).toBeVisible();
    });
  });
});
