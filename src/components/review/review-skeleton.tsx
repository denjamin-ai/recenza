// Скелетон ReviewPage (Фаза 7) для loading.tsx — лёгкая заглушка на время серверного рендера
// (BlockRenderer с диффом по крупным блокам). Только токены; без анимаций тяжелее opacity.

export function ReviewSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-[var(--background)]" aria-busy="true">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <div className="h-5 w-1/3 rounded-[var(--radius-sm)] bg-[var(--muted)]" />
        <div className="mt-2 h-3 w-1/4 rounded-[var(--radius-sm)] bg-[var(--muted)] opacity-60" />
      </div>
      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        <div className="space-y-3 overflow-hidden px-6 py-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 rounded-[var(--radius-sm)] bg-[var(--muted)] opacity-60" style={{ width: `${90 - i * 6}%` }} />
          ))}
        </div>
        <div className="hidden border-l border-[var(--border)] bg-[var(--bg-secondary)] p-4 md:block">
          <div className="h-3 w-1/2 rounded-[var(--radius-sm)] bg-[var(--muted)]" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)]" />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Загрузка ревью…</span>
    </div>
  );
}
