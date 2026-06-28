// Mermaid-блок — source-stub (RSC, без client-JS): нативный <details> показывает исходник схемы.
// Рендер идентичен в ридере и ревью. Реальная отрисовка mermaid-js — Фаза 12 (за тем же бордером).

export function MermaidBlock({ code }: { code: string }) {
  return (
    <figure className="my-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)]">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-[length:var(--type-small)] text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] [&::-webkit-details-marker]:hidden">
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
