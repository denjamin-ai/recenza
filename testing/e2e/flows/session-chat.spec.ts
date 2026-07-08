/**
 * REV-SESSION-CHAT / REV-PRESENCE — чат ревью-сессии (TC-FLOWS.md).
 *
 * Глава chp_under_review (promises): команда — reviewer (ведущий, online) + lena_review;
 * seed-чат rch_1–rch_3. Чат (`review_chat`) не смешивается с тредами (`threads/thread_replies`).
 * Кросс-экранный sync — поллинг 30 с: в тестах проверяем через reload, не ожиданием.
 *
 * Спек мутирует seed (добавляет 2 сообщения в review_chat) → serial + reseed в beforeAll.
 */
import { test, expect } from "../fixtures";
import { ReviewPage } from "../pages/review.page";
import { BLOG, CHAPTERS } from "../helpers/seed";
import { reseed } from "../helpers/db";

const REVIEWER_MSG = "Сообщение ревьюера e2e";
const AUTHOR_MSG = "Ответ автора e2e";

/** Seed-сообщения чата rch_1–rch_3 (seed-core §10) — хронологический порядок. */
const SEED_CHAT = [
  "Начинаю смотреть главу.", // rch_1, @reviewer
  "Спасибо! Жду замечаний.", // rch_2, @author
  "Подключилась к ревью.", // rch_3, @lena_review
] as const;

/**
 * Надёжное раскрытие чата: клик по toggle до гидрации может молча потеряться
 * (MCP-FINDINGS §5) — ретраим, пока aria-expanded не станет true.
 * POM.openChat() идемпотентен (проверяет aria-expanded перед кликом).
 */
async function openChatReliably(review: ReviewPage): Promise<void> {
  await expect(async () => {
    await review.openChat();
    await expect(review.chatToggle).toHaveAttribute("aria-expanded", "true", { timeout: 2_000 });
  }).toPass();
}

test.describe("REV-SESSION-CHAT: чат ревью-сессии — участники и изоляция от тредов", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    // Спек добавляет сообщения в review_chat — стартуем от детерминированного seed.
    reseed();
  });

  // Восстанавливаем seed после файла — чтобы любой grep-срез был самодостаточен.
  test.afterAll(() => {
    reseed();
  });

  test("REV-SESSION-CHAT @critical: сообщения чата видны всем участникам сессии и не попадают в треды", async ({
    asReviewer,
    asAuthor,
    loginAs,
  }) => {
    const reviewerView = new ReviewPage(asReviewer.page);
    const authorView = new ReviewPage(asAuthor.page);

    await test.step("Ревьюер (reviewer): открыть ревью promises, увидеть seed-чат, отправить сообщение", async () => {
      await reviewerView.gotoAsReviewer(CHAPTERS.underReview.id);
      await openChatReliably(reviewerView);

      // Seed-сообщения rch_1–rch_3 на месте (несколько участников: reviewer/author/lena_review).
      for (const text of SEED_CHAT) {
        await expect(asReviewer.page.getByText(text)).toBeVisible();
      }

      await reviewerView.sendChatMessage(REVIEWER_MSG);
      // Сообщение появляется у отправителя (router.refresh ~0.3–2 с) с подписью @reviewer.
      const sentLine = asReviewer.page.locator("p", { hasText: REVIEWER_MSG });
      await expect(sentLine).toBeVisible();
      await expect(sentLine.getByText("@reviewer", { exact: true })).toBeVisible();
    });

    await test.step("Автор: reload → открыть чат → сообщение ревьюера видно → ответить", async () => {
      await authorView.gotoAsAuthor(BLOG.slug, CHAPTERS.underReview.slug);
      // Кросс-экранный sync = поллинг 30 с — не ждём, синхронизируемся перезагрузкой.
      await asAuthor.page.reload();
      await openChatReliably(authorView);

      await expect(asAuthor.page.getByText(REVIEWER_MSG)).toBeVisible();

      await authorView.sendChatMessage(AUTHOR_MSG);
      const replyLine = asAuthor.page.locator("p", { hasText: AUTHOR_MSG });
      await expect(replyLine).toBeVisible();
      await expect(replyLine.getByText("@author", { exact: true })).toBeVisible();
    });

    await test.step("Ревьюер: reload → ответ автора виден", async () => {
      await asReviewer.page.reload();
      await openChatReliably(reviewerView);
      await expect(asReviewer.page.getByText(AUTHOR_MSG)).toBeVisible();
      await expect(asReviewer.page.getByText(REVIEWER_MSG)).toBeVisible();
    });

    await test.step("Изоляция: тред-rail «Обсуждения» НЕ содержит сообщений чата", async () => {
      const rail = reviewerView.threadsRail;
      await expect(rail).toBeVisible();
      // Rail живёт своими данными: seed-тред thr_open_1 и ответ в нём на месте…
      await expect(rail.getByText("Этот абзац стоит переписать — слишком расплывчато.")).toBeVisible();
      await expect(rail.getByText("Принято, перепишу к следующей версии.")).toBeVisible();
      // …а сообщения чата сессии (новые и seed) в треды не «протекают» (review_chat ≠ threads).
      await expect(rail.getByText(REVIEWER_MSG)).toHaveCount(0);
      await expect(rail.getByText(AUTHOR_MSG)).toHaveCount(0);
      await expect(rail.getByText(SEED_CHAT[2])).toHaveCount(0);
    });

    await test.step("Третий участник (lena_review): оба сообщения видны", async () => {
      const lena = await loginAs("lena_review");
      const lenaView = new ReviewPage(lena.page);
      await lenaView.gotoAsReviewer(CHAPTERS.underReview.id);
      await openChatReliably(lenaView);

      await expect(lena.page.getByText(REVIEWER_MSG)).toBeVisible();
      await expect(lena.page.getByText(AUTHOR_MSG)).toBeVisible();
      // И seed-история сессии тоже на месте.
      await expect(lena.page.getByText(SEED_CHAT[0])).toBeVisible();
    });
  });

  test("REV-PRESENCE @regression: «Команда ревью» рендерит участников с seed-маркерами (presence статичен)", async ({
    asAuthor,
  }) => {
    // Presence статичен из chapter_reviewers.online — реалтайма нет (Фаза 12);
    // ассертим ТОЛЬКО отрисовку маркеров из seed, без ожидания live-обновлений.
    const review = new ReviewPage(asAuthor.page);
    await review.gotoAsAuthor(BLOG.slug, CHAPTERS.underReview.slug);

    const team = review.team; // матчит div (desktop) и кнопку (mobile) — скоупим до аватаров-спанов
    // reviewer — ведущий, online=true (seed §6): маркер «онлайн».
    await expect(team.locator('span[title="@reviewer · ведущий · онлайн"]')).toBeVisible();
    // lena_review — принявшая, offline: маркер «был недавно», без «ведущий».
    await expect(team.locator('span[title="@lena_review · был недавно"]')).toBeVisible();
    // sergey_review лишь приглашён (inv_pending) — ревью не стартовало, в команде его нет.
    await expect(team.locator('span[title*="@sergey_review"]')).toHaveCount(0);
  });
});
