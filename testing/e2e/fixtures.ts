import {
  test as base,
  expect,
  request,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { authFile, type AuthRole } from "./helpers/auth";
import { BASE_URL, PASSWORD } from "./helpers/seed";

export { expect };

/**
 * Сессия роли: изолированный browserContext поверх storageState из global-setup.
 * Multi-user тест — просто деструктуризация двух фикстур: `({ asAuthor, asReviewer })`.
 */
export interface RoleSession {
  context: BrowserContext;
  page: Page;
  goto(path: string): Promise<void>;
}

type LoginAs = (handle: string, password?: string) => Promise<RoleSession>;
type ApiFactory = (role?: AuthRole) => Promise<APIRequestContext>;

interface Fixtures {
  /** Сборщик ошибок консоли (auto): тест падает при console.error/pageerror. */
  consoleErrors: string[];
  /** Гостевая сессия (без cookie) с console-guard. */
  asGuest: RoleSession;
  asReader: RoleSession;
  asAuthor: RoleSession;
  asReviewer: RoleSession;
  asAdmin: RoleSession;
  /** Сессия произвольного seed-пользователя (sergey_review, lena_review, troll, …). */
  loginAs: LoginAs;
  /**
   * Гостевая сессия с заданным X-Forwarded-For — изоляция login-rate-limit
   * (неудачные UI-логины; ключ лимита — первый хоп XFF).
   */
  guestWithXff: (xff: string) => Promise<RoleSession>;
  /**
   * API-контекст с cookie роли и заголовком Origin (same-origin CSRF).
   * Негативные API-проверки делать здесь, а не page.evaluate(fetch) —
   * браузерные 4xx-ответы засоряют консоль и роняют console-guard.
   */
  api: ApiFactory;
}

/**
 * Известные «здоровые» ошибки консоли:
 * - «Failed to load resource» — сетевой HTTP-шум (404 на несуществующих страницах, статус которых
 *   тест проверяет явно; 429 rate-limit, который приложение обрабатывает и который проверяется
 *   отдельными API-тестами). Это НЕ ошибки кода — реальные JS-краши приходят через `pageerror`
 *   и остаются фатальными.
 * - preload-шум turbopack в dev-режиме (MCP-FINDINGS §5).
 * ⚠️ С Фазы 12 URL с /uploads/ НЕ входят в allowlist: seed-плейсхолдеры закоммичены,
 *   битая картинка — регресс (загрузка реализована, /api/uploads).
 */
const CONSOLE_ALLOWLIST = [
  /Failed to load resource/i,
  /preload/i,
  // Dev-warning Next.js not-found страницы при рендере 404 — безобидный шум, не баг приложения.
  /Encountered a script tag while rendering/i,
];

function isAllowedConsoleError(text: string, url: string | undefined): boolean {
  // Битые /uploads/-ресурсы — всегда ошибка (см. шапку): не пропускаем даже сетевой шум.
  if (url?.includes("/uploads/")) return false;
  return CONSOLE_ALLOWLIST.some((re) => re.test(url ?? "") || re.test(text));
}

function attachConsoleGuard(context: BrowserContext, sink: string[]): void {
  context.on("page", (page) => {
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const url = msg.location()?.url;
      if (isAllowedConsoleError(msg.text(), url)) return;
      sink.push(`[console.error] ${page.url()}: ${msg.text()}${url ? ` (${url})` : ""}`);
    });
    page.on("pageerror", (err) => {
      sink.push(`[pageerror] ${page.url()}: ${err.message}`);
    });
  });
}

async function makeSession(
  browser: Browser,
  sink: string[],
  storageState?: string | { cookies: never[]; origins: never[] },
  extraHTTPHeaders?: Record<string, string>,
): Promise<RoleSession> {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    locale: "ru-RU",
    storageState: storageState as string | undefined,
    extraHTTPHeaders,
  });
  attachConsoleGuard(context, sink);
  const page = await context.newPage();
  return {
    context,
    page,
    goto: async (path: string) => {
      await page.goto(path);
    },
  };
}

function roleFixture(role: AuthRole) {
  return async (
    { browser, consoleErrors }: { browser: Browser; consoleErrors: string[] },
    use: (session: RoleSession) => Promise<void>,
  ) => {
    const session = await makeSession(browser, consoleErrors, authFile(role));
    await use(session);
    await session.context.close();
  };
}

export const test = base.extend<Fixtures>({
  consoleErrors: [
    async ({}, use) => {
      const sink: string[] = [];
      await use(sink);
      if (sink.length > 0) {
        throw new Error(`Ошибки консоли во время теста:\n${sink.join("\n")}`);
      }
    },
    { auto: true },
  ],

  asGuest: async ({ browser, consoleErrors }, use) => {
    const session = await makeSession(browser, consoleErrors);
    await use(session);
    await session.context.close();
  },

  asReader: roleFixture("reader"),
  asAuthor: roleFixture("author"),
  asReviewer: roleFixture("reviewer"),
  asAdmin: roleFixture("admin"),

  guestWithXff: async ({ browser, consoleErrors }, use) => {
    const contexts: BrowserContext[] = [];
    const factory = async (xff: string) => {
      const session = await makeSession(browser, consoleErrors, undefined, {
        "x-forwarded-for": xff,
      });
      contexts.push(session.context);
      return session;
    };
    await use(factory);
    for (const ctx of contexts) {
      await ctx.close();
    }
  },

  loginAs: async ({ browser, consoleErrors }, use) => {
    const contexts: BrowserContext[] = [];
    const factory: LoginAs = async (handle, password = PASSWORD) => {
      const req = await request.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: { origin: BASE_URL },
      });
      const res = await req.post("/api/auth/user", { data: { handle, password } });
      if (!res.ok()) {
        throw new Error(`loginAs(«${handle}») не удался: ${res.status()} ${await res.text()}`);
      }
      const state = await req.storageState();
      await req.dispose();
      const session = await makeSession(browser, consoleErrors, state as never);
      contexts.push(session.context);
      return session;
    };
    await use(factory);
    for (const ctx of contexts) {
      await ctx.close();
    }
  },

  api: async ({}, use) => {
    const contexts: APIRequestContext[] = [];
    const factory: ApiFactory = async (role) => {
      const ctx = await request.newContext({
        baseURL: BASE_URL,
        storageState: role ? authFile(role) : undefined,
        extraHTTPHeaders: { origin: BASE_URL },
      });
      contexts.push(ctx);
      return ctx;
    };
    await use(factory);
    for (const ctx of contexts) {
      await ctx.dispose();
    }
  },
});
