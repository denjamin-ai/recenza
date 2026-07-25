"use client";

// Правая шторка «Заявка на ревью» (Фаза 14) — пришла на смену пикеру ревьюеров.
//
// Что ушло насовсем: вкладки «По навыкам»/«Все», поиск, чекбоксы ревьюеров, звёзды рейтинга,
// балл «Топ», кнопка «вести»/«ведущий» и гейт состава по сложности. Автор больше НЕ выбирает
// исполнителя: он оставляет заявку, ревьюер берёт её сам из очереди
// (`POST /api/author/chapters/[id]/review-request` → `POST /api/reviewer/requests/[id]/claim`).
//
// Осталось: чек-лист готовности (5 пунктов, серверная перепроверка в роуте), навыки статьи
// (по ним заявка находится в очереди, читателю они тоже видны), заметка ревьюеру, сложность —
// теперь ЧИТАТЕЛЬСКАЯ метка без чисел ревьюеров (COMPLEXITY_LABELS).
//
// Если живая заявка уже есть (`request`), формы нет — шторка показывает её состояние, таймер SLA
// и «Отозвать заявку» (только пока никто не взял; сервер перепроверяет и отвечает 409).

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Block, Complexity } from "@/types";
import type { AuthorRequestView } from "@/lib/queries/review-requests";
import { COMPLEXITY_LABELS } from "@/lib/blocks/constants";
import { MAX_SKILLS, readinessChecklist } from "@/lib/blocks/validate";
import { formatDueLabel, slaState, type SlaState } from "@/lib/review-sla";
import { plural } from "@/lib/plural";
import { ChipInput } from "./chip-input";

/** Тон таймера: цвет — не единственный сигнификатор, рядом всегда текст срока. */
const SLA_TONE: Record<SlaState, string> = {
  ok: "text-[var(--muted-foreground)]",
  soon: "text-[var(--warning)]",
  overdue: "text-[var(--danger)]",
};

const COMPLEXITY_HINT: Record<Complexity, string> = {
  simple: "Короткий разбор — читается за один подход.",
  medium: "Обычная статья с разделами и примерами.",
  complex: "Глубокий материал: много кода, формул или схем.",
};

const COMPLEXITY_ORDER: Complexity[] = ["simple", "medium", "complex"];

export function SubmitSheet({
  chapterId,
  chapterTitle,
  blogId,
  blogSlug,
  blocks,
  tags,
  initialSkills,
  initialComplexity,
  request,
  onSave,
  onClose,
}: {
  chapterId: string;
  chapterTitle: string;
  blogId: string;
  blogSlug: string;
  blocks: Block[];
  tags: string[];
  initialSkills: string[];
  initialComplexity: Complexity;
  /** Живая заявка на текущую ревизию (open|claimed) или null — тогда показываем форму. */
  request: AuthorRequestView | null;
  /** Сохранить черновик, ЕСЛИ есть несохранённые правки (на published-ревизии пустой save завёл бы форк). */
  onSave: () => Promise<boolean>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [complexity, setComplexity] = useState<Complexity>(initialComplexity);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Отозванная заявка: RSC-проп обновится только после refresh, локальный флаг убирает мигание.
  const [withdrawn, setWithdrawn] = useState(false);

  // Точка отсчёта таймера фиксируется на открытии шторки: `Date.now()` в теле рендера запрещён
  // правилом `react-hooks/purity` (и давал бы «прыгающий» срок на каждый ререндер).
  const [now] = useState(() => Math.floor(Date.now() / 1000));

  const live = withdrawn ? null : request;

  const checks = useMemo(
    () => readinessChecklist({ title: chapterTitle, blocks, tags, skills }),
    [chapterTitle, blocks, tags, skills],
  );
  const ready = checks.every((c) => c.ok);
  const passed = checks.filter((c) => c.ok).length;

  async function submit() {
    setSubmitting(true);
    setError(null);
    const saved = await onSave();
    if (!saved) {
      setSubmitting(false);
      setError("Не удалось сохранить черновик перед отправкой.");
      return;
    }
    // Сложность — метаданные блога (не заявки): шлём отдельным PATCH и только при изменении.
    // Неудача здесь не должна ронять заявку — это подпись для читателя, а не условие ревью.
    if (complexity !== initialComplexity) {
      try {
        await fetch(`/api/author/blogs/${blogId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ complexity }),
        });
      } catch {
        /* игнорируем: заявка важнее */
      }
    }
    const res = await fetch(`/api/author/chapters/${chapterId}/review-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills, note: note.trim() || undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; failedChecks?: string[] };
    setSubmitting(false);
    if (res.ok) {
      router.push(`/author/blog/${blogSlug}`);
      return;
    }
    setError(
      data.failedChecks?.length
        ? `Не закрыто: ${data.failedChecks.join("; ")}`
        : (data.error ?? "Не удалось подать заявку."),
    );
  }

  async function withdraw() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/author/chapters/${chapterId}/review-request`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSubmitting(false);
    if (res.ok) {
      setWithdrawn(true);
      startTransition(() => router.refresh());
      return;
    }
    setError(data.error ?? "Не удалось отозвать заявку.");
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-[var(--overlay)]"
      role="dialog"
      aria-modal="true"
      aria-label="Заявка на ревью"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="flex h-full w-full max-w-[440px] flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-[length:var(--type-h4)]">Заявка на ревью</h2>
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

        {live ? (
          <div className="flex flex-col gap-4 px-5 py-4">
            <section
              aria-label="Состояние заявки"
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
            >
              <p className="flex flex-wrap items-center gap-2 text-[length:var(--type-small)]">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${live.status === "claimed" ? "bg-[var(--info)]" : "bg-[var(--muted-foreground)]"}`}
                />
                <span className="font-medium">
                  {live.status === "claimed"
                    ? `Взял в работу ${live.claimedByName ?? "ревьюер"}`
                    : "Заявка в очереди"}
                </span>
                <span className="text-[var(--muted-foreground)]">· версия {live.revisionNumber}</span>
              </p>
              {live.dueAt !== null && (
                <p className={`mt-1.5 text-[length:var(--type-small)] ${SLA_TONE[slaState(live.dueAt, now)]}`}>
                  Срок: {formatDueLabel(live.dueAt, now)}
                </p>
              )}
              {live.returnCount > 0 && (
                <p className="mt-1.5 text-[length:var(--type-small)] text-[var(--warning)]">
                  Заявка возвращалась в очередь {live.returnCount}{" "}
                  {plural(live.returnCount, "раз", "раза", "раз")}.
                </p>
              )}
              {live.channel === "editorial" && (
                <p className="mt-1.5 text-[length:var(--type-small)] text-[var(--info)]">
                  Подключена редакция — направление добавлено на доску «Ищем ревьюеров».
                </p>
              )}
              {live.channel === "invite" && (
                <p className="mt-1.5 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                  Заявка пришла по вашему приглашению эксперта.
                </p>
              )}
            </section>

            <p className="text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)]">
              {live.status === "claimed"
                ? "Пока ревьюер работает, версия закрыта для правок. Обсуждение — на экране ревью."
                : "Заявка ждёт ревьюера в общей очереди. Публиковать главу можно, не дожидаясь его."}
            </p>

            {error && (
              <p
                role="alert"
                className="rounded-[var(--radius-sm)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]"
              >
                {error}
              </p>
            )}

            {live.status === "open" && (
              <button
                type="button"
                onClick={withdraw}
                disabled={submitting}
                className="min-h-9 self-start rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-[length:var(--type-small)] text-[var(--danger)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
              >
                {submitting ? "Отзываем…" : "Отозвать заявку"}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-5 px-5 py-4">
              <p className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[length:var(--type-small)] leading-relaxed text-[var(--muted-foreground)]">
                Ревью не требуется для публикации — главу можно выпустить в любой момент. Заявка
                нужна ради разбора и бейджа «Проверено»: ревьюер возьмёт её из очереди сам.
              </p>

              {/* Чек-лист готовности (сервер перепроверяет тот же список). */}
              <section>
                <h3 className="text-[length:var(--type-small)] font-medium text-[var(--muted-foreground)]">
                  Готовность {passed}/{checks.length}
                </h3>
                <ul className="mt-2 flex flex-col gap-1">
                  {checks.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-[length:var(--type-small)]">
                      <span
                        aria-hidden="true"
                        className={c.ok ? "text-[var(--success)]" : "text-[var(--muted-foreground)]"}
                      >
                        {c.ok ? "✓" : "○"}
                      </span>
                      <span className={c.ok ? "" : "text-[var(--muted-foreground)]"}>{c.label}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Навыки статьи — по ним заявка находится в очереди ревьюера. */}
              <section>
                <h3 className="mb-2 text-[length:var(--type-small)] font-medium text-[var(--muted-foreground)]">
                  Ключевые навыки статьи (1–{MAX_SKILLS})
                </h3>
                <ChipInput
                  value={skills}
                  onChange={setSkills}
                  max={MAX_SKILLS}
                  placeholder="OpenTelemetry, Node.js…"
                  ariaLabel="Навыки статьи"
                />
                <p className="mt-1 text-[length:var(--type-small)] text-[var(--muted-foreground)]">
                  По ним ревьюеры находят заявку в очереди; читателю они тоже видны.
                </p>
              </section>

              {/* Сложность — подпись для читателя, на состав ревьюеров больше не влияет. */}
              <section>
                <h3 className="mb-2 text-[length:var(--type-small)] font-medium text-[var(--muted-foreground)]">
                  Сложность для читателя
                </h3>
                <div role="group" aria-label="Сложность для читателя" className="flex flex-col gap-1.5">
                  {COMPLEXITY_ORDER.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={complexity === c}
                      onClick={() => setComplexity(c)}
                      className={`min-h-9 rounded-[var(--radius-sm)] border px-3 py-2 text-left text-[length:var(--type-small)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                        complexity === c
                          ? "border-[var(--accent)] text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {COMPLEXITY_LABELS[c]} — {COMPLEXITY_HINT[c]}
                    </button>
                  ))}
                </div>
              </section>

              {/* Заметка */}
              <section>
                <h3 className="mb-2 text-[length:var(--type-small)] font-medium text-[var(--muted-foreground)]">
                  Заметка ревьюеру
                </h3>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Что просите посмотреть особенно внимательно?"
                  className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  aria-label="Заметка ревьюеру"
                />
              </section>

              {error && (
                <p
                  role="alert"
                  className="rounded-[var(--radius-sm)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-small)] text-[var(--danger)]"
                >
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
                {submitting ? "Отправляем…" : "Оставить заявку"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
