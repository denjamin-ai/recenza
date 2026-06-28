// Главная (лента). Фаза 4 — заглушка оболочки; реальная лента/каталог/карусель промо-баннеров — Фаза 5/10.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-16">
      {/* Слот карусели промо-баннеров (контракт места) — наполнение/логика в Фазе 10. */}
      <h1>Лента</h1>
      <p className="mt-4 max-w-2xl text-[var(--muted-foreground)]">
        Публичная лента многоглавных блогов появится в Фазе 5. Сейчас готов каркас платформы:
        аутентификация, роли и ролевые оболочки.
      </p>
    </div>
  );
}
