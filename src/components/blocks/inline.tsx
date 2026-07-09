// Инлайн-markdown в тексте блоков: **жирный**, *курсив*, `код`, [подпись](url), $формула$ (Фаза 12).
// Включён в Фазе 6, когда у автора появился инлайн-тулбар (B/I/Code/Link), который пишет markdown
// в block.text. Модуль СЕРВЕРНЫЙ (импортёры — RSC): KaTeX не попадает в клиентский бандл.
//
// XSS-безопасность ПО ПОСТРОЕНИЮ: возвращаем React-узлы (текстовые ноды авто-экранируются).
// Единственный dangerouslySetInnerHTML — вывод KaTeX (trust:false экранирует ввод; санкционирован,
// как Shiki в CodeBlock). Ссылки — только http(s)/относительные; иначе рендерим литерал.
// Грамматика непокрытых маркеров: выводятся как есть, никогда не падаем.
//
// Курсив — только `*...*` (НЕ `_..._`), чтобы snake_case в прозе не превращался в курсив.
// Математика: $...$ с анти-ценовыми правилами (после «$» не пробел/цифра+конец, перед закрывающим
// не пробел, после него не цифра) — «цена $5», «5$ и 10$» остаются литералами.
// Fast-path: текст без ` * [ $ возвращается как есть → seed рендерится байт-в-байт.

import { Fragment, type ReactNode } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

const SAFE_URL = /^(https?:\/\/|\/)/i;
const HAS_MARKUP = /[`*[$]/;

type Token =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "bold"; v: string }
  | { t: "italic"; v: string }
  | { t: "link"; label: string; url: string }
  | { t: "math"; v: string };

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

    // $формула$. Анти-цены: после "$" не пробел/не "$", перед закрывающим не пробел, после — не
    // цифра; ПЛЮС содержимое должно быть похоже на LaTeX (есть \ ^ _ { } = или латинская буква)
    // и не содержать кириллицы — иначе «цена $5 и 10$ рублей» превращалась в math (найдено e2e).
    if (ch === "$" && text[i + 1] !== "$" && text[i + 1] && !/\s/.test(text[i + 1])) {
      const end = text.indexOf("$", i + 1);
      if (
        end > i + 1 &&
        !/\s/.test(text[end - 1]) &&
        (end + 1 >= text.length || !/\d/.test(text[end + 1]))
      ) {
        const inner = text.slice(i + 1, end);
        if (/[\\^_{}=]|[a-zA-Z]/.test(inner) && !/[а-яё]/i.test(inner)) {
          flush();
          tokens.push({ t: "math", v: inner });
          i = end + 1;
          continue;
        }
      }
    }

    buf += ch;
    i++;
  }
  flush();
  return tokens;
}

/** $...$ → KaTeX inline-HTML; ошибка формулы → литерал `$...$` (никогда не падаем). */
function renderMath(tex: string, key: number): ReactNode {
  try {
    const html = katex.renderToString(tex, {
      displayMode: false,
      throwOnError: true,
      trust: false,
      strict: "ignore",
    });
    return <span key={key} dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <Fragment key={key}>{`$${tex}$`}</Fragment>;
  }
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
      case "math":
        return renderMath(tok.v, idx);
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

/** Снимает инлайн-марки, оставляя чистый текст (для SEO-описаний и текста оглавления).
 *  Math-токены выбрасываются: сырой TeX в description/ToC — мусор. */
export function stripInlineMarks(text: string): string {
  if (!text || !HAS_MARKUP.test(text)) return text;
  return tokenize(text)
    .map((tok) => (tok.t === "link" ? tok.label : tok.t === "math" ? "" : tok.v))
    .join("")
    .replace(/\s{2,}/g, " ");
}
