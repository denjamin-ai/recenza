import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Редактор Variant B + SubmitSheet (Фазы 6/9).
 * Гоча: гидрация ~1–2 с — первый клик «Отправить на ревью →» может потеряться,
 * поэтому открытие шторки ретраится (MCP-FINDINGS §4).
 */
export class EditorPage {
  constructor(readonly page: Page) {}

  async goto(blogSlug: string, chapterSlug: string): Promise<void> {
    await this.page.goto(`/author/blog/${blogSlug}/${chapterSlug}/edit`);
  }

  get titleInput(): Locator {
    return this.page.getByRole("textbox", { name: "Заголовок главы" });
  }

  /** Блок по accessible name типа («Параграф», «Заголовок 2», …). Заголовки — INPUT, прочее — TEXTAREA. */
  blockInput(typeName: string, nth = 0): Locator {
    return this.page.getByRole("textbox", { name: typeName }).nth(nth);
  }

  get saveButton(): Locator {
    return this.page.getByRole("button", { name: "Сохранить" });
  }

  /** Индикатор состояния: «нет изменений» / «не сохранено» / «сохранено» (тостов нет). */
  saveIndicator(state: "нет изменений" | "не сохранено" | "сохранено"): Locator {
    return this.page.getByText(state, { exact: true });
  }

  async save(): Promise<void> {
    await this.saveButton.click();
    await expect(this.saveIndicator("сохранено")).toBeVisible();
  }

  /** «+ Блок» → меню типов (11 пунктов). */
  async addBlockViaMenu(typeName: string): Promise<void> {
    await this.page.getByRole("button", { name: "Добавить блок" }).click();
    await this.page.getByRole("menuitem", { name: typeName }).click();
  }

  /** Слэш-меню: «/» в пустом блоке → listbox «Вставить блок». */
  async slashInsert(typeName: string, emptyBlock: Locator): Promise<void> {
    await emptyBlock.click();
    await emptyBlock.press("/");
    await this.page.getByRole("listbox", { name: "Вставить блок" }).getByRole("option", { name: typeName }).click();
  }

  get formattingToolbar(): Locator {
    return this.page.getByRole("toolbar", { name: "Форматирование" });
  }

  async openSettings(): Promise<Locator> {
    await this.page.getByRole("button", { name: "Настройки блога" }).click();
    return this.page.getByRole("dialog", { name: "Настройки блога" });
  }

  /** Баннер блокировки under-review/published глав (read-only режим). */
  get lockedBanner(): Locator {
    return this.page.getByText(/редактирование недоступно/);
  }

  // --- SubmitSheet ---

  get submitSheet(): Locator {
    return this.page.getByRole("dialog", { name: "Отправка на ревью" });
  }

  async openSubmitSheet(): Promise<void> {
    await expect(async () => {
      await this.page.getByRole("button", { name: "Отправить на ревью →" }).click();
      await expect(this.submitSheet).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
  }

  /** «Готовность N/7» в шапке шторки. */
  get readinessHeading(): Locator {
    return this.submitSheet.getByRole("heading", { name: /Готовность \d+\/7/ });
  }

  get skillsInput(): Locator {
    return this.submitSheet.getByRole("textbox", { name: "Навыки статьи" });
  }

  async addSkill(skill: string): Promise<void> {
    await this.skillsInput.fill(skill);
    await this.skillsInput.press("Enter");
  }

  async removeSkill(skill: string): Promise<void> {
    await this.submitSheet.getByRole("button", { name: `Удалить «${skill}»` }).click();
  }

  reviewersFilterTab(name: "По навыкам" | "Все"): Locator {
    return this.submitSheet.getByRole("tablist", { name: "Фильтр ревьюеров" }).getByRole("tab", { name });
  }

  get reviewersSearch(): Locator {
    return this.submitSheet.getByRole("searchbox", { name: "Поиск ревьюеров" });
  }

  /** Чекбокс ревьюера — name вида «Имя ★ 4.6»; disabled при занятости «загружен». */
  reviewerCheckbox(nameRe: RegExp): Locator {
    return this.submitSheet.getByRole("checkbox", { name: nameRe });
  }

  async makePrimary(nameRe: RegExp): Promise<void> {
    const row = this.submitSheet.locator("li", { has: this.page.getByRole("checkbox", { name: nameRe }) });
    await row.getByRole("button", { name: /Сделать ведущим|ВЕДУЩИЙ/ }).click();
  }

  /** Футер: «Закройте все пункты» → «Готово к отправке». */
  get readyFooter(): Locator {
    return this.submitSheet.getByText("Готово к отправке");
  }

  /** Отправка: успех = redirect в кабинет блога (тост не успевает). */
  async submit(blogSlug: string): Promise<void> {
    await this.submitSheet.getByRole("button", { name: "Отправить", exact: true }).click();
    await this.page.waitForURL(`**/author/blog/${blogSlug}`);
  }
}
