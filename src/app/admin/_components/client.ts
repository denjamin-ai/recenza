// Клиентский помощник для admin-мутаций (Фаза 10): same-origin fetch + единый разбор ошибки.
// CSRF проверяется сервером (assertSameOrigin); браузер шлёт Origin автоматически. Возвращает
// { ok, error } — вызывающий показывает error и/или делает router.refresh() в startTransition.

export interface AdminResult {
  ok: boolean;
  error?: string;
}

export async function adminMutate(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<AdminResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return { ok: true };
    let error = "Не удалось выполнить действие.";
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) error = data.error;
    } catch {
      /* нет тела ошибки */
    }
    return { ok: false, error };
  } catch {
    return { ok: false, error: "Сетевая ошибка. Проверьте соединение." };
  }
}
