/**
 * SHOP.js — Ozylix
 * ─────────────────────────────────────────────────────────────────
 * Extracted from index.html inline scripts (19 Aug 2026, Manus SEO pass).
 * Supabase client config (lazy — the deferred CDN bundle may not exist
 * when this runs and must not block first paint), VITA points display,
 * service-worker registration with non-disruptive update notices, and
 * the deterministic initShopHero bootstrap for the banner sliders.
 *
 * Removed as dead code: the old ".carousel-wrap" touch-swipe block — the
 * home carousel (shopHero / shTrack) is rendered by banners.js with its
 * own controls, and no .carousel-wrap markup exists in the page.
 */
(function () {
  // ── DATA ACCESS ──
  // The storefront must not connect directly to Supabase. Database and
  // Storage access is server-side only through the Ozylix backend API.
  // Keep this compatibility function returning null for older optional
  // callers; all required public data loaders use backend API routes.
  window.sbClient = function () { return null; };

  // ── VITA POINTS MICRO-DISPLAY ──
  window.updateVitaMicrocopy = function () {
    try {
      var e = typeof VITA_EARN_PER_RUPEE !== 'undefined' ? VITA_EARN_PER_RUPEE : 1;
      var v = typeof VITA_REDEEM_PER_RUPEE !== 'undefined' ? VITA_REDEEM_PER_RUPEE : 150;
      var a = document.getElementById('vitaMicroEarn');
      var b = document.getElementById('vitaMicroValue');
      if (a) a.textContent = e + ' point' + (e > 1 ? 's' : '') + ' per ₹1';
      if (b) b.textContent = v + ' points = ₹1 off';
    } catch (x) { /* decorative — never break the page */ }
  };
  window.updateVitaMicrocopy();

  // ── SERVICE WORKER ──
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(function (reg) {
        // A new sw.js was deployed while this tab was open. Don't force a
        // reload mid-session (could drop a cart/checkout in progress) —
        // just let the person know, the same way the network banner does.
        reg.addEventListener('updatefound', function () {
          var installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', function () {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              if (typeof showToast === 'function') {
                showToast('A new version of the site is available — refresh to update.', '');
              }
            }
          });
        });
      }).catch(function (err) {
        console.warn('[Ozylix] Service worker registration failed:', err);
      });
    });
  }

  // ── SHOP HERO BOOTSTRAP ──
  // banners.js (which defines initShopHero) is now a defer-loaded external
  // script, so DOMContentLoaded fires BEFORE the function exists. The eager
  // call covers the pre-split case; the window 'load' retry catches the
  // deferred-script case. site-media.js also re-invokes initShopHero after
  // admin banners arrive, covering live updates.
  var ran = { v: false };
  function boot() {
    if (ran.v) return; ran.v = true;
    try { if (typeof initShopHero === 'function') initShopHero(); } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
  } else {
    setTimeout(boot, 0);
  }
  window.addEventListener('load', function () { setTimeout(boot, 0); });
})();
