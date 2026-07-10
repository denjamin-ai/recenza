// UPL-* — загрузка изображений (Фаза 12): POST /api/uploads (multipart) + UploadField в редакторе.
// Дисциплина: additive — файлы пишутся в public/uploads (gitignored), сущности seed не трогаются;
// UI-тест добавляет image-блок в draft-главу БЕЗ сохранения (клиентский стейт).
// Гейт по kind: article/cover → автор; donation/banner → админ. MIME сверяется по magic-bytes.

import { test, expect } from "./fixtures";
import { throttleMutation } from "./helpers/throttle";

/** Ключ серверного rate-limit загрузок автора — 1/сек (hitActionRate `upload:<userId>`). */
const AUTHOR_UPLOAD_KEY = "upload:author";

/** Минимальный валидный по сигнатуре PNG (magic 89 50 4E 47 + хвост). */
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

function pngUpload(kind: string) {
  return {
    multipart: {
      kind,
      file: { name: "e2e.png", mimeType: "image/png", buffer: PNG_BYTES },
    },
  };
}

test.describe("UPL — загрузка изображений", () => {
  test("UPL-01 @critical: автор загружает PNG (kind=article) → 201 + путь /uploads/articles/, файл отдаётся", async ({
    api,
  }) => {
    const ctx = await api("author");
    await throttleMutation(AUTHOR_UPLOAD_KEY);
    const res = await ctx.post("/api/uploads", pngUpload("article"));
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { ok: boolean; path: string };
    expect(body.ok).toBe(true);
    expect(body.path).toMatch(/^\/uploads\/articles\/[0-9a-z]+\.png$/);

    const fetched = await ctx.get(body.path);
    expect(fetched.status()).toBe(200);
  });

  test("UPL-02 @critical: гейтинг по kind — гость 401; читатель/ревьюер 403; donation только админу", async ({
    api,
  }) => {
    const guest = await api();
    expect((await guest.post("/api/uploads", pngUpload("article"))).status()).toBe(401);

    const reader = await api("reader");
    expect((await reader.post("/api/uploads", pngUpload("article"))).status()).toBe(403);
    expect((await reader.post("/api/uploads", pngUpload("donation"))).status()).toBe(403);

    const reviewer = await api("reviewer");
    expect((await reviewer.post("/api/uploads", pngUpload("cover"))).status()).toBe(403);

    // Автору donation-канал закрыт (admin-only → requireAdmin: user-сессия = 403), админу — открыт.
    const author = await api("author");
    expect((await author.post("/api/uploads", pngUpload("donation"))).status()).toBe(403);

    const admin = await api("admin");
    const adminRes = await admin.post("/api/uploads", pngUpload("donation"));
    expect(adminRes.status()).toBe(201);
    expect(((await adminRes.json()) as { path: string }).path).toMatch(/^\/uploads\/donations\//);
  });

  test("UPL-03 @critical: валидация — неверный kind/MIME/сигнатура/>4МБ → 400, огромное тело → 413", async ({
    api,
  }) => {
    const ctx = await api("author");

    // kind валидируется ДО гейта/лимита — rate-limit не тратится.
    // (avatar с ui-feedback-5 — ВАЛИДНЫЙ kind, поэтому невалидный пример — произвольная строка.)
    const badKind = await ctx.post("/api/uploads", pngUpload("evil"));
    expect(badKind.status()).toBe(400);

    // Дальше каждый запрос проходит гейт → тратит action-limit 1/сек — выдерживаем паузы.
    await throttleMutation(AUTHOR_UPLOAD_KEY);
    const textFile = await ctx.post("/api/uploads", {
      multipart: {
        kind: "article",
        file: { name: "e2e.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
      },
    });
    expect(textFile.status()).toBe(400);

    // Заявлен PNG, содержимое — текст: magic-bytes ловят подмену.
    await throttleMutation(AUTHOR_UPLOAD_KEY);
    const fakePng = await ctx.post("/api/uploads", {
      multipart: {
        kind: "article",
        file: { name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not a png at all") },
      },
    });
    expect(fakePng.status()).toBe(400);
    expect(((await fakePng.json()) as { error: string }).error).toContain("не похоже");

    await throttleMutation(AUTHOR_UPLOAD_KEY);
    // Чуть больше лимита (влезает в допуск Content-Length +64КБ) → парсится и режется по file.size: 400.
    const oversize = await ctx.post("/api/uploads", {
      multipart: {
        kind: "article",
        file: {
          name: "big.png",
          mimeType: "image/png",
          buffer: Buffer.concat([PNG_BYTES, Buffer.alloc(4 * 1024 * 1024 + 1)]),
        },
      },
    });
    expect(oversize.status()).toBe(400);
    expect(((await oversize.json()) as { error: string }).error).toContain("4 МБ");

    // Сильно больше лимита → ранний 413 по Content-Length ДО буферизации (DoS-защита, security-ревью Ф12).
    const huge = await ctx.post("/api/uploads", {
      multipart: {
        kind: "article",
        file: {
          name: "huge.png",
          mimeType: "image/png",
          buffer: Buffer.concat([PNG_BYTES, Buffer.alloc(6 * 1024 * 1024)]),
        },
      },
    });
    expect(huge.status()).toBe(413);
  });

  test("UPL-04 @regression: UploadField в редакторе — «Загрузить…» подставляет путь в поле image-блока", async ({
    asAuthor,
  }) => {
    // Draft-глава редактируема; блок добавляем в клиентский стейт и НЕ сохраняем (additive-дисциплина).
    const { EditorPage } = await import("./pages/editor.page");
    const { BLOG, CHAPTERS } = await import("./helpers/seed");
    const editor = new EditorPage(asAuthor.page);
    await editor.goto(BLOG.slug, CHAPTERS.draft.slug);

    // Клик до гидрации может потеряться — ретраим до появления меню (паттерн MCP-FINDINGS §4).
    // «Добавить блок» дублируется на странице (gap-кнопки) — берём последнюю (низ документа).
    await expect(async () => {
      await asAuthor.page.getByRole("button", { name: "Добавить блок" }).last().click();
      await expect(asAuthor.page.getByRole("menuitem", { name: "Изображение" })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await asAuthor.page.getByRole("menuitem", { name: "Изображение" }).click();

    const pathInput = asAuthor.page.getByRole("textbox", { name: "Путь изображения" });
    await expect(pathInput).toBeVisible();

    await throttleMutation(AUTHOR_UPLOAD_KEY);
    await asAuthor.page
      .locator('input[type="file"]')
      .setInputFiles({ name: "e2e-ui.png", mimeType: "image/png", buffer: PNG_BYTES });

    await expect(pathInput).toHaveValue(/^\/uploads\/articles\/[0-9a-z]+\.png$/);
  });

  test("UPL-05 @regression: аватарка (ui-feedback-5) — kind=avatar доступен всем ролям, PATCH /api/profile/avatar валидирует путь", async ({
    api,
  }) => {
    // reseed в flows-спеках восстановит seed-аватарки; загрузка additive (файлы gitignored).
    const reader = await api("reader");
    await throttleMutation("upload:reader");
    const up = await reader.post("/api/uploads", pngUpload("avatar"));
    expect(up.status()).toBe(201);
    const { path } = (await up.json()) as { path: string };
    expect(path).toMatch(/^\/uploads\/avatars\/[0-9a-z]+\.png$/);

    // Привязка к своему профилю: валидный путь → 200; путь вне avatars → 400; гость → 401.
    await throttleMutation("avatar:reader");
    const ok = await reader.patch("/api/profile/avatar", { data: { avatarUrl: path } });
    expect(ok.status()).toBe(200);

    await throttleMutation("avatar:reader");
    const bad = await reader.patch("/api/profile/avatar", { data: { avatarUrl: "/uploads/articles/x.png" } });
    expect(bad.status()).toBe(400);

    const guest = await api();
    expect((await guest.patch("/api/profile/avatar", { data: { avatarUrl: path } })).status()).toBe(401);

    // Ревьюер тоже может загрузить аватарку (kind=avatar — любой пользователь).
    const reviewer = await api("reviewer");
    await throttleMutation("upload:reviewer");
    expect((await reviewer.post("/api/uploads", pngUpload("avatar"))).status()).toBe(201);

    // Самовосстановление: возвращаем reader'у seed-аватарку.
    await throttleMutation("avatar:reader");
    const restore = await reader.patch("/api/profile/avatar", { data: { avatarUrl: "/uploads/avatars/reader.png" } });
    expect(restore.status()).toBe(200);
  });
});
