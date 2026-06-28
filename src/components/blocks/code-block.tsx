// Код-блок: подсветка Shiki на СЕРВЕРЕ (dual theme github-light/github-dark через CSS-переменные,
// переключение темы — в globals.css по [data-theme="dark"]). Клиентский бандл не тянет Shiki.
// Содержимое экранируется Shiki (никакого XSS из текста блока). Кнопка копирования — единственный client-кусок.

import { codeToHtml } from "shiki";
import { CopyButton } from "./copy-button";

const THEMES = { light: "github-light", dark: "github-dark" } as const;

export async function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const language = (lang || "text").toLowerCase();
  let html: string;
  try {
    html = await codeToHtml(code, { lang: language, themes: THEMES, defaultColor: false });
  } catch {
    // Неизвестный язык — рендерим как plain text, не роняя страницу.
    html = await codeToHtml(code, { lang: "text", themes: THEMES, defaultColor: false });
  }

  return (
    <figure className="group relative my-6">
      <CopyButton text={code} />
      <div
        className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] text-[length:var(--type-code)] [&_pre]:m-0 [&_pre]:p-4"
        // Безопасно: Shiki экранирует содержимое в span'ы; сырой пользовательский HTML сюда не попадает.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}
