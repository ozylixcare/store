import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(file, { optedOut = false, storageFails = false, calls = [] } = {}) {
  const visit = new Map();
  const context = {
    location: { pathname: '/product/sample', search: '?email=private@example.test' },
    localStorage: { getItem: () => optedOut ? '1' : null },
    sessionStorage: {
      getItem(key) { if (storageFails) throw new Error('blocked storage'); return visit.get(key); },
      setItem(key, value) { visit.set(key, value); },
    },
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
    matchMedia: () => ({ matches: true }),
    document: { readyState: 'complete' },
    fetch: (url, options) => { calls.push({ url, options, body: JSON.parse(options.body) }); return Promise.resolve(); },
    showPage: () => 'page-result',
    openProduct: () => 'product-result',
    _trackAddToCart: () => 'cart-result',
    _trackBeginCheckout: () => 'checkout-result',
    _trackPurchase: () => 'purchase-result',
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), context);
  return { context, calls };
}

for (const file of ['../scripts/ozy-track.js', '../scripts/ozy-track.min.js']) {
  const { context, calls } = load(file);
  assert.equal(calls.length, 1, 'initial page visit emits one event');
  const initial = calls[0];
  assert.equal(initial.url, '/telemetry/api/track');
  assert.equal(initial.options.credentials, 'omit');
  assert.equal(initial.body.anon_id, initial.body.session_id);
  assert.ok(initial.body.anon_id, 'ingest requires an envelope anonymous ID');
  assert.ok(initial.body.session_id, 'ingest requires an envelope session ID');
  assert.equal(initial.body.device_hint, 'mobile');
  assert.equal(initial.body.events[0].event_name, 'homepage_viewed');
  assert.equal(initial.body.events[0].page, '/product');
  for (const [callback, event, result] of [
    ['showPage', 'page_viewed', 'page-result'],
    ['openProduct', 'product_viewed', 'product-result'],
    ['_trackAddToCart', 'product_added_to_cart', 'cart-result'],
    ['_trackBeginCheckout', 'checkout_started', 'checkout-result'],
    ['_trackPurchase', 'order_completed', 'purchase-result'],
  ]) {
    assert.equal(context[callback]({ email: 'private@example.test', order_id: 'private-order', product_id: 'private-product' }), result);
    assert.equal(calls.at(-1).body.events[0].event_name, event);
    assert.equal(calls.at(-1).body.session_id, initial.body.session_id);
  }
  assert.ok(!JSON.stringify(calls).includes('private'), 'events omit customer, order, product and query data');
  const before = calls.length;
  context.ozyTrack.track('cart_snapshot');
  context.ozyTrack.identify('private@example.test');
  assert.equal(calls.length, before, 'unsupported events and identification remain disabled');
  assert.equal(load(file, { optedOut: true }).calls.length, 0, 'opt-out prevents ingestion');
  assert.equal(load(file, { storageFails: true }).calls.length, 0, 'blocked storage prevents ingestion');
}
console.log('PASS: anonymous ingest envelope, callback results, privacy projection, opt-out, blocked storage and built asset');
