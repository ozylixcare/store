/**
 * TRACKING.js — Ozylix
 * GTM and the Meta base pixel are initialized once in each public HTML head.
 * Send GA4 events to the connected property and the retained secondary property.
 * Both destinations share one loader and the shopping/SPA helpers.
 */
(function () {
  function allows(kind) { return !!window.ozylixPrivacy && window.ozylixPrivacy.allows(kind); }
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  function loadScript(src) { var s=document.createElement('script');s.src=src;s.async=true;document.head.appendChild(s); }
  if (allows('analytics')) {
    gtag('consent','default',{analytics_storage:'granted',ad_storage:allows('advertising')?'granted':'denied',ad_user_data:allows('advertising')?'granted':'denied',ad_personalization:allows('advertising')?'granted':'denied'});
    gtag('js',new Date());
    ['G-1SPY139WS1','G-VC8L1WF561'].forEach(function(id){gtag('config',id,{send_page_view:false,allow_google_signals:allows('advertising'),allow_ad_personalization_signals:allows('advertising')});});
    loadScript('https://www.googletagmanager.com/gtag/js?id=G-VC8L1WF561');
  }
  if (allows('advertising')) {
    var fb=function(){fb.callMethod?fb.callMethod.apply(fb,arguments):fb.queue.push(arguments);};
    fb.queue=[];fb.loaded=true;fb.version='2.0';window.fbq=fb;
    loadScript('https://connect.facebook.net/en_US/fbevents.js');
    fb('init','5548440758714716');fb('track','PageView');
    if(allows('analytics')) {window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});loadScript('https://www.googletagmanager.com/gtm.js?id=GTM-K5B42TC9');}
  }
  var _gtag = function () { if (allows('analytics')) gtag.apply(null, arguments); };

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
      page_location: window.location.origin + window.location.pathname,
      page_path:     window.location.pathname,
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
    searchTerm = String(searchTerm || '').slice(0,100);
    if (/@|\d{7,}/.test(searchTerm)) return;
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
