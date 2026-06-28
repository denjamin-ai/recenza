// JSON-LD (schema.org) для страниц контента. Экранируем "<" → "<" (защита от закрытия тега script).

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
