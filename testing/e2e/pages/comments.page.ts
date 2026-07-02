import { type Locator, type Page } from "@playwright/test";
import { throttleMutation } from "../helpers/throttle";

/**
 * Секция публичных комментариев в ридере (Фаза 8).
 * Точные тексты гейтов/ошибок — MCP-FINDINGS §2 «Комментарии» и §5.
 */
export class CommentsPage {
  constructor(
    readonly page: Page,
    private readonly userKey: string = "guest",
  ) {}

  get region(): Locator {
    return this.page.getByRole("region", { name: "Комментарии" });
  }

  get heading(): Locator {
    return this.region.getByRole("heading", { name: /^Комментарии/ });
  }

  get composer(): Locator {
    return this.page.getByPlaceholder("Оставьте комментарий…");
  }

  /** Узел комментария по id (li#comment-{id}). */
  node(commentId: string): Locator {
    return this.page.locator(`li#comment-${commentId}`);
  }

  async addRoot(text: string): Promise<void> {
    await this.composer.fill(text);
    await this.region.getByRole("button", { name: "Отправить" }).first().click();
  }

  /** Ответ на комментарий: «Ответить» внутри узла → плейсхолдер «Ваш ответ…». */
  async replyTo(commentId: string, text: string): Promise<void> {
    await this.node(commentId).getByRole("button", { name: "Ответить" }).click();
    await this.page.getByPlaceholder("Ваш ответ…").fill(text);
    await this.region.getByRole("button", { name: "Отправить" }).last().click();
  }

  /** Правка своего комментария (textarea внутри узла — без aria-label). */
  async edit(commentId: string, newText: string): Promise<void> {
    const node = this.node(commentId);
    await node.getByRole("button", { name: "Изменить" }).click();
    await node.locator("textarea").fill(newText);
    await node.getByRole("button", { name: "Сохранить" }).click();
  }

  /** Удаление — нативный confirm («Удалить комментарий?»). */
  async remove(commentId: string): Promise<void> {
    this.page.once("dialog", (dialog) => void dialog.accept());
    await this.node(commentId).getByRole("button", { name: "Удалить" }).click();
  }

  /** Голос за комментарий (rate-limit 1/сек). kind: полезный/бесполезный. */
  async vote(commentId: string, kind: "up" | "down" = "up"): Promise<void> {
    await throttleMutation(this.userKey);
    const name = kind === "up" ? "Полезный комментарий" : "Бесполезный комментарий";
    await this.node(commentId).getByRole("button", { name }).click();
  }

  /** Спойлер «Комментарии к прошлым версиям». */
  get pastVersionsSpoiler(): Locator {
    return this.region.getByText(/прошлы[мх] верси/i);
  }

  /** Кнопка «Перейти к фрагменту в тексте» внутри узла (якорь). */
  goToFragment(commentId: string): Locator {
    return this.node(commentId).getByRole("button", { name: "Перейти к фрагменту в тексте" });
  }

  /**
   * Комментарий с привязкой к фрагменту: выделить текст блока (тройной клик),
   * нажать плавающую кнопку якоря (гаснет на scroll/resize/Esc — не скроллить
   * между выделением и кликом), затем отправить из композера с чипом «К фрагменту».
   */
  async addAnchoredToBlock(blockId: string, text: string): Promise<void> {
    await this.page.locator(`[data-block-id="${blockId}"]`).click({ clickCount: 3 });
    await this.page.locator('[aria-label="Прокомментировать выделенный фрагмент"]').click();
    await this.composer.fill(text);
    await this.region.getByRole("button", { name: "Отправить" }).first().click();
  }
}
