// Extracted from index.html (line 22350) by Manus SEO pass — load order preserved

/* ── Ozylix UI v2: Navbar scroll shadow + card 3D tilt ── */
(function() {
  'use strict';

  /* Navbar scrolled class */
  var nav = document.querySelector('.navbar');
  if (nav) {
    var lastScroll = 0;
    window.addEventListener('scroll', function() {
      var y = window.scrollY;
      nav.classList.toggle('scrolled', y > 24);
      lastScroll = y;
    }, { passive: true });
  }

  /* Scroll-reveal IntersectionObserver */
  var ro = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        ro.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  function initReveal() {
    document.querySelectorAll('[data-reveal]').forEach(function(el) {
      ro.observe(el);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }
  /* Re-observe when new reveal elements are added */
  var rmo = new MutationObserver(function(muts) {
    muts.forEach(function(m) {
      m.addedNodes.forEach(function(n) {
        if (n.nodeType === 1) {
          if (n.dataset && n.dataset.reveal !== undefined) ro.observe(n);
          n.querySelectorAll && n.querySelectorAll('[data-reveal]').forEach(function(el){ ro.observe(el); });
        }
      });
    });
  });
  rmo.observe(document.body, { childList: true, subtree: true });

})();
