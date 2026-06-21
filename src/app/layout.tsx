import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
