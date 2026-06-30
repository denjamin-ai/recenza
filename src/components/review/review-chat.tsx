// Чат сессии ревью — вне тредов (Фаза 7). Свёрнутая панель над панелью действий; разворачивается кнопкой.
"use client";

import { useState } from "react";
import type { ReviewChatLine } from "@/lib/queries/review";
import { Avatar } from "./review-primitives";

export function ReviewChat({
  chat,
  active,
  busy,
  onSend,
}: {
  chat: ReviewChatLine[];
  active: boolean;
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const submit = () => {
    const value = text.trim();
    if (!value || busy) return;
    onSend(value);
    setText("");
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Свернуть чат сессии" : "Развернуть чат сессии"}
        className="flex min-h-9 w-full items-center justify-between px-3 py-1.5 text-[length:var(--type-small)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] sm:px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <span className="font-semibold uppercase tracking-wider">
          Чат сессии <span className="tabular-nums">{chat.length}</span>
        </span>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 sm:px-5">
          <div className="mb-2 max-h-40 space-y-2 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] p-2">
            {chat.length === 0 ? (
              <p className="py-3 text-center text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                Сообщений пока нет.
              </p>
            ) : (
              chat.map((m) => (
                <div key={m.id} className="flex items-start gap-2">
                  <Avatar handle={m.fromHandle} name={m.fromName} size={18} />
                  <p className="min-w-0 text-[length:var(--type-small)] leading-snug">
                    <span className="font-medium">@{m.fromHandle}</span>{" "}
                    <span className="text-[var(--foreground)]">{m.text}</span>
                  </p>
                </div>
              ))
            )}
          </div>
          {active && (
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={1}
                aria-label="Сообщение в чат сессии"
                placeholder="Сообщение команде…"
                className="min-h-9 flex-1 resize-none rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-[length:var(--type-small)] focus:border-[var(--accent)] focus:outline-none"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <button
                type="button"
                onClick={submit}
                disabled={!text.trim() || busy}
                aria-label="Отправить сообщение"
                className="inline-flex min-h-9 items-center rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              >
                →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
