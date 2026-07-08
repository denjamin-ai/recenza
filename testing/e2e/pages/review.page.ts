import { expect, type Locator, type Page } from "@playwright/test";

/**
 * ReviewPage — общий макет POV автора и ревьюера (Фаза 7/9).
 * Кросс-экранный sync — поллинг 30с: в тестах проверять через reload, не ожиданием.
 * Вердикты/publish — без подтверждений; фидбек — тост role=status + смена пилюль.
 */
export class ReviewPage {
  constructor(readonly page: Page) {}

  async gotoAsReviewer(chapterId: string): Promise<void> {
    await this.page.goto(`/reviewer/review/${chapterId}`);
  }

  async gotoAsAuthor(blogSlug: string, chapterSlug: string): Promise<void> {
    await this.page.goto(`/author/blog/${blogSlug}/${chapterSlug}/review`);
  }

  /** «@handle · ведущий · онлайн» (пусто при нуле принявших). */
  get team(): Locator {
    return this.page.locator('[aria-label="Команда ревью"]');
  }

  /** Strip глав: tablist «Главы блога»; клик по табу = навигация на review той главы. */
  chapterTab(nameRe: RegExp): Locator {
    return this.page.getByRole("tablist", { name: "Главы блога" }).getByRole("tab", { name: nameRe });
  }

  // --- Треды ---

  get threadsRail(): Locator {
    return this.page.getByRole("complementary").filter({ hasText: "Обсуждения" });
  }

  get toggleResolved(): Locator {
    return this.page.getByRole("button", { name: /показать решённые|скрыть решённые/ });
  }

  /** Bauble на блоке: «правка предложена/обсуждение/решено: N тред(ов)…». */
  bauble(kindRe: RegExp = /тред/): Locator {
    return this.page.getByRole("button", { name: kindRe });
  }

  /** «→ блок» в карточке треда. */
  goToBlockButton(threadCard: Locator): Locator {
    return threadCard.getByRole("button", { name: "Перейти к блоку обсуждения" });
  }

  /**
   * Новый тред: выделить текст блока (тройной клик) → плавающая «Прокомментировать»
   * (не скроллить между выделением и кликом!) → композер.
   */
  async startThreadOnBlock(blockId: string): Promise<void> {
    await this.page.locator(`[data-block-id="${blockId}"]`).click({ clickCount: 3 });
    await this.page.getByRole("button", { name: "Прокомментировать" }).click();
  }

  get threadMessageInput(): Locator {
    return this.page.getByRole("textbox", { name: "Сообщение в обсуждение" });
  }

  /** Режим композера: «Комментарий» ↔ «Правка» (aria-pressed). */
  composerMode(name: "Комментарий" | "Правка"): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }

  /** Поле замены в режиме «Правка» (рядом блок «Было»). */
  get suggestionInput(): Locator {
    return this.page.getByPlaceholder(/Как должно стать/);
  }

  get proposeButton(): Locator {
    return this.page.getByRole("button", { name: "Предложить" });
  }

  // --- Действия автора в треде ---

  async applyAndClose(threadCard: Locator): Promise<void> {
    await threadCard.getByRole("button", { name: "Применить и закрыть" }).click();
  }

  async markResolved(threadCard: Locator): Promise<void> {
    await threadCard.getByRole("button", { name: "Отметить решённым" }).click();
  }

  // --- Вердикты (reviewer) и публикация (author) ---

  async approve(): Promise<void> {
    await this.page.getByRole("button", { name: "Одобрить" }).click();
    await expect(this.page.getByRole("status").filter({ hasText: "Вы одобрили главу." })).toBeVisible();
  }

  async requestChanges(): Promise<void> {
    await this.page.getByRole("button", { name: "Нужны правки" }).click();
  }

  /** В DOM ТОЛЬКО при все approve (иначе отсутствует; сервер — 409). exact — не путать с «Опубликовать сейчас» в модалке. */
  get publishButton(): Locator {
    return this.page.getByRole("button", { name: "Опубликовать", exact: true });
  }

  /** Фаза 12: «Опубликовать» открывает PublishModal (сейчас/отложенно) — публикуем сейчас. */
  async publish(): Promise<void> {
    await this.publishButton.click();
    const dialog = this.page.getByRole("dialog", { name: "Публикация главы" });
    await dialog.getByRole("button", { name: "Опубликовать сейчас" }).click();
    await expect(this.page.getByText("Глава опубликована.")).toBeVisible();
  }

  get submitNextVersionButton(): Locator {
    return this.page.getByRole("button", { name: /Отправить v\d+/ });
  }

  /** «Сменить ведущего» (disabled при <2 принявших) → модалка → запрос админу. */
  async requestPrimaryChange(candidateRe: RegExp, reason: string): Promise<void> {
    await this.page.getByRole("button", { name: "Сменить ведущего" }).click();
    const dialog = this.page.getByRole("dialog", { name: "Сменить ведущего ревьюера" });
    await dialog.getByRole("radio", { name: candidateRe }).check();
    await dialog.getByRole("textbox").fill(reason);
    await dialog.getByRole("button", { name: "Отправить запрос" }).click();
  }

  // --- Чат сессии (не смешивается с тредами) ---

  get chatToggle(): Locator {
    return this.page.getByRole("button", { name: /Развернуть чат сессии|Свернуть чат сессии/ });
  }

  async openChat(): Promise<void> {
    const toggle = this.chatToggle;
    if ((await toggle.getAttribute("aria-expanded")) !== "true") {
      await toggle.click();
    }
  }

  get chatInput(): Locator {
    return this.page.getByRole("textbox", { name: "Сообщение в чат сессии" });
  }

  async sendChatMessage(text: string): Promise<void> {
    await this.openChat();
    await this.chatInput.fill(text);
    await this.page.getByRole("button", { name: "Отправить сообщение" }).click();
  }

  /** Тосты ревью-действий (role=status, автоскрытие 5.5с — ассертить сразу). */
  toast(textRe: RegExp): Locator {
    return this.page.getByRole("status").filter({ hasText: textRe });
  }
}
