import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Полноэкранный админ-портал (Фаза 10): навигация, пользователи, жалобы,
 * ревью-очередь, recruit/доска/заявки, баннеры, пожертвования.
 */
export class AdminPage {
  constructor(readonly page: Page) {}

  /** UI-логин админа (пароль — env ADMIN_PASSWORD_PLAIN). Ретрай против потери кликов до гидрации. */
  async loginViaUi(password: string): Promise<void> {
    await this.page.goto("/admin/login");
    await this.page.getByRole("textbox", { name: "Пароль" }).fill(password);
    await expect(async () => {
      await this.page.getByRole("button", { name: "Войти как администратор" }).click();
      await this.page.waitForURL("**/admin/dashboard", { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
  }

  get nav(): Locator {
    return this.page.getByRole("navigation", { name: "Навигация админ-портала" });
  }

  async gotoSection(
    name: "Сводка" | "Жалобы" | "Ревью глав" | "Заявки ревьюеров" | "Пользователи" | "Доска ревьюеров" | "Баннеры" | "Пожертвования",
  ): Promise<void> {
    await this.nav.getByRole("link", { name }).click();
  }

  get exitToBlog(): Locator {
    return this.page.getByRole("button", { name: "Выйти к блогу" });
  }

  // --- Пользователи ---

  /** Поиск срабатывает только по submit (Enter) → ?q=. */
  async searchUser(query: string): Promise<void> {
    const box = this.page.getByRole("searchbox", { name: "Поиск пользователя по нику или имени" });
    await box.fill(query);
    await box.press("Enter");
  }

  async openUserCard(handle: string): Promise<void> {
    await this.page.goto(`/admin/users/${handle}`);
  }

  /** «Заблокировать (бан)» ↔ «Разблокировать» */
  banToggle(): Locator {
    return this.page.getByRole("button", { name: /Заблокировать \(бан\)|Разблокировать/ });
  }

  /** «Запретить комментарии» ↔ «Разрешить комментарии» */
  commentingToggle(): Locator {
    return this.page.getByRole("button", { name: /Запретить комментарии|Разрешить комментарии/ });
  }

  // --- Жалобы ---

  keepContentCloseReport(): Locator {
    return this.page.getByRole("button", { name: "Оставить контент, закрыть жалобу" });
  }

  deleteCommentCloseReport(): Locator {
    return this.page.getByRole("button", { name: "Удалить комментарий и закрыть" });
  }

  // --- Ревью-очередь ---

  /** Force-approve с инлайн-подтверждением «Опубликовать в обход гейта?». */
  async forceApprove(row: Locator): Promise<void> {
    await row.getByRole("button", { name: "Force-approve (опубликовать)" }).click();
    await this.page.getByRole("button", { name: "Да, опубликовать" }).click();
  }

  approvePrimaryChange(): Locator {
    return this.page.getByRole("button", { name: "Утвердить смену" });
  }

  /** Снятие ревьюера: «снять» → «Причина снятия» → «Снять». */
  async removeReviewer(row: Locator, reason: string): Promise<void> {
    await row.getByRole("button", { name: "снять" }).click();
    await this.page.getByLabel("Причина снятия").fill(reason);
    await this.page.getByRole("button", { name: "Снять", exact: true }).click();
  }

  // --- Recruit / доска / заявки ---

  /** Одобрение recruit-запроса: двухшагово, инлайн-форма. Клики ретраятся против потери до гидрации. */
  async approveRecruit(row: Locator, direction: string, note = ""): Promise<void> {
    const dirField = this.page.getByLabel("Направление", { exact: true });
    await expect(async () => {
      await row.getByRole("button", { name: "Одобрить" }).click();
      await expect(dirField).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await dirField.fill(direction);
    if (note) {
      await this.page.getByLabel("Заметка", { exact: true }).fill(note);
    }
    const publish = this.page.getByRole("button", { name: "Опубликовать на доске" });
    await expect(async () => {
      await publish.click();
      await expect(dirField).toBeHidden({ timeout: 3_000 }); // форма закрылась = опубликовано
    }).toPass({ timeout: 20_000 });
  }

  async rejectRecruit(row: Locator, reason: string): Promise<void> {
    await row.getByRole("button", { name: "Отклонить" }).click();
    await this.page.getByLabel("Причина отклонения").fill(reason);
    await this.page.getByRole("button", { name: "Отклонить с причиной" }).click();
  }

  acceptApplication(row: Locator): Locator {
    return row.getByRole("button", { name: "Принять (выдать роль)" });
  }

  // --- Баннеры ---

  async openNewBannerForm(): Promise<void> {
    await this.page.getByRole("button", { name: "+ Новый баннер" }).click();
  }

  bannerField(label: "Заголовок" | "Надзаголовок" | "Текст кнопки" | "Иконка" | "Цель ссылки"): Locator {
    // exact — иначе «Заголовок» матчит и «Надзаголовок» (strict-mode violation).
    return this.page.getByLabel(label, { exact: true });
  }

  bannerSelect(label: "Тон" | "Действие"): Locator {
    return this.page.getByRole("combobox", { name: label });
  }

  /** Действия в строке баннера: «править»/«скрыть»/«показать»/«удалить» (удаление БЕЗ подтверждения). */
  bannerRowAction(row: Locator, action: "править" | "скрыть" | "показать" | "удалить"): Locator {
    return row.getByRole("button", { name: action });
  }

  // --- Пожертвования ---

  get donationsEnabledCheckbox(): Locator {
    return this.page.getByRole("checkbox", { name: "Включить пожертвования" });
  }
}
