import { expect, type Locator, type Page } from "@playwright/test";
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

  /**
   * Узел комментария по видимому тексту (page-scoped: список ul>li не всегда внутри
   * DOM-поддерева region "Комментарии"). Возвращает li и его id.
   */
  nodeByText(text: string): Locator {
    return this.page.locator('li[id^="comment-"]').filter({ hasText: text }).first();
  }

  async idOfNewest(text: string): Promise<string> {
    const node = this.nodeByText(text);
    await expect(node).toBeVisible();
    return (await node.getAttribute("id"))!.replace("comment-", "");
  }

  /**
   * Создаёт корневой комментарий, возвращает его серверный id. Клик по «Отправить» ретраится
   * против потери события до гидрации; ждём именно УСПЕШНЫЙ (200) ответ создания — так id
   * получаем сразу, не полагаясь на оптимистичный DOM (у свежего узла ещё нет id="comment-…").
   */
  async addRoot(text: string): Promise<string> {
    await this.composer.fill(text);
    let id = "";
    await expect(async () => {
      const [res] = await Promise.all([
        this.page.waitForResponse(
          (r) => r.url().includes("/api/comments") && r.request().method() === "POST" && r.status() === 200,
          { timeout: 5_000 },
        ),
        this.region.getByRole("button", { name: "Отправить" }).first().click(),
      ]);
      id = ((await res.json()) as { id: string }).id;
    }).toPass({ timeout: 20_000 });
    return id;
  }

  /**
   * Ответ на комментарий: «Ответить» внутри узла → плейсхолдер «Ваш ответ…».
   * Сабмит реплай-композера называется «Ответить» (comment-item.tsx, submitLabel),
   * НЕ «Отправить» — и живёт внутри узла родителя.
   */
  async replyTo(commentId: string, text: string): Promise<void> {
    const node = this.node(commentId);
    await node.getByRole("button", { name: "Ответить" }).first().click();
    await this.page.getByPlaceholder("Ваш ответ…").fill(text);
    await node.getByRole("button", { name: "Ответить" }).last().click();
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

  /** Кнопка голоса ЗА СВОЙ узел (не за вложенные ответы — они внутри того же li). */
  voteButton(commentId: string, kind: "up" | "down" = "up"): Locator {
    const name = kind === "up" ? "Полезный комментарий" : "Бесполезный комментарий";
    return this.node(commentId).getByRole("button", { name }).first();
  }

  /** Голос за комментарий (rate-limit 1/сек). kind: полезный/бесполезный. */
  async vote(commentId: string, kind: "up" | "down" = "up"): Promise<void> {
    await throttleMutation(this.userKey);
    await this.voteButton(commentId, kind).click();
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
