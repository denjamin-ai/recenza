// 404 для скрытого/несуществующего блога или неопубликованной главы (notFound() из страниц ридера).

import Link from "next/link";

export default function BlogNotFound() {
  return (
    <div className="mx-auto w-full max-w-[var(--max-content)] px-6 py-24 text-center">
      <h1 className="text-[length:var(--type-h2)]">Публикация не найдена</h1>
      <p className="mt-4 text-[var(--muted-foreground)]">
        Эта глава не существует, ещё не опубликована или недоступна.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      >
        На главную
      </Link>
    </div>
  );
}
