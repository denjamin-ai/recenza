// Спеки роли «Ревьюер» — кейсы TC-REVIEWER.md: кабинет (три таба), ReviewPage
// (треды/suggestion/вердикт/чат), публичный профиль, негативы гейтинга.
//
// ⚠️ Фаза 14 переписала кабинет и модель работы. Из файла УБРАНЫ проверки:
//   · «Входящие приглашения» и кнопки Принять/Отклонить/«Навыки не совпадают» — приглашений нет,
//     ревьюер берёт заявку из общей очереди сам (claim-флоу — flows/review-queue.spec.ts);
//   · бейдж «вы ведущий» — роли «ведущего» больше не существует;
//   · плитка «Ваш рейтинг» и любые ★ — рейтинг ревьюеров снесён целиком (вместо него объём).
//
// Категория A — файл самодостаточен и НЕ требует reseed:
//   • read-only (TC-01/02/03/04/06/13/14/15/16/17/18);
//   • additive (новые треды/ответы/чат — уникальные тексты; вердикт approve (TC-10) идемпотентен;
//     его сайд-эффект — пересчёт статуса ревизии в changes-requested, т.к. у lena_review в seed
//     request-changes: сессия остаётся открытой, треды/чат/вердикты доступны, ассерты файла
//     от точного статус-бейджа не зависят).
// Кнопку «Взять» здесь НЕ нажимаем — claim мутирует seed и живёт в сквозных flows.
//
// Локаторы и точные тексты — testing/mcp/MCP-FINDINGS.md (§2, §5) + исходники компонентов
// (src/components/review/**, src/app/reviewer/_components/**).

import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { apiLoginUser, loginViaUi } from "./helpers/auth";
import { BASE_URL, BLOG, CHAPTERS, COMMENTS, DUO_BLOG, THREADS, USERS } from "./helpers/seed";
import { throttleMutation } from "./helpers/throttle";
import { ReviewPage } from "./pages/review.page";
import { CommentsPage } from "./pages/comments.page";

/** Уникальный суффикс — additive-тексты не конфликтуют между прогонами без reseed. */
const uniq = (text: string): string => `${text} [e2e ${Date.now()}]`;

/** Панель таба кабинета ревьюера (скрытые панели `hidden` в a11y-дерево не попадают). */
function tabPanel(page: Page, name: RegExp) {
  return page.getByRole("tabpanel", { name });
}

/** Переключение таба кабинета с ретраем «мёртвого» клика до гидрации. */
async function openReviewerTab(page: Page, name: RegExp): Promise<void> {
  const tab = page.getByRole("tab", { name });
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/**
 * Надёжный старт нового треда: до гидрации тройной клик не регистрирует выделение и
 * плавающая «Прокомментировать» не появляется (клики «молча» теряются — MCP-FINDINGS §4/§5).
 * Ретраим выделение до появления кнопки; сама кнопка отрисована React'ом ⇒ дальше клики надёжны.
 */
async function startThreadReliably(review: ReviewPage, blockId: string): Promise<void> {
  const { page } = review;
  const floating = page.getByRole("button", { name: "Прокомментировать" });
  await expect(async () => {
    await page.locator(`[data-block-id="${blockId}"]`).click({ clickCount: 3 });
    await expect(floating).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await floating.click();
  // Композер перешёл в режим нового треда — появился toggle «Комментарий»/«Правка».
  await expect(review.composerMode("Комментарий")).toBeVisible();
}

/** Идемпотентное раскрытие чата сессии с ретраем «мёртвого» клика по toggle. */
async function openChatReliably(review: ReviewPage): Promise<void> {
  await expect(async () => {
    await review.openChat(); // сам проверяет aria-expanded перед кликом
    await expect(review.chatToggle).toHaveAttribute("aria-expanded", "true", { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/** Идемпотентное включение показа решённых тредов (aria-pressed на toggle). */
async function showResolvedReliably(review: ReviewPage): Promise<void> {
  await expect(async () => {
    if ((await review.toggleResolved.getAttribute("aria-pressed")) !== "true") {
      await review.toggleResolved.click();
    }
    await expect(review.toggleResolved).toHaveAttribute("aria-pressed", "true", { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

test.describe("Роль «Ревьюер»: кабинет, ReviewPage, профиль, негативы", () => {
  test("TC-REVIEWER-01 (SMK-09) @smoke: логин ревьюера → /reviewer, плитки и три таба, рейтинга нет", async ({
    asGuest,
  }) => {
    const { page } = asGuest;
    await loginViaUi(page, USERS.reviewer.handle);
    // roleHome ревьюера — /reviewer (возможность берётся из БД, не из cookie).
    await expect(page).toHaveURL(/\/reviewer$/);
    await expect(page.getByRole("heading", { name: "Кабинет ревьюера" })).toBeVisible();

    await test.step("плитки: очередь · ваш ход · активные · объём (вместо рейтинга)", async () => {
      await expect(page.getByText("Заявок в очереди", { exact: true })).toBeVisible();
      await expect(page.getByText("Ваш ход", { exact: true })).toBeVisible();
      await expect(page.getByText("Активные ревью", { exact: true })).toBeVisible();
      // Ф14: «Ваш рейтинг» заменён объёмом проделанной работы.
      await expect(page.getByText("Отрецензировано", { exact: true })).toBeVisible();
      await expect(page.getByText("Ваш рейтинг")).toHaveCount(0);
    });

    await test.step("три таба рабочего места ревьюера", async () => {
      const tabs = page.getByRole("tablist", { name: "Разделы кабинета ревьюера" });
      await expect(tabs).toBeVisible();
      await expect(tabs.getByRole("tab", { name: /^Очередь/ })).toBeVisible();
      await expect(tabs.getByRole("tab", { name: /^Мои ревью/ })).toBeVisible();
      await expect(tabs.getByRole("tab", { name: /^Завершённые/ })).toBeVisible();
      // По умолчанию открыта «Очередь» — работа начинается с неё.
      await expect(tabs.getByRole("tab", { name: /^Очередь/ })).toHaveAttribute("aria-selected", "true");
    });

    await test.step("никаких ★ и приглашений на странице", async () => {
      await expect(page.getByText(/★/)).toHaveCount(0);
      await expect(page.getByText("Входящие приглашения")).toHaveCount(0);
    });
  });

  test("TC-REVIEWER-02 @regression: таб «Мои ревью» — активное ревью «Промисы изнутри», «ведущего» нет", async ({
    asReviewer,
  }) => {
    await asReviewer.goto("/reviewer");
    const { page } = asReviewer;
    await openReviewerTab(page, /^Мои ревью/);

    const panel = tabPanel(page, /Мои ревью/);
    // Взятые в работу главы сгруппированы по блогу (ревьюер ведёт блог целиком).
    await expect(panel.getByRole("heading", { name: BLOG.title })).toBeVisible();

    const card = panel.getByRole("link", { name: new RegExp(CHAPTERS.underReview.title) });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", `/reviewer/review/${CHAPTERS.underReview.id}`);
    // Вердикта по этой ревизии ревьюер ещё не ставил.
    await expect(card).toContainText("ваш ход");
    // Ф14: иерархии внутри ревью больше нет.
    await expect(page.getByText("вы ведущий")).toHaveCount(0);
  });

  test("TC-REVIEWER-03 @regression: таб «Очередь» — карточка заявки, совпадение, навыки, «Взять»", async ({
    asReviewer,
  }) => {
    await asReviewer.goto("/reviewer");
    const panel = tabPanel(asReviewer.page, /Очередь/);
    await expect(panel).toBeVisible();

    await test.step("свободная заявка: автор, блог, 0% совпадения, чипы навыков, «Взять»", async () => {
      // Сидовая req_open — на опубликованной главе duo; навыки «Тайм-менеджмент» не пересекаются
      // с компетенциями reviewer (TypeScript/React/Архитектура/Event Loop).
      const card = panel.getByRole("listitem").filter({ hasText: DUO_BLOG.chapter.title });
      await expect(card).toBeVisible();
      await expect(card).toContainText(DUO_BLOG.title);
      await expect(card).toContainText("совпадение 0%");
      await expect(card.getByText("Тайм-менеджмент", { exact: true })).toBeVisible();
      await expect(card.getByRole("button", { name: "Взять" })).toBeVisible();
      // НЕ кликаем: claim мутирует seed и покрыт сквозными flows (RQ-02/RQ-04).
    });

    await test.step("заявка на уже опубликованную главу помечена, срок не вышел", async () => {
      const card = panel.getByRole("listitem").filter({ hasText: DUO_BLOG.chapter.title });
      await expect(card).toContainText("заявка на опубликованную главу");
      await expect(card).toContainText(/осталось \d+ дн|остался 1 день/);
      await expect(card.getByRole("link", { name: "Открыть главу" })).toHaveAttribute(
        "href",
        `/blog/${DUO_BLOG.slug}/${DUO_BLOG.chapter.slug}`,
      );
    });

    await test.step("заявка заблокированного автора в очередь не попадает", async () => {
      // req_stale заведена на главу забаненного `ghost` — контент такого автора скрыт везде.
      await expect(panel.getByRole("listitem").filter({ hasText: CHAPTERS.ghost.title })).toHaveCount(0);
    });
  });

  test("TC-REVIEWER-04 @regression: таб «Завершённые» — кредит с уровнем бейджа", async ({
    asReviewer,
  }) => {
    await asReviewer.goto("/reviewer");
    await openReviewerTab(asReviewer.page, /^Завершённые/);
    const panel = tabPanel(asReviewer.page, /Завершённые/);

    const link = panel.getByRole("link", { name: new RegExp(CHAPTERS.published.title) });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", `/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);
    // Кредит выдан за v2, бейдж этой ревизии — independent (ревьюеров автор не приводил).
    await expect(link).toContainText("версия 2");
    await expect(link).toContainText("Проверено на Recenza");
    // Незавершённые главы сюда не попадают.
    await expect(panel.getByText(CHAPTERS.underReview.title)).toHaveCount(0);
  });

  test("TC-REVIEWER-06 @regression: ReviewPage — рейл «Обсуждения», сид-треды, показ решённых", async ({
    asReviewer,
  }) => {
    const review = new ReviewPage(asReviewer.page);

    await test.step("Треды chp_under_review: thr_open_1 и thr_open_2 (правка) видны", async () => {
      await review.gotoAsReviewer(CHAPTERS.underReview.id);
      await expect(review.threadsRail).toBeVisible();

      const open1 = review.threadsRail.locator(`[data-thread-id="${THREADS.open1}"]`);
      await expect(open1).toBeVisible();
      await expect(open1).toContainText("Этот абзац стоит переписать — слишком расплывчато.");
      // Ответ автора в треде (seed trp_1).
      await expect(open1).toContainText("Принято, перепишу к следующей версии.");

      const open2 = review.threadsRail.locator(`[data-thread-id="${THREADS.open2}"]`);
      await expect(open2).toBeVisible();
      await expect(open2.getByText("правка", { exact: true })).toBeVisible();
      // «Стало» из suggestion (seed).
      await expect(open2).toContainText(
        "Промис переходит из pending ровно один раз — в fulfilled или rejected.",
      );

      // Вердикт lena_review в seed — request-changes → предупреждающая пилюля в action-bar.
      await expect(asReviewer.page.getByText("есть запрос правок")).toBeVisible();
    });

    await test.step("Тумблер решённых включается", async () => {
      await showResolvedReliably(review);
      await expect(asReviewer.page.getByRole("button", { name: "скрыть решённые" })).toBeVisible();
    });

    await test.step("…и показывает решённый тред (thr_resolved_1 живёт на chp_changes)", async () => {
      // reviewer назначен и на chp_changes (seed, вердикт approve) — доступ есть.
      await review.gotoAsReviewer(CHAPTERS.changesRequested.id);
      await expect(review.threadsRail).toBeVisible();
      await showResolvedReliably(review);
      const resolved = review.threadsRail.locator(`[data-thread-id="${THREADS.resolved}"]`);
      await expect(resolved).toBeVisible();
      await expect(resolved.getByText("решено", { exact: true })).toBeVisible();
    });
  });

  test("TC-REVIEWER-07+08 @critical: новый тред на блоке, ответ в тред, границы кнопок треда у ревьюера", async ({
    asReviewer,
  }) => {
    const { page } = asReviewer;
    const review = new ReviewPage(page);
    const threadText = uniq("Здесь не хватает примера с Promise.all.");
    const replyText = uniq("Дополню: важен порядок settle.");

    await review.gotoAsReviewer(CHAPTERS.underReview.id);
    await expect(review.threadsRail).toBeVisible();

    await test.step("Новый тред-обсуждение через выделение первого блока", async () => {
      const firstBlock = page.locator("[data-block-id]").first();
      await expect(firstBlock).toBeVisible();
      const blockId = await firstBlock.getAttribute("data-block-id");
      expect(blockId).toBeTruthy();
      await startThreadReliably(review, blockId as string);
      // Композер нового треда: режим «Комментарий» активен по умолчанию.
      await expect(review.composerMode("Комментарий")).toHaveAttribute("aria-pressed", "true");
      await review.threadMessageInput.fill(threadText);
      await throttleMutation(USERS.reviewer.handle);
      await page.getByRole("button", { name: "Отправить", exact: true }).click();
    });

    const card = review.threadsRail.locator("[data-thread-id]").filter({ hasText: threadText });

    await test.step("Тред появился в рейле, у блока — bauble-маркер", async () => {
      await expect(card).toBeVisible();
      await expect(review.bauble(/обсуждение: \d+ тред/).first()).toBeVisible();
    });

    await test.step("Ответ в созданный тред", async () => {
      // Клик по тексту карточки (не по центру — внизу карточки кнопка resolve, её не задеваем).
      // Активация треда ретраится: повторный клик по уже активной карточке безвреден.
      await expect(async () => {
        await card.getByText(threadText).click();
        await expect(page.getByText(`↳ ответ @${USERS.reviewer.handle}`)).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 15_000 });
      await review.threadMessageInput.fill(replyText);
      await throttleMutation(USERS.reviewer.handle);
      await page.getByRole("button", { name: "Ответить", exact: true }).click();
      await expect(card.getByText(replyText)).toBeVisible();
    });

    await test.step("Границы кнопок треда в POV ревьюера", async () => {
      // Факт приложения (threads-rail.tsx + MCP sections/04 «Действия по треду»):
      // у ревьюера на открытом треде ЕСТЬ «Отметить решённым» — НЕ кликаем (resolve — шаг
      // автора в сквозных flows); авторской «Применить и закрыть» в рейле ревьюера нет нигде.
      await expect(card.getByRole("button", { name: "Отметить решённым" })).toBeVisible();
      await expect(
        review.threadsRail.getByRole("button", { name: "Применить и закрыть" }),
      ).toHaveCount(0);
    });
  });

  test("TC-REVIEWER-09 @regression: suggestion через режим «Правка» — карточка с бейджем «правка» и диффом", async ({
    asReviewer,
  }) => {
    const { page } = asReviewer;
    const review = new ReviewPage(page);
    const replacement = uniq("Промис — это объект-обещание результата асинхронной операции.");

    await review.gotoAsReviewer(CHAPTERS.underReview.id);
    await expect(review.threadsRail).toBeVisible();

    await test.step("Выделение блока и переключение в режим «Правка»", async () => {
      await startThreadReliably(review, "blk_pr_p_1");
      // Переключение режима идемпотентно (повторный клик по активному режиму безвреден).
      await expect(async () => {
        await review.composerMode("Правка").click();
        await expect(review.composerMode("Правка")).toHaveAttribute("aria-pressed", "true", {
          timeout: 2_000,
        });
      }).toPass({ timeout: 15_000 });
      // Блок «Было» с исходным (выделенным) текстом + поле замены.
      await expect(page.getByText("Было", { exact: true })).toBeVisible();
      await expect(review.suggestionInput).toBeVisible();
    });

    await test.step("«Предложить» создаёт тред-правку с диффом", async () => {
      await review.suggestionInput.fill(replacement);
      await throttleMutation(USERS.reviewer.handle);
      await review.proposeButton.click();

      const card = review.threadsRail.locator("[data-thread-id]").filter({ hasText: replacement });
      await expect(card).toBeVisible();
      await expect(card.getByText("правка", { exact: true })).toBeVisible();
      // Дифф: исходный текст блока blk_pr_p_1 (якорь + зачёркнутое «было»).
      await expect(
        card.getByText(/Промис — объект, представляющий результат/).first(),
      ).toBeVisible();
      // Применение правки — только авторская кнопка, у ревьюера её нет (серверный гейт — TC-REVIEWER-17).
      await expect(card.getByRole("button", { name: "Применить и закрыть" })).toHaveCount(0);
    });
  });

  test("TC-REVIEWER-10 (SMK-10) @smoke @critical: вердикт «Одобрить» — тост, «все одобрили» не появляется", async ({
    asReviewer,
  }) => {
    const review = new ReviewPage(asReviewer.page);
    await review.gotoAsReviewer(CHAPTERS.underReview.id);
    await expect(asReviewer.page.getByRole("button", { name: "Одобрить" })).toBeVisible();

    // Клик «Одобрить» + тост role=status «Вы одобрили главу.» — внутри POM (без подтверждения).
    // «Мёртвый» клик до гидрации ретраим; пауза ≥1.1с на попытку — повторный POST не ловит 429
    // (перезапись своего вердикта идемпотентна).
    await expect(async () => {
      await throttleMutation(USERS.reviewer.handle);
      await review.approve();
    }).toPass({ timeout: 40_000 });

    // У lena_review в seed остаётся request-changes → консенсуса «все одобрили» нет.
    await expect(asReviewer.page.getByText("есть запрос правок")).toBeVisible();
    await expect(asReviewer.page.getByText("все одобрили")).toHaveCount(0);
    // «Опубликовать» — авторская кнопка; в POV ревьюера отсутствует в DOM всегда.
    await expect(review.publishButton).toHaveCount(0);
  });

  test("TC-REVIEWER-12 @regression: чат сессии — сообщение видно в чате и не попадает в треды", async ({
    asReviewer,
  }) => {
    const { page } = asReviewer;
    const review = new ReviewPage(page);
    const message = uniq("Сегодня досмотрю раздел про then.");

    await review.gotoAsReviewer(CHAPTERS.underReview.id);
    await openChatReliably(review);
    // История сессии из seed (rch_1) — участники видят чат.
    await expect(page.getByText("Начинаю смотреть главу.")).toBeVisible();

    await throttleMutation(USERS.reviewer.handle);
    await review.sendChatMessage(message);
    await expect(page.getByText(message)).toBeVisible();
    // Сообщение чата НЕ становится тредом (review_chat ≠ threads).
    await expect(review.threadsRail.getByText(message)).toHaveCount(0);
  });

  test("TC-REVIEWER-13+14 @regression: публичный профиль /u/reviewer — таб «Ревью», рейтинга ★ нет", async ({
    asGuest,
    api,
  }) => {
    const { page } = asGuest;
    await asGuest.goto(`/u/${USERS.reviewer.slug}`);

    await test.step("Шапка профиля: чип возможности, метрика «Отрецензировано», рейтинга нет", async () => {
      await expect(page.getByRole("heading", { name: "Раиса Ревьюер" })).toBeVisible();
      // ui-feedback-3 (П5): шапка по прототипу ProfileScreen — @handle и чипы отдельными элементами.
      await expect(page.getByText(`@${USERS.reviewer.handle}`, { exact: true })).toBeVisible();
      await expect(page.getByText("Ревьюер", { exact: true })).toBeVisible();
      await expect(page.getByText("Отрецензировано", { exact: true })).toBeVisible();
      // ⚠️ Ф14: рейтинг ревьюеров снесён целиком — ни агрегата, ни звёзд нигде.
      await expect(page.getByText(/★/)).toHaveCount(0);
    });

    await test.step("Таб «Ревью»: только published-главы", async () => {
      // Ф13.5: ревью-активность живёт в отдельном табе (решение владельца — публично).
      await page.getByRole("tab", { name: /^Ревью/ }).click();
      const reviewed = page.getByRole("region", { name: "Отрецензированные главы" });
      await expect(reviewed).toBeVisible();
      const link = reviewed.getByRole("link", { name: /Цикл событий/ }).first();
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", `/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);
      // under-review и changes-requested глав в списке нет.
      await expect(reviewed.getByText(CHAPTERS.underReview.title)).toHaveCount(0);
      await expect(reviewed.getByText(CHAPTERS.changesRequested.title)).toHaveCount(0);
    });

    await test.step("Приватность: поштучные оценки не сериализуются в страницу", async () => {
      const ctx = await api();
      const res = await ctx.get(`/u/${USERS.reviewer.slug}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      // Ф14: таблицы оценок нет вовсе — поле не должно течь ни в разметку, ни в RSC-пейлоад.
      expect(html).not.toContain('"stars"');
    });
  });

  // Ф13: ролевого запрета «ревьюер не комментирует» больше нет — вместо него КОНФЛИКТ ИНТЕРЕСОВ,
  // привязанный к конкретной главе. `reviewer` рецензировал event-loop (reviewer_history) → закрыто;
  // `sergey_review` имеет возможность «ревьюер», но эту главу не рецензировал → комментирует свободно.
  test("TC-REVIEWER-15 (SMK-12) @smoke @critical: конфликт интересов — рецензировавший главу не комментирует её (UI-гейт и API 403)", async ({
    asReviewer,
    api,
  }) => {
    const comments = new CommentsPage(asReviewer.page, USERS.reviewer.handle);
    await asReviewer.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);

    await test.step("UI: формы нет, гейт-текст показан, чтение доступно", async () => {
      await expect(comments.region).toBeVisible();
      await expect(
        asReviewer.page.getByText("Вы рецензировали эту главу — публичное обсуждение недоступно."),
      ).toBeVisible();
      await expect(comments.composer).toHaveCount(0);
      await expect(comments.region.getByRole("button", { name: "Ответить" })).toHaveCount(0);
      // Существующие комментарии читаются.
      await expect(comments.node(COMMENTS.root)).toBeVisible();
    });

    await test.step("API: POST /api/comments → 403 с точным текстом гейта", async () => {
      const ctx = await api("reviewer");
      const res = await ctx.post("/api/comments", {
        data: { blogSlug: BLOG.slug, chapterSlug: CHAPTERS.published.slug, text: "попытка ревьюера" },
      });
      expect(res.status()).toBe(403);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toBe("Вы рецензировали эту главу — публичное обсуждение недоступно.");
    });

    await test.step("возможность «ревьюер» сама по себе не блокирует: sergey комментирует ту же главу", async () => {
      // sergey_review — ревьюер БЕЗ строк chapter_reviewers/reviewer_history по этой главе
      // (Ф14: заявок он не брал), значит конфликта интересов нет.
      const ctx = await apiLoginUser(USERS.sergey.handle);
      try {
        await throttleMutation(USERS.sergey.handle);
        const res = await ctx.post("/api/comments", {
          data: {
            blogSlug: BLOG.slug,
            chapterSlug: CHAPTERS.published.slug,
            text: "ревьюер без конфликта интересов комментирует",
          },
        });
        expect(res.status()).toBe(200);
      } finally {
        await ctx.dispose();
      }
    });
  });

  test("TC-REVIEWER-16 @critical: вердикт без взятой заявки → 403 (доступ даёт claim, а не возможность)", async () => {
    // Ф14: sergey_review — ревьюер, но заявку на эту главу не брал, значит строки в
    // chapter_reviewers у него нет. Возможности «ревьюер» самой по себе для вердикта мало.
    const ctx = await apiLoginUser(USERS.sergey.handle);
    try {
      const res = await ctx.post(`/api/review/${CHAPTERS.underReview.id}/verdict`, {
        data: { verdict: "approve" },
      });
      expect(res.status()).toBe(403);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toBe("Нет доступа к этому ревью.");
    } finally {
      await ctx.dispose();
    }
  });

  test("TC-REVIEWER-17 @critical: apply правки ревьюером → 403 (применяет только автор)", async ({
    api,
  }) => {
    const ctx = await api("reviewer");
    const res = await ctx.post(`/api/review/threads/${THREADS.open2}/apply`, { data: {} });
    expect(res.status()).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Применять правки может только автор.");
  });

  test("TC-REVIEWER-18 @critical: GET /author под ревьюером → 307 на главную", async ({ api }) => {
    const ctx = await api("reviewer");
    const res = await ctx.get("/author", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const location = res.headers()["location"] ?? "";
    expect(new URL(location, BASE_URL).pathname).toBe("/");
  });

  // ── TC-REVIEWER-19 — engagement доступен ЛЮБОМУ аккаунту (Ф13, реверс ui-feedback-5 П4) ────────

  test("TC-REVIEWER-19 @critical: голос/закладка/подписка ревьюеру доступны; бар «Реакции» в ридере есть", async ({
    asReviewer,
    api,
  }) => {
    const ctx = await api("reviewer");
    await throttleMutation(USERS.reviewer.handle);
    expect((await ctx.post(`/api/blogs/${BLOG.id}/vote`, { data: { value: 1 } })).status()).toBe(200);
    await throttleMutation(USERS.reviewer.handle);
    expect((await ctx.post("/api/bookmarks", { data: { blogId: BLOG.id } })).status()).toBe(200);
    await throttleMutation(USERS.reviewer.handle);
    expect((await ctx.post("/api/follows", { data: { authorId: USERS.author.id } })).status()).toBe(200);

    const { page } = asReviewer;
    await page.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: CHAPTERS.published.title })).toBeVisible();
    await expect(page.locator('[aria-label="Реакции"]').first()).toBeVisible();

    // Self-restoring: снимаем свои голос/закладку/подписку, чтобы спека осталась read-only по эффекту.
    await throttleMutation(USERS.reviewer.handle);
    await ctx.post(`/api/blogs/${BLOG.id}/vote`, { data: { value: 1 } });
    await throttleMutation(USERS.reviewer.handle);
    await ctx.post("/api/bookmarks", { data: { blogId: BLOG.id } });
    await throttleMutation(USERS.reviewer.handle);
    await ctx.post("/api/follows", { data: { authorId: USERS.author.id } });
  });
});
