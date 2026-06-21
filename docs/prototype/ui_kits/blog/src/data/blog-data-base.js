// Mock data for the review collaboration surface.
// One article in active review with a previous published version, multi-reviewer
// team, threads (notes + suggested edits), revision chat messages, and an
// admin queue of "change primary reviewer" requests.
//
// Lives on window.REVIEW_DATA so screens can read/mutate it via React state.

// Author drafts/in-flight/published views are derived from FAKE_DATA.articles
// at runtime — see window.__blogData helpers below.
// REVIEW_DATA now only holds admin-bound primary-change requests; everything
// else (article body, team, threads, chat, drafts list) lives on the canonical
// articles list.
window.REVIEW_DATA = {
  primaryChangeRequests: [
    {
      id: "pc-1",
      articleSlug: "next-16-boundary-patterns",
      revisionNumber: 4,
      requestedBy: "alex",
      requestedAt: 1747105200,
      currentPrimary: "dm.k",
      proposedPrimary: "kostya",
      reason: "Дмитрий в отпуске со среды, статья ждёт. Костя уже вовлечён и проверил диаграмму.",
      status: "pending",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// __blogData — base layer. blogs-data.js EXTENDS this object additively
// with the chapter-aware helpers (getBlogs, getInFlightChapters,
// getAuthorBlogs, effectiveChapterTeam, …), so this base must exist first.
// The legacy article-level views (getArticles / getArticleBySlug /
// getAuthorDrafts / getInFlightReviews) were superseded by those chapter-aware
// helpers and removed. Only effectiveTeam remains — ReviewPage still calls it
// as a defensive fallback when effectiveChapterTeam is unavailable.
// ─────────────────────────────────────────────────────────────────
window.__blogData = (function () {
  // Set of handles the admin has explicitly removed from an article's review.
  // Reads from window.__reviewStore (declared below); safe-guarded for first call.
  function removedSet(slug) {
    const store = window.__reviewStore?.get?.();
    if (!store?.removedReviewers) return new Set();
    return new Set(store.removedReviewers.filter(r => r.slug === slug).map(r => r.handle));
  }
  // Effective reviewer list for an article, excluding admin-removed handles.
  // If the primary was removed, promote the next remaining reviewer.
  function effectiveTeam(article) {
    if (!article) return { reviewerHandles: [], primaryHandle: null };
    const removed = removedSet(article.slug);
    const reviewerHandles = (article.reviewerHandles || []).filter(h => !removed.has(h));
    let primaryHandle = article.primaryHandle;
    if (primaryHandle && removed.has(primaryHandle)) primaryHandle = reviewerHandles[0] || null;
    return { reviewerHandles, primaryHandle, removed };
  }
  return {
    // Exposed so ReviewPage can seed its local team state without the removed set.
    effectiveTeam, removedReviewerHandlesFor: removedSet,
  };
})();

// ─────────────────────────────────────────────────────────────────
// Tiny shared review store — lets ReviewPage and AdminPortal share
// a single list of primary-change requests + admin-driven actions
// (force-approve, reviewer removal). Pub/sub so React state in
// either screen stays in sync without cross-imports.
// ─────────────────────────────────────────────────────────────────
window.__reviewStore = (function () {
  const state = {
    pcRequests: structuredClone(window.REVIEW_DATA.primaryChangeRequests || []),
    forced:     [],   // slugs that admin force-approved
    removedReviewers: [], // {slug, handle, by, at, reason}
  };
  const subs = new Set();
  return {
    get() { return state; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    update(patch) {
      Object.assign(state, typeof patch === "function" ? patch(state) : patch);
      subs.forEach(fn => fn(state));
    },
  };
})();
