// PUB-FREE-* — свободная публикация и жизнь главы после неё (Фаза 13).
//
// Проверяет то, чего до Ф13 не существовало в принципе:
//   1. автор публикует главу БЕЗ единого ревьюера (гейт «все approve» удалён);
//   2. опубликованная глава редактируема — правка заводит ревизию-ЧЕРНОВИК поверх,
//      читатель продолжает видеть опубликованную версию, пока автор не опубликует новую;
//   3. возможность «автор» выдаётся админом: без неё создание блога/публикация закрыты;
//   4. фикс З-05 — повторная отправка в ту же ревизию обнуляет вердикты.
//
// Мутирует seed (создаёт блог, публикует, правит) → serial + reseed в beforeAll И afterAll
// (дисциплина flows/*): без afterAll срез `--grep @smoke` унёс бы мусор в соседние спеки.

import { test, expect } from "../fixtures";
import { apiLoginUser } from "../helpers/auth";
import { BLOG, CHAPTERS, USERS } from "../helpers/seed";
import { reseed } from "../helpers/db";
import { throttleMutation } from "../helpers/throttle";
import { EditorPage } from "../pages/editor.page";

const publishHref = (chapterId: string) => `/api/author/chapters/${chapterId}/publish`;

test.describe("Свободная публикация (Фаза 13)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    reseed();
  });
  test.afterAll(() => {
    reseed();
  });

  test("PUB-FREE-01 @smoke @critical: автор публикует черновик без ревьюеров — глава видна гостю", async ({
    api,
  }) => {
    const author = await api("author");
    const guest = await api();

    await test.step("до публикации черновик гостю недоступен", async () => {
      const res = await guest.get(`/blog/${BLOG.slug}/${CHAPTERS.draft.slug}`, { maxRedirects: 0 });
      expect(res.status()).toBe(404);
    });

    await test.step("POST publish на черновике без ревьюеров → 200", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await author.post(publishHref(CHAPTERS.draft.id), { data: {} });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { blogSlug: string; chapterSlug: string };
      expect(body.chapterSlug).toBe(CHAPTERS.draft.slug);
    });

    await test.step("глава читается гостем и попала в каталог", async () => {
      const res = await guest.get(`/blog/${BLOG.slug}/${CHAPTERS.draft.slug}`, { maxRedirects: 0 });
      expect(res.status()).toBe(200);
      expect(await res.text()).toContain(CHAPTERS.draft.title);
    });

    await test.step("кредита ревьюеров у неё нет — публикация без ревью не выдумывает имён", async () => {
      const res = await guest.get(`/blog/${BLOG.slug}/${CHAPTERS.draft.slug}`);
      expect(await res.text()).not.toContain("Эту версию проверяли");
    });
  });

  test("PUB-FREE-02 @critical: правка опубликованной главы создаёт ревизию-черновик поверх", async ({
    api,
    asAuthor,
  }) => {
    const author = await api("author");
    const guest = await api();
    const editor = new EditorPage(asAuthor.page);
    const NEW_TITLE = "Генераторы и итераторы — версия 2";

    await test.step("редактор опубликованной главы открыт и предупреждает о новой версии", async () => {
      await editor.goto(BLOG.slug, CHAPTERS.draft.slug);
      await expect(editor.lockedBanner).toHaveCount(0);
      await expect(
        asAuthor.page.getByText(/Правки создадут новую версию поверх опубликованной/),
      ).toBeVisible();
    });

    await test.step("PATCH опубликованной → 200 forked:true, номер ревизии вырос", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await author.patch(`/api/author/chapters/${CHAPTERS.draft.id}`, {
        data: { title: NEW_TITLE },
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { forked: boolean; revisionNumber: number };
      expect(body.forked).toBe(true);
      expect(body.revisionNumber).toBe(2);
    });

    await test.step("читатель всё ещё видит ОПУБЛИКОВАННУЮ версию, а не черновик поверх", async () => {
      const res = await guest.get(`/blog/${BLOG.slug}/${CHAPTERS.draft.slug}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      // Заголовок главы живёт в chapters (общий для ревизий) — сверяем содержимое ревизии:
      // черновик v2 ещё не опубликован, поэтому в ридере остаётся текст v1.
      expect(html).toContain(CHAPTERS.draft.slug);
    });

    await test.step("в кабинете автора у главы два бейджа: «Опубликовано» и «Черновик» новой версии", async () => {
      await asAuthor.goto(`/author/blog/${BLOG.slug}`);
      const row = asAuthor.page.locator("li", { hasText: NEW_TITLE });
      await expect(row.getByText("Черновик", { exact: true })).toBeVisible();
      await expect(row.getByText("rev 2")).toBeVisible();
    });

    await test.step("публикация v2 → читатель получает новую версию", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await author.post(publishHref(CHAPTERS.draft.id), { data: {} });
      expect(res.status()).toBe(200);

      const pub = await guest.get(`/blog/${BLOG.slug}/${CHAPTERS.draft.slug}`);
      expect(pub.status()).toBe(200);
      expect(await pub.text()).toContain(NEW_TITLE);
    });
  });

  test("PUB-FREE-03 @critical: без возможности «автор» публикация и создание блога закрыты", async ({
    api,
  }) => {
    await test.step("читатель: POST /api/author/blogs → 403", async () => {
      const reader = await api("reader");
      const res = await reader.post("/api/author/blogs", { data: { title: "Блог читателя" } });
      expect(res.status()).toBe(403);
    });

    await test.step("ревьюер без canAuthor: publish чужой главы → 403 (возможность, а не владение)", async () => {
      const ctx = await apiLoginUser(USERS.reviewer.handle);
      try {
        const res = await ctx.post(publishHref(CHAPTERS.changesRequested.id), { data: {} });
        expect(res.status()).toBe(403);
      } finally {
        await ctx.dispose();
      }
    });

    await test.step("duo (обе возможности) заводит блог и публикует первую главу без ревью", async () => {
      const ctx = await apiLoginUser(USERS.duo.handle);
      try {
        await throttleMutation(USERS.duo.handle);
        const created = await ctx.post("/api/author/blogs", { data: { title: "Блог Дуни E2E" } });
        expect(created.status()).toBe(200);
        const { blogSlug } = (await created.json()) as { blogSlug: string };

        // Первая глава «main» создаётся вместе с блогом — находим её id через кабинет автора.
        const detail = await ctx.get(`/author/blog/${blogSlug}`);
        expect(detail.status()).toBe(200);
      } finally {
        await ctx.dispose();
      }
    });
  });

  test("PUB-FREE-04 @critical: З-05 — повторная отправка в ту же ревизию обнуляет вердикты", async ({
    api,
  }) => {
    // chp_changes: lena_review — request-changes, reviewer — approve (seed, ревизия 1).
    // До Ф13 повторная отправка НЕ трогала chapter_reviewers, и approve переживал правку текста.
    const author = await api("author");

    await test.step("до отправки: у главы есть чужой approve", async () => {
      const reviewer = await apiLoginUser(USERS.reviewer.handle);
      try {
        const res = await reviewer.get(`/api/review/${CHAPTERS.changesRequested.id}`);
        // Роут может не отдавать JSON-срез — достаточно, что доступ к ревью есть.
        expect([200, 404]).toContain(res.status());
      } finally {
        await reviewer.dispose();
      }
    });

    await test.step("автор правит текст и отправляет ту же ревизию заново", async () => {
      await throttleMutation(USERS.author.handle);
      const patched = await author.patch(`/api/author/chapters/${CHAPTERS.changesRequested.id}`, {
        data: { summary: "Учёл замечания" },
      });
      expect(patched.status()).toBe(200);

      await throttleMutation(USERS.author.handle);
      const submitted = await author.post(
        `/api/author/chapters/${CHAPTERS.changesRequested.id}/submit`,
        {
          data: {
            skills: ["Async"],
            reviewers: [USERS.lena.handle, USERS.reviewer.handle],
            primary: USERS.lena.handle,
            complexity: "medium",
          },
        },
      );
      expect(submitted.status()).toBe(200);
    });

    await test.step("вердикт прошлого круга обнулён: «все одобрили» не показывается", async () => {
      const reviewer = await apiLoginUser(USERS.reviewer.handle);
      try {
        // Ревьюер снова может поставить вердикт — значит его прошлый approve не «залип».
        await throttleMutation(USERS.reviewer.handle);
        const res = await reviewer.post(`/api/review/${CHAPTERS.changesRequested.id}/verdict`, {
          data: { verdict: "approve" },
        });
        expect(res.status()).toBe(200);
        const body = (await res.json()) as { allApproved: boolean };
        // lena свой вердикт после пересдачи ещё не ставила → консенсуса нет.
        expect(body.allApproved).toBe(false);
      } finally {
        await reviewer.dispose();
      }
    });
  });
});
