// Observe product images without downloading hidden routes or off-screen grids.
(function installProductImgHydrator() {
  if (window._hpiInstalled) return;
  window._hpiInstalled = true;
  var selector = 'div.product-card img[data-src]';
  function hydrate(img) {
    if (!img || !img.dataset.src) return;
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
  }
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      hydrate(entry.target);
      io.unobserve(entry.target);
    });
  }, { rootMargin: '300px 0px' }) : null;
  function watch(img) {
    if (!img.matches(selector)) return;
    if (io) io.observe(img);
    else hydrate(img);
  }
  window._hpiFlush = function() { document.querySelectorAll(selector).forEach(watch); };
  var mo = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'attributes') { watch(mutation.target); return; }
      mutation.addedNodes.forEach(function(node) {
        if (!(node instanceof Element)) return;
        watch(node);
        node.querySelectorAll(selector).forEach(watch);
      });
    });
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-src'] });
  window._hpiFlush();
})();
function hydrateProductImgs() { if (window._hpiFlush) window._hpiFlush(); }


// Recover transient image failures without replacing the existing fallback UI.
// Capture runs before inline onerror handlers overwrite src with a placeholder.
(function installImageRecovery() {
  var retries = new WeakMap();
  document.addEventListener('error', function(event) {
    var img = event.target;
    if (!img || img.tagName !== 'IMG') return;
    var source = img.getAttribute('src') || '';
    if (!/^(https?:\/\/|\/(?!\/))/.test(source)) return;
    var state = retries.get(img);
    if (!state || state.source !== source) {
      state = { source: source, count: 0, pending: false };
      retries.set(img, state);
    }
    if (state.pending || state.count >= 2) return;
    state.pending = true;
    state.count += 1;
    setTimeout(function() {
      state.pending = false;
      if (!img.isConnected || retries.get(img) !== state) return;
      var current = img.getAttribute('src') || '';
      // Never overwrite a newer product image selected while waiting.
      if (current !== source && !/^data:image\//.test(current)) return;
      img.src = source;
    }, state.count * 1500);
  }, true);
})();
