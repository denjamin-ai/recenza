"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Тема через атрибут data-theme на <html> (совпадает с селектором html[data-theme="dark"]
// в globals.css). По умолчанию — системная (prefers-color-scheme), переключается рантаймом.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
