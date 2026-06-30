"use client";

// Правая шторка «Отправить на ревью»: навыки (обяз.) + сложность + ПИКЕР С ПОДБОРОМ (Фаза 9) +
// выбор ведущего + заметка + чек-лист готовности (гейт). Подбор: вкладки «По навыкам / Все», поиск,
// match%/«Топ» пересчитываются ВЖИВУЮ при правке навыков (чистый rankReviewers), full не выбирается,
// пустое состояние «нет совпадений» → запрос ревьюеров у админа (recruit_requests).
// Сервер остаётся источником правды: /submit перепроверяет гейт; match% для flag-гейта — на сервере.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Block, Complexity } from "@/types";
import { rankReviewers } from "@/lib/reviewer-match";
import type { Availability, RankedReviewer } from "@/lib/reviewer-match";
import { COMPLEXITY_TIERS, MAX_SKILLS, readinessChecklist } from "@/lib/blocks/validate";
import { ChipInput } from "./chip-input";

const AVAIL_META: Record<Availability, { label: string; dot: string }> = {
  free: { label: "свободен", dot: "bg-[var(--success)]" },
  busy: { label: "занят", dot: "bg-[var(--warning)]" },
  full: { label: "загружен", dot: "bg-[var(--danger)]" },
};

type Tab = "matched" | "all";

export function SubmitSheet({
  chapterId,
  chapterTitle,
  blocks,
  tags,
  initialSkills,
  initialComplexity,
  reviewers,
  onSave,
  onClose,
}: {
  chapterId: string;
  chapterTitle: string;
  blocks: Block[];
  tags: string[];
  initialSkills: string[];
  initialComplexity: Complexity;
  reviewers: RankedReviewer[];
  onSave: () => Promise<boolean>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [complexity, setComplexity] = useState<Complexity>(initialComplexity);
  const [picked, setPicked] = useState<string[]>([]);
  const [primary, setPrimary] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("matched");
  const [query, setQuery] = useState("");
  const [recruit, setRecruit] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const tier = COMPLEXITY_TIERS[complexity];

  // Подбор пересчитывается вживую от текущих навыков (чистая функция, без сервера).
  const ranked = useMemo(
    () => rankReviewers(reviewers, skills, { onlyMatched: tab === "matched" }),
    [reviewers, skills, tab],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter(
      (r) => r.displayName.toLowerCase().includes(q) || r.competencies.some((c) => c.toLowerCase().includes(q)),
    );
  }, [ranked, query]);

  const noMatches = tab === "matched" && ranked.length === 0;

  const checks = useMemo(
    () => readinessChecklist({ title: chapterTitle, blocks, tags, skills, complexity, reviewers: picked, primary }),
    [chapterTitle, blocks, tags, skills, complexity, picked, primary],
  );
  const ready = checks.every((c) => c.ok);
  const passed = checks.filter((c) => c.ok).length;

  function togglePick(handle: string) {
    setPicked((prev) => {
      if (prev.includes(handle)) {
        if (primary === handle) setPrimary(null);
        return prev.filter((h) => h !== handle);
      }
      if (prev.length >= tier.max) return prev; // не больше максимума по сложности
      return [...prev, handle];
    });
  }

  async function requestRecruit() {
    if (skills.length === 0) return;
    setRecruit("sending");
    try {
      const res = await fetch("/api/author/recruit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, skills }),
      });
      setRecruit(res.ok ? "sent" : "error");
    } catch {
      setRecruit("error");
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    const saved = await onSave();
    if (!saved) {
      setSubmitting(false);
      setError("Не удалось сохранить черновик перед отправкой.");
      return;
    }
    const res = await fetch(`/api/author/chapters/${chapterId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills, reviewers: picked, primary, note, complexity }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      blogSlug?: string;
      error?: string;
      failedChecks?: string[];
    };
    setSubmitting(false);
    if (res.ok && data.blogSlug) {
      router.push(`/author/blog/${data.blogSlug}`);
    } else {
      setError(data.failedChecks?.length ? `Не закрыто: ${data.failedChecks.join("; ")}` : data.error ?? "Не удалось отправить.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-[var(--overlay)]"
      role="dialog"
      aria-modal="true"
      aria-label="Отправка на ревью"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="flex h-full w-full max-w-[440px] flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-[length:var(--type-h4)]">Отправить на ревью</h2>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-4">
          {/* Чек-лист готовности */}
          <section>
            <h3 className="text-[length:var(--type-small)] font-medium text-[var(--muted-foreground)]">
              Готовность {passed}/{checks.length}
            </h3>
            <ul className="mt-2 flex flex-col gap-1">
              {checks.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-[length:var(--type-small)]">
                  <span aria-hidden="true" className={c.ok ? "text-[var(--success)]" : "text-[var(--muted-foreground)]"}>
                    {c.ok ? "✓" : "○"}
                  </span>
                  <span className={c.ok ? "" : "text-[var(--muted-foreground)]"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Сложность */}
          <section>
            <h3 className="mb-2 text-[length:var(--type-small)] font-medium text-[var(--muted-foreground)]">Сложность</h3>
            <div className="flex flex-col gap-1.5">
              {(Object.keys(COMPLEXITY_TIERS) as Complexity[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setComplexity(c);
                    if (picked.length > COMPLEXITY_TIERS[c].max) setPicked((p) => p.slice(0, COMPLEXITY_TIERS[c].max));
                  }}
                  aria-pressed={complexity === c}
                  className={`rounded-[var(--radius-sm)] border px-3 py-2 text-left text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    complexity === c ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {COMPLEXITY_TIERS[c].label} — {COMPLEXITY_TIERS[c].hint}
                </button>
              ))}
            </div>
          </section>

          {/* Навыки */}
          <section>
            <h3 className="mb-2 text-[length:var(--type-small)] font-medium text-[var(--muted-foreground)]">
              Ключевые навыки статьи (1–{MAX_SKILLS})
            </h3>
            <ChipInput value={skills} onChange={setSkills} max={MAX_SKILLS} placeholder="OpenTelemetry, Node.js…" ariaLabel="Навыки статьи" />
            <p className="mt-1 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
              По ним подбираются ревьюеры; видны и читателю.
            </p>
          </section>

          {/* Ревьюеры — подбор */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[length:var(--type-small)] font-medium text-[var(--muted-foreground)]">
                Ревьюеры ({picked.length}/{tier.max})
              </h3>
              <div role="tablist" aria-label="Фильтр ревьюеров" className="flex gap-1">
                {([["matched", "По навыкам"], ["all", "Все"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    id={`reviewer-tab-${key}`}
                    aria-selected={tab === key}
                    aria-controls="reviewer-tabpanel"
                    onClick={() => setTab(key)}
                    className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                      tab === key ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени или компетенции…"
              aria-label="Поиск ревьюеров"
              className="mb-2 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[length:var(--type-small)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />

            <div id="reviewer-tabpanel" role="tabpanel" aria-labelledby={`reviewer-tab-${tab}`}>
            {noMatches ? (
              <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] p-3 text-[length:var(--type-small)]">
                <p className="text-[var(--muted-foreground)]">
                  {skills.length === 0
                    ? "Добавьте навыки статьи — по ним подбираются ревьюеры."
                    : "Ревьюеры под эти навыки не найдены."}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTab("all")}
                    className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    Показать всех
                  </button>
                  {skills.length > 0 && recruit !== "sent" && (
                    <button
                      type="button"
                      onClick={requestRecruit}
                      disabled={recruit === "sending"}
                      className="min-h-9 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                    >
                      {recruit === "sending" ? "Отправляем…" : "Запросить ревьюеров у админа"}
                    </button>
                  )}
                </div>
                {recruit === "sent" && (
                  <p className="mt-2 text-[var(--success)]">Запрос отправлен админу. Статус — в кабинете автора.</p>
                )}
                {recruit === "error" && <p className="mt-2 text-[var(--danger)]">Не удалось отправить запрос.</p>}
              </div>
            ) : visible.length === 0 ? (
              <p className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">Ничего не найдено.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {visible.map((r) => {
                  const isPicked = picked.includes(r.handle);
                  const disabled = r.availability === "full" && !isPicked;
                  return (
                    <li
                      key={r.handle}
                      className={`rounded-[var(--radius-sm)] border p-2.5 ${isPicked ? "border-[var(--accent)]" : "border-[var(--border)]"} ${disabled ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isPicked}
                            disabled={disabled}
                            onChange={() => togglePick(r.handle)}
                            className="accent-[var(--accent)]"
                          />
                          <span className="truncate text-[length:var(--type-small)]">{r.displayName}</span>
                          {r.rating != null && (
                            <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">★ {r.rating.toFixed(1)}</span>
                          )}
                        </label>
                        <span className="flex shrink-0 items-center gap-2">
                          {r.matchPct > 0 && (
                            <span className="rounded-[var(--radius-pill)] bg-[var(--accent-bg)] px-1.5 py-0.5 text-[0.7rem] font-medium text-[var(--accent)]">
                              {r.matchPct}%
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${AVAIL_META[r.availability].dot}`} />
                            {AVAIL_META[r.availability].label}
                          </span>
                        </span>
                      </div>
                      {r.competencies.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {r.competencies.slice(0, 6).map((comp) => {
                            const hit = r.matched.includes(comp);
                            return (
                              <span
                                key={comp}
                                className={`rounded-[var(--radius-pill)] px-1.5 py-0.5 text-[0.7rem] ${
                                  hit ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                                }`}
                              >
                                {hit ? "✓ " : ""}
                                {comp}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {isPicked && (
                        <button
                          type="button"
                          onClick={() => setPrimary(r.handle)}
                          aria-pressed={primary === r.handle}
                          className={`mt-1.5 rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.7rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                            primary === r.handle ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          {primary === r.handle ? "ВЕДУЩИЙ" : "Сделать ведущим"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            </div>
          </section>

          {/* Заметка */}
          <section>
            <h3 className="mb-2 text-[length:var(--type-small)] font-medium text-[var(--muted-foreground)]">Заметка ревьюерам</h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Что просите посмотреть особенно внимательно?"
              className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Заметка ревьюерам"
            />
          </section>

          {error && (
            <p className="rounded-[var(--radius-sm)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]">
              {error}
            </p>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border)] px-5 py-4">
          <span className="text-[length:var(--type-small)] text-[var(--muted-foreground)]">
            {ready ? "Готово к отправке" : "Закройте все пункты"}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!ready || submitting}
            className="min-h-9 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-[length:var(--type-small)] font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            {submitting ? "Отправляем…" : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}
