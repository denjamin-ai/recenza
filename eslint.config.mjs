import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Playwright-спеки: `use` из test.extend() — не React-хук; пустая деструктуризация
  // `{}` в фикстурах — идиома Playwright.
  {
    files: ["testing/e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "no-empty-pattern": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Прототип/эталоны и временный каркас — не код приложения, не линтуем:
    "docs/**",
    "next-scaffold/**",
    // Harness тест-стенда (tsx-скрипты для playwright-tester) — тулинг, не код приложения:
    ".claude/**",
    // Сгенерированные Playwright-артефакты (отчёты, трейсы, auth-state) — не линтуем:
    "testing/reports/**",
    "testing/e2e/.auth/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
