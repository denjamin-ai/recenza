import { expect, request, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import path from "node:path";
import { BASE_URL, PASSWORD } from "./seed";

export type AuthRole = "reader" | "author" | "reviewer" | "admin";

export const AUTH_DIR = path.resolve(__dirname, "..", ".auth");

export function authFile(role: AuthRole): string {
  return path.join(AUTH_DIR, `${role}.json`);
}

/** Request-контекст с Origin (иначе same-origin CSRF-гард отбивает мутации 403-м). */
export async function newApiContext(
  storageStatePath?: string,
  extraHeaders: Record<string, string> = {},
): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: BASE_URL,
    storageState: storageStatePath,
    extraHTTPHeaders: { origin: BASE_URL, ...extraHeaders },
  });
}

/** API-логин пользователя (reader/author/reviewer/…): POST /api/auth/user. */
export async function apiLoginUser(handle: string, password: string = PASSWORD): Promise<APIRequestContext> {
  const ctx = await newApiContext();
  const res = await ctx.post("/api/auth/user", { data: { handle, password } });
  if (!res.ok()) {
    throw new Error(`API-логин «${handle}» не удался: ${res.status()} ${await res.text()}`);
  }
  return ctx;
}

/** API-логин админа: POST /api/auth, пароль из env ADMIN_PASSWORD_PLAIN (.env.test). */
export async function apiLoginAdmin(): Promise<APIRequestContext> {
  const password = process.env.ADMIN_PASSWORD_PLAIN;
  if (!password) {
    throw new Error("ADMIN_PASSWORD_PLAIN не задан — проверь .env.test (его читает playwright.config.ts)");
  }
  const ctx = await newApiContext();
  const res = await ctx.post("/api/auth", { data: { password } });
  if (!res.ok()) {
    throw new Error(`API-логин админа не удался: ${res.status()} ${await res.text()}`);
  }
  return ctx;
}

/**
 * UI-логин пользователя со страницы /login. Устойчив к потере кликов до гидрации
 * (MCP-FINDINGS §4: обработчик формы навешивается позже рендера) — клик ретраится,
 * пока не случится уход со страницы логина.
 */
export async function loginViaUi(page: Page, handle: string, password: string = PASSWORD): Promise<void> {
  if (!page.url().includes("/login")) {
    await page.goto("/login");
  }
  await page.getByLabel("Никнейм").fill(handle);
  await page.getByLabel("Пароль").fill(password);
  await expect(async () => {
    await page.getByRole("button", { name: "Войти" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

/**
 * Уникальный X-Forwarded-For для изоляции login-rate-limit (ключ — первый хоп XFF).
 * In-memory счётчики живут до рестарта стенда, поэтому каждый тест с неудачными
 * логинами обязан использовать собственный адрес.
 */
export function uniqueXff(testInfo: TestInfo): string {
  const seedNum = Math.abs(
    [...`${testInfo.testId}:${Date.now()}`].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7),
  );
  const a = 1 + (seedNum % 254);
  const b = 1 + (Math.floor(seedNum / 254) % 254);
  const c = 1 + (Math.floor(seedNum / 254 / 254) % 254);
  return `10.${c}.${b}.${a}`;
}
