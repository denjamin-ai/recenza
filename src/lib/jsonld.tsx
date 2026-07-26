// JSON-LD (schema.org) для страниц контента. Экранируем "<" → "<" (защита от закрытия тега script).
//
// ⚠️ nonce здесь НЕ нужен и его НЕЛЬЗЯ проставлять (проверено e2e при вводе CSP, аудит ИБ
// 2026-07-26). Причины две:
//   1. `type="application/ld+json"` — data block: по HTML-спеке «prepare the script element»
//      выходит до проверки CSP, скрипт не исполняется и script-src его не блокирует.
//   2. Браузер намеренно скрывает значение атрибута nonce от чтения из DOM (антиэксфильтрация),
//      поэтому при гидрации React видит nonce="" против серверного nonce="…" — hydration mismatch
//      на каждой странице главы.

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
