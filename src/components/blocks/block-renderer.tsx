// Общий рендерер блоков — ЕДИНЫЙ источник вывода для ридера (Фаза 5) и ревью (Фаза 7).
// Рендер идентичен (CLAUDE.md §MDX: «рендер идентичен в ридере и ревью»). Ревью-хром
// (маркеры тредов, инлайн-дифф) Фаза 7 навешивает ОБЁРТКАМИ вокруг, не форком этого файла.
//
// RSC: компонент синхронный, но рендерит async-child <CodeBlock/> (React server awaits его сам).
// Текст блоков выводится текстовыми узлами React (авто-экранирование) — XSS из контента нет;
// единственный dangerouslySetInnerHTML — внутри CodeBlock (вывод Shiki, экранирован).

import type { ReactNode } from "react";
import type { Block } from "@/types";
import { diffWords } from "@/lib/diff";
import { blockAnchorId } from "./anchors";
import { renderInline } from "./inline";
import { CodeBlock } from "./code-block";
import { MermaidBlock } from "./mermaid-block";
import { LatexBlock } from "./latex-block";
import { ImageBlock } from "./image-block";

export type BlockRenderMode = "reader" | "review";

/**
 * Текст блока для review-режима с инлайн-диффом относительно предыдущей (опубликованной) версии.
 * Дифф по словам (см. src/lib/diff.ts): вставки → `.diff-edit`, удаления опускаются. Инлайн-markdown
 * в изменённом блоке показывается литералом (осознанное упрощение, D3 в PLAN; markdown-aware дифф — backlog).
 * Без baseline / без изменений — обычный renderInline.
 */
function renderText(block: Block, prev: Block | undefined): ReactNode {
  const cur = block.text ?? "";
  if (!prev) return renderInline(cur);
  const prevText = prev.text ?? "";
  if (prevText === cur) return renderInline(cur);
  return diffWords(prevText, cur)
    .filter((p) => p.type !== "del")
    .map((p, i) =>
      p.type === "ins" ? (
        <span key={i} className="diff-edit">
          {p.text}
        </span>
      ) : (
        <span key={i}>{p.text}</span>
      ),
    );
}

const CALLOUT_STYLES: Record<string, { box: string; label: string; title: string }> = {
  info: {
    box: "border-[var(--info-border)] bg-[var(--info-bg)]",
    label: "text-[var(--info)]",
    title: "Заметка",
  },
  warning: {
    box: "border-[var(--warning-border)] bg-[var(--warning-bg)]",
    label: "text-[var(--warning)]",
    title: "Важно",
  },
  note: {
    box: "border-[var(--border)] bg-[var(--bg-secondary)]",
    label: "text-[var(--muted-foreground)]",
    title: "Примечание",
  },
};

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function renderBlock(block: Block, prefix?: string, prev?: Block) {
  switch (block.type) {
    case "h2":
      return (
        <h2 id={blockAnchorId(block.id, prefix)} className="mt-10 scroll-mt-24 text-[length:var(--type-h2)]">
          {renderText(block, prev)}
        </h2>
      );
    case "h3":
      return (
        <h3 id={blockAnchorId(block.id, prefix)} className="mt-8 scroll-mt-24 text-[length:var(--type-h3)]">
          {renderText(block, prev)}
        </h3>
      );
    case "p":
      return <p className="my-4 leading-[var(--leading-body)]">{renderText(block, prev)}</p>;
    case "quote":
      return (
        <blockquote className="my-6 border-l-2 border-[var(--accent)] pl-4 italic text-[var(--muted-foreground)]">
          {renderText(block, prev)}
        </blockquote>
      );
    case "list": {
      const items = asStringArray(block.items);
      const variant = typeof block.variant === "string" ? block.variant : "bullet";
      if (variant === "todo") {
        return (
          <ul className="my-4 space-y-1.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <input type="checkbox" disabled aria-hidden="true" className="mt-1.5 accent-[var(--accent)]" />
                <span>{renderInline(item)}</span>
              </li>
            ))}
          </ul>
        );
      }
      const cls = "my-4 space-y-1.5 pl-6";
      return variant === "numbered" ? (
        <ol className={`${cls} list-decimal`}>
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      ) : (
        <ul className={`${cls} list-disc`}>
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    }
    case "code":
      return <CodeBlock code={block.text ?? ""} lang={typeof block.lang === "string" ? block.lang : undefined} />;
    case "callout": {
      const variant = typeof block.variant === "string" ? block.variant : "note";
      const style = CALLOUT_STYLES[variant] ?? CALLOUT_STYLES.note;
      return (
        <aside className={`my-6 rounded-[var(--radius-lg)] border px-4 py-3 ${style.box}`}>
          <p className={`mb-1 text-[length:var(--type-small)] font-medium ${style.label}`}>{style.title}</p>
          <p className="leading-[var(--leading-body)] text-[var(--foreground)]">{renderInline(block.text ?? "")}</p>
        </aside>
      );
    }
    case "mermaid":
      return <MermaidBlock code={block.text ?? ""} />;
    case "latex":
      return <LatexBlock tex={block.text ?? ""} />;
    case "image":
      return (
        <ImageBlock
          src={typeof block.src === "string" ? block.src : undefined}
          alt={typeof block.alt === "string" ? block.alt : undefined}
        />
      );
    case "table": {
      const rows = Array.isArray(block.rows) ? (block.rows as unknown[]) : [];
      const matrix = rows.map((r) => asStringArray(r));
      if (matrix.length === 0) return null;
      const [head, ...body] = matrix;
      return (
        <div className="my-6 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)]">
          <table className="w-full border-collapse text-[length:var(--type-small)]">
            <thead>
              <tr className="bg-[var(--bg-secondary)]">
                {head.map((cell, i) => (
                  <th key={i} className="border-b border-[var(--border)] px-3 py-2 text-left font-medium">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="border-b border-[var(--border-secondary)] last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 align-top">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "embed": {
      const url = typeof block.url === "string" ? block.url : "";
      const safe = /^https?:\/\//.test(url);
      if (!safe) return null;
      let host = url;
      try {
        host = new URL(url).host;
      } catch {
        /* оставляем url как есть */
      }
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="my-6 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3 text-[length:var(--type-small)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <span aria-hidden="true">↗</span>
          <span className="min-w-0">
            <span className="block font-medium text-[var(--foreground)]">Встроенное содержимое</span>
            <span className="block truncate font-mono text-[var(--muted-foreground)]">{host}</span>
          </span>
        </a>
      );
    }
    default:
      // Неизвестный тип — приглушённый fallback, никогда не падаем.
      return block.text ? <p className="my-4 text-[var(--muted-foreground)]">{block.text}</p> : null;
  }
}

/**
 * @param blocks   уже распарсенный Block[] (caller: parseJson<Block[]>(rev.blocks, []))
 * @param prefix   префикс для id заголовков (режим «Весь блог» — slug главы; иначе не задаётся)
 * @param mode     reader (Фаза 5) | review (Фаза 7). В review добавляются дифф-полосы/инлайн-дифф.
 * @param prev     снапшот предыдущей (опубликованной) версии для инлайн-диффа (review-режим). Пусто
 *                 → нет baseline (всё рендерится как обычно, без полос «изменён/добавлен»).
 */
export function BlockRenderer({
  blocks,
  prefix,
  mode = "reader",
  prev,
}: {
  blocks: Block[];
  prefix?: string;
  mode?: BlockRenderMode;
  prev?: Block[];
}) {
  const prevById =
    mode === "review" && prev && prev.length > 0 ? new Map(prev.map((b) => [b.id, b])) : null;

  return (
    <>
      {blocks.map((block) => {
        const prevBlock = prevById?.get(block.id);
        // Полоса слева: добавленный блок (нет в baseline) / изменённый текст. Только review + есть baseline.
        let stripe = "";
        if (prevById) {
          if (!prevBlock) stripe = "diff-stripe-add";
          else if ((prevBlock.text ?? "") !== (block.text ?? "")) stripe = "diff-stripe-edit";
        }
        return (
          <div
            key={block.id}
            data-block-id={block.id}
            data-render-mode={mode}
            className={stripe || undefined}
          >
            {renderBlock(block, prefix, prevBlock)}
          </div>
        );
      })}
    </>
  );
}
