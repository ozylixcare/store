/* Admin-managed video reels. Only active videos from the public API are shown. */
(function () {
  'use strict';
  var items = [], dialog, player, counter, message, previousFocus, savedOverflow;
  var observer, visible = new Set(), activeIndex = 0, refreshTimer, request;
  var section, track;
  function safeUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      var url = new URL(value, window.location.origin);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }
  function videosFrom(payload) {
    var rows = payload && (payload.data || payload.items || payload);
    return (Array.isArray(rows) ? rows : []).filter(function (item) {
      return item && item.active !== false && safeUrl(item.src) &&
        (item.type === 'video' || (!item.type && /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(item.src)));
    }).map(function (item) {
      var cdn = typeof cdnImg === 'function' ? cdnImg : function (url) { return url; };
      return { src: safeUrl(cdn(item.src)), poster: safeUrl(cdn(item.poster || '')), title: item.alt || item.title || 'Ozylix video' };
    }).filter(function (item) { return !!item.src; });
  }
  function attemptPlay(video) {
    var promise = video.play();
    if (promise && promise.catch) promise.catch(function () {});
  }
  function syncPreviews() {
    if (!track) return;
    track.querySelectorAll('video').forEach(function (video) {
      if (!document.hidden && !(dialog && dialog.open) && visible.has(video)) {
        if (!video.getAttribute('src')) video.src = video.dataset.src;
        attemptPlay(video);
      } else video.pause();
    });
  }
  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function control(text, label, action) {
    var button = element('button', 'pm-reel-control', text);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.addEventListener('click', action);
    return button;
  }
  function showVideo(index) {
    if (!items.length) return;
    activeIndex = (index + items.length) % items.length;
    var item = items[activeIndex];
    player.pause();
    player.src = item.src;
    player.poster = item.poster;
    player.setAttribute('aria-label', item.title);
    counter.textContent = (activeIndex + 1) + ' / ' + items.length;
    message.hidden = true;
    player.load();
    attemptPlay(player);
  }
  function createViewer() {
    if (dialog) return;
    dialog = element('dialog', 'pm-reel-viewer');
    dialog.setAttribute('aria-label', 'Ozylix promotional videos');
    var panel = element('div', 'pm-reel-panel');
    var header = element('div', 'pm-reel-header');
    header.appendChild(element('strong', '', 'Ozylix videos'));
    counter = element('span', 'pm-reel-counter');
    counter.setAttribute('aria-live', 'polite');
    header.appendChild(counter);
    header.appendChild(control('×', 'Close video viewer', function () { dialog.close(); }));
    player = element('video', 'pm-reel-player');
    player.controls = true;
    player.playsInline = true;
    player.preload = 'metadata';
    player.addEventListener('ended', function () { showVideo(activeIndex + 1); });
    message = element('p', 'pm-reel-error', 'This video could not load. Try the next video.');
    message.hidden = true;
    player.addEventListener('error', function () { message.hidden = false; });
    var nav = element('div', 'pm-reel-nav');
    nav.appendChild(control('‹', 'Previous video', function () { showVideo(activeIndex - 1); }));
    nav.appendChild(element('span', '', 'Swipe or use the arrows to browse'));
    nav.appendChild(control('›', 'Next video', function () { showVideo(activeIndex + 1); }));
    panel.append(header, player, message, nav);
    dialog.appendChild(panel);
    document.body.appendChild(dialog);
    dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', function () {
      player.pause();
      player.removeAttribute('src');
      player.load();
      section.classList.remove('pm-viewing');
      document.body.style.overflow = savedOverflow;
      if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
      syncPreviews();
    });
    dialog.addEventListener('keydown', function (event) {
      if (event.target === player) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); showVideo(activeIndex + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    var startX, startY;
    player.addEventListener('touchstart', function (event) { startX = event.changedTouches[0].clientX; startY = event.changedTouches[0].clientY; }, { passive: true });
    player.addEventListener('touchend', function (event) {
      var dx = event.changedTouches[0].clientX - startX;
      var dy = event.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) showVideo(activeIndex + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }
  function openVideo(index) {
    createViewer();
    previousFocus = document.activeElement;
    savedOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    section.classList.add('pm-viewing');
    syncPreviews();
    showVideo(index);
  }
  function card(item, index, clone) {
    var button = element('button', 'pm-card pm-reel-card');
    button.type = 'button';
    button.setAttribute('aria-label', 'Play ' + item.title + ' (' + (index + 1) + ' of ' + items.length + ')');
    if (clone) { button.tabIndex = -1; button.setAttribute('aria-hidden', 'true'); }
    button.dataset.index = index;
    var video = element('video', 'pm-card-media');
    video.dataset.src = item.src;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.setAttribute('aria-hidden', 'true');
    if (item.poster) video.poster = item.poster;
    button.appendChild(video);
    var play = element('span', 'pm-reel-play', '▶');
    play.setAttribute('aria-hidden', 'true');
    button.appendChild(play);
    button.appendChild(element('span', 'pm-reel-caption', item.title));
    return button;
  }
  function paint() {
    if (observer) observer.disconnect();
    track.querySelectorAll('video').forEach(function (video) { video.pause(); video.removeAttribute('src'); video.load(); });
    visible.clear();
    track.replaceChildren();
    section.style.display = items.length ? '' : 'none';
    if (!items.length) { if (dialog && dialog.open) dialog.close(); return; }
    // Repeat complete sequences only to fill wide screens; there is no item cap.
    var copies = Math.max(1, Math.ceil(window.innerWidth / (items.length * 180)));
    for (var groupIndex = 0; groupIndex < 2; groupIndex++) {
      var group = element('div', 'pm-reel-group');
      if (groupIndex) group.setAttribute('aria-hidden', 'true');
      for (var repeat = 0; repeat < copies; repeat++) items.forEach(function (item, index) {
        group.appendChild(card(item, index, !!(groupIndex || repeat)));
      });
      track.appendChild(group);
    }
    track.style.setProperty('--pm-duration', Math.max(24, copies * items.length * 6) + 's');
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target); });
        syncPreviews();
      });
      track.querySelectorAll('video').forEach(function (video) { observer.observe(video); });
    }
  }
  function load() {
    if (request) return;
    var base = typeof API_BASE !== 'undefined' ? API_BASE : '';
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 8000);
    request = fetch(base + '/api/promo-media', { signal: ctl.signal, cache: 'no-store' })
      .then(function (response) { if (!response.ok) throw new Error('Unavailable'); return response.json(); })
      .then(function (payload) {
        var next = videosFrom(payload);
        if (JSON.stringify(next) === JSON.stringify(items)) return;
        if (dialog && dialog.open) dialog.close();
        items = next; paint();
      })
      .catch(function () { /* Keep the last verified list during a temporary network error. */ })
      .finally(function () { clearTimeout(timer); request = null; });
  }
  function init() {
    section = document.getElementById('promo-media-section');
    track = document.getElementById('pmTrack');
    if (!section || !track) return;
    section.style.display = 'none';
    track.addEventListener('click', function (event) {
      var button = event.target.closest('.pm-reel-card');
      if (button && track.contains(button)) openVideo(Number(button.dataset.index));
    });
    load();
    setInterval(function () { if (!document.hidden) load(); }, 60000);
    document.addEventListener('visibilitychange', function () {
      syncPreviews();
      if (document.hidden && player) player.pause();
      if (!document.hidden) load();
    });
    window.addEventListener('resize', function () { clearTimeout(refreshTimer); refreshTimer = setTimeout(function () { if (!(dialog && dialog.open)) paint(); }, 200); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
