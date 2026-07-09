"use client";

// Клиентская отрисовка mermaid (Фаза 12): ленивый dynamic import (~2 МБ платят только страницы
// со схемами) + рендер по попаданию в вьюпорт (IntersectionObserver). Тема-aware (next-themes,
// re-render при смене). securityLevel:"strict" — mermaid санитизирует SVG, поэтому
// dangerouslySetInnerHTML санкционирован (как Shiki/KaTeX). Ошибка → русский fallback,
// исходник остаётся доступен в <details> обёртки (mermaid-block.tsx).

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

let seq = 0;

export function MermaidDiagram({ code }: { code: string }) {
  const { resolvedTheme } = useTheme();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: "200px" },
    );
    io.observe(host);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !code.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: resolvedTheme === "dark" ? "dark" : "neutral",
          fontFamily: "var(--font-sans)",
        });
        const id = `mmd-${Date.now().toString(36)}-${seq++}`;
        const out = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(out.svg);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setSvg(null);
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, code, resolvedTheme]);

  if (!code.trim()) return null;

  return (
    <div ref={hostRef} className="px-4 py-3">
      {failed ? (
        <p className="text-[length:var(--type-small)] text-[var(--warning)]">
          Не удалось отрисовать диаграмму — проверьте синтаксис (исходник ниже).
        </p>
      ) : svg ? (
        <div
          role="img"
          aria-label="Диаграмма Mermaid"
          className="flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p aria-hidden="true" className="animate-pulse text-[length:var(--type-small)] text-[var(--muted-foreground)]">
          Диаграмма загружается…
        </p>
      )}
    </div>
  );
}
