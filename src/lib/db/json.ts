// Безопасное чтение JSON-полей БД. JSON хранится как text (не drizzle {mode:"json"}),
// чтобы битый JSON не ронял рендер: парсинг идёт ТОЛЬКО здесь, в try/catch, с безопасным дефолтом.

/**
 * Единственная точка разбора JSON-полей БД (`tags`, `links`, `blocks`, `anchor`, `skills`, …).
 * НЕ вызывать `JSON.parse()` напрямую вне этого файла. При битом/`null` значении возвращает `fallback`.
 * @example const tags = parseJson<string[]>(row.tags, []);
 */
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Зеркальный сериализатор для записи JSON-полей (единая точка кодирования).
export function stringifyJson(value: unknown): string {
  return JSON.stringify(value);
}
