

const WA_FALLBACK_NUMBER = '919898582650';
let WA_NUMBER = WA_FALLBACK_NUMBER;

const WA_TECH_NUMBER = '917265884137';

function normalizeWhatsAppNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 && /^[6-9]/.test(digits)) return '91' + digits;
  return digits;
}

function getCustomerWhatsAppNumber() { return WA_NUMBER; }
window.getCustomerWhatsAppNumber = getCustomerWhatsAppNumber;

function setCustomerWhatsAppNumber(value) {
  const normalized = normalizeWhatsAppNumber(value);
  if (!normalized) return;
  WA_NUMBER = normalized;
  document.querySelectorAll('[data-wa-support]').forEach(function (link) {
    link.href = 'https://wa.me/' + WA_NUMBER;
  });
  window.dispatchEvent(new CustomEvent('ozylix:whatsapp-config-updated', {
    detail: { number: WA_NUMBER }
  }));
}

function loadStoreWhatsApp() {
  const base = (typeof API_BASE !== 'undefined') ? API_BASE : '';
  return fetchWithTimeout(base + '/api/public/store-config', { headers: { 'Accept': 'application/json' } }, 4500)
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (payload) {
      const number = payload && payload.data && payload.data.whatsapp_number;
      if (number) setCustomerWhatsAppNumber(number);
      return WA_NUMBER;
    })
    .catch(function () { return WA_NUMBER; });
}

function openWhatsApp(msg) {
  const encoded = encodeURIComponent(msg || 'Hello! I have a question about Ozylix.');
  window.open('https://wa.me/' + WA_NUMBER + '?text=' + encoded, '_blank');
}

function openWhatsAppTech() {

  const where = (document.querySelector('.page.active') || {}).id || '';
  const msg = 'Hi Ozylix, I am facing a technical issue on the website.'
            + (where ? '\n\nPage: ' + where.replace('page-', '') : '')
            + '\nLink: ' + window.location.href;
  window.open('https://wa.me/' + WA_TECH_NUMBER + '?text=' + encodeURIComponent(msg), '_blank');
}

const WA_BLOCKED_PAGES = ['cart', 'checkout', 'thankyou'];
window.waSync = function () {
  const fab = document.getElementById('waFab');
  const pop = document.getElementById('waChatPopup');
  if (!fab) return;
  const active = document.querySelector('.page.active');
  const id = active ? (active.id || '').replace('page-', '') : '';
  const hide = WA_BLOCKED_PAGES.indexOf(id) !== -1;
  fab.classList.toggle('wa-hidden', hide);
  if (pop) {
    pop.classList.toggle('wa-hidden', hide);
    if (hide) pop.classList.remove('open');
    document.querySelector('.vita-help-btn')?.setAttribute('aria-expanded', String(pop.classList.contains('open') && !hide));
  }
};
document.addEventListener('DOMContentLoaded', function () {
  window.waSync();
});

function toggleWAPopup() {
  const popup = document.getElementById('waChatPopup');
  if (popup) {
    const open = popup.classList.toggle('open');
    document.querySelector('.vita-help-btn')?.setAttribute('aria-expanded', String(open));
    if (!open) document.querySelector('.vita-help-btn')?.focus({ preventScroll: true });
  }
}

setTimeout(() => {
  if (!sessionStorage.getItem('wa_shown')) {
    const popup = document.getElementById('waChatPopup');
    if (popup) popup.classList.add('open');
    document.querySelector('.vita-help-btn')?.setAttribute('aria-expanded', String(!!popup && !popup.classList.contains('wa-hidden')));
    sessionStorage.setItem('wa_shown', '1');
  }
}, 45000);

const _rateCounters = {};
const _RATE_LIMITS = {
  '/api/confirm-cod-order':    3,
  '/api/create-gokwik-order': 3,
  '/api/confirm-order':        3,
  '/api/coupons/validate':     5,
  '/api/auth/email-login':     5,
  '/api/auth/register':        8,
};
function fetchWithTimeout(url, options, ms) {

  const limitKey = Object.keys(_RATE_LIMITS).find(k => url && url.includes(k));
  if (limitKey) {
    _rateCounters[limitKey] = (_rateCounters[limitKey] || 0) + 1;
    if (_rateCounters[limitKey] > _RATE_LIMITS[limitKey]) {
      return Promise.reject(new Error('Too many requests — please wait a moment before trying again.'));
    }

    if (_rateCounters[limitKey] === 1) {
      setTimeout(function() { delete _rateCounters[limitKey]; }, 30000);
    }
  }

  const controller = new AbortController();
  const input = options || {};
  const requestOptions = Object.assign({}, input, { signal: controller.signal });
  let timedOut = false;
  let timer;
  let onExternalAbort;

  const timeoutError = function () {
    const error = new Error('Timeout after ' + ms + 'ms');
    error.name = 'TimeoutError';
    return error;
  };

  if (input.signal) {
    onExternalAbort = function () {
      controller.abort(input.signal.reason);
    };
    if (input.signal.aborted) onExternalAbort();
    else input.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  timer = setTimeout(function () {
    timedOut = true;
    controller.abort();
  }, ms);

  const sessionToken = localStorage.getItem('asc_jwt') || '';
  const authHeader = new Headers(input.headers || {}).get('Authorization');
  const customerRequest = authHeader === 'Bearer ' + sessionToken && !!sessionToken;
  function guardSession() {
    if(customerRequest && (localStorage.getItem('asc_jwt') !== sessionToken || (typeof getCurrentUser === 'function' && !getCurrentUser()))) {
      const error = new Error('Account session changed'); error.name='AbortError'; throw error;
    }
  }
  return fetch(url, customerRequest ? {...requestOptions, cache:'no-store'} : requestOptions)
    .then(function(response) {
      guardSession();
      for(const method of ['json','text','blob']) {
        const read=response[method].bind(response);
        response[method]=async function() { const value=await read(); guardSession(); return value; };
      }
      return response;
    })
    .catch(function (error) {
      if (timedOut) throw timeoutError();
      throw error;
    })
    .finally(function () {
      clearTimeout(timer);
      if (input.signal && onExternalAbort) {
        input.signal.removeEventListener('abort', onExternalAbort);
      }
    });
}

const API_BASE = '';
loadStoreWhatsApp();

function isStoreProductActive(p) {
  return !!p && !p._hidden && p.active !== false && !p.deleted_at;
}

function mergeBackendProducts(backendProducts, options = {}) {
  if (!Array.isArray(backendProducts)) return false;
  if (options.fullSnapshot) {

    if (backendProducts.some(p => !p || !Number.isInteger(Number(p.id)) || Number(p.id) <= 0)) return false;
    const liveIds = new Set(backendProducts.map(p => Number(p.id)));
    PRODUCTS.forEach(p => {
      if (!liveIds.has(Number(p.id))) {
        p._hidden = true;
        p.active = false;
        p.stock = 0;
      }
    });
  }

  const parseArr = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') { try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; } catch(e) { return val.split(',').map(s=>s.trim()).filter(Boolean); } }
    return [];
  };

  backendProducts.forEach(bp => {
    bp.id = parseInt(bp.id);
    const normalizeMedia = items => items.map(item => {
      const url = typeof item === 'string' ? item : item && item.url;
      if (typeof url !== 'string' || !url.trim()) return null;
      return { ...(typeof item === 'object' ? item : {}), url: url.trim(),
        type: item.type === 'video' ? 'video' : mediaTypeFromUrl(url),
        thumb: typeof item.thumb === 'string' ? item.thumb : url.trim() };
    }).filter(Boolean).slice(0, 10);
    let backendMedia = normalizeMedia(parseArr(bp.media));
    if (!backendMedia.length) backendMedia = normalizeMedia(parseArr(bp.images));
    if (!backendMedia.length) backendMedia = normalizeMedia([bp.image, bp.image2, bp.image3, bp.image4, bp.image5].filter(Boolean));

    const idx = PRODUCTS.findIndex(p => p.id === bp.id);

    if (idx >= 0) {
      const p = PRODUCTS[idx];

      if (bp.price      != null) p.price     = parseFloat(bp.price);
      p.salePrice = bp.sale_price ? parseFloat(bp.sale_price) : null;

      if (bp.stock      != null) p.stock     = parseInt(bp.stock);
      if (bp.active     != null) p.active    = bp.active;

      if (bp.active === false)   p._hidden = true;
      else if (bp.active === true) p._hidden = false;

      if (bp.name)        p.name        = bp.name;
      if (bp.brand)       p.brand       = bp.brand;
      if (bp.description) p.description = bp.description;
      if (bp.badge)       p.badge       = bp.badge;
      if (bp.offer_text !== undefined) p.offer = bp.offer_text || null;
      else if (bp.offer !== undefined)  p.offer = bp.offer || null;
      if (bp.category)    p.category    = bp.category;
      if (bp.how_to_use)  p.howToUse    = bp.how_to_use;

      if (bp.rating != null) p.rating   = parseFloat(bp.rating);
      if (bp.reviews != null) p.reviews = parseInt(bp.reviews);

      if (bp.sort_order != null) p.position = parseInt(bp.sort_order);
      else if (bp.position != null) p.position = parseInt(bp.position);

      if (bp.tags) p.tags = parseArr(bp.tags);

      if (backendMedia.length) {
        p.media = backendMedia;
        p.image = backendMedia[0].url;
        p.image2 = backendMedia[1]?.url || '';
        p.allImages = backendMedia.map(m => m.url);
      } else if (['media','images','image','image2','image3','image4','image5'].some(key => Object.prototype.hasOwnProperty.call(bp, key))) {

        p.media = []; p.allImages = []; p.image = ''; p.image2 = '';
      }

      const ki = parseArr(bp.key_ingredients);
      if (ki.length) p.keyIngredients = ki;

      if (bp.seo_keywords) p.seoKeywords = parseArr(bp.seo_keywords);
      if (bp.meta_description) p.metaDescription = bp.meta_description;

      if (bp.tablets_per_pack != null) p.tabletsPerPack = parseInt(bp.tablets_per_pack) || null;
      if (bp.dose_per_day    != null) p.dosePerDay     = parseFloat(bp.dose_per_day) || null;
      if (bp.pack_unit       != null) p.packUnit       = String(bp.pack_unit || '').trim() || null;

      if (bp.has_tiers != null) p.hasTiers = bp.has_tiers;
      if (bp.tiers) {
        try {

          const parsed = Array.isArray(bp.tiers) ? bp.tiers : JSON.parse(bp.tiers);

          if (Array.isArray(parsed) && parsed.length && parsed[0].rate != null) {
            p._backendTiers = parsed;
          }
        } catch(e) { console.warn('Tiers parse error for product', bp.id, e); }
      }
    } else if (bp.active !== false) {

      const imgs = backendMedia.map(m => m.url);
      const ki   = parseArr(bp.key_ingredients);
      PRODUCTS.push({
        id:          parseInt(bp.id),
        name:        bp.name,
        brand:       bp.brand || 'Ozylix',
        category:    bp.category || 'effervescent',
        position:    bp.sort_order != null ? parseInt(bp.sort_order) : (bp.position != null ? parseInt(bp.position) : null),

        tags:        parseArr(bp.tags).length ? parseArr(bp.tags) : [],
        price:       bp.price != null ? parseFloat(bp.price) : null,
        salePrice:   bp.sale_price ? parseFloat(bp.sale_price) : null,
        offer:       bp.offer_text || bp.offer || null,
        media:       backendMedia,
        image:       imgs[0] || bp.image || '',
        image2:      imgs[1] || bp.image2 || '',
        allImages:   imgs,
        rating:      parseFloat(bp.rating) || 4.5,
        reviews:     parseInt(bp.reviews) || 0,
        stock:       parseInt(bp.stock) || 0,
        badge:       bp.badge || '',
        description: bp.description || '',
        keyIngredients: ki,
        howToUse:    bp.how_to_use || '',
        tabletsPerPack: parseInt(bp.tablets_per_pack) || null,
        dosePerDay:     parseFloat(bp.dose_per_day) || null,
        packUnit:       String(bp.pack_unit || '').trim() || null,
        hasTiers:    bp.has_tiers || false,
        _backendTiers: (() => { try { const t = Array.isArray(bp.tiers) ? bp.tiers : JSON.parse(bp.tiers||'null'); return (Array.isArray(t) && t.length && t[0].rate != null) ? t : null; } catch(e) { return null; } })(),
        seoKeywords: parseArr(bp.seo_keywords),
        active:      true,
        _hidden:     false,
      });
    }
  });

  updateSaleUIVisibility();
  syncProductStructuredData();
  return true;
}

function schemaSlug(value) {
  const raw = value && typeof value === 'object'
    ? (value.seoSlug || value.slug || value.urlSlug || value.name)
    : value;
  return String(raw || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function schemaPriceOf(p) {
  const tiers = p._backendTiers || (typeof QTY_TIERS !== 'undefined' ? QTY_TIERS[p.id] : null);
  const valid = Array.isArray(tiers) ? tiers.filter(t => t && t.rate != null) : [];
  if (valid.length) return Number(valid[0].rate);
  return Number(p.salePrice || p.price || 0);
}

function schemaImagesFor(p) {
  const urls = [];
  const push = u => {
    const v = typeof u === 'string' ? u : (u && u.url);
    if (v && /^https?:\/\//.test(v) && !urls.includes(v)) urls.push(v);
  };
  push(p.image);
  (p.allImages || []).forEach(push);
  (p.media || []).forEach(m => push(m && m.type !== 'video' ? m : null));
  push(p.image2);
  return urls.slice(0, 6);
}

const SCHEMA_SHIPPING = {
  '@type': 'OfferShippingDetails',
  shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'INR' },
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
    transitTime:  { '@type': 'QuantitativeValue', minValue: 2, maxValue: 7, unitCode: 'DAY' },
  },
};

const SCHEMA_RETURNS = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'IN',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 7,
  returnMethod: 'https://schema.org/ReturnByMail',
};

function schemaOfferFor(p, url) {
  const price = schemaPriceOf(p);
  const offer = {
    '@type': 'Offer',
    '@id': url + '#offer',
    url,
    priceCurrency: 'INR',
    price: String(price),
    availability: (Number(p.stock) > 0 && p._hidden !== true)
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@id': 'https://www.ozylix.com/#organization' },
    shippingDetails: SCHEMA_SHIPPING,
    hasMerchantReturnPolicy: SCHEMA_RETURNS,
  };

  const until = new Date(); until.setFullYear(until.getFullYear() + 1);
  offer.priceValidUntil = until.toISOString().slice(0, 10);
  return offer;
}

function schemaRatingFor(p) {

  const r = (typeof productRating === 'function')
    ? productRating(p)
    : { avg: Number(p.rating) || 0, count: Number(p.reviews) || 0 };
  const count = Number(r && r.count) || 0;
  const value = Number(r && r.avg) || 0;
  if (!(count > 0 && value > 0)) return null;
  return {
    '@type': 'AggregateRating',
    ratingValue: (Math.round(value * 10) / 10).toFixed(1),
    reviewCount: count,
    bestRating: '5',
    worstRating: '1',
  };
}

function schemaReviewsFor(p) {
  let rows = (typeof REVIEWS !== 'undefined' && Array.isArray(REVIEWS[p.id])) ? REVIEWS[p.id] : [];
  if (!rows.length && typeof PRODUCT_REVIEWS !== 'undefined' && Array.isArray(PRODUCT_REVIEWS[p.id])) {
    rows = PRODUCT_REVIEWS[p.id];
  }
  const usable = rows.filter(r => r && Number(r.rating) > 0 && r.user);
  if (!usable.length) return null;
  return usable.slice(0, 3).map(r => {
    const node = {
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: String(Number(r.rating)),
        bestRating: '5',
        worstRating: '1',
      },
      author: { '@type': 'Person', name: String(r.user) },
    };
    if (r.text) node.reviewBody = String(r.text);
    if (r.date) {
      const d = new Date(r.date);
      if (!isNaN(d)) node.datePublished = d.toISOString().slice(0, 10);
    }
    return node;
  });
}

function syncProductStructuredData() {
  try {
    const tag = document.querySelector('script[type="application/ld+json"]');
    if (!tag || typeof PRODUCTS === 'undefined' || !PRODUCTS.length) return;

    if (!syncProductStructuredData._pristine) {
      syncProductStructuredData._pristine = tag.textContent;
    }
    const graph = JSON.parse(syncProductStructuredData._pristine);
    const nodes = graph['@graph'] || [];
    const list = nodes.find(n =>
      String(n['@type']).includes('ItemList') && Array.isArray(n.itemListElement) &&
      n.itemListElement.some(e => String((e.item || e)['@type']).includes('Product')));
    if (!list) return;

    let changed = false;
    const noImage = [];
    const kept = [];
    for (const entry of list.itemListElement) {
      const item = entry.item || entry;
      if (!String(item['@type']).includes('Product')) { kept.push(entry); continue; }
      const live = PRODUCTS.find(p => schemaSlug(p) === String(item.url || '').split('/').pop());
      if (!live) { kept.push(entry); continue; }

      const images = schemaImagesFor(live);
      if (!images.length) {

        noImage.push(live.name);
        changed = true;
        continue;
      }
      item.image = images;
      item.offers = schemaOfferFor(live, item.url);

      const rating = schemaRatingFor(live);
      if (rating) item.aggregateRating = rating; else delete item.aggregateRating;
      const reviews = schemaReviewsFor(live);
      if (reviews) item.review = reviews; else delete item.review;

      kept.push(entry);
      changed = true;
    }
    if (changed) {
      list.itemListElement = kept.map((e, i) => {
        if (e && typeof e === 'object' && 'position' in e) e.position = i + 1;
        return e;
      });
      if ('numberOfItems' in list) list.numberOfItems = kept.length;
      tag.textContent = JSON.stringify(graph, null, 2);
    }

    if (noImage.length) {
      console.warn('[schema] ' + noImage.length + ' product(s) have no image, so they are held out of '
        + 'the Product feed until one is uploaded (Admin → Products): ' + noImage.join(', '));
    }
  } catch (e) {
    console.warn('[schema] catalogue sync skipped:', e.message);
  }
}

function setProductPageSchema(p) {
  const ID = 'ld-product-page';
  document.getElementById(ID)?.remove();
  if (!p) return;
  try {
    const url = 'https://www.ozylix.com/product/' + schemaSlug(p);
    const node = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': url + '#product',
      name: p.name,
      description: p.metaDescription || p.description || '',
      sku: 'OZ-' + p.id,
      url,
      category: p.category || '',
      brand: { '@type': 'Brand', name: p.brand || 'Ozylix' },
      manufacturer: { '@type': 'Organization', '@id': 'https://www.ozylix.com/#organization', name: 'Ozylix', url: 'https://www.ozylix.com' },
      offers: schemaOfferFor(p, url),
    };

    const images = schemaImagesFor(p);
    if (!images.length) return;
    node.image = images;
    const rating = schemaRatingFor(p);
    if (rating) node.aggregateRating = rating;
    const reviews = schemaReviewsFor(p);
    if (reviews) node.review = reviews;

    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = ID;
    el.textContent = JSON.stringify(node, null, 2);
    document.head.appendChild(el);
  } catch (e) {
    console.warn('[schema] product page block skipped:', e.message);
  }
}

function setShopPageSchema() {
  try {
    var items = (typeof PRODUCTS !== 'undefined' && PRODUCTS) ? PRODUCTS : [];
    var offerItems = items.filter(function (p) { return p && (p.image || p.media || p.price); })
      .slice(0, 20).map(function (p) {
        var price = p.salePrice || p.price || 0;
        return {
          '@type': 'ListItem',
          'position': p.position || (items.indexOf(p) + 1),
          'url': 'https://www.ozylix.com/product/' + schemaSlug(p.name),
          'name': p.name || ''
        };
      });
    var graph = [
      {
        '@type': 'CollectionPage',
        '@id': 'https://www.ozylix.com/shop',
        'url': 'https://www.ozylix.com/shop',
        'name': 'Buy Supplements Online in India | Ozylix',
        'description': 'Shop glutathione, spirulina, moringa, effervescent and ayurvedic supplements from Ozylix. FSSAI approved, lab tested, free pan-India delivery.',
        'breadcrumb': {'@id': 'https://www.ozylix.com/shop#breadcrumb'},
        'mainEntity': {'@id': 'https://www.ozylix.com/shop#itemlist'}
      },
      {
        '@type': 'BreadcrumbList',
        '@id': 'https://www.ozylix.com/shop#breadcrumb',
        'itemListElement': [
          {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://www.ozylix.com/'},
          {'@type': 'ListItem', 'position': 2, 'name': 'Shop', 'item': 'https://www.ozylix.com/shop'}
        ]
      },
      {
        '@type': 'ItemList',
        '@id': 'https://www.ozylix.com/shop#itemlist',
        'itemListElement': offerItems
      }
    ];
    var el = document.getElementById('shop-schema');
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = 'shop-schema';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(graph);
  } catch (e) {                                              }
}

function updateSaleUIVisibility() {
  const hasSaleProducts = PRODUCTS.some(p =>
    (p.salePrice && p.price && p.salePrice < p.price) || (p.tags && p.tags.includes('sale'))
  );
  document.querySelectorAll('.sale-only-ui').forEach(el => {
    el.style.display = hasSaleProducts ? '' : 'none';
  });
}

async function validateCouponWithBackend(code, subtotal, items) {
  try {
    const u = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    const previewItems = Array.isArray(items) ? items :
      ((typeof STORE !== 'undefined' && Array.isArray(STORE.cart)) ? STORE.cart.map(function (item) {
        const p = (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).find(function (x) { return x.id === item.id; });
        return { id: item.id, name: p?.name || '', price: item.tierRate !== undefined ? item.tierRate : (p?.salePrice || p?.price || 0), qty: item.qty, tierTabs: item.tierTabs };
      }) : []);
    const r = await fetchWithTimeout(`${API_BASE}/api/coupons/validate`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({code, subtotal, email: u?.email || null, items: previewItems})
    }, 5000);
    if (!r.ok) return null;
    const d = await r.json();
    return d.valid ? d : null;
  } catch(e) { return null; }
}

let _homeThumbnailsSyncInFlight = null;
async function syncHomeThumbnails() {
  if (_homeThumbnailsSyncInFlight) return _homeThumbnailsSyncInFlight;
  _homeThumbnailsSyncInFlight = (async function () {
    try {
      const r = await fetchWithTimeout(`${API_BASE}/api/home-thumbnails`, { cache: 'default' }, 5000);
      if (!r.ok) return;
      const payload = await r.json();
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const byProduct = new Map(rows.map(row => [Number(row.product_id), row]));
      PRODUCTS.forEach(p => {
        const row = byProduct.get(Number(p.id));
        p.homeThumbnailUrl = row?.url || '';
        p.homeThumbnailAlt = row?.alt_text || '';
      });
      renderFeatured();
      renderNewArrivals();

      try { if (document.getElementById('bundleProdList') && typeof renderBundleBuilder === 'function') renderBundleBuilder(); } catch (e) {}
      try { if (typeof renderPromoCarousel === 'function') renderPromoCarousel(); } catch (e) {}
    } catch (e) {
      console.warn('[Ozylix] homepage thumbnails unavailable:', e.message);
    }
  })().finally(() => { _homeThumbnailsSyncInFlight = null; });
  return _homeThumbnailsSyncInFlight;
}

let _productsSyncInFlight = null;
async function syncProductsFromBackend() {
  if (_productsSyncInFlight) return _productsSyncInFlight;
  _productsSyncInFlight = (async function () {
  const MAX_ATTEMPTS = 3;
  const TIMEOUTS     = [6000, 8000, 10000];
  const RETRY_DELAY  = 500;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      if (attempt > 0) {

        await new Promise(r => setTimeout(r, RETRY_DELAY));
      }

      const r = await fetchWithTimeout(`${API_BASE}/api/products`, {
        cache: 'default'
      }, TIMEOUTS[attempt]);

      if (!r.ok) {
        if (attempt < MAX_ATTEMPTS - 1) continue;
        return;
      }

      const data = await r.json();
      const products = data.data || data;
      if (Array.isArray(products)) {
        if (mergeBackendProducts(products, { fullSnapshot: true }) === false) return;

        STORE.normalizeCartTiers();
        if (typeof renderSideCart === 'function') renderSideCart();

        try { renderFeatured(); } catch(e){}
        try { renderNewArrivals(); } catch(e){}
        try { hydrateCategoryCounts(); } catch(e){}
        try { hydrateAboutStats(); } catch(e){}

        try { renderPromoCarousel(); } catch(e){}
        try {
          const sg = document.getElementById('shopGrid');
          if(sg) renderShopGrid();
        } catch(e){}

        try { refreshProductSelections(); } catch(e){}

        try { updateAllProductCards(); } catch(e){}

        try { if (typeof window._hpiFlush === 'function') window._hpiFlush(); } catch(e){}

        try {
          const prodPage = document.getElementById('page-product');
          if (prodPage && prodPage.style.display !== 'none' && window._currentProductId) {
            const cp = PRODUCTS.find(p => p.id === window._currentProductId);
            if (cp) buildProductPage(cp);
          }
        } catch(e) {}

        return;
      }
    } catch(e) {

      if (attempt > 0) {
        console.warn('[Ozylix] ⚠️ Sync attempt ' + (attempt+1) + ' failed:', e.name, e.message);
      }
      const isTimeout = e.name === 'TimeoutError' || e.name === 'AbortError';
      if (isTimeout && attempt < MAX_ATTEMPTS - 1) {
        continue;
      }
      return;
    }
  }
  })().finally(() => { _productsSyncInFlight = null; });
  return _productsSyncInFlight;
}

function renderFeatured() {
  const visible = PRODUCTS.filter(isStoreProductActive);
  const feat = visible.filter(p => p.tags.includes('featured')).sort(byPosition).slice(0,8);
  const fg = document.getElementById('featuredGrid');
  if (fg) fg.innerHTML = feat.map(p => renderProductCard(p, { homepage: true })).join('');
}
function renderNewArrivals() {
  const visible = PRODUCTS.filter(isStoreProductActive);
  const newP = visible.filter(p => p.tags.includes('new')).sort(byPosition).slice(0,4);
  const nag = document.getElementById('newArrivalsGrid');
  if (nag) nag.innerHTML = newP.map(p => renderProductCard(p, { homepage: true })).join('');
}
function renderShopGrid() { applyFilters(); }

function hydrateCategoryCounts() {
  const nodes = document.querySelectorAll('[data-cat-count]');
  if (!nodes.length || typeof PRODUCTS === 'undefined') return;
  const visible = PRODUCTS.filter(isStoreProductActive);
  nodes.forEach((el) => {
    const cat = el.getAttribute('data-cat-count');
    const n = visible.filter(p => p.category === cat).length;
    el.textContent = n === 1 ? '1 product' : n + ' products';
    const card = el.closest('.cat-card'), product = visible.find(p => p.category === cat && getProductCutout(p));
    if (card && product && !card.querySelector('.category-cutout')) {
      const image = document.createElement('img');
      image.className = 'category-cutout'; image.src = getProductCutout(product);
      image.alt = product.name; image.loading = 'lazy'; image.decoding = 'async';
      card.classList.add('has-cutout'); card.prepend(image);
    }

  });
}

function updateAllProductCards() {
  document.querySelectorAll('[data-product-id]').forEach(card => {
    const id = parseInt(card.dataset.productId);
    const p = PRODUCTS.find(x => x.id === id);
    if (!p || !card.parentNode) return;
    const tmp = document.createElement('div');
    const homepage = !!card.closest('#featuredGrid, #newArrivalsGrid');
    tmp.innerHTML = renderProductCard(p, { homepage });
    const nc = tmp.firstElementChild;
    if (nc) card.parentNode.replaceChild(nc, card);
  });
}

const OZYLIX_LOGO = "assets/ozylix-logo.png";

const SHIPROCKET_CONFIG = {
  trackingUrl: 'https://shiprocket.co/tracking/',
  pickup_location: 'Primary',
  apiBase: API_BASE,

};

const QTY_TIERS = {

  1:  [{tabs:15,mrp:899, rate:827, discountPct:8},{tabs:30,mrp:1798,rate:1618,discountPct:10},{tabs:45,mrp:2697,rate:2373,discountPct:12},{tabs:60,mrp:3596,rate:3093,discountPct:14}],

  2:  [{tabs:15,mrp:349, rate:321, discountPct:8},{tabs:30,mrp:698, rate:628, discountPct:10},{tabs:45,mrp:1047,rate:921, discountPct:12},{tabs:60,mrp:1396,rate:1201,discountPct:14}],

  3:  [{tabs:15,mrp:469, rate:399, discountPct:15},{tabs:30,mrp:938, rate:750, discountPct:20},{tabs:45,mrp:1407,rate:1055,discountPct:25},{tabs:60,mrp:1876,rate:1219,discountPct:35}],

  4:  [{tabs:15,mrp:599, rate:449, discountPct:25},{tabs:30,mrp:1198,rate:862, discountPct:28},{tabs:45,mrp:1797,rate:1221,discountPct:32},{tabs:60,mrp:2396,rate:1557,discountPct:35}],

  5:  [{tabs:15,mrp:349, rate:249, discountPct:28},{tabs:30,mrp:698, rate:488, discountPct:30},{tabs:45,mrp:1047,rate:711, discountPct:32},{tabs:60,mrp:1396,rate:921, discountPct:34}],

  8:  [{tabs:30,mrp:150, rate:120, discountPct:20},{tabs:60,mrp:289, rate:231, discountPct:20}],

  10: [{tabs:60,mrp:499, rate:399, discountPct:20}],

  11: [{tabs:60,mrp:459, rate:367, discountPct:20}],

  12: [{tabs:60,mrp:479, rate:383, discountPct:20}],

  20: [{tabs:60,mrp:249, rate:249, discountPct:0}],

  22: [{tabs:60,mrp:null, rate:null, discountPct:0}],
};

const PRODUCTS = [

  {id:8, position:14, name:"Multidiata – Ozylix Premium Multivitamin", brand:"Ozylix Premium", category:"premium", tags:["featured","bestseller","immunity","premium"],
   price:120, salePrice:null, offer:"Box Pack 30 Tabs ₹120 | Bottle Pack 60 Tabs ₹231",
   image2:"",
   rating:4.8, reviews:567,  badge:"🏆 Premium",
   hasTiers:true,
   seoKeywords:["multivitamin India","best multivitamin India","daily multivitamin"],
   description:"Complete daily multivitamin for immunity, energy, and overall health. Multidiata is Ozylix's flagship precision-crafted Multivitamin, Multimineral & Antioxidant formula — 19 essential nutrients in one daily tablet, each dosed at 72-100% RDA. Bridges nutritional gaps from diet and lifestyle, supports immune health with antioxidants like Vitamin C and Zinc, and boosts energy and mood via B-Vitamins. Not intended to replace a balanced, nutritious diet. 60 Tablets per bottle. FSSAI approved.",
   keyIngredients:["Vitamin C 80mg (100% RDA)","Vitamin B3/Niacin 18mg (100% RDA)","Zinc 17mg (100% RDA)","Vitamin E 10mg (100% RDA)","Vitamin B5/Pantothenic Acid 3.6mg (72% RDA)","Vitamin B2/Riboflavin 2.5mg (100% RDA)","Vitamin B6/Pyridoxine 2.4mg (100% RDA)","Vitamin B1/Thiamine 1.8mg (100% RDA)","Manganese 250mcg (6.25% RDA)","Vitamin B12/Cobalamin 2mcg (90.9% RDA)","Iodine 140mcg (100% RDA)","Chromium 50mcg (100% RDA)","Selenium 40mcg (100% RDA)","Biotin 30mcg (75% RDA)","Copper 40mcg (2.35% RDA)","Folic Acid 150mcg (85% RDA)","Vitamin D3 5mcg (33.33% RDA)","Vitamin A 1000mcg (100% RDA)","Magnesium 4mg (0.91% RDA)","Other Ingredients: Microcrystalline Cellulose (INS 460(i)), Dicalcium Phosphate (INS 341(ii)), Sodium Bicarbonate (INS 500(ii)), Sodium Starch Glycolate, PVP K (INS 201), Magnesium Stearate (INS 470(ii)), Preservative (INS 217 & INS 219)"],
   howToUse:"Take 1 tablet daily with breakfast or as directed by healthcare professional."},

  {id:30, image: "", position:4, name:"Green Tea Effervescent Tablet", brand:"Ozylix", category:"effervescent", tags:["featured","new","energy","effervescent"],
   price:425, salePrice:null, offer:"Price to be updated",
   image2:"", image3:"", image4:"", image5:"",
   rating:4.5, reviews:0,  badge:"New",
   hasTiers:false,
   seoKeywords:["green tea effervescent tablet India","green tea tablets online India","ashwagandha caffeine supplement","metabolism booster tablet India","energy effervescent tablet","fat burner tablet India"],
   metaDescription:"Buy Ozylix Green Tea Effervescent Tablets with Ashwagandha KSM-66 & Caffeine. Supports metabolism, energy, fat oxidation & focus. FSSAI approved.", seoSlug:"green-tea-effervescent-tablet",
   description:"Ozylix Green Tea Effervescent Tablet combines Green Tea Extract with Ashwagandha KSM-66 and Caffeine to support metabolism, boost energy, enhance fat oxidation, and improve focus and alertness. Fast-dissolving effervescent format for quick absorption. FSSAI approved. Not for medicinal use — this product is not intended to diagnose, treat, cure, or prevent any disease.",
   keyIngredients:["Green Tea Extract 500mg","Ashwagandha KSM-66 100mg","Caffeine 100mg"],
   howToUse:"Dissolve 1 tablet in 150–200ml water. Consume once daily as directed. Allow full fizz before drinking."},

  {id:31, image: "", position:3, name:"Ashwagandha Effervescent Tablet", brand:"Ozylix", category:"effervescent", tags:["featured","new","immunity","effervescent"],
   price:495, salePrice:null, offer:"Price to be updated",
   image2:"", image3:"", image4:"", image5:"",
   rating:4.5, reviews:0,  badge:"New",
   hasTiers:false,
   seoKeywords:["ashwagandha effervescent tablet India","KSM-66 ashwagandha tablets","stress relief supplement India","ashwagandha zinc vitamin D3 tablet","immunity ashwagandha tablet","stamina booster India"],
   metaDescription:"Ozylix Ashwagandha Effervescent Tablets with KSM-66, Vitamin D3 & Zinc. Reduces stress, boosts stamina, immunity & recovery. FSSAI approved.", seoSlug:"ashwagandha-effervescent-tablet",
   description:"Ozylix Ashwagandha Effervescent Tablet with Ashwagandha KSM-66, Eclipta Prostrata, Vitamin D3, and Zinc helps reduce stress, supports stamina, immunity, muscle recovery, and overall wellness. Fast-dissolving effervescent format. FSSAI approved. Not for medicinal use — this product is not intended to diagnose, treat, cure, or prevent any disease.",
   keyIngredients:["Ashwagandha KSM-66 650mg","Eclipta Prostrata 20mg","Vitamin D3 500 IU","Zinc 12mg"],
   howToUse:"Dissolve 1 tablet in 150–200ml water. Consume once daily as directed. Allow full fizz before drinking."},

  {id:32, image: "", position:5, name:"Men's Multivitamin Effervescent Tablet", brand:"Ozylix", category:"effervescent", tags:["featured","new","energy","effervescent"],
   price:399, salePrice:null, offer:"Price to be updated",
   image2:"", image3:"", image4:"", image5:"",
   rating:4.5, reviews:0,  badge:"New",
   hasTiers:false,
   seoKeywords:["men's multivitamin effervescent India","multivitamin tablets for men","L-Carnitine L-Arginine supplement","men's energy vitality tablet","ashwagandha multivitamin for men"],
   metaDescription:"Ozylix Men's Multivitamin Effervescent Tablets with L-Carnitine, L-Arginine, Ashwagandha & Astaxanthin. Daily energy, immunity & vitality support.", seoSlug:"mens-multivitamin-effervescent-tablet",
   description:"Ozylix Men's Multivitamin Effervescent Tablet delivers daily nutritional support for energy, immunity, vitality, muscle function and men's wellness. With Vitamin A, C, D2, L-Carnitine L-Tartrate, L-Arginine, Ashwagandha Extract, and Astaxanthin. FSSAI approved. Not for medicinal use — this product is not intended to diagnose, treat, cure, or prevent any disease.",
   keyIngredients:["Vitamin A 1000mcg","Vitamin C 80mg","Vitamin D2 600 IU","L-Carnitine L-Tartrate 50mg","L-Arginine 50mg","Ashwagandha Extract 55mg","Astaxanthin 1mg"],
   howToUse:"Dissolve 1 tablet in 150–200ml water. Consume once daily as directed. Allow full fizz before drinking."},

  {id:33, image: "", position:6, name:"Women's Multivitamin Effervescent Tablet", brand:"Ozylix", category:"effervescent", tags:["featured","new","skin","effervescent"],
   price:399, salePrice:null, offer:"Price to be updated",
   image2:"", image3:"", image4:"", image5:"",
   rating:4.5, reviews:0,  badge:"New",
   hasTiers:false,
   seoKeywords:["women's multivitamin effervescent India","multivitamin tablets for women","hyaluronic acid inositol tablet","iron multivitamin for women","hormonal balance supplement India"],
   metaDescription:"Ozylix Women's Multivitamin Effervescent Tablets with Iron, Hyaluronic Acid & Inositol. Supports skin, hormonal balance & daily nutrition.", seoSlug:"womens-multivitamin-effervescent-tablet",
   description:"Ozylix Women's Multivitamin Effervescent Tablet supports women's health, skin hydration, hormonal balance, immunity and daily nutrition. With Vitamin A, C, D2, Iron, Hyaluronic Acid, Inositol, D-Chiro Inositol, and Astaxanthin. FSSAI approved. Not for medicinal use — this product is not intended to diagnose, treat, cure, or prevent any disease.",
   keyIngredients:["Vitamin A 840mcg","Vitamin C 65mg","Vitamin D2 600 IU","Iron 14.5mg","Hyaluronic Acid 40mg","Inositol 205mg","D-Chiro Inositol 5mg","Astaxanthin 1mg"],
   howToUse:"Dissolve 1 tablet in 150–200ml water. Consume once daily as directed. Allow full fizz before drinking."},

  {id:34, image: "", position:2, name:"Apple Cider Vinegar Effervescent Tablet", brand:"Ozylix", category:"effervescent", tags:["featured","new","weight","effervescent"],
   price:349, salePrice:null, offer:"Price to be updated",
   image2:"", image3:"", image4:"", image5:"",
   rating:4.5, reviews:0,  badge:"New",
   hasTiers:false,
   seoKeywords:["apple cider vinegar effervescent India","ACV garcinia cambogia tablet","weight management effervescent tablet","digestion supplement India","ACV tablets online India"],
   metaDescription:"Ozylix Apple Cider Vinegar Effervescent Tablets with Garcinia Cambogia & Pomegranate. Supports digestion, weight management & metabolism.", seoSlug:"apple-cider-vinegar-effervescent-tablet",
   description:"Ozylix Apple Cider Vinegar Effervescent Tablet with Garcinia Cambogia, Pomegranate Extract, Chlorophyll, Vitamin B6 and B12 supports digestion, weight management, detoxification and metabolism. Fast-dissolving effervescent format. FSSAI approved. Not for medicinal use — this product is not intended to diagnose, treat, cure, or prevent any disease.",
   keyIngredients:["Apple Cider Vinegar 500mg","Garcinia Cambogia 500mg","Pomegranate Extract 100mg","Chlorophyll 10mg","Vitamin B6 1.3mg","Vitamin B12 2.2mcg"],
   howToUse:"Dissolve 1 tablet in 150–200ml water. Consume once daily before a meal. Allow full fizz before drinking."},

  {id:35, image: "", position:7, name:"Complete Bone Health Effervescent Tablet", brand:"Ozylix", category:"effervescent", tags:["featured","new","immunity","effervescent"],
   price:349, salePrice:null, offer:"Price to be updated",
   image2:"", image3:"", image4:"", image5:"",
   rating:4.5, reviews:0,  badge:"New",
   hasTiers:false,
   seoKeywords:["bone health effervescent tablet India","calcium magnesium D3 K2 tablet","calcium supplement India","bone strength tablet online","vitamin D3 K2 effervescent tablet"],
   metaDescription:"Ozylix Complete Bone Health Effervescent Tablets with Calcium, Magnesium, Vitamin D3 & K2-7. Strengthens bones, teeth & muscle function.", seoSlug:"bone-health-effervescent-tablet",
   description:"Ozylix Complete Bone Health Effervescent Tablet strengthens bones and teeth, improves calcium absorption and supports muscle function. With Calcium Carbonate, Magnesium Carbonate, Vitamin D3, Vitamin K2-7, Vitamin C, and Vitamin B6. FSSAI approved. Not for medicinal use — this product is not intended to diagnose, treat, cure, or prevent any disease.",
   keyIngredients:["Calcium Carbonate 500mg","Magnesium Carbonate 500mg","Vitamin D3 600 IU","Vitamin K2-7 55mcg","Vitamin C 40mg","Vitamin B6 1.9mg"],
   howToUse:"Dissolve 1 tablet in 150–200ml water. Consume once daily as directed. Allow full fizz before drinking."},

  {id:36, image: "", position:8, name:"Rehydration Effervescent Tablet", brand:"Ozylix", category:"effervescent", tags:["featured","new","energy","effervescent"],
   price:349, salePrice:null, offer:"Price to be updated",
   image2:"", image3:"", image4:"", image5:"",
   rating:4.5, reviews:0,  badge:"New",
   hasTiers:false,
   seoKeywords:["rehydration effervescent tablet India","electrolyte BCAA tablet","hydration supplement India","sports recovery tablet India","electrolyte tablet for exercise"],
   metaDescription:"Ozylix Rehydration Effervescent Tablets with BCAAs & electrolytes. Rapid hydration, muscle recovery & endurance support for active lifestyles.", seoSlug:"rehydration-effervescent-tablet",
   description:"Ozylix Rehydration Effervescent Tablet with BCAAs (Leucine, Isoleucine, Valine), Vitamin C, Magnesium, Chloride and Zinc delivers rapid hydration, electrolyte replenishment, muscle recovery and endurance support. FSSAI approved. Not for medicinal use — this product is not intended to diagnose, treat, cure, or prevent any disease.",
   keyIngredients:["BCAAs 300mg (Leucine 100mg, Isoleucine 100mg, Valine 100mg)","Vitamin C 80mg","Magnesium 25mg","Chloride 130mg","Zinc 12mg"],
   howToUse:"Dissolve 1 tablet in 150–200ml water. Consume during or after exercise, or as directed. Allow full fizz before drinking."},

  {id:37, image: "", position:9, name:"Natural Vitamin C + Amla Effervescent Tablet", brand:"Ozylix", category:"effervescent", tags:["featured","new","immunity","effervescent"],
   price:349, salePrice:null, offer:"Price to be updated",
   image2:"", image3:"", image4:"", image5:"",
   rating:4.5, reviews:0,  badge:"New",
   hasTiers:false,
   seoKeywords:["vitamin C amla effervescent India","natural amla tablet India","immunity booster effervescent tablet","vitamin C tablet India","amla vitamin C supplement"],
   metaDescription:"Ozylix Natural Vitamin C + Amla Effervescent Tablets boost immunity & collagen formation. Made with natural Amla, Orange & Lemon extracts.", seoSlug:"vitamin-c-amla-effervescent-tablet",
   description:"Ozylix Natural Vitamin C + Amla Effervescent Tablet boosts immunity, antioxidant protection, collagen formation and overall wellness. With Natural Amla Extract, Vitamin C, Zinc, Orange Powder and Lemon Powder. FSSAI approved. Not for medicinal use — this product is not intended to diagnose, treat, cure, or prevent any disease.",
   keyIngredients:["Natural Amla Extract 1000mg","Vitamin C 40mg","Zinc 10mg","Orange Powder 250mg","Lemon Powder 200mg"],
   howToUse:"Dissolve 1 tablet in 150–200ml water. Consume once daily as directed. Allow full fizz before drinking."},

  {id:38, image: "", position:1, name:"Glutathione Effervescent Tablet", brand:"Ozylix", category:"effervescent", tags:["featured","new","skin","effervescent"],
   price:650, salePrice:null, offer:"Price to be updated",
   image2:"", image3:"", image4:"", image5:"",
   rating:4.5, reviews:0,  badge:"New",
   hasTiers:false,
   seoKeywords:["glutathione effervescent tablet India","skin brightening glutathione tablet","glutathione hyaluronic acid supplement","antioxidant skin tablet India","glow skin supplement India"],
   metaDescription:"Ozylix Glutathione Effervescent Tablets with Hyaluronic Acid & Astaxanthin. Skin brightening, antioxidant & collagen support. FSSAI approved.", seoSlug:"glutathione-effervescent-tablet",
   description:"Ozylix Glutathione Effervescent Tablet supports skin brightening, antioxidant protection, collagen support and healthy skin hydration. With L-Glutathione, Vitamin C, Hyaluronic Acid, and Astaxanthin. FSSAI approved. Not for medicinal use — this product is not intended to diagnose, treat, cure, or prevent any disease.",
   keyIngredients:["L-Glutathione 600mg","Vitamin C 80mg","Hyaluronic Acid 50mg","Astaxanthin 10mg"],
   howToUse:"Dissolve 1 tablet in 150–200ml water. Consume once daily as directed. Allow full fizz before drinking."},

  {id:39, image: "", position:10, name:"L-Carnitine L-Tartrate Effervescent Tablet", brand:"Ozylix", category:"effervescent", tags:["featured","new","weight","energy","effervescent"],
   price:449, salePrice:null, offer:"Price to be updated",
   image2:"", image3:"", image4:"", image5:"",
   rating:4.5, reviews:0,  badge:"New",
   hasTiers:false,
   seoKeywords:["L-Carnitine L-Tartrate effervescent India","L-Carnitine 2000mg tablet","fat metabolism supplement India","energy tablet for exercise","L-Carnitine tablets online India"],
   metaDescription:"Ozylix L-Carnitine L-Tartrate Effervescent Tablets (2000mg) support fat metabolism, energy production & exercise performance.", seoSlug:"l-carnitine-l-tartrate-effervescent-tablet",
   description:"Ozylix L-Carnitine L-Tartrate Effervescent Tablet supports fat metabolism, enhances energy production, improves exercise performance and recovery. Delivers 2000mg L-Carnitine L-Tartrate per tablet in a fast-dissolving effervescent format. FSSAI approved. Not for medicinal use — this product is not intended to diagnose, treat, cure, or prevent any disease.",
   keyIngredients:["L-Carnitine L-Tartrate 2000mg"],
   howToUse:"Dissolve 1 tablet in 150–200ml water. Consume once daily before exercise or as directed. Allow full fizz before drinking."},

  {id:10, position:11, name:"VitaPlus B12 + D3 Vegan – with Certified Organic Spirulina", brand:"Ozylix Spirulina", category:"spirulina", tags:["featured","new","immunity","energy","spirulina"],
   price:399, salePrice:null, offer:"20% OFF – Introductory Price",
   image2:"",
   rating:4.7, reviews:89,  badge:"New",
   hasTiers:true,
   seoKeywords:["spirulina B12 D3 tablet India","spirulina vegan vitamin","spirulina capsules India"],
   description:"VitaPlus B12 + D3 Vegan combines the extraordinary power of Certified Organic Spirulina (2g per serving) with Vitamin B12 and Vitamin D3, both Plant Based and dosed at 100% RDA. Spirulina is a nutrient-dense superfood rich in high-quality protein, essential amino acids, iron, and antioxidants like phycocyanin — helping combat oxidative stress and support immune function. Vitamin D3 aids calcium absorption for bone density and helps prevent osteoporosis. Vitamin B12 is vital for energy production, red blood cell formation, and nerve health. Ideal for vegans, vegetarians, and those with limited sun exposure. 60 Tablets per bottle (serving size 2 tablets/2g). FSSAI approved. In-house grown India Certified Spirulina.",
   keyIngredients:["Organic Spirulina platensis Powder 2.00g per serving","Phycocyanin 0.24g per serving","Vitamin B12 2.40mcg per serving (100% RDA, Plant Based)","Vitamin D3 15mcg per serving (100% RDA, Plant Based)","Other Ingredients: Multivitamins, Minerals, Microcrystalline Cellulose (INS 460(i)), PVP (INS 1201), Magnesium Stearate (INS 470(ii))"],
   howToUse:"Adults: Take 2 tablets per day. Children (8–12 years): 1 tablet twice per day. Take in the morning with water or milk. Best before 18 months from packaging."},

  {id:11, position:12, name:"MG+++ Magnesium – B12 + D3 with Magnesium", brand:"Ozylix Spirulina", category:"spirulina", tags:["featured","new","energy","spirulina"],
   price:367, salePrice:null, offer:"20% OFF – Introductory Price",
   image2:"",
   rating:4.5, reviews:56,  badge:"New",
   hasTiers:true,
   seoKeywords:["spirulina magnesium supplement India","magnesium B12 tablet India","spirulina muscle support"],
   description:"MG+++ combines Certified Organic Spirulina with a triple-source Magnesium blend (Mg Citrate, Mg Gluconate, Mg Oxide) delivering 100% RDA Magnesium, plus Vitamin D3 and Vitamin B12 (both 100% RDA). Magnesium supports muscle and nerve function, works with calcium and Vitamin D to maintain bone density, aids energy conversion, and helps reduce stress and anxiety. Combined with Spirulina, it supports enhanced energy levels, better digestion, and effective nutrient absorption. 60 Tablets per bottle (serving size 2 tablets/2g). 100% Vegan. In-house grown India Certified Spirulina. FSSAI approved.",
   keyIngredients:["Magnesium (Mg Citrate, Mg Gluconate, Mg Oxide) 440mg per serving (100% RDA)","Vitamin B12 2.40mcg per serving (100% RDA)","Vitamin D3 15mcg per serving (100% RDA)","Organic Spirulina platensis Powder 1.10g per serving","Phycocyanin 0.13g","Vitamin B12 & D3 are Plant Based","Other Ingredients: Multivitamins, Minerals, Microcrystalline Cellulose (INS 460(i)), PVP (INS 1201), Magnesium Stearate (INS 470(ii))"],
   howToUse:"Adults: Take 2 tablets per day. Children (8–12 years): 1 tablet twice per day. Take in the morning with water or milk."},

  {id:12, position:13, name:"CS++ + Iron++ – Calcium + Iron with B12+D3", brand:"Ozylix Spirulina", category:"spirulina", tags:["featured","new","immunity","spirulina"],
   price:383, salePrice:null, offer:"20% OFF – Introductory Price",
   image2:"",
   rating:4.6, reviews:44,  badge:"New",
   hasTiers:true,
   seoKeywords:["spirulina calcium iron tablet India","spirulina bone health","iron supplement spirulina India"],
   description:"CA++ & Iron++ combines Certified Organic Spirulina with Calcium Citrate Malate, Vitamin K2-7, Zinc, Iron, Magnesium, Vitamin D3 and B12 (all key nutrients at 100% RDA except K2-7 at 50%) for complete bone and blood health. Formulated to address common nutritional needs for women through reproductive years and beyond. Calcium supports strong bones and teeth, Iron ensures efficient oxygen transport and helps prevent fatigue (especially important for menstruating women), Vitamin B12 supports energy, nerve and brain function, and Vitamin D3 supports immunity and mood regulation. 60 Tablets per bottle (serving size 2 tablets/2g). 100% Vegan. In-house grown India Certified Spirulina. FSSAI approved.",
   keyIngredients:["Calcium (Calcium Citrate Malate) 800mg per serving (100% RDA)","Iron (Elemental) 19mg per serving (100% RDA)","Zinc (Elemental) 17mg per serving (100% RDA)","Vitamin B12 2.40mcg per serving (100% RDA)","Vitamin D3 15mcg per serving (100% RDA)","Vitamin K2-7 55mcg per serving (50% RDA)","Organic Spirulina platensis Powder 0.506g per serving","Vitamin B12 & D3 are Plant Based","Other Ingredients: Multivitamins, Minerals, Microcrystalline Cellulose (INS 460(i)), PVP (INS 1201), Magnesium Stearate (INS 470(ii))"],
   howToUse:"Adults: Take 2 tablets per day. Children (8–12 years): 1 tablet per day. Take in the morning with water or milk."},

  {id:20, position:15, name:"Moringa Tablets", brand:"Ozylix Ayurvedic", category:"ayurvedic", tags:["featured","new","immunity","energy","ayurvedic"],
   price:249, salePrice:null, offer:"Price to be updated",
   image2:"",
   rating:4.7, reviews:156,  badge:"Ayurvedic",
   hasTiers:false,
   seoKeywords:["moringa tablets India","moringa oleifera supplement India","moringa veggie tablets"],
   description:"Pure Organic Moringa Tablets — the miracle tree in its most potent form. Boosts energy levels, improves digestive system, increases metabolism, and builds up stamina. Each 750mg tablet provides Moringa's full spectrum of nutrients. FSSAI Approved. Vegan. Dietary Supplement.",
   keyIngredients:["Organic Moringa (Moringa oleifera) 750mg per tablet","Acaciaegum (binder)"],
   howToUse:"Take 2 moringa tablets in the morning and 2 tablets in the evening to boost your body. Children (8–12 years): 1 moringa tablet twice per day as prescribed by nutritionist. Store in a cool & dry place."},

  {id:22, position:16, name:"Power Pro Tablets", brand:"Ozylix Immunity", category:"immunity", tags:["featured","new","immunity","energy"],
   price:499, salePrice:null, offer:"Price coming soon",
   image2:"",
   rating:4.7, reviews:34,  badge:"Coming Soon",
   hasTiers:false,
   seoKeywords:["immunity booster India","power pro tablet India","stamina supplement India","ashwagandha immunity"],
   description:"Energy Pro+ for Vigour, Vitality & Stamina. Enhances Stamina & Physical Performance. Inhibits Fatigue & Stress. Promotes a Healthy Immune Response. Power | Strength | Stamina. Contains a synergistic blend of Withania somnifera (Ashwagandha), Emblica officinalis, Rauvolfia serpentina, Asparagus racemosus, Withania coagulans, Mucuna pruriens, Tribulus terrestris, Abelmoschus moschatus, Chlorophytum borivilianum, Purified Shilajit, Myristica fragrans, and Astaxanthin.",
   keyIngredients:["Withania somnifera (Ashwagandha) 250mg","Emblica officinalis 75mg","Mucuna pruriens 50mg","Tribulus terrestris 50mg","Purified Shilajit Extract 50mg","Astaxanthin 4mg","Asparagus racemosus 59mg","Chlorophytum borivilianum 59mg"],
   howToUse:"Adults: Take 1 tablet per day after a meal or as directed by healthcare professional. Keep container tightly closed. Keep out of reach of children."},
];

function byPosition(a, b) {
  const pa = Number.isFinite(Number(a.position ?? a.sort_order)) ? Number(a.position ?? a.sort_order) : 9999;
  const pb = Number.isFinite(Number(b.position ?? b.sort_order)) ? Number(b.position ?? b.sort_order) : 9999;
  return (pa - pb) || (Number(a.id) - Number(b.id));
}

const REVIEWS = {};
const REVIEWS_LOADED = {};

const PRODUCT_RATINGS = {};
const PRODUCT_REVIEWS = {};
let PRODUCT_RATINGS_LOADED = false;

async function sbClientWhenReady(waitMs) {
  const deadline = Date.now() + (waitMs || 8000);
  for (;;) {
    const sb = sbClient();
    if (sb) return sb;
    if (Date.now() >= deadline) return null;
    await new Promise((r) => setTimeout(r, 250));
  }
}

let _loadProductRatingsDone = null;
async function loadProductRatings() {

  if (_loadProductRatingsDone) return _loadProductRatingsDone;
  _loadProductRatingsDone = (async () => {
    try {

    const reviewDeadline = Date.now() + 8000;
    while (typeof loadReviewsBatch !== 'function' && Date.now() < reviewDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const rows = typeof loadReviewsBatch === 'function' ? await loadReviewsBatch() : [];
    const totals = {};
    Object.keys(PRODUCT_RATINGS).forEach(id => delete PRODUCT_RATINGS[id]);
    Object.keys(PRODUCT_REVIEWS).forEach(id => delete PRODUCT_REVIEWS[id]);
    (rows || []).forEach((r) => {
      const id = r.productId;
      const n = Number(r.rating);
      if (id == null || !Number.isFinite(n) || n <= 0) return;
      if (!totals[id]) totals[id] = { sum: 0, count: 0 };
      totals[id].sum += n;
      totals[id].count += 1;
      if (!PRODUCT_REVIEWS[id]) PRODUCT_REVIEWS[id] = [];
      if (PRODUCT_REVIEWS[id].length < 3 && r.user) {
        PRODUCT_REVIEWS[id].push({
          user: r.user, rating: n, text: r.text, date: r.date,
        });
      }
    });
    Object.keys(totals).forEach((id) => {
      PRODUCT_RATINGS[id] = { avg: totals[id].sum / totals[id].count, count: totals[id].count };
    });
    if (typeof REVIEW_PRODUCT_TOTALS !== 'undefined') REVIEW_PRODUCT_TOTALS.forEach(r => {
      PRODUCT_RATINGS[r.product_id] = {avg:r.average == null ? null : Number(r.average),count:Number(r.total)||0};
    });
    PRODUCT_RATINGS_LOADED = true;
  } catch (e) {

    console.warn('[loadProductRatings]', e.message);
    _loadProductRatingsDone = null;
    PRODUCT_RATINGS_LOADED = false;
    try { updateAllProductCards(); } catch (_) {}
    return;
  }
  try { updateAllProductCards(); } catch (e) {}

  try { if (typeof syncProductStructuredData === 'function') syncProductStructuredData(); } catch (e) {}
  })();
  return _loadProductRatingsDone;
}

function productRating(p) {
  const live = PRODUCT_RATINGS[p.id];
  if (live && live.count > 0) return live;

  const cached = REVIEWS[p.id];
  if (Array.isArray(cached) && cached.length) {
    const sum = cached.reduce((s, r) => s + (Number(r.rating) || 0), 0);
    return { avg: sum / cached.length, count: cached.length };
  }

  if (PRODUCT_RATINGS_LOADED || REVIEWS_LOADED[p.id]) return { avg: null, count: 0 };

  return { avg: null, count: 0 };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadProductRatings);
} else {
  loadProductRatings();
}

const REVIEW_REQUEST_VERSION = {};
const REVIEW_REQUEST_PENDING = {};
async function loadProductReviews(productId, options = {}) {
  if (!options.force && REVIEW_REQUEST_PENDING[productId]) return REVIEW_REQUEST_PENDING[productId];
  const version = (REVIEW_REQUEST_VERSION[productId] || 0) + 1;
  REVIEW_REQUEST_VERSION[productId] = version;
  const task = (async () => {
    try {
      let offset = 0, all = [], payload;
      do {
        const response = await fetch(`${API_BASE}/api/public-reviews?product_id=${encodeURIComponent(productId)}&limit=100&offset=${offset}`, {
          headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store',
          signal: AbortSignal.timeout(20000),
        });
        payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Reviews are temporarily unavailable');
        if (!Array.isArray(payload.reviews)) throw new Error('The server returned an invalid review list');
        if (REVIEW_REQUEST_VERSION[productId] !== version) return;
        if (payload.has_more && !payload.reviews.length) throw new Error('Incomplete review list');
        all.push(...payload.reviews); offset += payload.reviews.length;
      } while (payload.has_more);
      REVIEWS[productId] = all.map(r => ({
        id: r.id, user: r.user_name, rating: Number(r.rating), text: r.review_text,
        date: r.created_at, updatedAt: r.updated_at, verified: r.verified === true
      }));
      REVIEWS_LOADED[productId] = true;
      if (typeof refreshProductReviewUI === 'function') refreshProductReviewUI(productId);
      return REVIEWS[productId];
    } catch (e) {
      if (REVIEW_REQUEST_VERSION[productId] !== version) return;
      if (currentProduct?.id === productId && !REVIEWS_LOADED[productId]) {
        const wrap = document.getElementById('rvListWrap');
        if (wrap) wrap.innerHTML = '<p>Reviews could not load. <button type="button" onclick="loadProductReviews(' + Number(productId) + ')">Retry</button></p>';
      }
      if (options.force) throw e;
    } finally {
      if (REVIEW_REQUEST_VERSION[productId] === version) delete REVIEW_REQUEST_PENDING[productId];
    }
  })();
  REVIEW_REQUEST_PENDING[productId] = task;
  return task;
}

const STORE = {
  cart:[], wishlist:[],
  init(){try{this.cart=JSON.parse(localStorage.getItem('asc_cart')||'[]');}catch(e){this.cart=[];}try{this.wishlist=JSON.parse(localStorage.getItem('asc_wish')||'[]');}catch(e){this.wishlist=[];}this.normalizeCartTiers();this.updateCartUI();},
  save(){try{localStorage.setItem('asc_cart',JSON.stringify(this.cart));localStorage.setItem('asc_wish',JSON.stringify(this.wishlist));}catch(e){}this.updateCartUI();},
  addToCart(id,qty=1){const p=PRODUCTS.find(p=>p.id===id);if(!isStoreProductActive(p)){showToast('This product is currently unavailable','error');return;}const ex=this.cart.find(i=>i.id===id&&i.tierIdx===undefined);if(ex)ex.qty+=qty;else this.cart.push({id,qty});this.save();window._trackAddToCart&&window._trackAddToCart(p,qty);const _dispPrice=p.salePrice||p.price;showToast(`${p.name} added to cart! 🌿`);},
  removeFromCart(id){this.cart=this.cart.filter(i=>i.id!==id);this.save();},

  normalizeCartTiers(){
    let changed = false;
    this.cart.forEach(it => {
      if (it.isCustomPack) return;

      const p = PRODUCTS.find(x => x.id === it.id);
      if (!p) return;

      if (it.tierIdx === undefined) {
        const p2 = PRODUCTS.find(x => x.id === it.id);
        const t2 = (typeof getProductTiers === 'function') ? getProductTiers(p2) : null;
        if (t2 && t2.length) { const first = t2[0]; it.tierIdx = 0; it.tierRate = first.rate; it.tierMRP = first.mrp; it.tierDisc = first.discountPct || 0; it.tierTabs = first.tabs; changed = true; }
        return;
      }
      const tiers = (typeof getProductTiers === 'function') ? getProductTiers(p) : null;
      const tier = tiers && Array.isArray(tiers) ? tiers[it.tierIdx] : null;
      if (tier && tier.rate !== undefined && tier.rate !== it.tierRate) {
        it.tierRate = tier.rate; it.tierMRP = tier.mrp; it.tierDisc = tier.discountPct || 0;
        it.tierTabs = tier.tabs; changed = true;
      } else if (!tier) {
        delete it.tierRate; delete it.tierMRP; delete it.tierDisc;
        delete it.tierTabs; delete it.tierIdx; delete it.tierLabel; delete it.isBundle;
        changed = true;
      }
    });
    if (changed) this.save();
  },
  updateQty(id,qty){const item=this.cart.find(i=>i.id===id);if(item){item.qty=Math.max(1,qty);this.save();}},
  getSubtotal(){return this.cart.reduce((s,i)=>{const p=PRODUCTS.find(p=>p.id===i.id);return s+(p?((p.salePrice||p.price)||0)*i.qty:0);},0);},
  applyCode(code){return null;},
  updateCartUI(){const count=this.cart.reduce((s,i)=>s+i.qty,0);document.querySelectorAll('.cart-badge').forEach(el=>{el.textContent=count;el.style.display=count>0?'flex':'none';});},
  toggleWishlist(id){const idx=this.wishlist.indexOf(id);if(idx>-1){this.wishlist.splice(idx,1);showToast('Removed from wishlist');}else{this.wishlist.push(id);showToast('Added to wishlist! 💚');}this.save();}
};

function fmt(p){return '₹'+p.toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2});}

function stars(r){const v=Math.round((Number(r)||0)*10)/10,f=Math.floor(v),h=v%1>=0.5;return '<span class="stars">'+'★'.repeat(f)+(h?'☆':'')+'</span><span class="rating-n">'+v+'</span>';}
function showToast(msg,type=''){

  const dupe = Array.from(document.querySelectorAll('.toast'))
    .find(el => el.textContent === msg);
  if (dupe) {
    clearTimeout(dupe._hideT); clearTimeout(dupe._killT);
    dupe.classList.add('show');
    dupe._hideT = setTimeout(()=>{ dupe.classList.remove('show');
      dupe._killT = setTimeout(()=>dupe.remove(),350); },3200);
    return;
  }
  const t=document.createElement('div');t.className='toast '+type;t.textContent=msg;
  document.body.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  t._hideT = setTimeout(()=>{ t.classList.remove('show');
    t._killT = setTimeout(()=>t.remove(),350); },3200);
}

const NO_IMAGE_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">' +
  '<rect width="240" height="240" fill="#FBF3E8"/>' +
  '<g fill="#547177" opacity=".22">' +
  '<circle cx="104" cy="96" r="17"/>' +
  '<circle cx="142" cy="112" r="19"/>' +
  '<circle cx="108" cy="136" r="14"/>' +
  '</g>' +
  '<text x="120" y="192" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" letter-spacing="1.6" fill="#7A82A4">IMAGE COMING SOON</text>' +
  '</svg>'
);
const PRODUCT_FALLBACKS = {
  'effervescent': NO_IMAGE_PLACEHOLDER,
  'spirulina':    NO_IMAGE_PLACEHOLDER,
  'premium':      NO_IMAGE_PLACEHOLDER,
  'ayurvedic':    NO_IMAGE_PLACEHOLDER,
  'immunity':     NO_IMAGE_PLACEHOLDER,
  'default':      NO_IMAGE_PLACEHOLDER,
};

function cdnImg(url) {
  if (!url) return url;
  var raw = String(url);
  try {
    var u = new URL(raw, location.origin);
    var marker = '/storage/v1/object/public/ozylix%20store/';
    if (u.pathname.indexOf(marker) === 0) return '/cdn-storage/ozylix%20store/' + u.pathname.slice(marker.length) + u.search;
    if (u.pathname.indexOf('/cdn-storage/ozylix%20store/') === 0) return u.pathname + u.search;
  } catch (_) {}
  return raw;
}

var VIDEO_EXT = /\.(mp4|webm|mov|m4v|3gp)(\?|$)/i;
function mediaTypeFromUrl(url) {
  if (!url) return 'image';
  var s = String(url).toLowerCase();
  if (VIDEO_EXT.test(s) || /response-content-type=video/.test(s)) return 'video';
  return 'image';
}

const PRODUCT_CUTOUT_SOURCES = {"38": "1786544708346-2n4nad.webp", "34": "1786544405506-8l0alq.webp", "31": "1786544754750-xd8h9n.webp", "30": "1786544808269-q1ro7o.webp", "32": "1786529108294-o35fhe.webp", "33": "1786544958455-wlcavv.webp", "35": "1786545030513-0a7fmf.webp", "36": "1786545163371-nk5c7i.webp", "37": "1786545213192-cozg5a.webp", "39": "1786529254427-awoc66.webp"};
function getProductCutout(p) {
  const filename = p && String(p.image || '').split('?')[0].split('/').pop();
  return p && filename === PRODUCT_CUTOUT_SOURCES[p.id] ? '/assets/products/cutouts/' + p.id + '.webp' : '';
}
function getProductImg(p) {
  const cutout = getProductCutout(p);
  if (cutout) return cutout;
  if (typeof p.image === 'string' && /^(https?:\/\/|\/(?!\/))/.test(p.image)) return cdnImg(p.image);
  return cdnImg(PRODUCT_FALLBACKS[p.category] || PRODUCT_FALLBACKS['default']);
}

const HOME_CUTOUT_SOURCES = {"38": "1788250608989-1936lu.webp", "31": "1786544758370-qsxkhw.webp", "32": "1786544881956-ifl139.webp", "33": "1786544962961-ofe17e.webp", "30": "1786544819470-d1bil2.webp", "35": "1786545034233-7c1jsa.webp", "36": "1786545166376-07p1ho.webp", "39": "1786545298781-uz2amq.webp", "34": "1786544414753-g3gyel.webp"};
function getProductSurfaceImg(p) {
  const thumb = p && p.homeThumbnailUrl ? String(p.homeThumbnailUrl).trim() : '';
  const cutout = getProductCutout(p);
  if (cutout && (!thumb || thumb.split('?')[0].split('/').pop() === HOME_CUTOUT_SOURCES[p.id])) return cutout;
  if (thumb) return cdnImg(thumb);
  return getProductImg(p);
}
function productSurfaceMediaHTML(url, alt, className, extraStyle) {
  const src = esc(cdnImg(url || ''));
  const safeAlt = esc(alt || 'Ozylix product media');
  const cls = className || '';
  const style = extraStyle || '';
  if (mediaTypeFromUrl(src) === 'video') {
    return '<video class="' + cls + '" src="' + src + '" muted loop playsinline autoplay preload="metadata" aria-label="' + safeAlt + '" style="' + style + '"></video>';
  }
  return '<img class="' + cls + '" src="' + src + '" alt="' + safeAlt + '" loading="lazy" fetchpriority="low" decoding="async" style="' + style + '" onerror="this.src=\'' + PRODUCT_FALLBACKS.default + '\'">';
}
function upgradeUploadedVideoImages(root) {
  const scope = root || document;
  scope.querySelectorAll('img[src]').forEach(function(img) {
    if (img.dataset.videoUpgraded === '1') return;
    const src = img.currentSrc || img.getAttribute('src') || '';
    if (!src || mediaTypeFromUrl(src) !== 'video') return;
    const video = document.createElement('video');
    Array.from(img.attributes).forEach(function(attr) {
      if (!['src','alt','loading','decoding','onerror'].includes(attr.name)) video.setAttribute(attr.name, attr.value);
    });
    video.src = src;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = 'metadata';
    video.setAttribute('aria-label', img.getAttribute('alt') || 'Ozylix product video');
    img.dataset.videoUpgraded = '1';
    img.replaceWith(video);
  });
}
(function installUploadedVideoUpgrade() {
  const start = function() {
    upgradeUploadedVideoImages(document);
    if (!document.body || window.__ozylixVideoObserver) return;
    const observer = new MutationObserver(function(records) {
      records.forEach(function(record) {
        record.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) upgradeUploadedVideoImages(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__ozylixVideoObserver = observer;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

var OZYLIX_NOTIFICATION_STORE='ozylix.notificationCenter.v1';
function ozylixReadCenterEntries(){try{var r=localStorage.getItem(OZYLIX_NOTIFICATION_STORE);var a=r?JSON.parse(r):[];return Array.isArray(a)?a:[]}catch(e){return[]}}
function ozylixWriteCenterEntries(a){try{localStorage.setItem(OZYLIX_NOTIFICATION_STORE,JSON.stringify(a.slice(0,40)))}catch(e){}}
function ozylxSaveCenterEntry(i){var a=ozylixReadCenterEntries(),m=String(i.msg||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();if(!m)return;a=a.filter(function(x){return x.id!==i.id});a.unshift({id:String(i.id||('note-'+Date.now())),icon:String(i.icon||'✨'),message:m,cta:String(i.cta||''),url:String(i.url||''),createdAt:new Date().toISOString(),read:false});ozylixWriteCenterEntries(a);updateNotificationCenterBadge()}
function updateNotificationCenterBadge(){var n=ozylixReadCenterEntries().filter(function(x){return !x.read}).length;['mobileNotificationBadge','desktopNotificationBadge'].forEach(function(id){var e=document.getElementById(id);if(!e)return;e.textContent=n>9?'9+':String(n);e.style.display=n?'grid':'none'})}
function renderNotificationCenter(){var e=document.getElementById('notificationCenterList');if(!e)return;var a=ozylixReadCenterEntries();if(!a.length){e.innerHTML='<div class="notification-center-empty"><h3>You are all caught up</h3><p>No saved updates yet. We will keep helpful offer, review and wellness reminders here when they are relevant to you.</p><button class="btn-primary" type="button" onclick="showPage(\'shop\')">Explore products</button></div>';updateNotificationCenterBadge();return}e.innerHTML=a.map(function(x){var t=x.createdAt?new Date(x.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'';return '<article class="notification-center-card '+(x.read?'':'unread')+'"><span class="notification-center-icon" aria-hidden="true">'+esc(x.icon||'✨')+'</span><div class="notification-center-message"><strong>'+(x.read?'Update':'New update')+'</strong>'+esc(x.message)+'<span class="notification-center-time">'+esc(t)+'</span></div><button class="btn-secondary" type="button" onclick="openSavedNotification(\''+esc(x.id)+'\')">'+(x.cta?esc(x.cta):'Open')+'</button></article>'}).join('');updateNotificationCenterBadge()}
function openSavedNotification(id){var a=ozylixReadCenterEntries(),i=a.find(function(x){return x.id===id});if(!i)return;a.forEach(function(x){if(x.id===id)x.read=true});ozylixWriteCenterEntries(a);renderNotificationCenter();if(i.url){try{window.location.hash=i.url.replace(/^.*#/,'#')}catch(e){}}else showPage(i.cta&&/review/i.test(i.cta)?'account':'shop')}
function markAllNotificationsRead(){var a=ozylixReadCenterEntries();a.forEach(function(x){x.read=true});ozylixWriteCenterEntries(a);renderNotificationCenter();showToast('Notification center marked as read.')}
function openNotificationCenter(){showPage('notifications');renderNotificationCenter()}

var ozylxNotify = (function () {
  var MAX_PER_SESSION = 3;
  var MIN_GAP_MS = 20000;
  var shownCount = 0, lastAt = 0;
  var shownIds = {}, queue = [], live = null;

  function isTransactionalPage() {
    return (typeof currentPage === 'string') &&
      ['checkout', 'thankyou', 'account', 'login'].indexOf(currentPage) > -1;
  }
  function removeLive() {
    if (!live) return;
    var card = live; live = null;
    card.classList.add('is-exit');
    setTimeout(function () { card.remove(); drain(); }, 360);
  }
  function drain() {
    var now = Date.now();
    if (queue.length && shownCount < MAX_PER_SESSION && (now - lastAt) >= MIN_GAP_MS && !live) {
      var item = queue.shift();
      shownIds[item.id] = true;
      paint(item);
    }
  }
  function paint(item) {
    var root = document.getElementById('ozylxNotify');
    if (!root) return;
    if (root.querySelector('.ozylx-notify-card')) return;
    var card = document.createElement('div');
    card.className = 'ozylx-notify-card';
    card.setAttribute('data-corner', item.corner || 'bottom-left');
    card.setAttribute('role', 'status');
    var safeMsg = String(item.msg || '').replace(/</g, '&lt;');
    var safeCta = item.cta ? String(item.cta).replace(/</g, '&lt;') : '';
    card.innerHTML =
      '<span class="nzn-ico" aria-hidden="true">' + String(item.icon || '✨') + '</span>' +
      '<span class="nzn-txt">' + safeMsg +
        (safeCta ? '<br><button class="nzn-btn">' + safeCta + '</button>' : '') +
      '</span>' +
      '<button class="nzn-dismiss" aria-label="Close">&times;</button>';
    card.querySelector('.nzn-dismiss').onclick = function () {
      try { sessionStorage.setItem('ozylix.notifyDismissed.' + item.id, '1'); } catch (e) {}
      removeLive();
    };
    var btn = card.querySelector('.nzn-btn');
    if (btn) btn.onclick = function () { removeLive(); if (item.onCta) item.onCta(); };
    root.appendChild(card);
    live = card;
    shownCount += 1; lastAt = Date.now();

    setTimeout(function () { if (live === card) removeLive(); }, 8000);
  }
  function eligible(item) {
    if (isTransactionalPage()) return false;
    if (shownCount >= MAX_PER_SESSION) return false;
    if (shownIds[item.id]) return false;
    try { if (sessionStorage.getItem('ozylix.notifyDismissed.' + item.id)) return false; } catch (e) {}
    if ((Date.now() - lastAt) < MIN_GAP_MS) return false;
    return true;
  }
  function schedule(item) {
    try { ozylxSaveCenterEntry(item); } catch(e) {}
    if (eligible(item)) {
      if (live) { queue.push(item); }
      else { shownIds[item.id] = true; paint(item); }
    } else if (shownCount < MAX_PER_SESSION && !shownIds[item.id]) {
      queue.push(item);
    }

  }
  return { show: schedule, clear: removeLive, get shown() { return shownCount; } };
})();
setTimeout(updateNotificationCenterBadge, 500);

function esc(s) {
  const d = document.createElement('div');
  d.textContent = (s == null) ? '' : String(s);
  return d.innerHTML;
}

function starCount(n) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(5, v)) : 5;
}

function renderProductCard(p, options = {}){
  const homepage = options.homepage === true;
  const homeThumb = homepage && p && p.homeThumbnailUrl ? String(p.homeThumbnailUrl).trim() : '';
  const hasRealImage = !!(homeThumb || (p && p.image && String(p.image).trim()));
  const disc=p.salePrice&&p.price?Math.round((1-p.salePrice/p.price)*100):0;
  const rawTiers=p._backendTiers||QTY_TIERS[p.id];
  const normalizedTiers = Array.isArray(rawTiers) ? rawTiers.filter(t=>t&&t.rate!=null&&t.mrp!=null&&Number(t.mrp)>0&&Number(t.rate)>=0&&Number(t.rate)<=Number(t.mrp)).map((t,i)=>({...t,discountPct:Number.isFinite(Number(t.discountPct))?Number(t.discountPct):((Number(t.mrp)-Number(t.rate))/Number(t.mrp))*100,savingAmount:Math.max(0,Number(t.mrp)-Number(t.rate)),_offerIndex:i})).sort((a,b)=>(b.discountPct-a.discountPct)||(b.savingAmount-a.savingAmount)||(Number(b.tabs||0)-Number(a.tabs||0))||(a._offerIndex-b._offerIndex)).map(({_offerIndex,...t})=>t) : [];

  const tiers=normalizedTiers.length ? normalizedTiers : null;
  const maxDisc=tiers?Math.max(...tiers.map(t=>Number(t.discountPct)||0)):disc;
  const baseRate=tiers?tiers[0].rate:(p.salePrice||p.price);
  const baseMRP=tiers?tiers[0].mrp:p.price;
  const priceDisplay=(baseRate==null)?'<em style="font-size:0.8rem;color:var(--f-mineral-d)">Price Coming Soon</em>':'\u20B9'+baseRate.toLocaleString('en-IN');
  const imgSrc = homepage ? getProductSurfaceImg(p) : getProductImg(p);
  const cutoutClass = imgSrc.startsWith('/assets/products/cutouts/') ? ' has-cutout' : '';
  const mediaState = hasRealImage ? 'ready' : 'missing';
  const mediaBadge = hasRealImage ? '' : '<span class="p-media-status" role="status" style="position:absolute;left:10px;right:10px;bottom:10px;z-index:3;padding:6px 8px;border-radius:999px;background:rgba(255,255,255,.9);color:#547177;font-size:.64rem;font-weight:700;text-align:center;letter-spacing:.02em;box-shadow:0 2px 8px rgba(44,55,60,.12)">Product photo being updated</span>';
  const safeName  = esc(p.name);
  const imageAlt = esc(homepage && p.homeThumbnailAlt ? p.homeThumbnailAlt : p.name);
  const cardMedia = productSurfaceMediaHTML(imgSrc, homepage && p.homeThumbnailAlt ? p.homeThumbnailAlt : p.name, '', 'width:100%;height:100%;object-fit:cover;display:block;');
  const safeBrand = esc(p.brand);

  const BENEFIT = [
    [/glutathione|skin|glow/i,             'Skin & Glow',          'var(--clay)'],
    [/apple cider|acv|weight|slim/i,       'Metabolism & Weight',  'var(--harbour)'],
    [/ashwagandha|stress|calm|sleep/i,     'Stress & Calm',        'var(--sage)'],
    [/green tea|antioxid/i,                'Antioxidant Support',  'var(--sage)'],
    [/spirulina|moringa|greens|algae/i,    'Plant Nutrition',      'var(--fern)'],
    [/bone|calcium|joint/i,                'Bone & Joint',         'var(--harbour)'],
    [/biotin|hair|nail|b1\b/i,             'Hair & Nails',         'var(--clay)'],
    [/rehydrat|electrolyte|hydrat/i,       'Hydration',            'var(--sky)'],
    [/carnitine|energy|burn/i,             'Energy & Burn',        'var(--clay)'],
    [/vitamin c|amla|immun/i,              'Immunity & Defence',   'var(--fern)'],

    [/women|female/i,                      "Women's Daily",        'var(--clay)'],
    [/\bmen\b|male/i,                     "Men's Daily",          'var(--indigo)'],
    [/multivitamin|multidiata|daily/i,     'Daily Essentials',     'var(--indigo)'],
    [/combo|kit|pack/i,                    'Curated Combo',        'var(--harbour)'],
  ];
  const _hay = ((p.name||'') + ' ' + (p.category||'')).trim();
  const _hit = BENEFIT.find(function(r){ return r[0].test(_hay); });
  const safeKicker  = esc(_hit ? _hit[1] : (p.category || 'Wellness'));
  const cardFlavour = _hit ? _hit[2] : 'var(--indigo)';
  const safeBadge = p.badge ? `<span class="p-badge">${esc(p.badge)}</span>` : '';
  const safeOffer = p.offer && !(/price to be updated|tbd|coming soon/i.test(p.offer) && Number(baseRate) > 0) ? `<span class="offer-tag" style="margin-top:4px;display:inline-block">${esc(p.offer)}</span>` : '';

  const rating = productRating(p);
  const ratingDisplay = rating.count > 0
    ? `${stars(rating.avg)} <span class="review-ct">(${rating.count})</span>`
    : `<span class="review-ct" style="color:var(--gray)">${typeof REVIEWS_BATCH_ERROR !== 'undefined' && REVIEWS_BATCH_ERROR ? 'Reviews unavailable' : 'No ratings yet'}</span>`;

  const qAddLabel = tiers ? 'Choose Pack' : 'Add to Cart';
  const qAddOnclick = tiers ? `event.stopPropagation();openProduct(${p.id})` : `event.stopPropagation();STORE.addToCart(${p.id})`;
  const buyNowOnclick = `event.stopPropagation();openProduct(${p.id})`;
  return `<div class="product-card${cutoutClass}" data-product-id="${p.id}" data-image-state="${mediaState}" style="--card-flavour:${cardFlavour}" onclick="openProduct(${p.id})"><div class="p-img-wrap">${cardMedia}${safeBadge}${mediaBadge} ${maxDisc>0?`<span class="p-disc-badge">${tiers?'Up to ':'-'}${maxDisc}%</span>`:''}<div class="p-actions"><button class="btn-wishlist" onclick="event.stopPropagation();STORE.toggleWishlist(${p.id})" title="Wishlist">♡</button><button class="btn-qadd" onclick="${qAddOnclick}">${qAddLabel}</button></div></div><div class="p-info"><div class="p-brand">${safeKicker}</div><div class="p-name">${safeName}</div><div class="p-rating">${ratingDisplay}</div><div class="p-price"><span class="sale-price">${priceDisplay}</span>${(baseMRP&&baseMRP!==baseRate)?`<span class="orig-price">₹${baseMRP.toLocaleString('en-IN')}</span>`:''}</div>${tiers?`<div class="tier-offer-tag">⚡ Up to ${maxDisc.toFixed(maxDisc%1?1:0)}% OFF on larger packs${tiers[0]?.offerType==='buy_get' ? ` · ${esc(tiers[0].label || `Buy ${tiers[0].buyQuantity||1} Get ${tiers[0].freeQuantity||0}`)}` : ''}</div>`:safeOffer}<div class="p-enter" aria-hidden="true">Shop now<svg viewBox="0 0 15 8" fill="none"><path d="M0 4h13M9.5 1L13 4l-3.5 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div><div class="p-buyrow"><button class="btn-buynow" onclick="${buyNowOnclick}">⚡ Buy Now</button></div></div>`;
}

