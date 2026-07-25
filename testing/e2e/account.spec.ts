// WS-* / SET-* / PROF-* — приватные страницы аккаунта и единый публичный профиль (Фаза 13.5–13.7).
//
// Проверяет то, чего до Ф13 не существовало: «Рабочее место», «Настройки» (до фазы имя/био/ссылки
// не редактировались НИГДЕ — З-38) и профиль у аккаунта без возможностей (до фазы — 404).
//
// Мутирует профиль `duo` (имя/био/ссылки) → serial + reseed в beforeAll И afterAll: без afterAll
// срез `--grep @smoke` унёс бы изменённое имя в соседние спеки.

import { test, expect } from "./fixtures";
import { apiLoginUser } from "./helpers/auth";
import { BLOG, CHAPTERS, DUO_BLOG, USERS } from "./helpers/seed";
import { reseed } from "./helpers/db";
import { throttleMutation } from "./helpers/throttle";

test.describe("Аккаунт: рабочее место, настройки, профиль (Фаза 13)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    reseed();
  });
  test.afterAll(() => {
    reseed();
  });

  // ── Рабочее место (13.6) ───────────────────────────────────────────────────

  test("WS-01 @smoke @critical: /workspace — гостю 307, читателю пустое состояние, duo две карточки", async ({
    api,
    asReader,
  }) => {
    await test.step("гость → 307 на /login", async () => {
      const guest = await api();
      const res = await guest.get("/workspace", { maxRedirects: 0 });
      expect(res.status()).toBe(307);
    });

    await test.step("читатель без возможностей: пустое состояние, кабинетов нет", async () => {
      await asReader.goto("/workspace");
      await expect(asReader.page.getByRole("heading", { level: 1, name: "Рабочее место" })).toBeVisible();
      await expect(asReader.page.getByText("Пока нет кабинетов")).toBeVisible();
      await expect(asReader.page.getByText(/Их выдаёт\s+администратор/)).toBeVisible();
      await expect(asReader.page.getByRole("link", { name: /Кабинет автора/ })).toHaveCount(0);
      // Подвал «Аккаунт» есть у всех.
      await expect(asReader.page.getByRole("link", { name: "Закладки" })).toBeVisible();
      await expect(asReader.page.getByRole("link", { name: "Настройки" })).toBeVisible();
    });

    await test.step("страница приватная: noindex", async () => {
      const ctx = await apiLoginUser(USERS.reader.handle);
      try {
        const html = await (await ctx.get("/workspace")).text();
        expect(html).toContain("noindex");
      } finally {
        await ctx.dispose();
      }
    });
  });

  test("WS-02 @critical: аккаунт с ОБЕИМИ возможностями видит два кабинета", async ({ loginAs }) => {
    // Флагманский сценарий фазы: до Ф13 роли были взаимоисключающими.
    const duo = await loginAs(USERS.duo.handle);
    await duo.goto("/workspace");
    await expect(duo.page.getByRole("link", { name: /Кабинет автора/ })).toBeVisible();
    await expect(duo.page.getByRole("link", { name: /Кабинет ревьюера/ })).toBeVisible();
    await expect(duo.page.getByText("Пока нет кабинетов")).toHaveCount(0);
    // Кросс-ролевой блок присутствует (у duo дел нет → «всё чисто»).
    await expect(duo.page.getByText("Требует внимания")).toBeVisible();
  });

  // ── Настройки (13.7) ───────────────────────────────────────────────────────

  test("SET-01 @critical: /settings сохраняет имя/био/ссылки; изменения видны в профиле", async ({
    loginAs,
  }) => {
    const NEW_NAME = "Дуня Обновлённая";
    const NEW_BIO = "Пишу и рецензирую, обновлено e2e.";
    const duo = await loginAs(USERS.duo.handle);

    await test.step("форма сохраняет имя и био", async () => {
      await duo.goto("/settings");
      await expect(duo.page.getByRole("heading", { level: 1, name: "Настройки" })).toBeVisible();
      await duo.page.getByLabel("Имя").fill(NEW_NAME);
      await duo.page.getByLabel("О себе").fill(NEW_BIO);
      await throttleMutation(USERS.duo.handle);
      await duo.page.getByRole("button", { name: "Сохранить" }).click();
      await expect(duo.page.getByRole("status").filter({ hasText: "Сохранено" })).toBeVisible();
    });

    await test.step("новое имя и био видны в публичном профиле", async () => {
      await duo.goto(`/u/${USERS.duo.slug}`);
      await expect(duo.page.getByRole("heading", { level: 1, name: NEW_NAME })).toBeVisible();
      await expect(duo.page.getByText(NEW_BIO)).toBeVisible();
    });

    await test.step("компетенции доступны ревьюеру и НЕ доступны читателю", async () => {
      await duo.goto("/settings");
      await expect(duo.page.getByLabel(/Компетенции/)).toBeVisible();

      const reader = await apiLoginUser(USERS.reader.handle);
      try {
        await throttleMutation(USERS.reader.handle);
        const res = await reader.patch("/api/profile", { data: { competencies: ["Взлом"] } });
        expect(res.status()).toBe(403);
      } finally {
        await reader.dispose();
      }
    });
  });

  test("SET-02 @critical: PATCH /api/profile — гость 401, эскалация невозможна, валидация ссылок", async ({
    api,
  }) => {
    await test.step("гость → 401", async () => {
      const guest = await api();
      const res = await guest.patch("/api/profile", { data: { displayName: "Хакер" } });
      expect(res.status()).toBe(401);
    });

    await test.step("возможности и роль через этот роут не выдаются", async () => {
      const ctx = await apiLoginUser(USERS.reader.handle);
      try {
        await throttleMutation(USERS.reader.handle);
        // displayName оставляем прежним (сид-значение) — спека не должна менять имя читателя
        // для соседних шагов; проверяем именно то, что лишние поля не применяются.
        const res = await ctx.patch("/api/profile", {
          data: { displayName: "Рина Читатель", canAuthor: true, isReviewer: true, role: "admin" },
        });
        expect(res.status()).toBe(200); // displayName принят, лишние поля молча отброшены
        const me = (await (await ctx.get("/api/auth/user")).json()) as {
          user: { canAuthor: boolean; isReviewer: boolean };
        };
        expect(me.user.canAuthor).toBe(false);
        expect(me.user.isReviewer).toBe(false);
      } finally {
        await ctx.dispose();
      }
    });

    await test.step("ссылка не http(s) и «https://» без хоста отклоняются с 400", async () => {
      const ctx = await apiLoginUser(USERS.reader.handle);
      try {
        await throttleMutation(USERS.reader.handle);
        const xss = await ctx.patch("/api/profile", {
          data: { links: [{ label: "x", url: "javascript:alert(1)" }] },
        });
        expect(xss.status()).toBe(400);

        // Префикс проходит регулярку, но хоста нет — должен быть 400, не 500.
        await throttleMutation(USERS.reader.handle);
        const noHost = await ctx.patch("/api/profile", { data: { links: [{ url: "https://" }] } });
        expect(noHost.status()).toBe(400);
      } finally {
        await ctx.dispose();
      }
    });
  });

  // ── Единый профиль (13.5) ──────────────────────────────────────────────────

  test("PROF-01 @critical: профиль есть у аккаунта БЕЗ возможностей, но с noindex", async ({
    api,
  }) => {
    const guest = await api();

    await test.step("у читателя профиль открывается (до Ф13 был 404)", async () => {
      const res = await guest.get(`/u/${USERS.reader.slug}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toContain("Рина Читатель");
      // «Пустой» профиль (нет публикаций и ревью) — вне поиска (З-47).
      expect(html).toContain("noindex");
      // Табов «Блоги»/«Ревью» у него нет — только «О себе».
      expect(html).not.toContain("Отрецензировано");
    });

    await test.step("профиль автора индексируется (noindex нет)", async () => {
      const res = await guest.get(`/u/${USERS.author.slug}`);
      expect(res.status()).toBe(200);
      expect(await res.text()).not.toContain("noindex");
    });

    await test.step("заблокированный аккаунт по-прежнему 404", async () => {
      const res = await guest.get(`/u/${USERS.ghost.slug}`, { maxRedirects: 0 });
      expect(res.status()).toBe(404);
    });

    await test.step("sitemap не содержит пустых профилей", async () => {
      const xml = await (await guest.get("/sitemap.xml")).text();
      expect(xml).toContain(`/u/${USERS.author.slug}`);
      expect(xml).not.toContain(`/u/${USERS.reader.slug}`);
    });
  });

  test("PROF-03 @critical: профиль аккаунта с ОБЕИМИ возможностями показывает и блоги, и ревью", async ({
    asGuest,
  }) => {
    // Флагманский сценарий фазы: до Ф13 профиль был либо авторским, либо ревьюерским.
    await asGuest.goto(`/u/${USERS.duo.slug}`);
    const { page } = asGuest;

    await expect(page.getByText("Автор", { exact: true })).toBeVisible();
    await expect(page.getByText("Ревьюер", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Блоги/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Ревью/ })).toBeVisible();
    // Обе группы метрик в шапке одновременно.
    await expect(page.getByText("Отрецензировано", { exact: true })).toBeVisible();
    await expect(page.getByText("Блог", { exact: true })).toBeVisible();

    await test.step("панель блогов есть в разметке даже до клика (SEO/без JS)", async () => {
      const html = await page.content();
      expect(html).toContain(DUO_BLOG.title);
    });
  });

  // ── Отзыв авторства прячет блоги (решение владельца) ───────────────────────

  test("CAP-01 @critical: снятие «вести блоги» прячет блоги автора отовсюду; возврат — восстанавливает", async ({
    api,
  }) => {
    const admin = await api("admin");
    const guest = await api();
    const chapterUrl = `/blog/${BLOG.slug}/${CHAPTERS.published.slug}`;

    await test.step("исходно блог автора виден гостю и лежит в sitemap", async () => {
      expect((await guest.get(chapterUrl, { maxRedirects: 0 })).status()).toBe(200);
      expect(await (await guest.get("/sitemap.xml")).text()).toContain(BLOG.slug);
    });

    await test.step("админ снимает возможность «автор»", async () => {
      await expect(async () => {
        const res = await admin.patch(`/api/admin/users/${USERS.author.handle}`, {
          data: { canAuthor: false },
        });
        expect(res.status()).toBe(200);
      }).toPass({ timeout: 10_000 });
    });

    await test.step("блоги скрыты: каталог, прямая ссылка, sitemap, профиль", async () => {
      // Прямая ссылка — 404, а не просто пропажа из каталога.
      expect((await guest.get(chapterUrl, { maxRedirects: 0 })).status()).toBe(404);
      expect((await guest.get(`/blog/${BLOG.slug}`, { maxRedirects: 0 })).status()).toBe(404);

      const catalog = await (await guest.get("/?view=all")).text();
      expect(catalog).not.toContain(BLOG.title);

      const sitemap = await (await guest.get("/sitemap.xml")).text();
      expect(sitemap).not.toContain(BLOG.slug);

      // Профиль остаётся (аккаунт не забанен), но без таба «Блоги».
      const profile = await guest.get(`/u/${USERS.author.slug}`);
      expect(profile.status()).toBe(200);
      expect(await profile.text()).not.toContain('id="profile-tab-blogs"');
    });

    await test.step("комментировать скрытую главу нельзя — цель не резолвится", async () => {
      const reader = await apiLoginUser(USERS.reader.handle);
      try {
        await throttleMutation(USERS.reader.handle);
        const res = await reader.post("/api/comments", {
          data: { blogSlug: BLOG.slug, chapterSlug: CHAPTERS.published.slug, text: "после скрытия" },
        });
        expect(res.status()).toBe(404);
      } finally {
        await reader.dispose();
      }
    });

    await test.step("возврат возможности возвращает блоги как были (данные не мутировались)", async () => {
      await expect(async () => {
        const res = await admin.patch(`/api/admin/users/${USERS.author.handle}`, {
          data: { canAuthor: true },
        });
        expect(res.status()).toBe(200);
      }).toPass({ timeout: 10_000 });

      expect((await guest.get(chapterUrl, { maxRedirects: 0 })).status()).toBe(200);
      expect(await (await guest.get("/sitemap.xml")).text()).toContain(BLOG.slug);
    });
  });

  test("CAP-02 @critical: новый аккаунт по умолчанию МОЖЕТ вести блоги", async ({ api }) => {
    const admin = await api("admin");
    const handle = "e2e_default_author";
    const password = "e2e-password-12";

    await expect(async () => {
      // Возможности в теле НЕ передаём — проверяем именно дефолт.
      const res = await admin.post("/api/admin/users", {
        data: { handle, displayName: "Дефолтный Автор", password },
      });
      expect(res.status()).toBe(201);
    }).toPass({ timeout: 10_000 });

    const ctx = await apiLoginUser(handle, password);
    try {
      const me = (await (await ctx.get("/api/auth/user")).json()) as {
        user: { canAuthor: boolean; isReviewer: boolean };
      };
      expect(me.user.canAuthor).toBe(true);
      // Ревьюерство по-прежнему выдаётся явно.
      expect(me.user.isReviewer).toBe(false);

      await throttleMutation(handle);
      const blog = await ctx.post("/api/author/blogs", { data: { title: "Блог по умолчанию" } });
      expect(blog.status()).toBe(200);
    } finally {
      await ctx.dispose();
    }
  });

  test("PROF-02 @critical: на своём профиле есть «Изменить профиль», на чужом — нет", async ({
    asReader,
    asGuest,
  }) => {
    await asReader.goto(`/u/${USERS.reader.slug}`);
    // ⚠️ Реверс uif-6 П3: кнопка редактирования вернулась на свой профиль.
    await expect(asReader.page.getByRole("button", { name: "Изменить профиль" })).toBeVisible();

    await asGuest.goto(`/u/${USERS.author.slug}`);
    await expect(asGuest.page.getByRole("button", { name: "Изменить профиль" })).toHaveCount(0);
  });
});
