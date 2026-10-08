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
  const paths = {
    dashboard:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    analytics:'M4 3v18h17 M8 16v-5 M13 16V7 M18 16V4',
    orders:'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10',
    products:'M4 7h16l1 14H3z M8 7V5a4 4 0 0 1 8 0v2',
    returns:'M9 4 4 9l5 5 M4 9h10a6 6 0 0 1 0 12h-3',
    calendar:'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2z M7 3v4 M17 3v4 M3 11h18',
    customers:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M18 4a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-4',
    payments:'M3 5h18v14H3z M3 10h18 M6 15h4',
    finance:'M4 21V10h16v11 M2 10l10-7 10 7 M8 13v5 M12 13v5 M16 13v5',
    inventory:'M5 4h14v17H5z M9 3v3h6V3z M8 11h8 M8 15h8',
    discounts:'M3 3h9l9 9-9 9-9-9z M7 7h.01',
    livevisitors:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    image:'M3 3h18v18H3z M3 17l5-5 4 4 4-7 5 8 M8 7h.01',
    settings:'M9 3h6l1 4 4 1 1 6-4 2-1 4H9l-1-4-4-1-1-6 4-2z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    more:'M4 12h.01 M12 12h.01 M20 12h.01'
  };
  const icons = Array.from(root.querySelectorAll('.nav-ico,.abn-btn > span:first-child')).map(element => {
    const nav = element.closest('.nav-item,.abn-btn');
    const name = (nav?.getAttribute('onclick') || '').match(/showPage\(['"]([^'"]+)/)?.[1] || 'more';
    element.setAttribute('aria-hidden','true');
    return {element, name, text:element.textContent};
  });
  function renderIcons() {
    icons.forEach(({element, name, text}) => {
      element.textContent = '';
      if (preferences.look !== 'bento') { element.textContent = text; return; }
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      svg.setAttribute('viewBox','0 0 24 24');
      svg.setAttribute('fill','none'); svg.setAttribute('stroke','currentColor');
      svg.setAttribute('stroke-width','1.65'); svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round');
      path.setAttribute('d',paths[name] || (['banners','photolibrary','siteimages'].includes(name) ? paths.image : paths.dashboard));
      svg.appendChild(path); element.appendChild(svg);
    });
  }
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
    renderIcons();
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
    const menuButton = root.querySelector('.hamburger-btn');
    if (menuButton) menuButton.setAttribute('aria-expanded', String(!!document.querySelector('#adminMoreMenu.open')));
    const page = root.querySelector('.page.active');
    if (!page || root.getClientRects().length === 0) return;
    if (page !== activePage) {
      stop();
      activePage = page;
      seen = new WeakSet();
      // A different destination should start at its heading, even when the
      // preceding page or mobile Settings controls were far down the document.
      window.scrollTo({top:0, behavior:'instant'});
      const main = root.querySelector('.main');
      if (main) main.scrollTop = 0;
      root.querySelectorAll('.nav-item').forEach(item => {
        if (item.classList.contains('active')) item.setAttribute('aria-current','page');
        else item.removeAttribute('aria-current');
      });
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
    schedule();
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
  root.querySelectorAll('div.nav-item').forEach(item => { item.setAttribute('role','button'); item.tabIndex = 0; });
  root.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('div.nav-item')) {
      event.preventDefault(); event.target.click();
    }
  });
  // Navigation keeps its existing handler. Observing the class change also
  // supports keyboard shortcuts, mobile More, and asynchronously loaded pages.
  const observer = new MutationObserver(schedule);
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
  const moreMenu = document.getElementById('adminMoreMenu');
  if (moreMenu && !root.contains(moreMenu)) observer.observe(moreMenu, {attributes:true, attributeFilter:['class','style']});
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
