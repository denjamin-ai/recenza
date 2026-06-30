// Рейл обсуждений ReviewPage (Фаза 7): леджер вердиктов (3 счётчика) + карточки тредов + композер.
// Композер: при свежем выделении — новый тред (Комментарий/Правка); иначе ответ в активный тред.
"use client";

import { useEffect, useRef, useState } from "react";
import type { ReviewThread } from "@/lib/queries/review";
import { Avatar, TONE } from "./review-primitives";

interface Selection {
  blockId: string;
  quote: string;
}

export function ThreadsRail({
  threads,
  pov,
  activeThreadId,
  showResolved,
  setShowResolved,
  selection,
  busy,
  onPickThread,
  onApply,
  onResolve,
  onReply,
  onPost,
}: {
  threads: ReviewThread[];
  pov: "author" | "reviewer";
  activeThreadId: string | null;
  showResolved: boolean;
  setShowResolved: (v: boolean) => void;
  selection: Selection | null;
  busy: boolean;
  onPickThread: (t: ReviewThread) => void;
  onApply: (t: ReviewThread) => void;
  onResolve: (t: ReviewThread) => void;
  onReply: (t: ReviewThread, text: string) => void;
  onPost: (blockId: string, text: string, opts: { suggest: boolean }) => void;
}) {
  const open = threads.filter((t) => t.status === "open");
  const list = showResolved ? threads : open;
  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;
  const railRef = useRef<HTMLDivElement | null>(null);

  // Скролл активной карточки в зону видимости.
  useEffect(() => {
    if (!activeThreadId) return;
    const container = railRef.current;
    const card = container?.querySelector<HTMLElement>(`[data-thread-id="${CSS.escape(activeThreadId)}"]`);
    if (!container || !card) return;
    const offset = card.offsetTop - container.clientHeight / 2 + card.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
  }, [activeThreadId, showResolved]);

  const counters = [
    { label: "правок", color: TONE.fix.color, n: open.filter((t) => t.suggestion).length },
    { label: "обсуждений", color: TONE.discuss.color, n: open.filter((t) => !t.suggestion).length },
    { label: "решено", color: TONE.ok.color, n: threads.filter((t) => t.status === "resolved").length },
  ];

  return (
    <aside className="flex min-h-0 flex-col border-l border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <span className="text-[length:var(--type-small)] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Обсуждения <span className="tabular-nums">{open.length}</span>
        </span>
        <button
          type="button"
          onClick={() => setShowResolved(!showResolved)}
          aria-pressed={showResolved}
          className="text-[length:var(--type-small)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {showResolved ? "скрыть решённые" : "показать решённые"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[length:var(--type-small)]">
        {counters.map((c) => (
          <span key={c.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-[var(--radius-pill)]" style={{ background: c.color }} />
            <span className="font-medium tabular-nums">{c.n}</span>
            <span className="text-[var(--muted-foreground)]">{c.label}</span>
          </span>
        ))}
      </div>

      <div ref={railRef} className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {list.length === 0 ? (
          <p className="py-8 text-center text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            Пока пусто. Выделите фрагмент статьи — появится кнопка «Прокомментировать».
          </p>
        ) : (
          list.map((t) => (
            <ThreadCard
              key={t.id}
              thread={t}
              pov={pov}
              active={t.id === activeThreadId}
              busy={busy}
              onClick={() => onPickThread(t)}
              onApply={() => onApply(t)}
              onResolve={() => onResolve(t)}
            />
          ))
        )}
      </div>

      <Composer
        pov={pov}
        selection={selection}
        activeThread={activeThread}
        busy={busy}
        onReply={(text) => activeThread && onReply(activeThread, text)}
        onPost={(text, opts) => selection && onPost(selection.blockId, text, opts)}
      />
    </aside>
  );
}

function ThreadCard({
  thread,
  pov,
  active,
  busy,
  onClick,
  onApply,
  onResolve,
}: {
  thread: ReviewThread;
  pov: "author" | "reviewer";
  active: boolean;
  busy: boolean;
  onClick: () => void;
  onApply: () => void;
  onResolve: () => void;
}) {
  return (
    <div
      data-thread-id={thread.id}
      onClick={onClick}
      className={`cursor-pointer rounded-[var(--radius-md)] border bg-[var(--background)] p-2.5 transition-colors ${
        active ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--accent)]"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Avatar handle={thread.fromHandle} name={thread.fromName} size={20} />
          <span className="truncate text-[length:var(--type-small)] font-medium">@{thread.fromHandle}</span>
          {thread.suggestion && (
            <span className="rounded-[var(--radius-sm)] bg-[var(--warning-bg)] px-1.5 py-0.5 text-[length:var(--type-small)] font-semibold uppercase tracking-wider text-[var(--warning)]">
              правка
            </span>
          )}
          {thread.status === "resolved" && (
            <span className="rounded-[var(--radius-sm)] bg-[var(--success-bg)] px-1.5 py-0.5 text-[length:var(--type-small)] font-semibold uppercase tracking-wider text-[var(--success)]">
              решено
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          aria-label="Перейти к блоку обсуждения"
          className="shrink-0 rounded-[var(--radius-sm)] text-[length:var(--type-small)] text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          → блок
        </button>
      </div>

      {thread.anchor && (
        <blockquote className="anchor-hi mb-1.5 line-clamp-1 pl-2 text-[length:var(--type-small)] italic text-[var(--muted-foreground)]" title={thread.anchor}>
          «{thread.anchor}»
        </blockquote>
      )}
      <p className="mb-1.5 text-[length:var(--type-body)] leading-snug">{thread.text}</p>

      {thread.suggestion && (
        <div className="mb-1.5 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--code-bg)] p-2 font-mono text-[length:var(--type-small)]">
          <div className="line-clamp-2 whitespace-pre-wrap text-[var(--muted-foreground)] line-through opacity-60">
            {thread.suggestion.from}
          </div>
          <div className="line-clamp-2 whitespace-pre-wrap text-[var(--success)]">{thread.suggestion.to}</div>
        </div>
      )}

      {thread.replies.map((r) => (
        <div key={r.id} className="mt-1.5 border-l-2 border-[var(--border)] pl-2">
          <div className="mb-0.5 flex items-center gap-1.5">
            <Avatar handle={r.fromHandle} name={r.fromName} size={14} />
            <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">@{r.fromHandle}</span>
          </div>
          <p className="text-[length:var(--type-small)] leading-snug">{r.text}</p>
        </div>
      ))}

      {thread.status === "open" && (
        <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
          {pov === "author" ? (
            <button
              type="button"
              disabled={busy}
              onClick={onApply}
              className="inline-flex min-h-9 items-center rounded-[var(--radius-sm)] bg-[var(--accent)] px-2 text-[length:var(--type-small)] font-semibold uppercase tracking-wider text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              {thread.suggestion ? "Применить и закрыть" : "Отметить решённым"}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onResolve}
              className="inline-flex min-h-9 items-center rounded-[var(--radius-sm)] border border-[var(--border)] px-2 text-[length:var(--type-small)] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Отметить решённым
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Composer({
  pov,
  selection,
  activeThread,
  busy,
  onReply,
  onPost,
}: {
  pov: "author" | "reviewer";
  selection: Selection | null;
  activeThread: ReviewThread | null;
  busy: boolean;
  onReply: (text: string) => void;
  onPost: (text: string, opts: { suggest: boolean }) => void;
}) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"comment" | "suggest">("comment");
  // Сброс режима при смене/потере выделения (паттерн «коррекция стейта в рендере», без эффекта).
  const [prevSel, setPrevSel] = useState(selection);
  if (selection !== prevSel) {
    setPrevSel(selection);
    if (mode === "suggest" && !selection) setMode("comment");
  }

  const canPost = !!text.trim() && !busy && (!!selection || !!activeThread);

  const submit = () => {
    const value = text.trim();
    if (!value || busy) return;
    if (selection) onPost(value, { suggest: mode === "suggest" });
    else if (activeThread) onReply(value);
    setText("");
    setMode("comment");
  };

  const anchorLabel = selection
    ? `↳ «${selection.quote.slice(0, 40)}${selection.quote.length > 40 ? "…" : ""}»`
    : activeThread
      ? `↳ ответ @${activeThread.fromHandle}`
      : "Выделите фрагмент или откройте тред";

  const placeholder = selection
    ? mode === "suggest"
      ? "Как должно стать — замена выделенного…"
      : "Комментарий к выделенному…"
    : activeThread
      ? pov === "author"
        ? "Ответить ревьюеру…"
        : "Ответить или дополнить…"
      : "Выделите фрагмент статьи слева…";

  return (
    <div className="border-t border-[var(--border)] bg-[var(--background)] p-3">
      {selection && (
        <div className="mb-2 inline-flex items-center gap-0.5 rounded-[var(--radius-sm)] border border-[var(--border)] p-0.5 text-[length:var(--type-small)]">
          {(["comment", "suggest"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`min-h-9 rounded-[var(--radius-sm)] px-2 ${
                mode === m
                  ? "bg-[var(--accent)] font-medium text-[var(--accent-foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {m === "comment" ? "Комментарий" : "Правка"}
            </button>
          ))}
        </div>
      )}

      {mode === "suggest" && selection && (
        <div className="mb-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--code-bg)] p-2">
          <p className="mb-0.5 text-[length:var(--type-small)] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Было
          </p>
          <div className="line-clamp-3 whitespace-pre-wrap font-mono text-[length:var(--type-small)] line-through opacity-60">
            {selection.quote}
          </div>
        </div>
      )}

      <div
        className={`rounded-[var(--radius-sm)] border focus-within:border-[var(--accent)] ${
          mode === "suggest" ? "border-[var(--success-border)]" : "border-[var(--border)]"
        }`}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={2}
          aria-label="Сообщение в обсуждение"
          className="block w-full resize-none bg-transparent px-2.5 py-2 text-[length:var(--type-body)] focus:outline-none"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-2 py-1 text-[length:var(--type-small)]">
          <span className="min-w-0 truncate text-[var(--muted-foreground)]">{anchorLabel} · ⌘/Ctrl+Enter</span>
          <button
            type="button"
            onClick={submit}
            disabled={!canPost}
            className="inline-flex min-h-9 items-center rounded-[var(--radius-sm)] bg-[var(--accent)] px-2.5 font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            {mode === "suggest" ? "Предложить" : selection ? "Отправить" : "Ответить"}
          </button>
        </div>
      </div>
    </div>
  );
}
