// Оркестратор ReviewPage (Фаза 7). Источник правды — серверная сессия (проп `session`); кросс-экранный
// sync — серверное состояние + поллинг и router.refresh() после действий (D2, без вебсокетов).
// UI-состояние (активный тред/выделение/мобайл-таб/модалки) — локальное. Действия → /api/review/**.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ReviewSession, ReviewThread } from "@/lib/queries/review";
import { ReviewHeader } from "./review-header";
import { ConvoCanvas } from "./convo-canvas";
import { ThreadsRail } from "./threads-rail";
import { ActionBar } from "./action-bar";
import { ReviewChat } from "./review-chat";
import { PrimaryChangeModal, TeamSheet } from "./review-modals";
import { Toast, type ToastState } from "./review-primitives";

const POLL_MS = 30_000;

export function ReviewScreen({
  session,
  pov,
  viewerHandle,
  article,
}: {
  session: ReviewSession;
  pov: "author" | "reviewer";
  viewerHandle: string;
  /** Серверный <BlockRenderer mode="review">; передаётся как нода (единый рендерер). */
  article: ReactNode;
}) {
  const router = useRouter();
  // router.refresh() в transition: фоновое обновление данных без срабатывания Suspense-фоллбэка
  // (loading.tsx) — иначе ReviewScreen перемонтируется и теряет тост/локальный UI-стейт после действия.
  const [, startTransition] = useTransition();
  const { chapter, blog, revision, reviewers, threads } = session;

  // UI-состояние.
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [selection, setSelection] = useState<{ blockId: string; quote: string } | null>(null);
  const [mobileTab, setMobileTab] = useState<"article" | "threads">("article");
  const [teamOpen, setTeamOpen] = useState(false);
  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [busy, setBusy] = useState(false);
  const [flashKey, setFlashKey] = useState(0);

  const status = revision.status;
  const active = status === "under-review" || status === "changes-requested";
  const myVerdict = reviewers.find((r) => r.handle === viewerHandle)?.verdict ?? null;
  const allApproved = session.allApproved;
  const anyChanges = reviewers.some((r) => r.verdict === "request-changes");

  const threadsByBlock = useMemo(() => {
    const m = new Map<string, ReviewThread[]>();
    for (const t of threads) {
      const arr = m.get(t.blockId) ?? [];
      arr.push(t);
      m.set(t.blockId, arr);
    }
    return m;
  }, [threads]);

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;
  const activeBlockId = activeThread?.blockId ?? selection?.blockId ?? null;

  // Тост автоскрытие.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Поллинг кросс-экранных изменений (вердикты/треды из других сессий). Только когда вкладка видима.
  // refresh в transition — фоновое обновление без Suspense-фоллбэка/перемонтажа.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, startTransition]);

  // Esc сбрасывает выделение/активный тред.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelection(null);
      setActiveThreadId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ── Единый POST-хелпер ──
  const post = useCallback(
    async (url: string, body: unknown, okToast?: ToastState): Promise<boolean> => {
      if (busy) return false;
      setBusy(true);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body ?? {}),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setToast({ kind: "error", text: data.error || "Не удалось выполнить действие." });
          return false;
        }
        if (okToast) setToast(okToast);
        startTransition(() => router.refresh());
        return true;
      } catch {
        setToast({ kind: "error", text: "Сеть недоступна. Попробуйте ещё раз." });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, router, startTransition],
  );

  // ── Навигация bauble ↔ thread ──
  const pickThread = useCallback(
    (t: ReviewThread) => {
      if (activeThreadId === t.id && !selection) {
        setActiveThreadId(null);
        return;
      }
      setSelection(null);
      setActiveThreadId(t.id);
      setMobileTab("article");
      setFlashKey((k) => k + 1);
    },
    [activeThreadId, selection],
  );

  const pickBauble = useCallback(
    (blockId: string) => {
      const list = threadsByBlock.get(blockId) ?? [];
      if (list.length === 0) return;
      if (list.some((t) => t.status === "resolved")) setShowResolved(true);
      const target = list.find((t) => t.status === "open") ?? list[list.length - 1];
      setSelection(null);
      setActiveThreadId(target.id);
      setMobileTab("threads");
      setFlashKey((k) => k + 1);
    },
    [threadsByBlock],
  );

  const onComment = useCallback((blockId: string, quote: string) => {
    setSelection({ blockId, quote });
    setActiveThreadId(null);
    setMobileTab("threads");
  }, []);

  // ── Мутации ──
  const postThread = async (blockId: string, text: string, opts: { suggest: boolean }) => {
    const body = opts.suggest
      ? { blockId, anchor: selection?.quote, suggestion: { from: selection?.quote ?? "", to: text } }
      : { blockId, anchor: selection?.quote, text };
    const ok = await post(`/api/review/${chapter.id}/threads`, body);
    if (ok) setSelection(null);
  };

  const replyThread = async (t: ReviewThread, text: string) => {
    await post(`/api/review/threads/${t.id}/replies`, { text });
  };

  const applyThread = async (t: ReviewThread) => {
    await post(
      `/api/review/threads/${t.id}/apply`,
      {},
      { kind: "ok", text: t.suggestion ? "Правка применена, тред закрыт." : "Тред отмечен решённым." },
    );
    if (activeThreadId === t.id) setActiveThreadId(null);
  };

  const resolveThread = async (t: ReviewThread) => {
    await post(`/api/review/threads/${t.id}/resolve`, {}, { kind: "ok", text: "Тред отмечен решённым." });
    if (activeThreadId === t.id) setActiveThreadId(null);
  };

  const setVerdict = async (verdict: "approve" | "request-changes") => {
    await post(
      `/api/review/${chapter.id}/verdict`,
      { verdict },
      { kind: "ok", text: verdict === "approve" ? "Вы одобрили главу." : "Вы запросили правки." },
    );
  };

  const submitRevision = async () => {
    await post(
      `/api/review/${chapter.id}/submit-revision`,
      {},
      { kind: "ok", text: `Отправлено как ревизия v${revision.number + 1}. Ревьюеры уведомлены.` },
    );
  };

  const publish = async () => {
    await post(`/api/review/${chapter.id}/publish`, {}, {
      kind: "ok",
      text: `Глава «${chapter.title}» опубликована.`,
      href: `/blog/${blog.slug}/${chapter.slug}`,
      hrefLabel: "Открыть в ридере →",
    });
  };

  const submitPrimaryChange = async (toHandle: string, reason: string) => {
    const ok = await post(
      `/api/review/${chapter.id}/primary-change`,
      { toHandle, reason },
      { kind: "ok", text: "Запрос на смену ведущего отправлен админу." },
    );
    if (ok) setPrimaryOpen(false);
  };

  const sendChat = async (text: string) => {
    await post(`/api/review/${chapter.id}/chat`, { text });
  };

  const openCount = threads.filter((t) => t.status === "open").length;
  const canComment = active;

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <ReviewHeader session={session} pov={pov} onOpenTeam={() => setTeamOpen(true)} />

      {/* Мобильные табы. */}
      <div role="tablist" aria-label="Статья и обсуждения" className="flex border-b border-[var(--border)] text-[length:var(--type-body)] md:hidden">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "article"}
          aria-controls="review-panel-article"
          onClick={() => setMobileTab("article")}
          className={`min-h-[44px] flex-1 ${
            mobileTab === "article"
              ? "border-b-2 border-[var(--accent)] font-semibold text-[var(--accent)]"
              : "text-[var(--muted-foreground)]"
          }`}
        >
          Статья
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "threads"}
          aria-controls="review-panel-threads"
          onClick={() => setMobileTab("threads")}
          className={`min-h-[44px] flex-1 ${
            mobileTab === "threads"
              ? "border-b-2 border-[var(--accent)] font-semibold text-[var(--accent)]"
              : "text-[var(--muted-foreground)]"
          }`}
        >
          Обсуждения <span className="font-semibold text-[var(--accent)]">{openCount}</span>
        </button>
      </div>

      {/* Двухколоночная сетка. */}
      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        <div id="review-panel-article" className={`min-h-0 ${mobileTab === "article" ? "" : "hidden md:block"}`}>
          <ConvoCanvas
            article={article}
            threadsByBlock={threadsByBlock}
            activeBlockId={activeBlockId}
            flashKey={flashKey}
            canComment={canComment}
            onPickBauble={pickBauble}
            onComment={onComment}
            scrollRef={scrollRef}
          />
        </div>
        <div id="review-panel-threads" className={`min-h-0 ${mobileTab === "threads" ? "flex" : "hidden md:flex"} flex-col`}>
          <ThreadsRail
            threads={threads}
            pov={pov}
            activeThreadId={activeThreadId}
            showResolved={showResolved}
            setShowResolved={setShowResolved}
            selection={selection}
            busy={busy}
            onPickThread={pickThread}
            onApply={applyThread}
            onResolve={resolveThread}
            onReply={replyThread}
            onPost={postThread}
          />
        </div>
      </div>

      <ReviewChat chat={session.chat} active={active} busy={busy} onSend={sendChat} />

      <ActionBar
        pov={pov}
        status={status}
        reviewerCount={reviewers.length}
        openThreadCount={openCount}
        allApproved={allApproved}
        anyChanges={anyChanges}
        myVerdict={myVerdict}
        nextRevision={revision.number + 1}
        canChangePrimary={!!chapter.primaryHandle && reviewers.length > 1}
        busy={busy}
        onApprove={() => setVerdict("approve")}
        onRequestChanges={() => setVerdict("request-changes")}
        onSubmitRevision={submitRevision}
        onPublish={publish}
        onRequestPrimaryChange={() => setPrimaryOpen(true)}
      />

      {teamOpen && (
        <TeamSheet
          reviewers={reviewers}
          primaryHandle={chapter.primaryHandle}
          pov={pov}
          onClose={() => setTeamOpen(false)}
          onRequestPrimaryChange={() => {
            setTeamOpen(false);
            setPrimaryOpen(true);
          }}
        />
      )}

      {primaryOpen && (
        <PrimaryChangeModal
          reviewers={reviewers}
          primaryHandle={chapter.primaryHandle}
          busy={busy}
          onClose={() => setPrimaryOpen(false)}
          onSubmit={submitPrimaryChange}
        />
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
