// Инлайн-markdown в тексте блоков: **жирный**, *курсив*, `код`, [подпись](url). Включён в Фазе 6,
// когда у автора появился инлайн-тулбар (B/I/Code/Link), который пишет markdown в block.text.
//
// XSS-безопасность ПО ПОСТРОЕНИЮ: возвращаем React-узлы (текстовые ноды авто-экранируются) — никаких
// dangerouslySetInnerHTML (та же гарантия, что и у block-renderer.tsx). Ссылки — только http(s)/относительные;
// иначе рендерим литерал. Грамматика непокрытых маркеров: выводятся как есть, никогда не падаем.
//
// Курсив — только `*...*` (НЕ `_..._`), чтобы snake_case в прозе не превращался в курсив.
// Fast-path: текст без ` * [ возвращается как есть → seed (без markdown-символов) рендерится байт-в-байт.

import { Fragment, type ReactNode } from "react";

const SAFE_URL = /^(https?:\/\/|\/)/i;
const HAS_MARKUP = /[`*[]/;

type Token =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "bold"; v: string }
  | { t: "italic"; v: string }
  | { t: "link"; label: string; url: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let buf = "";
  let i = 0;
  const flush = () => {
    if (buf) {
      tokens.push({ t: "text", v: buf });
      buf = "";
    }
  };

  while (i < text.length) {
    const ch = text[i];

    // `код` (литерал, без вложенных марок)
    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i) {
        flush();
        tokens.push({ t: "code", v: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // [подпись](url)
    if (ch === "[") {
      const m = /^\[([^\]]*)\]\(([^)\s]+)\)/.exec(text.slice(i));
      if (m) {
        flush();
        tokens.push({ t: "link", label: m[1], url: m[2] });
        i += m[0].length;
        continue;
      }
    }

    // **жирный** (до курсива, чтобы * не перехватил)
    if (ch === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end > i + 1) {
        flush();
        tokens.push({ t: "bold", v: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    // *курсив*
    if (ch === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i) {
        flush();
        tokens.push({ t: "italic", v: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    buf += ch;
    i++;
  }
  flush();
  return tokens;
}

/** Текст блока с инлайн-марками → React-узлы. Plain-текст (без марок) возвращается как есть (byte-identical). */
export function renderInline(text: string): ReactNode {
  if (!text || !HAS_MARKUP.test(text)) return text;
  return tokenize(text).map((tok, idx) => {
    switch (tok.t) {
      case "text":
        return <Fragment key={idx}>{tok.v}</Fragment>;
      case "code":
        return (
          <code
            key={idx}
            className="rounded border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-1 py-0.5 font-mono text-[0.9em]"
          >
            {tok.v}
          </code>
        );
      case "bold":
        return <strong key={idx}>{tok.v}</strong>;
      case "italic":
        return <em key={idx}>{tok.v}</em>;
      case "link": {
        if (!SAFE_URL.test(tok.url)) {
          // небезопасный/битый URL — выводим литерал, не делаем ссылку
          return <Fragment key={idx}>{`[${tok.label}](${tok.url})`}</Fragment>;
        }
        const external = /^https?:\/\//i.test(tok.url);
        return (
          <a
            key={idx}
            href={tok.url}
            className="text-[var(--accent)] underline underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
          >
            {tok.label || tok.url}
          </a>
        );
      }
    }
  });
}

/** Снимает инлайн-марки, оставляя чистый текст (для SEO-описаний и текста оглавления). */
export function stripInlineMarks(text: string): string {
  if (!text || !HAS_MARKUP.test(text)) return text;
  return tokenize(text)
    .map((tok) => (tok.t === "link" ? tok.label : tok.v))
    .join("");
}
