// LaTeX-блок (Фаза 12) — RSC: katex.renderToString работает на сервере, клиентского JS ноль.
// dangerouslySetInnerHTML санкционирован (третий случай после Shiki/mermaid): KaTeX с trust:false
// экранирует ввод и не пропускает HTML/URL-команды. Ошибка формулы — русский fallback с исходником.

import katex from "katex";
import "katex/dist/katex.min.css";

export function LatexBlock({ tex }: { tex: string }) {
  const source = tex.trim();
  if (!source) return null;

  let html: string | null = null;
  try {
    html = katex.renderToString(source, {
      displayMode: true,
      throwOnError: true,
      trust: false,
      strict: "ignore",
    });
  } catch {
    html = null;
  }

  if (html === null) {
    return (
      <figure className="my-6 rounded-[var(--radius-lg)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3">
        <p className="mb-1 text-[length:var(--type-small)] font-medium text-[var(--warning)]">
          Ошибка в формуле
        </p>
        <pre className="overflow-x-auto font-mono text-[length:var(--type-code)] text-[var(--foreground)]">
          <code>{source}</code>
        </pre>
      </figure>
    );
  }

  return (
    <div
      className="my-6 overflow-x-auto text-[var(--foreground)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
