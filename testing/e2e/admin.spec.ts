// TC-ADMIN — админ-портал (Фаза 11.3): логин/логаут, полноэкранный shell, дашборд,
// модерация пользователей, жалобы, ревью-очередь (смена ведущего / force-approve / снятие
// ревьюера), recruit/заявки, баннеры, пожертвования + негативные инварианты доступа.
//
// Файл МУТИРУЕТ seed-состояние (публикация chp_under_review, разбор pcr_1/rec_pending/app_user,
// rpt_1 и т.д.) → serial + reseed() в beforeAll И afterAll (admin.spec идёт первым по алфавиту —
// восстанавливаем baseline для следующих файлов).
//
// Отступления от TC-дока (обоснование — MCP-FINDINGS и исходники):
// • TC-ADMIN-10 выполняется ДО TC-ADMIN-09: после force-approve глава уходит из очереди и
//   pcr_1 разобрать негде (баг №2 MCP-FINDINGS §6) — в обратном порядке оба кейса проверяют
//   рабочее поведение, а не сломанное.
// • TC-ADMIN-06: «блог появился в каталоге» недостижимо на seed — blog_ghost не имеет
//   published-глав, а каталог/страница блога требуют ≥1 (src/app/(reader)/blog/[slug]/page.tsx:46).
//   Эффект разбана проверяется через возможность входа ghost + self-heal сессии после бана.
// • TC-ADMIN-17: серверная валидация проверяется через api("admin"), а не через UI-форму —
//   браузерный fetch с 400 пишет «Failed to load resource» в консоль и роняет console-guard.

import type { APIResponse, Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { AdminPage } from "./pages/admin.page";
import { ReaderPage } from "./pages/reader.page";
import { apiLoginUser, newApiContext, uniqueXff } from "./helpers/auth";
import { reseed } from "./helpers/db";
import { BANNER_TEXTS, BANNERS, BASE_URL, BLOG, CHAPTERS, HIDDEN_BLOG, PASSWORD, USERS } from "./helpers/seed";
import { throttleMutation } from "./helpers/throttle";

test.describe.configure({ mode: "serial" });

/** pathname из Location-заголовка (Next отдаёт и относительные, и абсолютные URL). */
function locationPath(res: APIResponse): string {
  return new URL(res.headers()["location"] ?? "", BASE_URL).pathname;
}

/** Карточка главы в очереди /admin/review (Card = <section>, внутри — ссылка с названием главы). */
function reviewCard(page: Page, chapterTitle: string): Locator {
  return page.locator("section").filter({ has: page.getByRole("link", { name: chapterTitle }) });
}

/** Pending-строка recruit-запроса «Генераторы и итераторы» на /admin/recruit (есть кнопка «Одобрить»). */
function pendingRecruitRow(page: Page): Locator {
  return page
    .locator("li")
    .filter({ has: page.getByRole("button", { name: "Одобрить" }) })
    .filter({ hasText: "Генераторы и итераторы" });
}

test.describe("TC-ADMIN — админка, модерация и монетизация", () => {
  test.beforeAll(() => {
    reseed();
  });

  test.afterAll(() => {
    // Restoring baseline: следующие спеки получают чистый детерминированный seed.
    reseed();
  });

  test("TC-ADMIN-01 (SMK-13) @smoke: вход через /admin/login, полноэкранный портал, «Выйти к блогу» гасит сессию", async ({ asGuest }) => {
    const password = process.env.ADMIN_PASSWORD_PLAIN;
    if (!password) {
      throw new Error("ADMIN_PASSWORD_PLAIN не задан — проверь .env.test (его читает playwright.config.ts)");
    }
    const admin = new AdminPage(asGuest.page);

    await test.step("Страница /admin/login и вход администратора", async () => {
      await asGuest.goto("/admin/login");
      await expect(asGuest.page.getByRole("heading", { name: "Вход администратора" })).toBeVisible();
      await admin.loginViaUi(password);
      await expect(asGuest.page.getByRole("heading", { name: "Сводка" })).toBeVisible();
    });

    await test.step("Полноэкранность: шапки сайта нет", async () => {
      // Логотип-ссылка «Recenza» и «Меню пользователя» — элементы публичной шапки, в портале их нет.
      await expect(asGuest.page.getByRole("link", { name: "Recenza" })).toHaveCount(0);
      await expect(asGuest.page.getByRole("button", { name: "Меню пользователя" })).toHaveCount(0);
    });

    await test.step("Навигация портала: все разделы на месте", async () => {
      for (const name of ["Сводка", "Жалобы", "Ревью глав", "Заявки ревьюеров", "Пользователи", "Баннеры", "Пожертвования"] as const) {
        await expect(admin.nav.getByRole("link", { name, exact: true })).toBeVisible();
      }
    });

    await test.step("«Выйти к блогу»: сессия погашена, /admin/dashboard → 307 на /admin/login", async () => {
      await admin.exitToBlog.click();
      await asGuest.page.waitForURL((url) => url.pathname === "/");
      // context.request шарит cookie контекста — cookie admin-сессии уже уничтожена.
      const res = await asGuest.context.request.get("/admin/dashboard", { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(locationPath(res)).toBe("/admin/login");
    });
  });

  test("TC-ADMIN-03 @regression: дашборд — KPI-плитки и «Требует внимания»; /admin → 307 на /admin/dashboard", async ({ asAdmin, api }) => {
    await asAdmin.goto("/admin/dashboard");
    const main = asAdmin.page.locator("#admin-main");

    await test.step("KPI-секции видны (без exact-count: состояние аддитивно)", async () => {
      for (const label of [
        "Открытые жалобы",
        "Главы на ревью",
        "Смена ведущего",
        "Запросы подбора",
        "Заявки ревьюеров",
        "Заблокированные",
        "Пользователи",
        "Направления на доске",
      ] as const) {
        await expect(main.getByText(label, { exact: true })).toBeVisible();
      }
      await expect(main.getByText("Требует внимания")).toBeVisible();
    });

    await test.step("/admin → 307 на /admin/dashboard", async () => {
      const ctx = await api("admin");
      const res = await ctx.get("/admin", { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(locationPath(res)).toBe("/admin/dashboard");
    });
  });

  test("TC-ADMIN-04+05 @critical: поиск «troll» и тумблер комментирования — POST /api/comments 2xx ↔ 403", async ({ asAdmin }) => {
    const admin = new AdminPage(asAdmin.page);
    const commentBody = {
      blogSlug: BLOG.slug,
      chapterSlug: CHAPTERS.published.slug,
      text: "Проверка гейта комментирования (автотест TC-ADMIN-05).",
    };

    await test.step("Поиск «troll» из топбара → карточка troll", async () => {
      await asAdmin.goto("/admin/users");
      await admin.searchUser("troll");
      await asAdmin.page.waitForURL(/\/admin\/users\?q=troll/);
      await expect(asAdmin.page.getByRole("link", { name: "Тролль Заблокированный" })).toBeVisible();
      await expect(asAdmin.page.getByRole("link", { name: "Антон Автор" })).toHaveCount(0);
    });

    const trollApi = await apiLoginUser(USERS.troll.handle);
    try {
      await test.step("«Разрешить комментарии» → troll публикует комментарий (2xx)", async () => {
        await admin.openUserCard(USERS.troll.handle);
        await expect(asAdmin.page.getByText("Комментарии запрещены", { exact: true })).toBeVisible();
        await asAdmin.page.getByRole("button", { name: "Разрешить комментарии" }).click();
        await expect(asAdmin.page.getByRole("button", { name: "Запретить комментарии" })).toBeVisible();

        await throttleMutation(USERS.troll.handle);
        const res = await trollApi.post("/api/comments", { data: commentBody });
        expect(res.ok()).toBeTruthy();
      });

      await test.step("«Запретить комментарии» назад → POST 403 «Комментирование ограничено.»", async () => {
        await asAdmin.page.getByRole("button", { name: "Запретить комментарии" }).click();
        await expect(asAdmin.page.getByRole("button", { name: "Разрешить комментарии" })).toBeVisible();

        await throttleMutation(USERS.troll.handle);
        const res = await trollApi.post("/api/comments", { data: commentBody });
        expect(res.status()).toBe(403);
        expect(((await res.json()) as { error: string }).error).toBe("Комментирование ограничено.");
      });
    } finally {
      await trollApi.dispose();
    }
  });

  test("TC-ADMIN-06 @critical: разбан/бан ghost — вход становится возможен, живая сессия гаснет (self-heal), бан — soft", async ({ asAdmin, api }, testInfo) => {
    const admin = new AdminPage(asAdmin.page);
    const guestApi = await api();
    // Неудачный логин заблокированного считается в login-rate-limit (5/15 мин) → уникальный XFF.
    const ghostApi = await newApiContext(undefined, { "x-forwarded-for": uniqueXff(testInfo) });

    try {
      await test.step("Пока забанен: блог скрыт (404), вход отклонён (401)", async () => {
        const blog = await guestApi.get(`/blog/${HIDDEN_BLOG.slug}`);
        expect(blog.status()).toBe(404);
        const login = await ghostApi.post("/api/auth/user", {
          data: { handle: USERS.ghost.handle, password: PASSWORD },
        });
        expect(login.status()).toBe(401);
      });

      await test.step("«Разблокировать» на карточке ghost", async () => {
        await admin.openUserCard(USERS.ghost.handle);
        await expect(asAdmin.page.getByText("Заблокирован", { exact: true })).toBeVisible();
        await asAdmin.page.getByRole("button", { name: "Разблокировать" }).click();
        await expect(asAdmin.page.getByRole("button", { name: "Заблокировать (бан)" })).toBeVisible();
      });

      await test.step("После разбана вход ghost успешен", async () => {
        const login = await ghostApi.post("/api/auth/user", {
          data: { handle: USERS.ghost.handle, password: PASSWORD },
        });
        expect(login.ok()).toBeTruthy();
      });

      await test.step("«Заблокировать (бан)» назад: живая сессия гаснет, запись пользователя остаётся", async () => {
        await asAdmin.page.getByRole("button", { name: "Заблокировать (бан)" }).click();
        await expect(asAdmin.page.getByRole("button", { name: "Разблокировать" })).toBeVisible();

        // self-heal getCurrentUser: сессия заблокированного гаснет → user: null
        const me = await ghostApi.get("/api/auth/user");
        expect(me.ok()).toBeTruthy();
        expect(((await me.json()) as { user: unknown }).user).toBeNull();

        // Read-side снова закрыт, но soft-бан: пользователь остаётся в списке
        const blog = await guestApi.get(`/blog/${HIDDEN_BLOG.slug}`);
        expect(blog.status()).toBe(404);
        await asAdmin.goto("/admin/users?q=ghost");
        await expect(asAdmin.page.getByRole("link", { name: "Гость Призрак" })).toBeVisible();
      });
    } finally {
      await ghostApi.dispose();
    }
  });

  test("TC-ADMIN-07 @regression: у пользователя с ревью-историей нет кнопки удаления — только soft-инструменты", async ({ asAdmin }) => {
    const admin = new AdminPage(asAdmin.page);
    await admin.openUserCard(USERS.reviewer.handle);

    // Доступные инструменты — только soft-модерация
    await expect(asAdmin.page.getByRole("button", { name: "Заблокировать (бан)" })).toBeVisible();
    await expect(asAdmin.page.getByRole("button", { name: "Запретить комментарии" })).toBeVisible();
    await expect(asAdmin.page.getByText("Ёмкость ревью:")).toBeVisible();
    await expect(asAdmin.page.getByRole("button", { name: "Уменьшить ёмкость" })).toBeVisible();

    // Hard-delete отсутствует как класс (FK ревью-таблиц на users.handle)
    await expect(asAdmin.page.getByRole("button", { name: /удалить/i })).toHaveCount(0);
  });

  test("TC-ADMIN-08 @critical: жалоба rpt_1 — «Оставить контент, закрыть жалобу» убирает её из открытых", async ({ asAdmin }) => {
    const admin = new AdminPage(asAdmin.page);

    await test.step("Открыть карточку жалобы из списка", async () => {
      await asAdmin.goto("/admin/reports");
      await asAdmin.page.getByRole("link", { name: /Спам в комментариях/ }).click();
      await asAdmin.page.waitForURL(/\/admin\/reports\/rpt_1/);
      await expect(asAdmin.page.getByText("На рассмотрении", { exact: true })).toBeVisible();
      // Цель — soft-deleted комментарий → цитата «[удалён]», ветки «Удалить комментарий и закрыть» нет
      await expect(asAdmin.page.getByText("[удалён]")).toBeVisible();
      await expect(admin.deleteCommentCloseReport()).toHaveCount(0);
    });

    await test.step("«Оставить контент, закрыть жалобу» → редирект в список, открытых нет", async () => {
      await admin.keepContentCloseReport().click();
      await asAdmin.page.waitForURL((url) => url.pathname === "/admin/reports");
      await expect(asAdmin.page.getByText("Открытых жалоб нет.")).toBeVisible();
    });

    await test.step("Повторное открытие rpt_1 — «Закрыта», повторный разбор недоступен", async () => {
      await asAdmin.goto("/admin/reports/rpt_1");
      await expect(asAdmin.page.getByText("Закрыта", { exact: true })).toBeVisible();
      await expect(asAdmin.page.getByText("Жалоба закрыта.")).toBeVisible();
      await expect(admin.keepContentCloseReport()).toHaveCount(0);
    });
  });

  // ⚠️ Выполняется ДО TC-ADMIN-09: после force-approve глава уходит из очереди и pcr_1
  // разобрать через UI негде (баг №2 MCP-FINDINGS §6).
  test("TC-ADMIN-10 @regression: «Утвердить смену» по pcr_1 — чип «ведущий» переходит к lena_review", async ({ asAdmin }) => {
    const admin = new AdminPage(asAdmin.page);
    await asAdmin.goto("/admin/review");
    const card = reviewCard(asAdmin.page, CHAPTERS.underReview.title);

    await test.step("Запрос pcr_1 виден на карточке главы", async () => {
      await expect(card.getByText("Запрос смены ведущего: @reviewer → @lena_review")).toBeVisible();
    });

    await test.step("«Утвердить смену» → блок исчезает, ведущий — Лена Базы", async () => {
      await admin.approvePrimaryChange().click();
      await expect(asAdmin.page.getByText("Запрос смены ведущего")).toHaveCount(0);

      const lenaRow = card.locator("li").filter({ hasText: "Лена Базы" });
      await expect(lenaRow.getByText("ведущий", { exact: true })).toBeVisible();
      const raisaRow = card.locator("li").filter({ hasText: "Раиса Ревьюер" });
      await expect(raisaRow.getByText("ведущий", { exact: true })).toHaveCount(0);
    });
  });

  test("TC-ADMIN-09 @critical: force-approve «Промисы изнутри» — публикация в обход гейта, глава видна гостю", async ({ asAdmin, asGuest }) => {
    const admin = new AdminPage(asAdmin.page);
    await asAdmin.goto("/admin/review");
    const card = reviewCard(asAdmin.page, CHAPTERS.underReview.title);

    await test.step("«Отмена» в инлайн-подтверждении не публикует", async () => {
      await card.getByRole("button", { name: "Force-approve (опубликовать)" }).click();
      await expect(asAdmin.page.getByText("Опубликовать в обход гейта?")).toBeVisible();
      await asAdmin.page.getByRole("button", { name: "Отмена" }).click();
      await expect(asAdmin.page.getByText("Опубликовать в обход гейта?")).toHaveCount(0);
      await expect(card).toHaveCount(1);
    });

    await test.step("Force-approve → глава уходит из активной очереди", async () => {
      await admin.forceApprove(card);
      await expect(card).toHaveCount(0);
    });

    await test.step("Гость открывает опубликованную главу в ридере", async () => {
      await asGuest.goto(`/blog/${BLOG.slug}/${CHAPTERS.underReview.slug}`);
      await expect(
        asGuest.page.getByRole("heading", { name: CHAPTERS.underReview.title }).first(),
      ).toBeVisible();
    });
  });

  test("TC-ADMIN-11 @regression: снятие ревьюера lena_review с «Async/await на практике» с причиной", async ({ asAdmin }) => {
    const admin = new AdminPage(asAdmin.page);
    await asAdmin.goto("/admin/review");
    const card = reviewCard(asAdmin.page, CHAPTERS.changesRequested.title);
    const lenaRow = card.locator("li").filter({ hasText: "Лена Базы" });
    await expect(lenaRow).toBeVisible();

    await admin.removeReviewer(lenaRow, "конфликт интересов");

    // Команда обновилась: Лена снята, Раиса осталась.
    await expect(card.getByText("Лена Базы")).toHaveCount(0);
    await expect(card.getByText("Раиса Ревьюер")).toBeVisible();
    // Фаза 12 (P1-фикс бага №3): снят ведущий → primary детерминированно переходит к оставшемуся.
    await expect(
      card.locator("li").filter({ hasText: "Раиса Ревьюер" }).getByText("ведущий", { exact: true }),
    ).toBeVisible();
  });

  test("TC-ADMIN-12+13 @regression: recruit-запрос — «Одобрить» публикует направление на /board; «Отклонить с причиной» disabled без причины", async ({ asAdmin, asGuest, api }) => {
    const admin = new AdminPage(asAdmin.page);

    await test.step("Одобрить rec_pending → направление в списке доски", async () => {
      await asAdmin.goto("/admin/recruit");
      const row = pendingRecruitRow(asAdmin.page);
      await expect(row).toBeVisible();
      await admin.approveRecruit(row, "Тестовое направление", "Ищем ревьюера по итераторам");
      await expect(asAdmin.page.getByText("Нет запросов на рассмотрении.")).toBeVisible();
      await expect(asAdmin.page.getByText("Тестовое направление")).toBeVisible();
    });

    await test.step("Гость видит направление на публичной доске /board", async () => {
      await asGuest.goto("/board");
      await expect(asGuest.page.getByRole("heading", { name: "Тестовое направление" })).toBeVisible();
    });

    await test.step("Новый запрос автора (API) → «Отклонить с причиной» disabled без причины", async () => {
      // rec_pending уже разобран → дедуп pending на (главу, автора) не мешает создать свежий запрос.
      const authorApi = await api("author");
      await throttleMutation(USERS.author.handle);
      const created = await authorApi.post("/api/author/recruit-requests", {
        data: { chapterId: CHAPTERS.draft.id, skills: ["Генераторы", "Итераторы"] },
      });
      expect(created.ok()).toBeTruthy();

      await asAdmin.goto("/admin/recruit");
      const row = pendingRecruitRow(asAdmin.page);
      await row.getByRole("button", { name: "Отклонить", exact: true }).click();

      const rejectBtn = asAdmin.page.getByRole("button", { name: "Отклонить с причиной" });
      await expect(rejectBtn).toBeDisabled();
      await asAdmin.page.getByLabel("Причина отклонения").fill("Навыки описаны слишком общо");
      await expect(rejectBtn).toBeEnabled();
      await rejectBtn.click();

      await expect(asAdmin.page.getByText("Нет запросов на рассмотрении.")).toBeVisible();
      // Вердикт с причиной виден в списке разобранных
      await expect(asAdmin.page.getByText("Навыки описаны слишком общо")).toBeVisible();
    });
  });

  test("TC-ADMIN-15 @regression: заявка app_user — «Отклонить»: роль reader не меняется", async ({ asAdmin }) => {
    const admin = new AdminPage(asAdmin.page);

    await test.step("Отклонить pending-заявку reader'а", async () => {
      await asAdmin.goto("/admin/recruit");
      const appRow = asAdmin.page
        .locator("li")
        .filter({ hasText: "Хочу рецензировать статьи по фронтенду." });
      // Кнопка «Принять (выдать роль)» существует, но НЕ нажимается — accept ломает роль reader.
      await expect(admin.acceptApplication(appRow)).toBeVisible();
      await appRow.getByRole("button", { name: "Отклонить", exact: true }).click();

      await expect(asAdmin.page.getByText("Нет новых откликов.")).toBeVisible();
      const resolvedRow = asAdmin.page.locator("li").filter({ hasText: "Рина Читатель" });
      await expect(resolvedRow.getByText("Отклонён", { exact: true })).toBeVisible();
    });

    await test.step("Роль осталась «Читатель», степпера ёмкости нет", async () => {
      await admin.openUserCard(USERS.reader.handle);
      await expect(asAdmin.page.getByText("Читатель", { exact: true })).toBeVisible();
      await expect(asAdmin.page.getByRole("button", { name: "Уменьшить ёмкость" })).toHaveCount(0);
    });
  });

  test("TC-ADMIN-16+17 @critical: баннеры — создание/скрытие/удаление в карусели ленты + серверная валидация target (400)", async ({ asAdmin, asGuest, api }) => {
    const admin = new AdminPage(asAdmin.page);
    const reader = new ReaderPage(asGuest.page);
    const title = "Стань ревьюером-2";
    const row = asAdmin.page.locator("li").filter({ hasText: title });

    await test.step("Создать internal-баннер (Цель /board)", async () => {
      await asAdmin.goto("/admin/banners");
      await admin.openNewBannerForm();
      await admin.bannerField("Заголовок").fill(title);
      await admin.bannerField("Текст кнопки").fill("К доске");
      await admin.bannerSelect("Действие").selectOption("internal");
      await admin.bannerField("Цель ссылки").fill("/board");
      await asAdmin.page.getByRole("button", { name: "Сохранить" }).click();
      await expect(row).toBeVisible();
      await expect(row.getByText("Внутр. ссылка · /board")).toBeVisible();
    });

    await test.step("Гость: баннер в карусели, CTA ведёт на /board", async () => {
      await reader.gotoFeed();
      // Новый баннер добавлен в конец (sort) — фиксируем 4-й слайд точкой (авторотация ~6с);
      // клик ретраим против потери события до гидрации (как в guest.spec TC-GUEST-01).
      await expect(async () => {
        await reader.promo.getByRole("button", { name: "Баннер 4" }).click();
        await expect(reader.promo.getByText(title)).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await asGuest.page.getByRole("button", { name: "К доске" }).click();
      await asGuest.page.waitForURL("**/board");
      await expect(
        asGuest.page.getByRole("heading", { name: "Помогите авторам выпускать качественные статьи" }),
      ).toBeVisible();
    });

    await test.step("«скрыть» → баннер пропал из карусели", async () => {
      await admin.bannerRowAction(row, "скрыть").click();
      await expect(row.getByText("· скрыт")).toBeVisible();
      await expect(admin.bannerRowAction(row, "показать")).toBeVisible();

      await reader.gotoFeed();
      await expect(reader.promo).toBeVisible();
      await expect(reader.promo.getByRole("button", { name: "Баннер 4" })).toHaveCount(0);
      await expect(asGuest.page.getByText(title)).toHaveCount(0);
    });

    await test.step("«удалить» → строка исчезает (без подтверждения)", async () => {
      await admin.bannerRowAction(row, "удалить").click();
      await expect(row).toHaveCount(0);
    });

    await test.step("Валидация target по action — 400 (api, не UI: браузерный 4xx роняет console-guard)", async () => {
      const adminApi = await api("admin");

      const r1 = await adminApi.post("/api/admin/banners", {
        data: { title: "XSS-тест", action: "external", target: "javascript:alert(1)" },
      });
      expect(r1.status()).toBe(400);
      expect(((await r1.json()) as { error: string }).error).toBe("Внешний баннер: укажите http(s)-ссылку.");

      const r2 = await adminApi.post("/api/admin/banners", {
        data: { title: "XSS-тест", action: "internal", target: "https://evil.example.com" },
      });
      expect(r2.status()).toBe(400);
      expect(((await r2.json()) as { error: string }).error).toBe(
        "Внутренний баннер: укажите путь, начинающийся с /.",
      );

      const r3 = await adminApi.post("/api/admin/banners", {
        data: { title: "XSS-тест", action: "donate", coverUrl: "https://evil.example/x.png" },
      });
      expect(r3.status()).toBe(400);
      expect(((await r3.json()) as { error: string }).error).toBe("Обложка: только путь /uploads/.");
    });

    await test.step("Гость: отклонённые баннеры не появились (в карусели только 3 seed-слайда)", async () => {
      await reader.gotoFeed();
      await expect(reader.promo).toBeVisible();
      await expect(reader.promo.getByRole("button", { name: "Баннер 3" })).toBeVisible();
      await expect(reader.promo.getByRole("button", { name: "Баннер 4" })).toHaveCount(0);
    });
  });

  test("TC-ADMIN-18 @regression: тумблер пожертвований — заглушка в DonateModal и возврат к seed", async ({ asAdmin, asGuest }) => {
    const admin = new AdminPage(asAdmin.page);
    const reader = new ReaderPage(asGuest.page);
    const modal = asGuest.page.getByRole("dialog", { name: "Поддержать проект" });

    /** Открыть DonateModal с ленты: donate-баннер — 3-й слайд seed-карусели. */
    async function openDonateModal(): Promise<void> {
      await reader.gotoFeed();
      // Фиксация слайда + открытие модалки ретраятся (авторотация + потеря клика до гидрации).
      await expect(async () => {
        await reader.pinPromoSlide(3);
        await asGuest.page.getByRole("button", { name: "Поддержать", exact: true }).click();
        await expect(modal).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
    }

    await test.step("Снять «Включить пожертвования»", async () => {
      await asAdmin.goto("/admin/donation");
      await expect(admin.donationsEnabledCheckbox).toBeChecked();
      await admin.donationsEnabledCheckbox.click();
      await expect(admin.donationsEnabledCheckbox).not.toBeChecked();
    });

    await test.step("Гость (после reload): модалка показывает заглушку", async () => {
      await openDonateModal();
      await expect(modal.getByText("Способы поддержки пока не настроены.")).toBeVisible();
    });

    await test.step("Включить обратно — способы вернулись", async () => {
      await admin.donationsEnabledCheckbox.click();
      await expect(admin.donationsEnabledCheckbox).toBeChecked();

      await openDonateModal();
      await expect(modal.getByRole("link", { name: /DonationAlerts/ })).toBeVisible();
      // QR СБП: seed-плейсхолдер /uploads/donations/sbp-qr.png закоммичен в Фазе 12 — картинка живая.
      await expect(modal.getByAltText("QR-код: СБП")).toBeAttached();
      await expect(modal.getByText("Способы поддержки пока не настроены.")).toHaveCount(0);
    });
  });

  test("TC-ADMIN-20 @critical: админ ≠ пользователь — POST /api/author/** под админ-сессией → 401 «Требуется вход.»", async ({ api }) => {
    const adminApi = await api("admin");

    await test.step("POST /api/author/blogs → 401", async () => {
      const res = await adminApi.post("/api/author/blogs", { data: { title: "Блог админа" } });
      expect(res.status()).toBe(401);
      expect(((await res.json()) as { error: string }).error).toBe("Требуется вход.");
    });

    await test.step("PUT /api/author/portfolio → 401", async () => {
      const res = await adminApi.put("/api/author/portfolio", { data: {} });
      expect(res.status()).toBe(401);
    });

    await test.step("Страница /author под админ-сессией → 307 на /admin", async () => {
      const res = await adminApi.get("/author", { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(locationPath(res)).toBe("/admin");
    });
  });

  test("TC-ADMIN-23 @critical: «Новый пользователь» — создание reader из формы, вход созданного, дубль handle → 409", async ({
    asAdmin,
    api,
  }) => {
    // Фаза 12 (альфа-модель доступа): self-registration нет, аккаунты выдаёт админ.
    const handle = "e2e_newbie";
    const password = "e2e-password-12";

    await test.step("Форма «Новый пользователь» на /admin/users → статус «создан», строка в таблице", async () => {
      await asAdmin.goto("/admin/users");
      // Клик до гидрации может потеряться — ретраим до раскрытия формы.
      await expect(async () => {
        await asAdmin.page.getByRole("button", { name: "Новый пользователь" }).click();
        await expect(asAdmin.page.getByRole("button", { name: "Создать пользователя" })).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });

      await asAdmin.page.getByRole("textbox", { name: "Хэндл" }).fill(handle);
      await asAdmin.page.getByRole("textbox", { name: "Отображаемое имя" }).fill("Новичок E2E");
      await asAdmin.page.getByRole("textbox", { name: /Пароль/ }).fill(password);
      // exact: «Роль» — подстрока «Пароль…» (getByLabel матчит подстрокой без exact).
      await asAdmin.page.getByLabel("Роль", { exact: true }).selectOption("reader");
      await asAdmin.page.getByRole("button", { name: "Создать пользователя" }).click();

      await expect(asAdmin.page.getByRole("status").filter({ hasText: `@${handle} создан` })).toBeVisible();
      // exact — иначе матчится и статус-сообщение «Пользователь @… создан…».
      await expect(asAdmin.page.getByText(`@${handle}`, { exact: true })).toBeVisible();
    });

    await test.step("Созданный пользователь логинится, роль reader", async () => {
      const ctx = await apiLoginUser(handle, password);
      const me = await ctx.get("/api/auth/user");
      expect(me.ok()).toBeTruthy();
      const body = (await me.json()) as { user: { handle: string; role: string } };
      expect(body.user.handle).toBe(handle);
      expect(body.user.role).toBe("reader");
      await ctx.dispose();
    });

    await test.step("Дубль handle через API → 409; reader на POST /api/admin/users → 403", async () => {
      const adminApi = await api("admin");
      // Создание из формы выше потратило action-limit 1/сек → 429 ретраится (паттерн негативных API).
      await expect(async () => {
        const dup = await adminApi.post("/api/admin/users", {
          data: { handle, displayName: "Дубль", password: "another-pass-12", role: "reader" },
        });
        expect(dup.status()).toBe(409);
      }).toPass({ timeout: 10_000 });

      const readerApi = await api("reader");
      const forbidden = await readerApi.post("/api/admin/users", {
        data: { handle: "sneaky", displayName: "Хакер", password: "hack-pass-123", role: "author" },
      });
      expect(forbidden.status()).toBe(403);
    });
  });

  test("TC-ADMIN-21+22 @critical: /admin/* и /api/admin/* без прав — 307 / 403 / 401", async ({ api }) => {
    const bannerBody = { title: "x", action: "donate" };

    await test.step("reader: GET /admin/users → 307 на /", async () => {
      const readerApi = await api("reader");
      const res = await readerApi.get("/admin/users", { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(locationPath(res)).toBe("/");
    });

    await test.step("reader: POST /api/admin/banners → 403 «Недостаточно прав.»", async () => {
      const readerApi = await api("reader");
      const res = await readerApi.post("/api/admin/banners", { data: bannerBody });
      expect(res.status()).toBe(403);
      expect(((await res.json()) as { error: string }).error).toBe("Недостаточно прав.");
    });

    await test.step("Гость: GET /admin/users → 307 на /admin/login; POST /api/admin/banners → 401", async () => {
      const guestApi = await api();
      const page307 = await guestApi.get("/admin/users", { maxRedirects: 0 });
      expect(page307.status()).toBe(307);
      expect(locationPath(page307)).toBe("/admin/login");

      const res = await guestApi.post("/api/admin/banners", { data: bannerBody });
      expect(res.status()).toBe(401);
      expect(((await res.json()) as { error: string }).error).toBe("Требуется вход.");
    });
  });

  // ── TC-ADMIN-24 — смена пароля пользователю (ui-feedback-3, П7) ─────────────

  test("TC-ADMIN-24 @critical: смена пароля reader — UI «Задать пароль», старый → 401, новый → 200, негативы и гейтинг", async (
    { asAdmin, api },
    testInfo,
  ) => {
    const newPassword = "new-password-e2e";

    await test.step("UI: карточка /admin/users/reader → «Задать пароль» → статус «Пароль обновлён»", async () => {
      await asAdmin.goto(`/admin/users/${USERS.reader.handle}`);
      const input = asAdmin.page.getByRole("textbox", { name: "Новый пароль" });
      // Клик до гидрации может потеряться — идемпотентный ретрай.
      await expect(async () => {
        await input.fill(newPassword);
        await asAdmin.page.getByRole("button", { name: "Задать пароль" }).click();
        await expect(asAdmin.page.getByRole("status").filter({ hasText: "Пароль обновлён" })).toBeVisible({
          timeout: 3_000,
        });
      }).toPass({ timeout: 20_000 });
    });

    await test.step("вход: старый пароль → 401, новый → 200 (уникальный XFF — изоляция login-лимита)", async () => {
      const guest = await newApiContext(undefined, { "x-forwarded-for": uniqueXff(testInfo) });
      const bad = await guest.post("/api/auth/user", { data: { handle: USERS.reader.handle, password: PASSWORD } });
      expect(bad.status()).toBe(401);
      const good = await guest.post("/api/auth/user", { data: { handle: USERS.reader.handle, password: newPassword } });
      expect(good.ok()).toBeTruthy();
      await guest.dispose();
    });

    await test.step("негативы: 7 символов → 400, не-строка → 400, несуществующий handle → 404, reader → 403", async () => {
      const adminApi = await api("admin");
      const short = await adminApi.patch(`/api/admin/users/${USERS.reader.handle}`, { data: { password: "1234567" } });
      expect(short.status()).toBe(400);
      const notString = await adminApi.patch(`/api/admin/users/${USERS.reader.handle}`, { data: { password: 12345678 } });
      expect(notString.status()).toBe(400);
      const missing = await adminApi.patch("/api/admin/users/no_such_user_e2e", { data: { password: "valid-pass-123" } });
      expect(missing.status()).toBe(404);
      const readerApi = await api("reader");
      const forbidden = await readerApi.patch(`/api/admin/users/${USERS.reader.handle}`, {
        data: { password: "valid-pass-123" },
      });
      expect(forbidden.status()).toBe(403);
    });

    await test.step("возвращаем seed-пароль reader (изоляция в пределах файла; afterAll reseed-ит)", async () => {
      const adminApi = await api("admin");
      const res = await adminApi.patch(`/api/admin/users/${USERS.reader.handle}`, { data: { password: PASSWORD } });
      expect(res.ok()).toBeTruthy();
    });
  });

  // ── TC-ADMIN-25 — лимиты текстов баннеров (ui-feedback-3, П3) ───────────────

  test("TC-ADMIN-25 @regression: лимиты баннеров — превышение → 400 (POST и PATCH), граница → ok, maxLength в форме", async ({
    asAdmin,
    api,
  }) => {
    const adminApi = await api("admin");
    const long = (n: number) => "х".repeat(n);

    await test.step("POST: title 91 / eyebrow 41 / cta 31 → 400 с русским сообщением", async () => {
      const t = await adminApi.post("/api/admin/banners", { data: { title: long(91), action: "donate" } });
      expect(t.status()).toBe(400);
      expect(((await t.json()) as { error: string }).error).toContain("до 90");
      const e = await adminApi.post("/api/admin/banners", { data: { title: "ок", eyebrow: long(41), action: "donate" } });
      expect(e.status()).toBe(400);
      expect(((await e.json()) as { error: string }).error).toContain("до 40");
      const c = await adminApi.post("/api/admin/banners", { data: { title: "ок", cta: long(31), action: "donate" } });
      expect(c.status()).toBe(400);
      expect(((await c.json()) as { error: string }).error).toContain("до 30");
    });

    await test.step("PATCH pb_recruit: 91 → 400; ровно 90 → ok; откат исходного title", async () => {
      const over = await adminApi.patch(`/api/admin/banners/${BANNERS.recruit}`, { data: { title: long(91) } });
      expect(over.status()).toBe(400);
      const edge = await adminApi.patch(`/api/admin/banners/${BANNERS.recruit}`, { data: { title: long(90) } });
      expect(edge.ok()).toBeTruthy();
      const restore = await adminApi.patch(`/api/admin/banners/${BANNERS.recruit}`, {
        data: { title: BANNER_TEXTS.recruit.title },
      });
      expect(restore.ok()).toBeTruthy();
    });

    await test.step("UI: инпуты формы несут maxLength (счётчик {len}/{max})", async () => {
      await asAdmin.goto("/admin/banners");
      // exact — «Заголовок» иначе матчится подстрокой и в «Надзаголовок».
      const titleField = asAdmin.page.getByRole("textbox", { name: "Заголовок", exact: true });
      await expect(async () => {
        await asAdmin.page.getByRole("button", { name: "+ Новый баннер" }).click();
        await expect(titleField).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await expect(titleField).toHaveAttribute("maxlength", "90");
      await expect(asAdmin.page.getByRole("textbox", { name: "Надзаголовок" })).toHaveAttribute("maxlength", "40");
      await expect(asAdmin.page.getByRole("textbox", { name: "Текст кнопки" })).toHaveAttribute("maxlength", "30");
    });
  });
});
