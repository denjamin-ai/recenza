// reviewer-skills.js — additive reviewer-matching layer (Phase 2).
// Loads after data.js + blogs-data.js. Seeds reviewer competencies, ratings,
// availability onto FAKE_DATA.users; derives per-chapter skills; exposes
// matching/scoring helpers (window.__reviewerMatch) and a pub-sub store for
// invitations / recruit-requests / author ratings (window.__reviewerFlow).
// Nothing here rewrites existing data — it augments it in place.
(function () {
  const FD = window.FAKE_DATA;
  if (!FD || !FD.users) return;

  // ── Competency / reputation seed (reviewers) ───────────────────────
  // rating  — aggregate of authors' private 1–5 stars (accuracy dimension)
  // reviews — chapters reviewed (volume) · avgH — median hours to verdict
  // acceptRate — % invites accepted · load/capacity — current workload
  const SEED = {
    "dm.k":    { competencies: ["Node.js", "Observability", "TypeScript", "Distributed Systems"], rating: 4.9, ratingsN: 38, reviews: 48, avgH: 16, acceptRate: 94, load: 1, capacity: 3 },
    "kostya":  { competencies: ["Distributed Systems", "Tracing", "Go", "gRPC"], rating: 4.8, ratingsN: 44, reviews: 56, avgH: 12, acceptRate: 91, load: 0, capacity: 4 },
    "sveta.k": { competencies: ["OpenTelemetry", "Node.js", "Go", "Kubernetes"], rating: 4.7, ratingsN: 25, reviews: 31, avgH: 22, acceptRate: 88, load: 2, capacity: 3 },
    "pavel.t": { competencies: ["DevOps", "CI/CD", "Docker", "Performance"], rating: 4.4, ratingsN: 15, reviews: 19, avgH: 30, acceptRate: 76, load: 3, capacity: 3 },
    "lena.v":  { competencies: ["Accessibility", "Performance", "React", "CSS"], rating: 4.5, ratingsN: 11, reviews: 14, avgH: 34, acceptRate: 79, load: 1, capacity: 3 },
    "ira.m":   { competencies: ["Tailwind", "CSS", "Design Systems", "Bundlers"], rating: 4.6, ratingsN: 21, reviews: 27, avgH: 26, acceptRate: 82, load: 2, capacity: 2 },
  };
  Object.entries(SEED).forEach(([h, s]) => { if (FD.users[h]) Object.assign(FD.users[h], s); });

  // ── Per-chapter key skills (scientific-keyword style) ──────────────
  // Reworks every fake blog so each chapter carries a `skills` array (shown
  // to readers + used for reviewer matching). Keyed blogSlug#chapterSlug.
  const CHAPTER_SKILLS = {
    "nextjs-16-series#boundaries":       ["Next.js", "RSC", "App Router", "Server Components"],
    "nextjs-16-series#server-actions":   ["Next.js", "Server Actions", "Forms", "TypeScript"],
    "nextjs-16-series#caching":          ["Next.js", "Caching", "App Router", "revalidate"],
    "drizzle-sqlite-series#schema":      ["Drizzle", "SQLite", "TypeScript", "Schema Design"],
    "drizzle-sqlite-series#migrations":  ["Drizzle", "Migrations", "SQLite", "drizzle-kit"],
    "drizzle-sqlite-series#perf":        ["SQLite", "Performance", "Indexing", "SQL"],
    "drizzle-sqlite-series#battlescars": ["SQLite", "Concurrency", "Transactions", "WAL"],
    "mdx-engine-series#setup":           ["MDX", "Next.js", "Remark", "Rehype"],
    "mdx-engine-series#components":      ["MDX", "React", "Components", "DX"],
    "mdx-engine-series#performance":     ["MDX", "Performance", "Caching", "Shiki"],
    "sessions-cookies-nextjs#main":      ["Next.js", "Auth", "Cookies", "Security"],
    "tailwind-v4-tokens#main":           ["Tailwind", "CSS", "Design Systems", "Design Tokens"],
    "e2e-playwright-speedrun#main":      ["Playwright", "E2E", "Testing", "CI/CD"],
    "observability-series#structured-logs": ["Node.js", "Observability", "Logging", "pino"],
    "observability-series#metrics":         ["Observability", "Metrics", "Prometheus", "Node.js"],
    "observability-series#tracing":         ["OpenTelemetry", "Distributed Tracing", "Node.js", "Observability"],
    "observability-series#alerting":        ["Observability", "Alerting", "SLO", "DevOps"],
  };
  function applySkills() {
    (FD.blogs || []).forEach(b => {
      (b.chapters || []).forEach(c => {
        if (Array.isArray(c.skills) && c.skills.length) return;
        c.skills = (CHAPTER_SKILLS[b.slug + "#" + c.slug] || (Array.isArray(b.tags) ? b.tags.slice() : [])).slice();
      });
    });
    (FD.articles || []).forEach(a => {
      if (Array.isArray(a.skills) && a.skills.length) return;
      a.skills = typeof a.tags === "string" ? a.tags.split(",").map(t => t.trim()).filter(Boolean) : (Array.isArray(a.tags) ? a.tags.slice() : []);
    });
  }
  applySkills();

  // Anyone who can review (has competencies). dm.k/kostya/etc.
  function reviewerPool() {
    return Object.keys(FD.users).filter(h => (FD.users[h].competencies || []).length > 0);
  }

  // ── Skill matching ─────────────────────────────────────────────────
  function words(s) { return String(s || "").toLowerCase().split(/[^a-zа-я0-9.]+/i).filter(w => w.length > 2); }
  function hit(reviewerSkill, articleSkills) {
    const rw = new Set(words(reviewerSkill));
    return articleSkills.some(a => words(a).some(w => rw.has(w)));
  }
  // Chapter/article skills: explicit chapter.skills → blog.tags → article tags.
  function chapterSkills(chapter, blog) {
    if (chapter && Array.isArray(chapter.skills) && chapter.skills.length) return chapter.skills;
    if (blog && Array.isArray(blog.tags) && blog.tags.length) return blog.tags;
    if (chapter && typeof chapter.tags === "string") return chapter.tags.split(",").map(t => t.trim()).filter(Boolean);
    return [];
  }
  function match(handle, skills) {
    const comp = (FD.users[handle] || {}).competencies || [];
    const matched = comp.filter(c => hit(c, skills));
    const covered = skills.filter(a => comp.some(c => hit(c, [a])));
    const pct = skills.length ? Math.round((covered.length / skills.length) * 100) : 0;
    return { matched, covered, pct };
  }
  // Composite "Top": skill match 50% + rating 30% + volume 20% (cap 60).
  function score(handle, skills) {
    const u = FD.users[handle] || {};
    const m = match(handle, skills).pct / 100;
    const r = (u.rating || 0) / 5;
    const v = Math.min((u.reviews || 0) / 60, 1);
    return Math.round((m * 0.5 + r * 0.3 + v * 0.2) * 100);
  }
  function avail(handle) {
    const u = FD.users[handle] || {};
    const load = u.load || 0, cap = u.capacity || 1;
    if (load >= cap) return { key: "full", label: "Занят", tone: "danger", load, cap };
    if (load >= cap - 1) return { key: "busy", label: "Почти занят", tone: "warning", load, cap };
    return { key: "free", label: "Свободен", tone: "success", load, cap };
  }
  function ranked(skills, opts) {
    opts = opts || {};
    let hs = (opts.pool || reviewerPool()).slice();
    if (opts.onlyMatched) hs = hs.filter(h => match(h, skills).pct > 0);
    return hs.sort((a, b) => score(b, skills) - score(a, skills));
  }

  window.__reviewerMatch = { reviewerPool, chapterSkills, match, score, avail, ranked };

  // ── Flow store: invitations / recruit requests / ratings ───────────
  const subs = new Set();
  function emit() { subs.forEach(fn => { try { fn(); } catch (e) {} }); }
  const store = {
    // self-describing invitation records so the cabinet renders without
    // depending on the chapter existing in FAKE_DATA.
    invitations: [
      { id: "inv-1", blogSlug: "observability-node", blogTitle: "Observability в Node", chapterTitle: "Распределённый трейсинг с OpenTelemetry", chN: 3, chTotal: 4, author: "alex", complexity: "Сложная", skills: ["OpenTelemetry", "Distributed Tracing", "Node.js", "Observability"], note: "Глава про propagation context между сервисами — твой профиль. Особенно интересно мнение по разделу с sampling.", asLead: true, to: "dm.k", status: "pending", deadlineH: 46, at: 1747160000 },
      { id: "inv-2", blogSlug: "go-prod", blogTitle: "Go в проде", chapterTitle: "Профилирование горутин под нагрузкой", chN: 2, chTotal: 5, author: "ira.m", complexity: "Средняя", skills: ["Go", "Distributed Systems", "Performance", "pprof"], note: "Нужен второй взгляд на бенчмарки.", asLead: false, to: "dm.k", status: "pending", deadlineH: 70, at: 1747120000 },
      { id: "inv-3", blogSlug: "wasm-lowlevel", blogTitle: "Низкоуровневый WASM", chapterTitle: "Ручное управление памятью в WASI", chN: 1, chTotal: 2, author: "ira.m", complexity: "Сложная", skills: ["WebAssembly", "Rust", "WASI", "Linear Memory"], note: "Указал тебя по навыку «Systems».", asLead: false, to: "dm.k", status: "pending", deadlineH: 30, at: 1747050000 },
    ],
    recruitRequests: [
      // A pending request the admin will see in their queue, and a resolved one
      // so the author cabinet shows verdict states out of the box.
      { id: "rr-seed-1", blogSlug: "wasm-lowlevel", chapterSlug: "memory", blogTitle: "Низкоуровневый WASM", chapterTitle: "Ручное управление памятью в WASI", skills: ["WebAssembly", "Rust", "WASI", "Linear Memory"], by: "alex", status: "pending", at: 1747100000 },
    ],
    // Admin-curated public board of open reviewer calls.
    boardCalls: [
      { id: "bc-1", area: "Rust · WebAssembly", skills: ["Rust", "WebAssembly", "WASI"], waiting: 3, note: "Низкоуровневые главы простаивают без профильного ревьюера.", hot: true },
      { id: "bc-2", area: "Kubernetes · Platform", skills: ["Kubernetes", "Helm", "eBPF"], waiting: 2, note: "Растёт поток статей по платформенной инженерии.", hot: true },
      { id: "bc-3", area: "ML · Inference", skills: ["PyTorch", "ONNX", "CUDA"], waiting: 2, note: "Нужен второй ревьюер на серию про инференс." },
      { id: "bc-4", area: "Security · AppSec", skills: ["OWASP", "Auth", "Crypto"], waiting: 1, note: "Ищем ведущего для разбора уязвимостей." },
    ],
    ratings: {}, // handle -> [{ stars, by, chapter, at }]
    ratedChapters: {}, // chapterKey -> true once the author has rated
    // People applying to become reviewers from the public board.
    applications: [],
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    // Submit a reviewer application (from the «Стать ревьюером» / «Откликнуться»
    // board buttons). area is optional (the call they responded to).
    apply(app) {
      const rec = Object.assign({ id: "ap-" + Date.now(), status: "pending", at: Math.floor(Date.now() / 1000) }, app);
      this.applications.push(rec); emit(); return rec;
    },
    resolveApplication(id, status) {
      const a = this.applications.find(x => x.id === id);
      if (a) { a.status = status; a.resolvedAt = Math.floor(Date.now() / 1000); emit(); }
    },
    invitesFor(handle, status) {
      return this.invitations.filter(i => i.to === handle && (!status || i.status === status));
    },
    respond(id, status) {
      const inv = this.invitations.find(i => i.id === id);
      if (inv) { inv.status = status; inv.respondedAt = Math.floor(Date.now() / 1000); emit(); }
    },
    invite(records) { records.forEach(r => this.invitations.push(r)); emit(); },
    requestRecruit(req) {
      const rec = Object.assign({ id: "rr-" + Date.now(), status: "pending", at: Math.floor(Date.now() / 1000) }, req);
      this.recruitRequests.push(rec); emit(); return rec;
    },
    recruitFor(handle) { return this.recruitRequests.filter(r => r.by === handle); },
    resolveRecruit(id, status, reason) {
      const r = this.recruitRequests.find(x => x.id === id);
      if (!r) return;
      r.status = status; r.reason = reason || ""; r.resolvedAt = Math.floor(Date.now() / 1000);
      // Approving a request publishes a matching call onto the public board.
      if (status === "approved") {
        this.boardCalls.unshift({
          id: "bc-" + Date.now(), area: (r.skills || []).slice(0, 2).join(" · ") || r.chapterTitle,
          skills: (r.skills || []).slice(), waiting: 1,
          note: `По запросу автора «${r.chapterTitle || r.blogTitle}».`, hot: true,
        });
      }
      emit();
    },
    rate(handle, stars, by, chapter) {
      (this.ratings[handle] = this.ratings[handle] || []).push({ stars, by, chapter, at: Math.floor(Date.now() / 1000) });
      emit();
    },
    // Author rates a whole chapter's reviewers at once; marks it rated so the
    // «оцените» prompt disappears.
    rateChapter(key, entries) {
      (entries || []).forEach(e => {
        (this.ratings[e.handle] = this.ratings[e.handle] || []).push({ stars: e.stars, by: "author", chapter: key, at: Math.floor(Date.now() / 1000) });
      });
      this.ratedChapters[key] = true; emit();
    },
    isRated(key) { return !!this.ratedChapters[key]; },
    // Invitations a reviewer flagged as skill-mismatch, for a given author.
    flaggedFor(author) { return this.invitations.filter(i => i.status === "flagged" && i.author === author); },
  };
  window.__reviewerFlow = store;
})();
