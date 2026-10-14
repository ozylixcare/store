/**
 * TRACKING.js — Ozylix
 * GTM and the Meta base pixel are initialized once in each public HTML head.
 * Keep the shared dataLayer and shopping/SPA helpers; Google destinations are
 * configured by GTM rather than hard-coded GA4 measurement IDs.
 */
(function () {
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  var _gtag = function () {
    var args = Array.prototype.slice.call(arguments);
    gtag.apply(null, args);
  };

  // ── GOOGLE IDENTITY SERVICES (bot-gated) ──
  var ua = navigator.userAgent || '';
  var isBot = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver|crawler|spider|headlesschrome|bot\b/i.test(ua);
  if (!isBot) {
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = function () { window.onGoogleLibraryLoad && window.onGoogleLibraryLoad(); };
    document.head.appendChild(s);
  }

  // ── E-COMMERCE / ENGAGEMENT HELPERS ──
  // PAGE VIEW — called from showPage (SPA navigation). Reads the REAL URL
  // rather than rebuilding a hash-routed one; GA4's Pages report used to
  // list '/#shop' while Search Console and every real link said '/shop'.
  window._trackPage = function (pageName) {
    _gtag('event', 'page_view', {
      page_title:    'Ozylix – ' + (pageName.charAt(0).toUpperCase() + pageName.slice(1)),
      page_location: window.location.href,
      page_path:     window.location.pathname + window.location.search,
    });
  };

  window._trackViewItem = function (product) {
    if (!product) return;
    _gtag('event', 'view_item', {
      currency: 'INR',
      value:    product.salePrice || product.price || 0,
      items: [{
        item_id:       String(product.id),
        item_name:     product.name || '',
        item_category: product.category || '',
        item_brand:    product.brand || 'Ozylix',
        price:         product.salePrice || product.price || 0,
        quantity:      1,
      }],
    });
    if (typeof fbq === 'function') fbq('track', 'ViewContent', {
      content_ids: [String(product.id)],
      content_name: product.name || '',
      content_category: product.category || '',
      content_type: 'product',
      value: product.salePrice || product.price || 0,
      currency: 'INR',
    });
  };

  window._trackAddToCart = function (product, qty) {
    if (!product) return;
    _gtag('event', 'add_to_cart', {
      currency: 'INR',
      value:    (product.salePrice || product.price || 0) * (qty || 1),
      items: [{
        item_id:       String(product.id),
        item_name:     product.name || '',
        item_category: product.category || '',
        item_brand:    product.brand || 'Ozylix',
        price:         product.salePrice || product.price || 0,
        quantity:      qty || 1,
      }],
    });
    if (typeof fbq === 'function') fbq('track', 'AddToCart', {
      content_ids: [String(product.id)],
      content_name: product.name || '',
      content_type: 'product',
      value: (product.salePrice || product.price || 0) * (qty || 1),
      currency: 'INR',
    });
  };

  window._trackViewCart = function (cartItems, total) {
    _gtag('event', 'view_cart', {
      currency: 'INR',
      value:    total || 0,
      items:    (cartItems || []).map(function (i) {
        return { item_id: String(i.id), item_name: i.name || '', price: i.price || 0, quantity: i.qty || 1 };
      }),
    });
  };

  window._trackBeginCheckout = function (cartItems, total) {
    _gtag('event', 'begin_checkout', {
      currency: 'INR',
      value:    total || 0,
      items:    (cartItems || []).map(function (i) {
        return { item_id: String(i.id), item_name: i.name || '', price: i.price || 0, quantity: i.qty || 1 };
      }),
    });
    if (typeof fbq === 'function') fbq('track', 'InitiateCheckout', {
      content_ids: (cartItems || []).map(function (i) { return String(i.id); }),
      content_type: 'product',
      num_items: (cartItems || []).reduce(function (n, i) { return n + (i.qty || 1); }, 0),
      value: total || 0,
      currency: 'INR',
    });
  };

  window._trackPurchase = function (orderId, total, items) {
    _gtag('event', 'purchase', {
      transaction_id: orderId,
      value:          total,
      currency:       'INR',
      items:          (items || []).map(function (i) {
        return { item_id: i.sku || String(i.id || ''), item_name: i.name || '', price: i.selling_price || i.price || 0, quantity: i.units || i.qty || 1 };
      }),
    });
    if (typeof fbq === 'function') fbq('track', 'Purchase', {
      content_ids: (items || []).map(function (i) { return i.sku || String(i.id || ''); }),
      content_type: 'product',
      value: total,
      currency: 'INR',
    }, { eventID: String(orderId) }); // eventID enables dedup if you later add server-side Conversions API for the same order
  };

  window._trackSearch = function (searchTerm) {
    _gtag('event', 'search', { search_term: searchTerm });
    if (typeof fbq === 'function') fbq('track', 'Search', { search_string: searchTerm });
  };

  window._trackCoupon = function (couponCode, discount) {
    _gtag('event', 'select_promotion', {
      promotion_name: couponCode,
      discount:       discount || 0,
    });
  };
})();
