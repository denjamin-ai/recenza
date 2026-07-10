// Спеки роли «Ревьюер» (Фаза 11.3) — кейсы TC-REVIEWER.md: кабинет-инбокс, приглашение (read-only),
// ReviewPage (треды/suggestion/вердикт/чат), публичный профиль, негативы ролевого гейтинга.
//
// Категория A — файл самодостаточен и НЕ требует reseed:
//   • read-only (TC-01/02/03/06/13/14/15/16/17/18);
//   • additive (новые треды/ответы/чат — уникальные тексты; вердикт approve (TC-10) идемпотентен;
//     его сайд-эффект — пересчёт статуса ревизии в changes-requested, т.к. у lena_review в seed
//     request-changes: статус остаётся ACTIVE, треды/чат/вердикты доступны, ассерты файла
//     от точного статус-бейджа не зависят).
// Accept/decline/flag приглашений здесь НЕ трогаем — это сквозные flows.
//
// Локаторы и точные тексты — testing/mcp/MCP-FINDINGS.md (§2, §5) + исходники компонентов
// (src/components/review/**, src/app/reviewer/_components/**).

import { test, expect } from "./fixtures";
import { apiLoginUser, loginViaUi } from "./helpers/auth";
import { BASE_URL, BLOG, CHAPTERS, COMMENTS, THREADS, USERS } from "./helpers/seed";
import { throttleMutation } from "./helpers/throttle";
import { ReviewPage } from "./pages/review.page";
import { CommentsPage } from "./pages/comments.page";

/** Уникальный суффикс — additive-тексты не конфликтуют между прогонами без reseed. */
const uniq = (text: string): string => `${text} [e2e ${Date.now()}]`;

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
  test("TC-REVIEWER-01 (SMK-09) @smoke: логин ревьюера → редирект /reviewer, плитки кабинета", async ({
    asGuest,
  }) => {
    const { page } = asGuest;
    await loginViaUi(page, USERS.reviewer.handle);
    // roleHome ревьюера — /reviewer (роль берётся из БД, не из cookie).
    await expect(page).toHaveURL(/\/reviewer$/);
    await expect(page.getByRole("heading", { name: "Кабинет ревьюера" })).toBeVisible();
    // Четыре плитки-счётчика (значения не ассертим — состояние аддитивно между спеками).
    await expect(page.getByText("Приглашения", { exact: true })).toBeVisible();
    await expect(page.getByText("Ваш ход", { exact: true })).toBeVisible();
    // «Активные ревью» встречается дважды (плитка + h2 секции) — берём первый.
    await expect(page.getByText("Активные ревью", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Ваш рейтинг", { exact: true })).toBeVisible();
  });

  test("TC-REVIEWER-02 @regression: инбокс — активное ревью «Промисы изнутри» с бейджем «вы ведущий»", async ({
    asReviewer,
  }) => {
    await asReviewer.goto("/reviewer");
    // Карточка активного ревью — целиком ссылка на ReviewPage главы.
    const card = asReviewer.page.getByRole("link", { name: /Промисы изнутри/ });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", `/reviewer/review/${CHAPTERS.underReview.id}`);
    // reviewer — primary главы chp_under_review (seed).
    await expect(card).toContainText("вы ведущий");
    await expect(card).toContainText(BLOG.title);
  });

  test("TC-REVIEWER-03 @regression: входящее приглашение sergey_review — карточка и кнопки ответа (без кликов)", async ({
    loginAs,
  }) => {
    const sergey = await loginAs(USERS.sergey.handle);
    await sergey.goto("/reviewer");
    const { page } = sergey;

    await expect(page.getByRole("heading", { name: "Входящие приглашения" })).toBeVisible();
    // Карточка inv_pending: sergey_review → «Промисы изнутри», match 0% (компетенции не совпали).
    const card = page.locator("li").filter({ hasText: CHAPTERS.underReview.title });
    await expect(card).toBeVisible();
    await expect(card).toContainText(BLOG.title);
    await expect(card.getByText("0% совпадение")).toBeVisible();
    await expect(card.getByRole("button", { name: "Принять", exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "Отклонить", exact: true })).toBeVisible();
    // Flag-кнопка доступна только при match < 50% (здесь 0%).
    await expect(card.getByRole("button", { name: "Навыки не совпадают" })).toBeVisible();
    // НЕ кликаем: accept/decline/flag мутируют seed и покрыты сквозными flows.
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

  test("TC-REVIEWER-13+14 @regression: публичный профиль /u/reviewer — «Отрецензировал», только агрегат рейтинга", async ({
    asGuest,
    api,
  }) => {
    const { page } = asGuest;
    await asGuest.goto(`/u/${USERS.reviewer.slug}`);

    await test.step("Шапка профиля и агрегат рейтинга", async () => {
      await expect(page.getByRole("heading", { name: "Раиса Ревьюер" })).toBeVisible();
      // ui-feedback-3 (П5): шапка по прототипу ProfileScreen — @handle и пилюля роли отдельные элементы.
      await expect(page.getByText(`@${USERS.reviewer.handle}`, { exact: true })).toBeVisible();
      await expect(page.getByText("Ревьюер", { exact: true })).toBeVisible();
      // Только агрегат «★ N.N [· M оценок]» — точное число не ассертим (агрегат пересчитывается
      // по реальным строкам reviewer_ratings, MCP-FINDINGS §5).
      await expect(page.getByText(/★ \d\.\d/)).toBeVisible();
    });

    await test.step("«Отрецензировал»: только published-главы", async () => {
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
      // Поле reviewer_ratings.stars не должно утекать ни в разметку, ни в RSC-пейлоад.
      expect(html).not.toContain('"stars"');
    });
  });

  test("TC-REVIEWER-15 (SMK-12) @smoke @critical: ревьюер не комментирует публично — UI-гейт и API 403", async ({
    asReviewer,
    api,
  }) => {
    const comments = new CommentsPage(asReviewer.page, USERS.reviewer.handle);
    await asReviewer.goto(`/blog/${BLOG.slug}/${CHAPTERS.published.slug}`);

    await test.step("UI: формы нет, гейт-текст показан, чтение доступно", async () => {
      await expect(comments.region).toBeVisible();
      await expect(
        asReviewer.page.getByText("Ревьюеры не участвуют в публичных обсуждениях."),
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
      expect(body.error).toBe("Ревьюеры не участвуют в публичных обсуждениях.");
    });
  });

  test("TC-REVIEWER-16 @critical: вердикт до accept приглашения → 403 (pending не даёт доступа)", async () => {
    // sergey_review приглашён (inv_pending), но НЕ принял — записи в chapter_reviewers нет.
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
});
