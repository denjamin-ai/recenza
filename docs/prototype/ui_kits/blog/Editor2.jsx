// Editor v2 — primitives + block components.
// (Helpers, ContentEditable wrapper, inline toolbar and slash menu were merged
//  here from the retired Editor.jsx; block components follow below.)
// Exposes: window.__editorHelpers, window.Editable, window.InlineToolbar,
//          window.SlashMenu, window.EditorBlocks.

// ═════════ Helpers & inline primitives (from Editor.jsx) ═════════
// Editor v2 — hybrid block + inline-format + markdown-shortcut editor.
// Replaces the older EditorScreen exported from Author.jsx via window override.
//
// Layout:
//   • Sticky top bar  — back / status / preview toggle / "Отправить ревьюерам"
//   • Center column   — block editor (max-w-[760px])
//   • Right rail      — cover / title / slug / tags / сложность / ревьюеры /
//                       срок / записка / чек-лист готовности
//   • Mobile <lg      — right rail becomes a bottom-sheet drawer ("Метаданные")
//
// Block types: h2, h3, p, list (bullet/numbered/todo), code, quote,
//              callout (note/warning/info), mermaid, latex, image, table, embed.
// Inline format: B/I/Code/Link via floating popover on text selection.
// Markdown shortcuts at start of paragraph: ## / ### / > / - / 1. / [] / ``` / > note: / > warning: / > info: / $$  / > mermaid:
//
// Globals exposed: window.EditorScreen (overrides the legacy one in Author.jsx).

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const COMPLEXITY = {
  simple:  { label: "Простая",  min: 1, max: 2, hint: "1 ревьюер хватит; максимум 2." },
  medium:  { label: "Средняя",  min: 2, max: 3, hint: "2 ревьюера — оптимально; максимум 3." },
  complex: { label: "Сложная",  min: 3, max: 5, hint: "Минимум 3 ревьюера; до 5 для глубокого ревью." },
};
const COMPLEXITY_ORDER = ["simple", "medium", "complex"];

const BLOCK_LABEL = {
  h2: "Заголовок H2", h3: "Заголовок H3", p: "Параграф",
  list: "Список", code: "Код", quote: "Цитата", callout: "Callout",
  mermaid: "Схема (Mermaid)", latex: "Формула (LaTeX)",
  image: "Изображение", table: "Таблица", embed: "Embed",
};

// Slash-menu groups. Order matters for keyboard nav.
const SLASH_GROUPS = [
  { label: "Текст",        items: [
    { type: "p",    title: "Параграф",   hint: "обычный текст" },
    { type: "h2",   title: "Заголовок 2", hint: "## " },
    { type: "h3",   title: "Заголовок 3", hint: "### " },
    { type: "quote",title: "Цитата",      hint: "> " },
  ]},
  { label: "Списки",       items: [
    { type: "list",       subtype: "bullet",   title: "Маркированный",  hint: "- " },
    { type: "list",       subtype: "numbered", title: "Нумерованный",   hint: "1. " },
    { type: "list",       subtype: "todo",     title: "Чек-лист",       hint: "[] " },
  ]},
  { label: "Блоки",        items: [
    { type: "code",    title: "Код",          hint: "``` " },
    { type: "callout", subtype: "note",    title: "Callout",       hint: "> note:" },
    { type: "image",   title: "Изображение", hint: "вставить картинку" },
    { type: "table",   title: "Таблица",     hint: "" },
  ]},
  { label: "Спец.",        items: [
    { type: "mermaid", title: "Схема Mermaid", hint: "> mermaid:" },
    { type: "latex",   title: "LaTeX-формула", hint: "$$" },
    { type: "embed",   title: "Embed (видео / ссылка)", hint: "" },
  ]},
];

// Default empty payload for each block type.
function emptyBlock(type, subtype) {
  const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  switch (type) {
    case "h2":      return { id, type: "h2", text: "" };
    case "h3":      return { id, type: "h3", text: "" };
    case "quote":   return { id, type: "quote", text: "" };
    case "list":    return { id, type: "list", subtype: subtype || "bullet", items: [{ id: id + "i1", text: "", done: false }] };
    case "code":    return { id, type: "code", lang: "ts", text: "" };
    case "callout": return { id, type: "callout", tone: subtype || "note", text: "" };
    case "mermaid": return { id, type: "mermaid", text: "graph TD\n  A[Запрос] --> B[Сервер]\n  B --> C[Ответ]" };
    case "latex":   return { id, type: "latex", text: "E = mc^2" };
    case "image":   return { id, type: "image", src: "", caption: "" };
    case "table":   return { id, type: "table", rows: [["", ""], ["", ""]] };
    case "embed":   return { id, type: "embed", url: "" };
    case "p":
    default:        return { id, type: "p", text: "" };
  }
}

function slugifyRu(s) {
  const map = { а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", ё:"e", ж:"zh", з:"z", и:"i", й:"y",
    к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t", у:"u", ф:"f", х:"h",
    ц:"ts", ч:"ch", ш:"sh", щ:"sch", ъ:"", ы:"y", ь:"", э:"e", ю:"yu", я:"ya" };
  return (s || "").toLowerCase().split("").map(c => map[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled";
}

// Strip HTML to plain text (for markdown-shortcut detection and char-count).
function stripHtml(html) {
  if (!html) return "";
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.textContent || "";
}

// Pluralization for "ревьюер".
function pluralReviewers(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "ревьюер";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "ревьюера";
  return "ревьюеров";
}

// ─────────────────────────────────────────────────────────────────
// ContentEditable wrapper. Mounts innerHTML once and forwards
// input/key events. Lets parent control HTML via a controlled ref;
// re-mounts a fresh DOM when block type changes.
// ─────────────────────────────────────────────────────────────────
function Editable({ html, onInput, onKeyDown, placeholder, className = "", tag = "div", autoFocus = false }) {
  const ref = useRef(null);

  // Initial mount: drop html into the DOM once.
  useEffect(() => {
    if (ref.current && (html ?? "") !== ref.current.innerHTML) {
      ref.current.innerHTML = html ?? "";
    }
    if (autoFocus && ref.current) {
      ref.current.focus();
      placeCaretAtEnd(ref.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External html-prop changes (rare — only when blockType swaps reuse the
  // same Editable node by accident). Skip when the user is typing.
  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement === ref.current) return;
    if ((html ?? "") !== ref.current.innerHTML) {
      ref.current.innerHTML = html ?? "";
    }
  }, [html]);

  const Tag = tag;
  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder || ""}
      className={`editor-editable outline-none ${className}`}
      onInput={(e) => onInput?.(e.currentTarget.innerHTML)}
      onKeyDown={onKeyDown}
    />
  );
}

function placeCaretAtEnd(el) {
  if (!el) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// ─────────────────────────────────────────────────────────────────
// Inline format popover (B / I / Code / Link). Tracks selection
// globally, shows above the current range when non-empty.
// ─────────────────────────────────────────────────────────────────
function InlineToolbar({ containerRef }) {
  const [rect, setRect] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { setOpen(false); return; }
      const range = sel.getRangeAt(0);
      // Must be inside an editor-editable surface.
      let node = range.commonAncestorContainer;
      if (node.nodeType !== 1) node = node.parentElement;
      const editable = node?.closest?.(".editor-editable");
      if (!editable) { setOpen(false); return; }
      const r = range.getBoundingClientRect();
      if (!r || (!r.width && !r.height)) { setOpen(false); return; }
      const containerRect = containerRef.current?.getBoundingClientRect();
      setRect({
        top:  r.top  - (containerRect?.top  ?? 0) - 40,
        left: r.left - (containerRect?.left ?? 0) + r.width / 2,
      });
      setOpen(true);
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [containerRef]);

  const apply = (cmd, value) => {
    document.execCommand(cmd, false, value);
    // Refresh — execCommand keeps selection but the popover rect needs reflow.
  };

  if (!open || !rect) return null;
  return (
    <div
      style={{ top: rect.top, left: rect.left, transform: "translateX(-50%)" }}
      className="absolute z-50 flex items-center gap-0.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md p-1 shadow-none"
      onMouseDown={(e) => e.preventDefault()}
    >
      <ToolbarBtn label="B" hotkey="⌘B" onClick={() => apply("bold")}>
        <span className="font-bold">B</span>
      </ToolbarBtn>
      <ToolbarBtn label="Курсив" hotkey="⌘I" onClick={() => apply("italic")}>
        <span className="italic">I</span>
      </ToolbarBtn>
      <ToolbarBtn label="Код" hotkey="⌘E" onClick={() => apply("insertHTML", `<code style="background:var(--code-bg);padding:0 4px;border-radius:4px;font-family:var(--font-mono);font-size:0.92em;">${getSelectionText()}</code>`)}>
        <span className="font-mono text-[12px]">{"<>"}</span>
      </ToolbarBtn>
      <ToolbarBtn label="Ссылка" hotkey="⌘K" onClick={() => {
        const url = window.prompt("URL");
        if (url) apply("createLink", url);
      }}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
          <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
        </svg>
      </ToolbarBtn>
    </div>
  );
}
function ToolbarBtn({ children, onClick, label, hotkey }) {
  return (
    <button
      type="button"
      title={hotkey ? `${label} (${hotkey})` : label}
      onClick={onClick}
      className="w-7 h-7 inline-flex items-center justify-center rounded text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
    >{children}</button>
  );
}
function getSelectionText() {
  return window.getSelection()?.toString() || "";
}

// ─────────────────────────────────────────────────────────────────
// Slash menu — opens when an empty block's first character is "/".
// Filtered by what the user typed after the slash.
// ─────────────────────────────────────────────────────────────────
function SlashMenu({ query, onPick, onClose }) {
  const items = useMemo(() => {
    const all = SLASH_GROUPS.flatMap(g => g.items.map(it => ({ ...it, _group: g.label })));
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter(it => (it.title.toLowerCase().includes(q) || (it.hint || "").toLowerCase().includes(q)));
  }, [query]);
  const [active, setActive] = useState(0);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(items.length - 1, i + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
      else if (e.key === "Enter") { e.preventDefault(); items[active] && onPick(items[active]); }
      else if (e.key === "Escape") { e.preventDefault(); onClose?.(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [items, active, onPick, onClose]);

  return (
    <div className="absolute z-40 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg w-[280px] max-h-[320px] overflow-y-auto py-1">
      {items.length === 0 ? (
        <p className="px-3 py-2 text-[12.5px] text-[var(--muted-foreground)]">Ничего не нашлось</p>
      ) : items.map((it, i) => (
        <button
          key={it.type + (it.subtype || "") + i}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onPick(it); }}
          className={`w-full text-left px-3 py-1.5 text-[13px] flex items-baseline justify-between gap-3 ${i === active ? "bg-[var(--muted)]" : ""} hover:bg-[var(--muted)]`}
        >
          <span className="font-medium">{it.title}</span>
          {it.hint && <span className="text-[11px] text-[var(--muted-foreground)] font-mono">{it.hint}</span>}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Markdown shortcut detection at start of paragraph. Receives plain
// text and returns { type, subtype, stripPrefix } when a match is
// found, or null. Caller swaps block type & clears the matched prefix.
// ─────────────────────────────────────────────────────────────────
function detectMarkdownShortcut(plainText) {
  const t = plainText;
  // Order matters — longer prefixes first.
  if (/^###\s/.test(t))           return { type: "h3", prefix: t.match(/^###\s/)[0] };
  if (/^##\s/.test(t))            return { type: "h2", prefix: t.match(/^##\s/)[0] };
  if (/^>\s*note:\s?/i.test(t))   return { type: "callout", subtype: "note",    prefix: t.match(/^>\s*note:\s?/i)[0] };
  if (/^>\s*warning:\s?/i.test(t))return { type: "callout", subtype: "warning", prefix: t.match(/^>\s*warning:\s?/i)[0] };
  if (/^>\s*info:\s?/i.test(t))   return { type: "callout", subtype: "info",    prefix: t.match(/^>\s*info:\s?/i)[0] };
  if (/^>\s*mermaid:\s?/i.test(t))return { type: "mermaid", prefix: t.match(/^>\s*mermaid:\s?/i)[0] };
  if (/^>\s/.test(t))             return { type: "quote", prefix: t.match(/^>\s/)[0] };
  if (/^```\s?/.test(t))          return { type: "code",  prefix: t.match(/^```\s?/)[0] };
  if (/^\$\$\s?/.test(t))         return { type: "latex", prefix: t.match(/^\$\$\s?/)[0] };
  if (/^-\s/.test(t))             return { type: "list", subtype: "bullet",   prefix: t.match(/^-\s/)[0] };
  if (/^\d+\.\s/.test(t))         return { type: "list", subtype: "numbered", prefix: t.match(/^\d+\.\s/)[0] };
  if (/^\[\]\s/.test(t))          return { type: "list", subtype: "todo",     prefix: t.match(/^\[\]\s/)[0] };
  return null;
}

window.__editorHelpers = { COMPLEXITY, COMPLEXITY_ORDER, SLASH_GROUPS, BLOCK_LABEL, emptyBlock, slugifyRu, stripHtml, pluralReviewers, detectMarkdownShortcut };
window.Editable = Editable;
window.InlineToolbar = InlineToolbar;
window.SlashMenu = SlashMenu;

// ═════════ Block components ═════════
// Editor v2 — block components.
// Each block exports a small React component. Type-router lives in EditorScreen
// (see Editor3.jsx). All blocks accept:
//   { block, onChange(next), onEnter(), onBackspaceEmpty(), focused }
//
// Inline-format editing happens in `Editable` (defined above). The toolbar
// floats globally and uses document.execCommand on the current selection.
// (React hooks + emptyBlock/detectMarkdownShortcut/stripHtml are already in
//  scope from the merged primitives section above.)

// Common block frame: hover-handle on the left edge, "+" between blocks.
function BlockFrame({ children, onAddAfter, onDelete, onChangeType, dragHandlers, onGripDragStart, onGripDragEnd, dropBefore, dragging }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={`group/block relative pl-12 pr-1 transition-opacity ${dragging ? "opacity-40" : ""}`} {...(dragHandlers || {})}>
      {/* Drop indicator — accent bar where the dragged block will land. */}
      {dropBefore && <div className="absolute -top-[3px] left-12 right-1 h-[3px] bg-[var(--accent)] rounded-full z-10 pointer-events-none" />}
      {/* Left-edge handle gutter — horizontal pair, aligned to the first line.
          A row (not a stack) keeps both controls within the block's top line so
          the hover/drag target never spills into the gap between blocks. */}
      <div className="absolute left-0 top-0 w-12 flex items-start justify-end gap-0.5 pt-[3px] pr-1.5 opacity-0 group-hover/block:opacity-100 focus-within:opacity-100 transition-opacity select-none">
        <button
          type="button"
          title="Добавить блок ниже"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
          className="w-6 h-6 rounded text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] inline-flex items-center justify-center text-[16px] leading-none"
        >+</button>
        <button
          type="button"
          title="Перетащить, чтобы переставить · Alt+клик — удалить"
          draggable={!!onGripDragStart}
          onDragStart={onGripDragStart}
          onDragEnd={onGripDragEnd}
          onClick={(e) => { e.stopPropagation(); if (e.altKey) onDelete?.(); else setMenuOpen("ctx"); }}
          className="w-6 h-6 rounded text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] inline-flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><circle cx="9"  cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
        </button>
      </div>
      {menuOpen === "ctx" && (
        <BlockContextMenu
          onClose={() => setMenuOpen(false)}
          onDelete={() => { onDelete?.(); setMenuOpen(false); }}
          onChangeType={(t, st) => { onChangeType?.(t, st); setMenuOpen(false); }}
        />
      )}
      {menuOpen === true && (
        <InsertMenu
          onClose={() => setMenuOpen(false)}
          onPick={(t, st) => { onAddAfter?.(t, st); setMenuOpen(false); }}
        />
      )}
      {children}
    </div>
  );
}

function InsertMenu({ onPick, onClose }) {
  const { SLASH_GROUPS } = window.__editorHelpers;
  return (
    <div className="absolute left-8 top-7 z-30 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg w-[260px] max-h-[300px] overflow-y-auto py-1.5">
      {SLASH_GROUPS.map(g => (
        <div key={g.label}>
          <p className="px-3 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">{g.label}</p>
          {g.items.map((it, i) => (
            <button
              key={it.type + (it.subtype || "") + i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onPick(it.type, it.subtype); }}
              className="w-full text-left px-3 py-1 text-[12.5px] hover:bg-[var(--muted)]"
            >{it.title}</button>
          ))}
        </div>
      ))}
      <ClickOutside onClick={onClose} />
    </div>
  );
}
function BlockContextMenu({ onDelete, onChangeType, onClose }) {
  return (
    <div className="absolute left-8 top-7 z-30 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg w-[200px] py-1">
      <p className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Превратить в</p>
      {[
        { t: "p", l: "Параграф" }, { t: "h2", l: "Заголовок H2" }, { t: "h3", l: "Заголовок H3" },
        { t: "quote", l: "Цитата" }, { t: "code", l: "Код" },
      ].map(o => (
        <button key={o.t} type="button" onMouseDown={(e) => { e.preventDefault(); onChangeType(o.t); }} className="w-full text-left px-3 py-1 text-[12.5px] hover:bg-[var(--muted)]">{o.l}</button>
      ))}
      <hr className="my-1 border-[var(--border)]" />
      <button type="button" onMouseDown={(e) => { e.preventDefault(); onDelete(); }} className="w-full text-left px-3 py-1 text-[12.5px] text-rose-600 hover:bg-rose-500/10">Удалить блок</button>
      <ClickOutside onClick={onClose} />
    </div>
  );
}
function ClickOutside({ onClick }) {
  useEffect(() => {
    const h = () => onClick?.();
    setTimeout(() => document.addEventListener("mousedown", h, { once: true }), 0);
    return () => document.removeEventListener("mousedown", h);
  }, [onClick]);
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Helper used by text blocks: handle Enter / Backspace / markdown shortcut.
// Returns onInput / onKeyDown handlers to pass to <Editable>.
// ─────────────────────────────────────────────────────────────────
function useTextBlockHandlers({ block, onChange, onEnter, onBackspaceEmpty, allowMarkdown = true, replaceType }) {
  const onInput = (html) => {
    const plain = stripHtml(html);
    if (allowMarkdown) {
      const m = detectMarkdownShortcut(plain);
      if (m && replaceType) {
        const newType = m.type;
        const subtype = m.subtype || null;
        // strip prefix from the html (best-effort: strip from leading text node)
        const stripped = html.replace(/^[^<]*?(?=$|<)/, (lead) => lead.slice(m.prefix.length));
        replaceType(newType, subtype, stripped);
        return;
      }
    }
    onChange({ ...block, text: html });
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnter?.();
    } else if (e.key === "Backspace") {
      const sel = window.getSelection();
      const txt = stripHtml(e.currentTarget?.innerHTML);
      if (!txt && sel?.isCollapsed) {
        e.preventDefault();
        onBackspaceEmpty?.();
      }
    }
  };
  return { onInput, onKeyDown };
}

// ─────────────────────────────────────────────────────────────────
// Heading / paragraph / quote — single Editable.
// ─────────────────────────────────────────────────────────────────
function BlockHeading({ block, onChange, onEnter, onBackspaceEmpty, replaceType, focused }) {
  const cls = block.type === "h2"
    ? "font-[var(--font-display)] font-bold text-[28px] leading-[1.2] tracking-tight mb-2 mt-6"
    : "font-[var(--font-display)] font-semibold text-[22px] leading-[1.25] tracking-tight mb-1.5 mt-5";
  const h = useTextBlockHandlers({ block, onChange, onEnter, onBackspaceEmpty, replaceType });
  return (
    <Editable
      html={block.text}
      placeholder={block.type === "h2" ? "Заголовок H2" : "Заголовок H3"}
      className={cls}
      tag={block.type === "h2" ? "h2" : "h3"}
      autoFocus={focused}
      onInput={h.onInput}
      onKeyDown={h.onKeyDown}
    />
  );
}

function BlockParagraph({ block, onChange, onEnter, onBackspaceEmpty, replaceType, focused }) {
  const h = useTextBlockHandlers({ block, onChange, onEnter, onBackspaceEmpty, replaceType });
  return (
    <Editable
      html={block.text}
      placeholder={'Текст параграфа. "/" — команды; "**bold**", "[]", "##" — шорткаты'}
      className="text-[15.5px] leading-[1.75] text-[var(--foreground)] py-1"
      tag="p"
      autoFocus={focused}
      onInput={h.onInput}
      onKeyDown={h.onKeyDown}
    />
  );
}

function BlockQuote({ block, onChange, onEnter, onBackspaceEmpty, replaceType, focused }) {
  const h = useTextBlockHandlers({ block, onChange, onEnter, onBackspaceEmpty, replaceType });
  return (
    <div className="border-l-2 border-[var(--accent)] pl-4 my-2">
      <Editable
        html={block.text}
        placeholder="Цитата"
        className="text-[15.5px] leading-[1.7] italic text-[var(--muted-foreground)] py-0.5"
        tag="div"
        autoFocus={focused}
        onInput={h.onInput}
        onKeyDown={h.onKeyDown}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// List (bullet / numbered / todo)
// ─────────────────────────────────────────────────────────────────
function BlockList({ block, onChange, onEnter, onBackspaceEmpty }) {
  const items = block.items || [];
  const update = (idx, patch) => {
    onChange({ ...block, items: items.map((it, i) => i === idx ? { ...it, ...patch } : it) });
  };
  const insertAfter = (idx) => {
    const fresh = { id: `i-${Date.now()}`, text: "", done: false };
    onChange({ ...block, items: [...items.slice(0, idx + 1), fresh, ...items.slice(idx + 1)] });
  };
  const removeAt = (idx) => {
    if (items.length <= 1) { onBackspaceEmpty?.(); return; }
    onChange({ ...block, items: items.filter((_, i) => i !== idx) });
  };
  const cycleType = () => {
    const order = ["bullet", "numbered", "todo"];
    onChange({ ...block, subtype: order[(order.indexOf(block.subtype || "bullet") + 1) % order.length] });
  };
  return (
    <ul className="my-1 space-y-0.5">
      <li className="absolute right-1 top-1 opacity-0 group-hover/block:opacity-100">
        <button type="button" onClick={cycleType} className="text-[10.5px] uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--accent)]">
          {block.subtype}
        </button>
      </li>
      {items.map((it, i) => (
        <li key={it.id} className="flex items-baseline gap-2">
          {block.subtype === "bullet"   && <span className="text-[var(--muted-foreground)] select-none">•</span>}
          {block.subtype === "numbered" && <span className="text-[var(--muted-foreground)] tabular-nums select-none w-4 text-right">{i + 1}.</span>}
          {block.subtype === "todo"     && (
            <input type="checkbox" checked={!!it.done} onChange={(e) => update(i, { done: e.target.checked })} className="accent-[var(--accent)] translate-y-[1px]" />
          )}
          <Editable
            html={it.text}
            placeholder="Элемент"
            className={`flex-1 text-[15px] leading-[1.65] ${it.done ? "line-through opacity-60" : ""}`}
            tag="div"
            onInput={(html) => update(i, { text: html })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const isEmpty = !stripHtml(e.currentTarget.innerHTML);
                if (isEmpty && i === items.length - 1) onEnter?.();
                else insertAfter(i);
              } else if (e.key === "Backspace" && !stripHtml(e.currentTarget.innerHTML)) {
                e.preventDefault();
                removeAt(i);
              }
            }}
          />
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────
// Code (plain textarea + language select)
// ─────────────────────────────────────────────────────────────────
function BlockCode({ block, onChange }) {
  const LANGS = ["ts", "js", "tsx", "jsx", "rs", "go", "py", "sh", "json", "yaml", "sql", "html", "css"];
  return (
    <div className="my-2 rounded-lg border border-[var(--border)] bg-[var(--code-bg)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
        <select
          value={block.lang || "ts"}
          onChange={(e) => onChange({ ...block, lang: e.target.value })}
          className="bg-transparent text-[11px] uppercase tracking-wider font-medium text-[var(--muted-foreground)] focus:outline-none cursor-pointer"
        >
          {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Код</span>
      </div>
      <textarea
        value={block.text}
        onChange={(e) => onChange({ ...block, text: e.target.value })}
        rows={Math.max(3, (block.text || "").split("\n").length)}
        spellCheck={false}
        placeholder="// код"
        className="block w-full bg-transparent text-[13px] font-mono leading-[1.6] text-[var(--foreground)] px-4 py-3 resize-none focus:outline-none"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Callout (note / warning / info)
// ─────────────────────────────────────────────────────────────────
function BlockCallout({ block, onChange, focused }) {
  const TONE = {
    note:    { bg: "var(--info-bg)",    bd: "var(--info-border)",    fg: "var(--info)",    label: "Note" },
    warning: { bg: "var(--warning-bg)", bd: "var(--warning-border)", fg: "var(--warning)", label: "Warning" },
    info:    { bg: "var(--success-bg)", bd: "var(--success-border)", fg: "var(--success)", label: "Info" },
  };
  const t = TONE[block.tone] || TONE.note;
  return (
    <div
      className="my-2 rounded-lg border px-4 py-3"
      style={{ background: t.bg, borderColor: t.bd }}
    >
      <div className="flex items-center gap-2 mb-1">
        <select
          value={block.tone}
          onChange={(e) => onChange({ ...block, tone: e.target.value })}
          style={{ color: t.fg }}
          className="bg-transparent text-[10.5px] uppercase tracking-wider font-semibold focus:outline-none cursor-pointer"
        >
          <option value="note">note</option>
          <option value="warning">warning</option>
          <option value="info">info</option>
        </select>
      </div>
      <Editable
        html={block.text}
        placeholder={`${t.label}: текст`}
        className="text-[14.5px] leading-[1.65]"
        tag="div"
        autoFocus={focused}
        onInput={(html) => onChange({ ...block, text: html })}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Mermaid / LaTeX — raw textarea + small preview placeholder.
// ─────────────────────────────────────────────────────────────────
function BlockTechnical({ block, onChange, kind }) {
  return (
    <div className="my-2 rounded-lg border border-[var(--border)] overflow-hidden grid grid-cols-1 md:grid-cols-2">
      <div className="border-r border-[var(--border)] md:border-r md:border-b-0 border-b">
        <div className="px-3 py-1 border-b border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-between">
          <span className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">{kind === "mermaid" ? "Mermaid" : "LaTeX"}</span>
          <span className="text-[10px] text-[var(--muted-foreground)]">источник</span>
        </div>
        <textarea
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          rows={Math.max(4, (block.text || "").split("\n").length)}
          spellCheck={false}
          className="block w-full bg-[var(--code-bg)] text-[12.5px] font-mono leading-[1.6] px-3 py-2 resize-none focus:outline-none"
        />
      </div>
      <div className="bg-[var(--bg-secondary)] p-4 flex items-center justify-center text-center min-h-[120px]">
        <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed">
          превью {kind === "mermaid" ? "схемы" : "формулы"} появится при сборке<br/>
          <span className="opacity-60">в kit-режиме рендеринг отключён</span>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Image, Table, Embed
// ─────────────────────────────────────────────────────────────────
function BlockImage({ block, onChange }) {
  return (
    <div className="my-2">
      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] aspect-[16/9] flex items-center justify-center">
        {block.src ? (
          <img src={block.src} alt={block.caption || ""} className="w-full h-full object-cover rounded-lg" />
        ) : (
          <div className="text-center px-6">
            <p className="text-[12.5px] text-[var(--muted-foreground)] mb-2">Перетащите файл сюда или вставьте URL</p>
            <input
              type="text"
              value={block.src}
              onChange={(e) => onChange({ ...block, src: e.target.value })}
              placeholder="https://…"
              className="w-full max-w-xs bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-[12.5px] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        )}
      </div>
      <input
        type="text"
        value={block.caption}
        onChange={(e) => onChange({ ...block, caption: e.target.value })}
        placeholder="Подпись (опционально)"
        className="block w-full bg-transparent border-b border-transparent focus:border-[var(--border)] text-[12.5px] text-[var(--muted-foreground)] mt-2 py-1 focus:outline-none text-center"
      />
    </div>
  );
}

function BlockTable({ block, onChange }) {
  const rows = block.rows || [["", ""]];
  const setCell = (r, c, v) => {
    const next = rows.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? v : cell) : row);
    onChange({ ...block, rows: next });
  };
  const addRow = () => onChange({ ...block, rows: [...rows, Array(rows[0].length).fill("")] });
  const addCol = () => onChange({ ...block, rows: rows.map(r => [...r, ""]) });
  const removeRow = (i) => rows.length > 1 && onChange({ ...block, rows: rows.filter((_, ri) => ri !== i) });
  const removeCol = (i) => rows[0].length > 1 && onChange({ ...block, rows: rows.map(r => r.filter((_, ci) => ci !== i)) });
  return (
    <div className="my-2 overflow-x-auto -mx-1 px-1">
      <table className="w-full border-collapse text-[13.5px]">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="group/row">
              {row.map((cell, ci) => (
                <td key={ci} className={`border border-[var(--border)] p-0 ${ri === 0 ? "bg-[var(--bg-elevated)] font-medium" : ""}`}>
                  <input
                    type="text"
                    value={cell}
                    onChange={(e) => setCell(ri, ci, e.target.value)}
                    placeholder={ri === 0 ? "Колонка" : "ячейка"}
                    className="block w-full bg-transparent px-2 py-1.5 focus:outline-none focus:bg-[var(--muted)]/40"
                  />
                </td>
              ))}
              <td className="pl-2 align-middle">
                <button type="button" onClick={() => removeRow(ri)} className="opacity-0 group-hover/row:opacity-100 text-[11px] text-rose-600 hover:underline">×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-3 mt-1.5">
        <button type="button" onClick={addRow} className="text-[11.5px] text-[var(--muted-foreground)] hover:text-[var(--accent)]">+ строка</button>
        <button type="button" onClick={addCol} className="text-[11.5px] text-[var(--muted-foreground)] hover:text-[var(--accent)]">+ колонка</button>
      </div>
    </div>
  );
}

function BlockEmbed({ block, onChange }) {
  const ok = block.url && /^https?:\/\//.test(block.url);
  return (
    <div className="my-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <p className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1.5">Embed</p>
      <input
        type="text"
        value={block.url}
        onChange={(e) => onChange({ ...block, url: e.target.value })}
        placeholder="https://www.youtube.com/watch?v=… или CodeSandbox / Loom / Twitter"
        className="block w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1.5 text-[12.5px] focus:outline-none focus:border-[var(--accent)]"
      />
      <div className="mt-2 aspect-video rounded border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center text-[12px] text-[var(--muted-foreground)]">
        {ok ? `превью: ${block.url.replace(/^https?:\/\//, "").slice(0, 60)}` : "после вставки URL появится embed"}
      </div>
    </div>
  );
}

window.EditorBlocks = {
  BlockFrame, BlockHeading, BlockParagraph, BlockQuote, BlockList,
  BlockCode, BlockCallout, BlockTechnical, BlockImage, BlockTable, BlockEmbed,
};
