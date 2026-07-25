// PUB-FREE-* — свободная публикация и жизнь главы после неё (Фаза 13).
//
// Проверяет то, чего до Ф13 не существовало в принципе:
//   1. автор публикует главу БЕЗ единого ревьюера (гейт «все approve» удалён);
//   2. опубликованная глава редактируема — правка заводит ревизию-ЧЕРНОВИК поверх,
//      читатель продолжает видеть опубликованную версию, пока автор не опубликует новую;
//   3. возможность «автор» выдаётся админом: без неё создание блога/публикация закрыты;
//   4. Ф14 — инварианты ЗАЯВКИ на ревью (одна живая на ревизию, отзыв, проверенная версия закрыта).
//      ⚠️ Прежний пункт 4 (З-05: «повторная отправка обнуляет вердикты») снят вместе с роутом
//      `POST …/submit` — заявка `chapter_reviewers` не трогает, обнулять там нечего.
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
    const DRAFT_ONLY_TEXT = "ЧЕРНОВИК-V2-НЕ-ДЛЯ-ЧИТАТЕЛЯ";

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
        data: {
          title: NEW_TITLE,
          blocks: [{ id: "b1", type: "p", text: DRAFT_ONLY_TEXT }],
        },
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { forked: boolean; revisionNumber: number };
      expect(body.forked).toBe(true);
      expect(body.revisionNumber).toBe(2);
    });

    await test.step("КОНТЕНТ черновика читателю НЕ протекает — в ридере остаётся текст v1", async () => {
      const res = await guest.get(`/blog/${BLOG.slug}/${CHAPTERS.draft.slug}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      // Ключевое утверждение DoD: блоки неопубликованной ревизии не видны читателю.
      expect(html).not.toContain(DRAFT_ONLY_TEXT);
      // Текст опубликованной v1 на месте (первый блок seed-черновика «Генераторы и итераторы»).
      expect(html).toContain("Генератор");
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
      const html = await pub.text();
      expect(html).toContain(NEW_TITLE);
      expect(html).toContain(DRAFT_ONLY_TEXT);
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

  // ⚠️ Ф14 переписала этот кейс. Прежняя формулировка (З-05: «повторная отправка в ту же ревизию
  // обнуляет вердикты») описывала роут `POST …/submit` с пикером ревьюеров — его больше нет.
  // Преемник — ЗАЯВКА: она не трогает `chapter_reviewers` вовсе, поэтому проверяем её собственные
  // инварианты (единственность живой заявки на ревизию, отзыв, запрет на уже проверенную версию).
  test("PUB-FREE-04 @critical: заявка на ревью — одна живая на ревизию (409), отзыв возвращает возможность подать заново, проверенная версия закрыта (409)", async ({
    api,
  }) => {
    const author = await api("author");
    const requestHref = (chapterId: string) => `/api/author/chapters/${chapterId}/review-request`;
    const skills = ["Async/Await", "Обработка ошибок"];

    await test.step("заявка на главу в статусе «нужны правки» принимается → 201", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await author.post(requestHref(CHAPTERS.changesRequested.id), { data: { skills } });
      expect(res.status()).toBe(201);
      const body = (await res.json()) as { ok: boolean; requestId: string; revisionNumber: number };
      expect(body.ok).toBe(true);
      expect(body.revisionNumber).toBe(1);
    });

    await test.step("повтор на ту же ревизию → 409 «Заявка на эту версию уже подана.»", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await author.post(requestHref(CHAPTERS.changesRequested.id), { data: { skills } });
      expect(res.status()).toBe(409);
      expect(((await res.json()) as { error?: string }).error).toBe("Заявка на эту версию уже подана.");
    });

    await test.step("DELETE отзывает заявку, пока её никто не взял → подать можно снова", async () => {
      await throttleMutation(USERS.author.handle);
      const withdrawn = await author.delete(requestHref(CHAPTERS.changesRequested.id));
      expect(withdrawn.status()).toBe(200);

      await throttleMutation(USERS.author.handle);
      const again = await author.post(requestHref(CHAPTERS.changesRequested.id), { data: { skills } });
      expect(again.status()).toBe(201);
    });

    await test.step("на УЖЕ проверенную ревизию (event-loop v2, бейдж выдан) → 409", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await author.post(requestHref(CHAPTERS.published.id), {
        data: { skills: ["Event Loop"] },
      });
      expect(res.status()).toBe(409);
      expect(((await res.json()) as { error?: string }).error).toBe("Эта версия главы уже прошла ревью.");
    });

    await test.step("без возможности «автор» заявку не оставить → 403 (гейт возможности раньше ownership)", async () => {
      const reviewerCtx = await apiLoginUser(USERS.reviewer.handle);
      try {
        // У ревьюера нет `can_author` → 403 ещё на гейте возможности, до резолва главы.
        const res = await reviewerCtx.post(requestHref(CHAPTERS.changesRequested.id), {
          data: { skills },
        });
        expect(res.status()).toBe(403);
      } finally {
        await reviewerCtx.dispose();
      }
    });
  });
});
