/* One motion layer for every admin page. No API calls or business-state changes. */
(function () {
  'use strict';
  const root = document.getElementById('app');
  if (!root) return;
  const body = document.body;
  const key = 'ozylix_admin_appearance_v1';
  const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let preferences = { look: 'bento', motion: 'full' };
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && ['bento', 'classic'].includes(saved.look)) preferences.look = saved.look;
    if (saved && ['full', 'reduced'].includes(saved.motion)) preferences.motion = saved.motion;
  } catch (_) { /* Storage is optional. */ }
  let activePage = null;
  let frame = 0;
  const animations = new Set();
  const counters = new Set();
  let seen = new WeakSet();
  const surfaces = '.card,.kpi,.oz-section-card,.oz-advanced-surface,.table-wrap';
  const reduced = () => systemMotion.matches || preferences.motion === 'reduced';
  function stop() {
    animations.forEach(animation => animation.cancel());
    animations.clear();
    counters.forEach(counter => {
      cancelAnimationFrame(counter.frame);
      if (counter.element.isConnected) counter.element.textContent = counter.format(counter.value);
    });
    counters.clear();
  }
  function apply() {
    body.classList.toggle('admin-bento', preferences.look === 'bento');
    body.classList.toggle('admin-motion-reduced', reduced());
    body.classList.add('admin-motion-ready');
    root.querySelectorAll('[data-admin-look]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.adminLook === preferences.look)));
    root.querySelectorAll('[data-admin-motion]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.adminMotion === preferences.motion)));
    if (reduced()) {
      stop();
      // Existing CSS transitions can already be running when the preference
      // changes; cancel them so the final computed style appears immediately.
      if (root.getAnimations) root.getAnimations({subtree:true}).forEach(animation => animation.cancel());
    }
  }
  function animate(element, delay) {
    if (reduced() || typeof element.animate !== 'function') return;
    // Entry motion never changes card content or replaces a DOM node.
    const animation = element.animate([
      { opacity: .35, transform: 'translateY(10px) scale(.992)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], { duration: 380, delay, easing: 'cubic-bezier(.22,1,.36,1)' });
    animations.add(animation);
    const remove = () => animations.delete(animation);
    animation.onfinish = remove;
    animation.oncancel = remove;
  }
  function sync() {
    frame = 0;
    const page = root.querySelector('.page.active');
    if (!page || root.getClientRects().length === 0) return;
    if (page !== activePage) {
      stop();
      activePage = page;
      seen = new WeakSet();
      const heading = page.querySelector('.page-hdr');
      if (heading) animate(heading, 0);
    }
    // Bounded entry animation only for visible cards. Hidden pages and large
    // table row replacements do not start hundreds of animations.
    let count = 0;
    for (const element of page.querySelectorAll(surfaces)) {
      if (seen.has(element) || element.classList.contains('skel')) continue;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.top >= window.innerHeight || rect.bottom <= 0) continue;
      if (element.parentElement.closest(surfaces)) continue;
      seen.add(element);
      animate(element, Math.min(count * 35, 175));
      if (++count >= 24) break;
    }
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }
  root.addEventListener('click', event => {
    // The existing palette picker remains useful: choosing a palette returns
    // to that theme instead of silently overriding it with the bento colours.
    if (event.target.closest('.palette-opt,.layout-theme-opt')) {
      preferences.look = 'classic';
      try { localStorage.setItem(key, JSON.stringify(preferences)); } catch (_) {}
      apply();
      return;
    }
    const button = event.target.closest('[data-admin-look],[data-admin-motion]');
    if (!button || !root.contains(button)) return;
    if (button.dataset.adminLook) preferences.look = button.dataset.adminLook;
    if (button.dataset.adminMotion) preferences.motion = button.dataset.adminMotion;
    try { localStorage.setItem(key, JSON.stringify(preferences)); } catch (_) {}
    apply();
    schedule();
  });
  // Navigation keeps its existing handler. Observing the class change also
  // supports keyboard shortcuts, mobile More, and asynchronously loaded pages.
  new MutationObserver(schedule).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else schedule();
  });
  if (systemMotion.addEventListener) systemMotion.addEventListener('change', apply);
  // Honour reduced motion for the existing dashboard number animation too.
  // Use the same final value and formatter supplied by the data module.
  if (typeof window.animateCount === 'function') {
    window.animateCount = function (element, from, to, format, duration = 900) {
      if (!element) return;
      if (reduced() || duration <= 0) { element.textContent = format(to); return; }
      counters.forEach(counter => {
        if (counter.element === element) { cancelAnimationFrame(counter.frame); counters.delete(counter); }
      });
      const counter = {element, format, value:to, frame:0};
      const start = performance.now();
      const tick = now => {
        if (!element.isConnected) { counters.delete(counter); return; }
        const progress = Math.min((now - start) / duration, 1);
        element.textContent = format(from + (to - from) * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) counter.frame = requestAnimationFrame(tick);
        else counters.delete(counter);
      };
      counters.add(counter);
      counter.frame = requestAnimationFrame(tick);
    };
  }
  apply();
  schedule();
})();
