// donation.js — additive donation + promo-banner data layer (Phase 3).
// Loads after data.js. Two INDEPENDENT stores:
//   window.__banners  — carousel promo slides on the feed (admin-managed)
//   window.__donations — donation methods + enable flag (admin-managed)
// Both are pub-sub and persist nothing server-side (prototype in-memory).
(function () {
  function makeStore(initial) {
    const subs = new Set();
    const state = initial;
    return {
      get: () => state,
      subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
      emit() { subs.forEach(fn => { try { fn(); } catch (e) {} }); },
    };
  }

  // ── Promo banners (feed carousel) ──────────────────────────────────
  // action: "internal" (in-app nav), "external" (new tab), "donate" (open modal)
  const bannersState = {
    items: [
      { id: "b-reviewer", eyebrow: "Ищем ревьюеров", title: "Рецензируйте статьи по своим навыкам", cta: "Стать ревьюером", tone: "teal", icon: "pen", action: "internal", target: "board", visible: true },
      { id: "b-donate", eyebrow: "Поддержите проект", title: "Recenza живёт на пожертвования читателей", cta: "Поддержать", tone: "gold", icon: "heart", action: "donate", target: "", visible: true },
    ],
  };
  const banners = makeStore(bannersState);
  Object.assign(banners, {
    visibleItems() { return bannersState.items.filter(b => b.visible); },
    update(id, patch) { const b = bannersState.items.find(x => x.id === id); if (b) { Object.assign(b, patch); banners.emit(); } },
    add() { bannersState.items.push({ id: "b-" + Date.now(), eyebrow: "Новый баннер", title: "Заголовок баннера", cta: "Подробнее", tone: "teal", icon: "pen", action: "internal", target: "board", visible: false }); banners.emit(); },
    remove(id) { bannersState.items = bannersState.items.filter(x => x.id !== id); banners.emit(); },
  });
  window.__banners = banners;

  // ── Donation methods ───────────────────────────────────────────────
  // type: "link" (button → opens url in new tab) | "qr" (scannable image)
  const donState = {
    enabled: true,
    methods: [
      { id: "da", name: "DonationAlerts", type: "link", url: "https://donationalerts.com/r/recenza", hint: "Картой, кошельком, телефоном", visible: true, primary: true },
      { id: "ozon", name: "Ozon Банк", type: "qr", hint: "Сканируйте в приложении Ozon", visible: true, qrUploaded: true },
      { id: "sbp", name: "СБП", type: "qr", hint: "Любой банк с поддержкой СБП", visible: false, qrUploaded: false },
    ],
  };
  const donations = makeStore(donState);
  Object.assign(donations, {
    isEnabled() { return donState.enabled; },
    setEnabled(v) { donState.enabled = v; donations.emit(); },
    visibleMethods() { return donState.methods.filter(m => m.visible); },
    update(id, patch) { const m = donState.methods.find(x => x.id === id); if (m) { Object.assign(m, patch); donations.emit(); } },
    add() { donState.methods.push({ id: "m-" + Date.now(), name: "Новый способ", type: "link", url: "", hint: "", visible: false }); donations.emit(); },
    remove(id) { donState.methods = donState.methods.filter(x => x.id !== id); donations.emit(); },
  });
  window.__donations = donations;
})();
