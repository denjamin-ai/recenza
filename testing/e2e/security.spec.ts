// SEC-* — сквозные инварианты безопасности (TESTING.md §4 + блок C REGRESSION-SUITE):
// CSRF same-origin, XSS-санитизация блоков, httpOnly-cookie, Unix-seconds в API, закрытая
// энумерация логина и два rate-limit (голоса 1/сек, логин 5/15мин).
//
// Дисциплина файла — read-only / additive / изолировано:
//   - CSRF/энумерация/логин-лимит: мутации отклоняются (403/401/429) → состояние не меняется;
//   - XSS: создаётся песочница-блог + глава (additive, новые сущности, не трогаем seed);
//   - TC-READER-21: troll получает один голос (additive; счётчики точным числом не ассертим);
//   - все rate-limit тесты изолированы уникальным X-Forwarded-For / отдельным userId.
// Файл идёт ПОСЛЕДНИМ по алфавиту, rate-limit тесты — в самом конце файла (in-memory лимит
// reseed НЕ сбрасывает, поэтому уникальный XFF на каждый негативный логин обязателен).
// Локаторы/тексты — testing/mcp/MCP-FINDINGS.md §5; известные баги §6 не ассертим как рабочие.

import { request, type APIRequestContext } from "@playwright/test";
import { test, expect } from "./fixtures";
import { authFile, newApiContext, apiLoginUser, uniqueXff } from "./helpers/auth";
import { BASE_URL, BLOG, CHAPTERS, PASSWORD, USERS } from "./helpers/seed";

test.describe("Безопасность (SEC-*)", () => {
  // ── SEC-CSRF-01 (SMK-14) — мутация без/с чужим Origin → 403 ──────────────────

  test("SEC-CSRF-01 @smoke @critical: мутация читателя без Origin и с чужим Origin → 403 (same-origin CSRF)", async () => {
    // Контексты строим ВРУЧНУЮ (не через api()/newApiContext — они всегда подставляют Origin),
    // чтобы воспроизвести именно отсутствующий/межсайтовый Origin. Cookie читателя — из storageState.
    const noOrigin = await request.newContext({ baseURL: BASE_URL, storageState: authFile("reader") });
    const evilOrigin = await request.newContext({
      baseURL: BASE_URL,
      storageState: authFile("reader"),
      extraHTTPHeaders: { origin: "https://evil.example" },
    });

    try {
      await test.step("POST голоса БЕЗ заголовка Origin → 403 (отсутствует Origin)", async () => {
        const res = await noOrigin.post(`/api/blogs/${BLOG.id}/vote`, {
          data: { value: 1 },
        });
        expect(res.status()).toBe(403);
      });

      await test.step("POST голоса с чужим Origin https://evil.example → 403 (межсайтовый запрос)", async () => {
        const res = await evilOrigin.post(`/api/blogs/${BLOG.id}/vote`, {
          data: { value: 1 },
        });
        expect(res.status()).toBe(403);
      });

      await test.step("POST комментария без Origin → 403, комментарий не создан (CSRF отбивает до записи)", async () => {
        // CSRF-гард — первой строкой роута, до разбора тела: 403 ⇒ строка в БД не появляется.
        const res = await noOrigin.post("/api/comments", {
          data: { blogSlug: BLOG.slug, chapterSlug: CHAPTERS.published.slug, text: "csrf-probe" },
        });
        expect(res.status()).toBe(403);
      });
    } finally {
      await noOrigin.dispose();
      await evilOrigin.dispose();
    }
  });

  // ── SEC-XSS-01 (SMK-15) — <script>/onerror в блоке рендерятся инертно ────────

  test("SEC-XSS-01 @smoke @critical: <script>/onerror в параграфе санитизированы — предпросмотр рендерит инертный текст, alert не срабатывает", async ({
    asAuthor,
    api,
  }) => {
    const { page } = asAuthor;
    const ctx = await api("author");
    const payload = "<script>alert(1)</script><img src=x onerror=alert(2)>";

    // POST /api/author/blogs — единственный create-путь, возвращающий chapterId (нужен для PATCH);
    // per-blog chapters-роут отдаёт только slug. Песочница additive: seed-блог не трогаем.
    const created = await test.step("создать песочницу-блог + главу и вписать XSS-пейлоад в параграф", async () => {
      const blogRes = await ctx.post("/api/author/blogs", { data: { title: `XSS Sandbox ${Date.now()}` } });
      expect(blogRes.ok()).toBeTruthy();
      const blog = (await blogRes.json()) as { blogSlug: string; chapterSlug: string; chapterId: string };

      const patchRes = await ctx.patch(`/api/author/chapters/${blog.chapterId}`, {
        data: { blocks: [{ type: "p", text: payload }] },
      });
      expect(patchRes.ok()).toBeTruthy();
      return blog;
    });

    // Любой alert() (из <script> или из img onerror) поднял бы диалог — ловим и валим тест.
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });

    await test.step("предпросмотр: пейлоад виден как ТЕКСТ (экранирован), нет реальных <script>/<img>, alert не сработал", async () => {
      await page.goto(`/author/blog/${created.blogSlug}/${created.chapterSlug}/preview`);
      const article = page.locator("article");
      // Экранировано: литеральная строка присутствует как текст (React авто-экранирует текст-ноды).
      await expect(article).toContainText("<script>alert(1)</script>");
      // Не распарсено в DOM: ни исполняемого <script>, ни <img> с onerror внутри статьи.
      await expect(article.locator("script")).toHaveCount(0);
      await expect(article.locator("img")).toHaveCount(0);
      // Ни одного alert-диалога за время загрузки/рендера.
      expect(dialogs).toEqual([]);
    });
  });

  // ── SEC-HTTPONLY-01 — blog_session недоступна из document.cookie ─────────────

  test("SEC-HTTPONLY-01 @critical: cookie blog_session — httpOnly, недоступна из document.cookie", async ({
    asReader,
  }) => {
    const { page } = asReader;
    await asReader.goto("/");
    const cookieString = await page.evaluate(() => document.cookie);
    expect(cookieString).not.toContain("blog_session");
  });

  // ── SEC-HEADERS-01 — security-заголовки на всех ответах (next.config headers; Фаза 12) ──
  // HSTS здесь НЕ ассертим: его добавляет Caddy только на HTTPS-контуре прода.

  test("SEC-HEADERS-01 @smoke @critical: GET / отдаёт nosniff / DENY / Referrer-Policy / Permissions-Policy", async ({
    api,
  }) => {
    const ctx = await api();
    const res = await ctx.get("/");
    expect(res.ok()).toBeTruthy();
    const headers = res.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
  });

  // ── SEC-CRON-01 — cron-роут закрыт Bearer CRON_SECRET (Фаза 12) ──────────────

  test("SEC-CRON-01 @critical: GET /api/cron/publish без Bearer → 401; с неверным Bearer → 401", async ({
    api,
  }) => {
    const ctx = await api();
    const bare = await ctx.get("/api/cron/publish");
    expect(bare.status()).toBe(401);
    const wrong = await ctx.get("/api/cron/publish", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect(wrong.status()).toBe(401);
  });

  // ── SEC-TS-01 — timestamps API в Unix seconds, не миллисекундах ──────────────

  test("SEC-TS-01 @regression: GET /api/notifications — createdAt в Unix-секундах (< 10^11), не в миллисекундах", async ({
    api,
  }) => {
    const ctx = await api("reader");
    const res = await ctx.get("/api/notifications");
    expect(res.ok()).toBeTruthy();

    const feed = (await res.json()) as { items: Array<{ createdAt: number }> };
    // У читателя есть seed-уведомления — есть что проверять (точное число не ассертим — additive).
    expect(feed.items.length).toBeGreaterThan(0);
    const SECONDS_CEILING = 1e11; // 10^11 сек ≈ год 5138; ms-таймстамп (~1.7e12) сюда не влезет.
    for (const item of feed.items) {
      expect(Number.isInteger(item.createdAt)).toBe(true);
      expect(item.createdAt).toBeLessThan(SECONDS_CEILING);
    }
  });

  // ── Энумерация закрыта — заблокированный ghost отвечает как «неверный пароль» ─

  test("Логин заблокированного ghost @critical: POST /api/auth/user → 401 с обезличенным «Неверный никнейм или пароль.» (энумерация закрыта)", async ({}, testInfo) => {
    // ghost существует, но isBlocked → роут отдаёт тот же generic-ответ, что и на неверный пароль:
    // атакующий не отличит «нет такого» / «неверный пароль» / «забанен». Неудача считается в
    // login-rate-limit (5/15мин) → изолируем уникальным XFF.
    const ctx = await newApiContext(undefined, { "x-forwarded-for": uniqueXff(testInfo) });
    try {
      const res = await ctx.post("/api/auth/user", {
        data: { handle: USERS.ghost.handle, password: PASSWORD },
      });
      expect(res.status()).toBe(401);
      expect(((await res.json()) as { error: string }).error).toBe("Неверный никнейм или пароль.");
    } finally {
      await ctx.dispose();
    }
  });

  // ─────────────────────────── RATE-LIMIT (в конце файла) ───────────────────────────

  // ── TC-READER-21 — rate-limit действий: 2-й быстрый голос → 429 ─────────────

  test("TC-READER-21 @critical: два POST голоса подряд без паузы → второй 429 «Слишком часто. Подождите секунду.» + Retry-After", async () => {
    // ui-feedback-5: голоса блоговые и только reader → troll (reader без seed-голоса):
    // первый POST точно 200 (toggle с нуля), второй в пределах секунды — 429.
    // Голос troll — additive; точный счётчик не ассертим (uniqueIndex защищает от дублей).
    const ctx = await apiLoginUser(USERS.troll.handle);
    try {
      // Последовательно, но БЕЗ паузы (localhost-round-trip ≪ 1с) → детерминированно 200, затем 429.
      const r1 = await ctx.post(`/api/blogs/${BLOG.id}/vote`, { data: { value: 1 } });
      const r2 = await ctx.post(`/api/blogs/${BLOG.id}/vote`, { data: { value: 1 } });

      expect(r1.status()).toBe(200);
      expect(r2.status()).toBe(429);
      expect(((await r2.json()) as { error: string }).error).toBe("Слишком часто. Подождите секунду.");
      expect(r2.headers()["retry-after"]).toBeTruthy();
    } finally {
      await ctx.dispose();
    }
  });

  // ── TC-ADMIN-02 — rate-limit логина админа: 6-я неудача → 429 (ПОСЛЕДНИЙ) ────

  test("TC-ADMIN-02 @critical: 5 неверных логинов админа → 401, 6-й → 429 (лимит по XFF; последний тест файла)", async ({}, testInfo) => {
    // Уникальный XFF: in-memory login-лимит переживает reseed, изолируем окно от прочих тестов.
    const ctx = await newApiContext(undefined, { "x-forwarded-for": uniqueXff(testInfo) });
    try {
      await test.step("попытки 1–5 с неверным паролем → 401 «Неверный пароль.»", async () => {
        for (let i = 1; i <= 5; i++) {
          const res = await ctx.post("/api/auth", { data: { password: "wrong-password" } });
          expect(res.status(), `админ-попытка №${i} должна быть 401`).toBe(401);
          expect(((await res.json()) as { error: string }).error).toBe("Неверный пароль.");
        }
      });

      await test.step("6-я попытка тем же XFF → 429 + Retry-After", async () => {
        const res = await ctx.post("/api/auth", { data: { password: "wrong-password" } });
        expect(res.status()).toBe(429);
        expect(res.headers()["retry-after"]).toBeTruthy();
      });

      await test.step("тем же XFF POST /api/auth/user — раздельность лимитов admin:/user: НЕ ассертим", async () => {
        // Пробуем пользовательский логин под тем же адресом. Ключи лимита (admin:<ip> / user:<ip>)
        // раздельны, но это НЕ инвариант этого кейса — просто проверяем, что запрос не роняет сервер
        // (статус — любой не-5xx: 401 если ключ независим, 429 если бы шарился).
        const res = await ctx.post("/api/auth/user", {
          data: { handle: USERS.reader.handle, password: "wrong-password" },
        });
        expect(res.status()).toBeLessThan(500);
      });
    } finally {
      await ctx.dispose();
    }
  });
});

// Явный маркер, что APIRequestContext-хелперы импортированы намеренно (strict noUnusedLocals).
export type _SecuritySpecApiCtx = APIRequestContext;
