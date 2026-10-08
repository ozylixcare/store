import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequest } from '../functions/_middleware.js';
globalThis.HTMLRewriter = class {
  on() { return this; }
  transform(response) { return response; }
};
const env = { ASSETS: { fetch: async () => new Response('<html>storefront</html>', { headers: { 'Content-Type': 'text/html' } }) } };
for (const path of ['/account', '/account/', '/cart', '/wishlist', '/notifications']) {
  for (const method of ['GET', 'HEAD']) {
    const response = await onRequest({ request: new Request('https://www.ozylix.com'+path, { method }), env, waitUntil() {} });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.equal(response.headers.get('Vary'), 'Cookie, Authorization');
  }
}
for (const path of ['/', '/shop', '/about', '/product/green-tea-effervescent-tablet']) {
  const response = await onRequest({ request: new Request('https://www.ozylix.com'+path), env, waitUntil() {} });
  assert.equal(response.headers.get('Cache-Control'), 'no-cache');
  assert.equal(response.headers.get('X-Robots-Tag'), null);
}
const worker = fs.readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8');
assert.ok(!worker.includes('Disallow: /scripts/'), 'Search engines must be able to render storefront JavaScript');
for (const name of ['ADMIN_CSP', 'PUBLIC_CSP']) {
  const policy = worker.match(new RegExp('const '+name+' = "([^"]+)"'))[1];
  const connect = policy.match(/connect-src ([^;]+)/)[1];
  assert.ok(!connect.includes('frwsjgrrtzhjfflcdjjs.supabase.co'));
  assert.ok(!connect.includes('wyvpuafzirwlwweifzao.supabase.co'));
  assert.ok(!connect.includes('localhost'));
  assert.ok(!connect.includes('127.0.0.1'));
  assert.ok(connect.includes('https://backend-s7ih.onrender.com'));
}
console.log('Private routes exclude shared caching/indexing; crawler rendering and production connection policies passed');
