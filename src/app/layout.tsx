import type { Metadata } from "next";
import { headers } from "next/headers";
import { Lora, Literata, Fira_Code } from "next/font/google";
import { ThemeProvider } from "./providers";
import "./globals.css";

// Переменные-шрифты (полная ось весов), subsets latin+cyrillic — UI на русском.
// Имена --ff-* отличаются от токенов --font-* (см. globals.css), стек собирается там.
const fontDisplay = Lora({
  variable: "--ff-display",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const fontSans = Literata({
  variable: "--ff-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const fontMono = Fira_Code({
  variable: "--ff-mono",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Recenza — девблог с редакционным ревью",
    template: "%s | Recenza",
  },
  description:
    "Recenza — платформа для технических авторов: многоглавные блоги и встроенный процесс редакционного ревью.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // nonce из CSP-middleware (src/middleware.ts). Нужен next-themes для его инлайн-скрипта темы:
  // без nonce CSP заблокирует скрипт и тема перестанет применяться до гидрации.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider nonce={nonce}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
