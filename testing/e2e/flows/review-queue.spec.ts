// RQ-* — очередь заявок на ревью (Фаза 14, канал 1 из трёх).
//
// Модель, которую проверяет файл: автор НИГДЕ не выбирает ревьюера. Он оставляет ЗАЯВКУ
// (`POST /api/author/chapters/[id]/review-request`), заявка попадает в общую очередь, и ревьюер
// берёт её сам (`POST /api/reviewer/requests/[id]/claim`). Приглашений, согласия и «ведущего» нет.
//
// Инварианты, за которыми следит файл:
//   · claim — единственная точка старта ревью (он же пишет `chapter_reviewers`);
//   · capacity проверяется НА СЕРВЕРЕ (З-06: до Ф14 «full» только дизейблил чекбокс в пикере);
//   · заявку можно оставить на УЖЕ опубликованную главу — кредит и бейдж выдаются без публикации
//     (закрытие сессии переехало в `closeReviewSession`, вторая точка вызова — verdict-роут);
//   · свой блог рецензировать нельзя даже аккаунту с обеими возможностями;
//   · одна живая заявка на ревизию; отзыв возможен только пока заявку не взяли.
//
// Мутирует seed (заявки, назначения, кредит) → serial + reseed в beforeAll И afterAll:
// без afterAll срез `--grep @smoke` унёс бы мусор в соседние спеки (дисциплина flows/*).

import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { apiLoginUser } from "../helpers/auth";
import { reseed } from "../helpers/db";
import { BLOG, CHAPTERS, DUO_BLOG, REVIEW_REQUESTS, USERS } from "../helpers/seed";
import { throttleMutation } from "../helpers/throttle";
import { EditorPage } from "../pages/editor.page";

test.describe.configure({ mode: "serial" });

const requestHref = (chapterId: string) => `/api/author/chapters/${chapterId}/review-request`;
const claimHref = (requestId: string) => `/api/reviewer/requests/${requestId}/claim`;

/** Готовит «Генераторы» к заявке: ≥3 содержательных блока (пункт чек-листа готовности). */
async function prepareDraftBlocks(api: (role?: "author") => Promise<APIRequestContext>): Promise<void> {
  const ctx = await api("author");
  await throttleMutation(USERS.author.handle);
  const res = await ctx.patch(`/api/author/chapters/${CHAPTERS.draft.id}`, {
    data: {
      blocks: [
        { type: "h2", text: "Генераторы e2e" },
        { type: "p", text: "Первый содержательный абзац для готовности." },
        { type: "p", text: "Второй содержательный абзац для готовности." },
        { type: "p", text: "Третий содержательный абзац для готовности." },
      ],
    },
  });
  expect(res.ok()).toBe(true);
}

/** Панель активного таба кабинета ревьюера (скрытые панели `hidden` в a11y-дерево не попадают). */
function tabPanel(page: Page, name: RegExp) {
  return page.getByRole("tabpanel", { name });
}

/** Карточка заявки в очереди по названию главы. */
function queueCard(page: Page, chapterTitle: string) {
  return tabPanel(page, /Очередь/).getByRole("listitem").filter({ hasText: chapterTitle });
}

/** Переключение таба кабинета ревьюера с ретраем «мёртвого» клика до гидрации. */
async function openReviewerTab(page: Page, name: RegExp): Promise<void> {
  await expect(async () => {
    await page.getByRole("tab", { name }).click();
    await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true", {
      timeout: 2_000,
    });
  }).toPass({ timeout: 20_000 });
}

test.describe("Очередь заявок на ревью (RQ-*)", () => {
  test.beforeAll(() => {
    reseed();
  });
  test.afterAll(() => {
    reseed();
  });

  // ── RQ-01 — заявка из редактора → очередь ревьюера ───────────────────────────

  test("RQ-01 @smoke @critical: автор оставляет заявку из редактора → она видна в очереди ревьюера с match%", async ({
    asAuthor,
    asReviewer,
    api,
  }) => {
    const editor = new EditorPage(asAuthor.page);
    await prepareDraftBlocks(api);

    await test.step("шторка редактора — форма заявки с чек-листом готовности", async () => {
      // `chp_draft` в сиде намеренно чист от заявок (живая заявка заблокировала бы редактор).
      await editor.goto(BLOG.slug, CHAPTERS.draft.slug);
      await editor.openSubmitSheet();
      await expect(editor.readinessHeading).toBeVisible();
    });

    await test.step("навыки статьи заменяются на компетенции ревьюера (match 100%)", async () => {
      // Сидовые навыки «Генераторы/Итераторы» не пересекаются ни с чьими компетенциями —
      // подменяем их, чтобы процент в очереди был детерминированным, а не «каким получится».
      for (const skill of ["Генераторы", "Итераторы"]) {
        await expect(async () => {
          await editor.removeSkill(skill);
          await expect(editor.submitSheet.getByText(skill, { exact: true })).toHaveCount(0, {
            timeout: 2_000,
          });
        }).toPass({ timeout: 20_000 });
      }
      await editor.addSkill("TypeScript");
      await editor.addSkill("React");
      await expect(editor.readinessHeading).toHaveText("Готовность 5/5");
      await expect(editor.readyFooter).toBeVisible();
    });

    await test.step("«Оставить заявку» → редирект в кабинет блога", async () => {
      await throttleMutation(USERS.author.handle);
      await editor.submit(BLOG.slug);
    });

    await test.step("ревьюер видит заявку в очереди: 100% совпадение, чипы навыков, «Взять»", async () => {
      await asReviewer.goto("/reviewer");
      const card = queueCard(asReviewer.page, CHAPTERS.draft.title);
      await expect(card).toBeVisible();
      await expect(card).toContainText(BLOG.title);
      await expect(card).toContainText("совпадение 100%");
      await expect(card.getByText("TypeScript", { exact: true })).toBeVisible();
      await expect(card.getByText("React", { exact: true })).toBeVisible();
      await expect(card.getByRole("button", { name: "Взять" })).toBeVisible();
    });

    await test.step("повторный заход в редактор показывает СОСТОЯНИЕ заявки вместо формы", async () => {
      await editor.goto(BLOG.slug, CHAPTERS.draft.slug);
      await editor.openSubmitSheet();
      // ⚠️ Расхождение контракта: POM-геттер `editor.requestState` ищет role="group", а шторка
      // рендерит <section aria-label="Состояние заявки"> — это role="region" (HTML-AAM: section
      // с доступным именем). До сведения сторон локатор берём по фактической роли (см. отчёт фазы).
      const state = editor.submitSheet.getByRole("region", { name: "Состояние заявки" });
      await expect(state).toBeVisible();
      await expect(state).toContainText("Заявка в очереди");
      await expect(editor.readinessHeading).toHaveCount(0);
      await expect(editor.withdrawButton).toBeVisible();
    });
  });

  // ── RQ-02 — claim: очередь → «Мои ревью», ось ревью in-review ────────────────

  test("RQ-02 @smoke @critical: ревьюер берёт заявку → она уезжает в «Мои ревью», ось ревью in-review", async ({
    asReviewer,
    asAuthor,
    api,
  }) => {
    reseed();
    const { page } = asReviewer;
    const author = await api("author");

    await test.step("автор оставляет заявку на черновик (в сиде он чист от заявок)", async () => {
      await prepareDraftBlocks(api);
      await throttleMutation(USERS.author.handle);
      const created = await author.post(requestHref(CHAPTERS.draft.id), {
        data: { skills: ["Генераторы", "Итераторы"] },
      });
      expect(created.status()).toBe(201);
    });

    await test.step("кнопка «Взять» убирает карточку из очереди", async () => {
      await asReviewer.goto("/reviewer");
      const card = queueCard(page, CHAPTERS.draft.title);
      await expect(card).toBeVisible();
      // Клик может потеряться до гидрации; повторный по уже взятой заявке отвечает 409 и
      // карточка всё равно исчезает после refresh — ретрай безопасен.
      await expect(async () => {
        await card.getByRole("button", { name: "Взять" }).click();
        await expect(card).toHaveCount(0, { timeout: 5_000 });
      }).toPass({ timeout: 30_000 });
    });

    await test.step("глава появилась в «Мои ревью» со ссылкой на ReviewPage", async () => {
      await openReviewerTab(page, /Мои ревью/);
      const panel = tabPanel(page, /Мои ревью/);
      const link = panel.getByRole("link", { name: new RegExp(CHAPTERS.draft.title) });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", `/reviewer/review/${CHAPTERS.draft.id}`);
      // Вердикта ещё нет — ход ревьюера.
      await expect(link).toContainText("ваш ход");
    });

    await test.step("у автора заявка перешла в «В работе» с именем ревьюера", async () => {
      await asAuthor.goto("/author");
      const section = asAuthor.page.getByRole("region", { name: "Заявки на ревью" });
      const card = section.getByRole("listitem").filter({ hasText: CHAPTERS.draft.title });
      await expect(card).toBeVisible();
      await expect(card).toContainText("В работе");
      await expect(card).toContainText("Раиса Ревьюер");
    });

    await test.step("ось ревью главы — «На ревью» (публикация не тронута: «Черновик»)", async () => {
      await asAuthor.goto(`/author/blog/${BLOG.slug}`);
      const row = asAuthor.page.getByRole("listitem").filter({ hasText: CHAPTERS.draft.title });
      await expect(row.getByText("На ревью", { exact: true })).toBeVisible();
      await expect(row.getByText("Черновик", { exact: true })).toBeVisible();
    });
  });

  // ── RQ-03 — серверная проверка capacity (З-06) ───────────────────────────────

  test("RQ-03 @critical: claim при исчерпанной ёмкости → 409 (проверка серверная, не в UI)", async ({
    api,
  }) => {
    reseed();
    const admin = await api("admin");
    const reviewer = await api("reviewer");

    await test.step("админ обнуляет ёмкость ревьюера", async () => {
      const res = await admin.patch(`/api/admin/users/${USERS.reviewer.handle}`, {
        data: { reviewCapacity: 0 },
      });
      expect(res.status()).toBe(200);
    });

    await test.step("claim → 409 «Вы уже загружены до предела»", async () => {
      await throttleMutation(USERS.reviewer.handle);
      const res = await reviewer.post(claimHref(REVIEW_REQUESTS.open));
      expect(res.status()).toBe(409);
      expect(((await res.json()) as { error?: string }).error).toBe(
        "Вы уже загружены до предела — завершите текущие ревью.",
      );
    });

    await test.step("вернули ёмкость → тот же claim проходит (409 был именно про занятость)", async () => {
      const restored = await admin.patch(`/api/admin/users/${USERS.reviewer.handle}`, {
        data: { reviewCapacity: 5 },
      });
      expect(restored.status()).toBe(200);

      await throttleMutation(USERS.reviewer.handle);
      const res = await reviewer.post(claimHref(REVIEW_REQUESTS.open));
      expect(res.status()).toBe(200);
      expect(((await res.json()) as { chapterId?: string }).chapterId).toBe(DUO_BLOG.chapter.id);
    });
  });

  // ── RQ-04 — заявка на ОПУБЛИКОВАННУЮ главу: кредит и бейдж без публикации ────

  test("RQ-04 @critical: ревью опубликованной главы — approve выдаёт кредит и бейдж БЕЗ публикации", async ({
    asGuest,
    asReviewer,
    api,
  }) => {
    reseed();
    const reviewer = await api("reviewer");

    await test.step("до ревью у опубликованной главы бейджа нет", async () => {
      await asGuest.goto(`/blog/${DUO_BLOG.slug}/${DUO_BLOG.chapter.slug}`);
      await expect(
        asGuest.page.getByRole("heading", { level: 1, name: DUO_BLOG.chapter.title }),
      ).toBeVisible();
      await expect(asGuest.page.getByText("Проверено на Recenza")).toHaveCount(0);
      await expect(asGuest.page.getByRole("region", { name: "Ревьюеры главы" })).toHaveCount(0);
    });

    await test.step("в очереди заявка помечена как «на опубликованную главу» и берётся из UI", async () => {
      // Флагманский случай Ф14 (З-03): сидовая req_open стоит на уже опубликованной главе duo.
      await asReviewer.goto("/reviewer");
      const card = queueCard(asReviewer.page, DUO_BLOG.chapter.title);
      await expect(card).toContainText("заявка на опубликованную главу");
      await expect(async () => {
        await card.getByRole("button", { name: "Взять" }).click();
        await expect(card).toHaveCount(0, { timeout: 5_000 });
      }).toPass({ timeout: 30_000 });
    });

    await test.step("approve на опубликованной ревизии закрывает сессию и выдаёт бейдж", async () => {
      await throttleMutation(USERS.reviewer.handle);
      const res = await reviewer.post(`/api/review/${DUO_BLOG.chapter.id}/verdict`, {
        data: { verdict: "approve" },
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { allApproved: boolean; status: string; badge: string | null };
      expect(body.allApproved).toBe(true);
      expect(body.status).toBe("reviewed");
      // Ревьюера автор не приводил (`introduced_by` пуст) → уровень independent.
      expect(body.badge).toBe("independent");
    });

    await test.step("читатель видит бейдж и кредит — публикации при этом не было", async () => {
      await asGuest.goto(`/blog/${DUO_BLOG.slug}/${DUO_BLOG.chapter.slug}`);
      await expect(asGuest.page.getByText("Проверено на Recenza").first()).toBeVisible();

      const credit = asGuest.page.getByRole("region", { name: "Ревьюеры главы" });
      await expect(credit).toBeVisible();
      await expect(credit.getByRole("link", { name: "Раиса Ревьюер" })).toBeVisible();
    });

    await test.step("глава попала ревьюеру в «Завершённые» — кредит выдан без публикации", async () => {
      await asReviewer.goto("/reviewer");
      await openReviewerTab(asReviewer.page, /^Завершённые/);
      const panel = tabPanel(asReviewer.page, /Завершённые/);
      await expect(panel.getByRole("link", { name: new RegExp(DUO_BLOG.chapter.title) })).toBeVisible();
    });
  });

  // ── RQ-05 — свой блог рецензировать нельзя ──────────────────────────────────

  test("RQ-05 @critical: claim собственного блога → 403 (даже у аккаунта с обеими возможностями)", async ({
    api,
    loginAs,
  }) => {
    reseed();
    const author = await api("author");
    const ctx = await apiLoginUser(USERS.duo.handle);

    await test.step("в очереди должна быть и чужая заявка — иначе проверка вырождается", async () => {
      await prepareDraftBlocks(api);
      await throttleMutation(USERS.author.handle);
      const created = await author.post(requestHref(CHAPTERS.draft.id), {
        data: { skills: ["Генераторы", "Итераторы"] },
      });
      expect(created.status()).toBe(201);
    });

    try {
      await test.step("API: claim заявки на свою главу → 403", async () => {
        // req_open принадлежит duo (сидовая заявка на его же опубликованную главу).
        const res = await ctx.post(claimHref(REVIEW_REQUESTS.open));
        expect(res.status()).toBe(403);
        expect(((await res.json()) as { error?: string }).error).toBe(
          "Нельзя рецензировать собственный блог.",
        );
      });
    } finally {
      await ctx.dispose();
    }

    await test.step("UI: своей главы в очереди нет вовсе (getReviewQueue отсекает свои блоги)", async () => {
      const duo = await loginAs(USERS.duo.handle);
      await duo.goto("/reviewer");
      await expect(tabPanel(duo.page, /Очередь/)).toBeVisible();
      await expect(queueCard(duo.page, DUO_BLOG.chapter.title)).toHaveCount(0);
      // Чужая заявка в очереди при этом есть — фильтр именно по владельцу, а не «пусто у всех».
      await expect(queueCard(duo.page, CHAPTERS.draft.title)).toBeVisible();
    });
  });

  // ── RQ-06 — одна живая заявка на ревизию ────────────────────────────────────

  test("RQ-06 @critical: вторая заявка на ту же ревизию → 409", async ({ api }) => {
    reseed();
    await prepareDraftBlocks(api);
    const author = await api("author");

    await throttleMutation(USERS.author.handle);
    const first = await author.post(requestHref(CHAPTERS.draft.id), {
      data: { skills: ["Генераторы", "Итераторы"] },
    });
    expect(first.status()).toBe(201);

    await throttleMutation(USERS.author.handle);
    const second = await author.post(requestHref(CHAPTERS.draft.id), {
      data: { skills: ["Генераторы"] },
    });
    expect(second.status()).toBe(409);
    expect(((await second.json()) as { error?: string }).error).toBe("Заявка на эту версию уже подана.");
  });

  // ── RQ-07 — отзыв заявки автором ────────────────────────────────────────────

  test("RQ-07 @critical: отзыв заявки — open → 200, claimed → 409", async ({ api }) => {
    reseed();
    const author = await api("author");

    await test.step("автор оставляет заявку на черновик", async () => {
      await prepareDraftBlocks(api);
      await throttleMutation(USERS.author.handle);
      const created = await author.post(requestHref(CHAPTERS.draft.id), {
        data: { skills: ["Генераторы", "Итераторы"] },
      });
      expect(created.status()).toBe(201);
    });

    await test.step("открытую заявку автор отзывает", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await author.delete(requestHref(CHAPTERS.draft.id));
      expect(res.status()).toBe(200);
      expect(((await res.json()) as { ok?: boolean }).ok).toBe(true);
    });

    await test.step("повторный отзыв — уже нечего отзывать → 409", async () => {
      await throttleMutation(USERS.author.handle);
      const res = await author.delete(requestHref(CHAPTERS.draft.id));
      expect(res.status()).toBe(409);
    });

    await test.step("взятую в работу заявку отозвать нельзя → 409", async () => {
      // req_silent: заявка на «Промисы изнутри» взята ревьюером (claimed).
      await throttleMutation(USERS.author.handle);
      const res = await author.delete(requestHref(CHAPTERS.underReview.id));
      expect(res.status()).toBe(409);
      expect(((await res.json()) as { error?: string }).error).toBe(
        "Заявку уже взяли в работу — отозвать нельзя.",
      );
    });
  });
});
