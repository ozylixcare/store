(function () {
  'use strict';
  var KEY = 'ozylix.privacy.v1';
  function read() {
    try { var p = JSON.parse(localStorage.getItem(KEY) || 'null'); return p && p.version === 1 ? p : null; } catch (_) { return null; }
  }
  function restricted() { return navigator.globalPrivacyControl === true || /^(1|yes)$/.test(navigator.doNotTrack || ''); }
  function allowed(kind) { var p = read(); return !restricted() && !!p && p[kind] === true; }
  window.ozylixPrivacy = { allows: allowed, preferences: read, open: open, clearDevice: clearDevice };
  // A tracker must never infer permission from a missing or corrupt preference.
  function save(analytics, advertising) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, analytics: !!analytics, advertising: !!advertising, at: new Date().toISOString() }));
      localStorage.setItem('ozy_optout', analytics && !restricted() ? '0' : '1');
    } catch (_) { return; }
    // Reload unloads previously authorised SDKs as well as gating future calls.
    clearTrackingCookies();
    location.reload();
  }
  function clearTrackingCookies() {
    document.cookie.split(';').forEach(function (part) {
      var name = part.trim().split('=')[0];
      if (!/^(_ga|_gid|_gat|_gcl|_fbp|_fbc)/.test(name)) return;
      ['', location.hostname, '.ozylix.com'].forEach(function (domain) {
        document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax; Secure' + (domain ? '; Domain=' + domain : '');
      });
    });
  }
  async function clearDevice() {
    // Preserve the explicit privacy choice; clear only this application's data.
    [localStorage, sessionStorage].forEach(function (storage) {
      Object.keys(storage).forEach(function (key) {
        if (key !== KEY && key !== 'ozy_optout' && /^(asc_|ozy_|ozylix[._-]|ozylix-position$)/i.test(key)) storage.removeItem(key);
      });
    });
    clearTrackingCookies();
    if ('caches' in window) { var keys = await caches.keys(); await Promise.all(keys.filter(function (k) { return /^ozylix-/.test(k); }).map(function (k) { return caches.delete(k); })); }
    if ('serviceWorker' in navigator) { var registration = await navigator.serviceWorker.getRegistration(); if (registration && registration.pushManager) { var subscription = await registration.pushManager.getSubscription(); if (subscription) await subscription.unsubscribe(); } }
  }
  function open() {
    if (document.getElementById('ozPrivacyDialog')) return;
    var p = read(), box = document.createElement('dialog'); box.id = 'ozPrivacyDialog'; box.setAttribute('aria-labelledby', 'ozPrivacyTitle');
    box.innerHTML = '<h2 id="ozPrivacyTitle">Your privacy choices</h2><p>Essential storage keeps sign-in, your basket, security and checkout working. Optional analytics measures site use. Advertising tools measure campaigns and may link visits across sites.</p><label><input type="checkbox" id="ozAnalytics"> Allow analytics</label><label><input type="checkbox" id="ozAdvertising"> Allow advertising measurement (Google Tag Manager and Meta)</label><p>Choosing optional tracking is separate from email, WhatsApp and browser-notification permissions. You can change this choice in Privacy Policy.</p><div class="oz-privacy-actions"><button type="button" data-choice="reject">Essential only</button><button type="button" data-choice="save">Save choices</button><button type="button" data-choice="all">Allow optional tracking</button></div>';
    document.body.appendChild(box);
    box.querySelector('#ozAnalytics').checked = !!p && p.analytics === true;
    box.querySelector('#ozAdvertising').checked = !!p && p.advertising === true;
    box.querySelectorAll('button').forEach(function (b) { b.onclick = function () { var c = b.dataset.choice; save(c === 'all' || c === 'save' && box.querySelector('#ozAnalytics').checked, c === 'all' || c === 'save' && box.querySelector('#ozAdvertising').checked); }; });
    box.showModal();
  }
  function boot() {
    var style = document.createElement('style');
    style.textContent = '#ozPrivacyDialog{box-sizing:border-box;width:min(92vw,620px);max-height:85vh;overflow:auto;border:1px solid #d6d6d6;border-radius:20px;padding:24px;background:var(--paper,#fff);color:var(--t-hi,#20303a);font:inherit;line-height:1.65}#ozPrivacyDialog::backdrop{background:rgba(0,0,0,.36)}#ozPrivacyDialog label{display:block;margin:14px 0}.oz-privacy-actions{display:flex;flex-wrap:wrap;gap:10px}.oz-privacy-actions button{padding:10px 15px;border:1px solid currentColor;border-radius:12px;background:var(--paper,#fff);color:inherit;font:inherit;cursor:pointer}';
    document.head.appendChild(style);
    if (!read() && !restricted()) open();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
