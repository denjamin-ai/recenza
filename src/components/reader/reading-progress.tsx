"use client";

// Полоса прогресса чтения вверху страницы. Только transform (scaleX) — без layout-триггеров.
// prefers-reduced-motion гасит transition (см. globals.css).

import { useEffect, useState } from "react";

export function ReadingProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let raf = 0;
    function update() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.documentElement;
        const max = el.scrollHeight - el.clientHeight;
        setPct(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
      });
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent" aria-hidden="true">
      <div
        className="h-full origin-left bg-[var(--accent)] transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${pct})` }}
      />
    </div>
  );
}
