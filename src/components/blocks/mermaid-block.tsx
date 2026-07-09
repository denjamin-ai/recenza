// Mermaid-блок (RSC-обёртка). Фаза 12: реальная отрисовка клиентским <MermaidDiagram> (ленивый
// mermaid-js, тема-aware) + прежний <details> с исходником (fallback и «показать исходник»).
// Рендер идентичен в ридере и ревью.

import { MermaidDiagram } from "./mermaid-diagram";

export function MermaidBlock({ code }: { code: string }) {
  return (
    <figure className="my-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)]">
      <MermaidDiagram code={code} />
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] [&::-webkit-details-marker]:hidden">
          <span>Диаграмма (Mermaid)</span>
          <span aria-hidden="true">Показать исходник</span>
        </summary>
        <pre className="overflow-x-auto border-t border-[var(--border)] px-4 py-3 font-mono text-[length:var(--type-code)] text-[var(--foreground)]">
          <code>{code}</code>
        </pre>
      </details>
    </figure>
  );
}
