import { type Locator, type Page } from "@playwright/test";
import { throttleMutation } from "../helpers/throttle";

/**
 * Публичный читательский слой: лента, ридер главы, engagement, уведомления.
 * Локаторы — из testing/mcp/MCP-FINDINGS.md §2 (data-testid в приложении нет).
 */
export class ReaderPage {
  constructor(
    readonly page: Page,
    /** Ключ троттлинга мутаций (rate-limit 1/сек на пользователя) */
    private readonly userKey: string = "guest",
  ) {}

  // --- Навигация ---

  async gotoFeed(): Promise<void> {
    await this.page.goto("/");
  }

  /** Главная без табов (ui-feedback-4 П2): h1 «Все блоги» (гость/автор/ревьюер) или «Ваша лента» (reader). */
  homeHeading(name: "Все блоги" | "Ваша лента"): Locator {
    return this.page.getByRole("heading", { level: 1, name });
  }

  /** Карточка блога на главной: article с заголовком-названием блога. */
  blogCard(title: string): Locator {
    return this.page.locator("article").filter({ has: this.page.getByRole("heading", { name: title }) });
  }

  async gotoBlog(blogSlug: string): Promise<void> {
    await this.page.goto(`/blog/${blogSlug}`);
  }

  async gotoChapter(blogSlug: string, chapterSlug: string): Promise<void> {
    await this.page.goto(`/blog/${blogSlug}/${chapterSlug}`);
  }

  // --- Карусель промо (авторотация ~5с — фиксировать слайд точкой!) ---

  get promo(): Locator {
    return this.page.getByRole("region", { name: "Промо" });
  }

  async pinPromoSlide(n: 1 | 2 | 3): Promise<void> {
    await this.promo.getByRole("button", { name: `Баннер ${n}` }).click();
  }

  // --- Реакции (rate-limit 1/сек → троттлинг встроен) ---

  get reactions(): Locator {
    return this.page.locator('[aria-label="Реакции"]');
  }

  voteUpButton(): Locator {
    return this.reactions.getByRole("button", { name: "Полезно", exact: true });
  }

  voteDownButton(): Locator {
    return this.reactions.getByRole("button", { name: "Не полезно" });
  }

  /** «В закладки» ↔ «Убрать из закладок» */
  bookmarkButton(): Locator {
    return this.reactions.getByRole("button", { name: /закладки|закладок/ });
  }

  /** «Подписаться на автора» ↔ «Вы подписаны» */
  followButton(): Locator {
    return this.reactions.getByRole("button", { name: /Подписаться на автора|Вы подписаны/ });
  }

  async voteUp(): Promise<void> {
    await throttleMutation(this.userKey);
    await this.voteUpButton().click();
  }

  async toggleBookmark(): Promise<void> {
    await throttleMutation(this.userKey);
    await this.bookmarkButton().click();
  }

  async toggleFollow(): Promise<void> {
    await throttleMutation(this.userKey);
    await this.followButton().click();
  }

  // --- Ревьюеры главы (REV-VERSIONS read-side) ---

  get reviewersRegion(): Locator {
    return this.page.getByRole("region", { name: "Ревьюеры главы" });
  }

  get pastVersions(): Locator {
    return this.reviewersRegion.getByText("Прошлые версии");
  }

  async expandPastVersions(): Promise<void> {
    await this.pastVersions.click();
  }

  // --- Режим чтения ---

  readingModeLink(name: "Глава" | "Весь блог"): Locator {
    return this.page.getByRole("group", { name: "Режим чтения" }).getByRole("link", { name });
  }

  // --- Уведомления ---

  get bell(): Locator {
    return this.page.getByRole("button", { name: /^Уведомления/ });
  }

  async openNotifications(): Promise<Locator> {
    await this.bell.click();
    return this.page.getByRole("menu", { name: "Уведомления" });
  }

  async markAllRead(): Promise<void> {
    const menu = await this.openNotifications();
    await menu.getByText("Прочитать всё").click();
  }

  // --- Меню пользователя ---

  get userMenuButton(): Locator {
    return this.page.getByRole("button", { name: "Меню пользователя" });
  }

  async logout(): Promise<void> {
    await this.userMenuButton.click();
    await this.page.getByRole("menuitem", { name: "Выйти" }).click();
  }

  /** Блок контента по id (якоря скроллят к [data-block-id], не к id="block-…") */
  block(blockId: string): Locator {
    return this.page.locator(`[data-block-id="${blockId}"]`);
  }
}
