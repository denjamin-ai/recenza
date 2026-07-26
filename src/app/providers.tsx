"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Тема через атрибут data-theme на <html> (совпадает с селектором html[data-theme="dark"]
// в globals.css). По умолчанию — системная (prefers-color-scheme), переключается рантаймом.
// ⚠️ nonce ОБЯЗАТЕЛЕН при включённом CSP (src/middleware.ts): next-themes инжектит инлайн-скрипт
// выбора темы до гидрации, и без nonce браузер его заблокирует — страница останется в светлой теме
// с миганием при переходах.
export function ThemeProvider({
  children,
  nonce,
}: {
  children: React.ReactNode;
  nonce?: string;
}) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      {children}
    </NextThemesProvider>
  );
}
