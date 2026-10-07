import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequest } from '../functions/_middleware.js';
import { PUBLIC_CSP } from '../worker/index.js';

let rewrittenPolicy;
globalThis.HTMLRewriter = class {
  on(selector, handler) { assert.equal(selector, 'meta[http-equiv="Content-Security-Policy"]'); this.handler = handler; return this; }
  transform(response) { this.handler.element({ setAttribute(name, value) { assert.equal(name, 'content'); rewrittenPolicy = value; } }); return response; }
};
let assets = [];
const env = { ASSETS: { async fetch(input) {
  const url = new URL(input.url || input);
  assets.push(url.pathname);
  // Pages canonicalizes /index.html to /; fetching it for a SPA loses the shell.
  if (url.pathname === '/index.html') return Response.redirect(new URL('/', url), 301);
  if (url.pathname === '/') return new Response('<html>current storefront shell</html>', { headers: { 'Content-Type': 'text/html', 'Content-Security-Policy': 'old conflicting policy' } });
  if (url.pathname === '/download/' || url.pathname === '/shop/') throw new Error('stale route copy used');
  if (url.pathname === '/manifest.json') return new Response('{"display":"standalone"}', { headers: { 'Content-Type': 'application/manifest+json' } });
  if (url.pathname === '/sw.js') return new Response('service worker', { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' } });
  return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/html' } });
} } };
const run = (url, options) => onRequest({ request: new Request(url, options), env, waitUntil() {} });
for (const path of ['/', '/download?ref=install', '/product/green-tea-effervescent-tablet?campaign=a%20b', '/manifest.json', '/cdn-storage/ozylix%20store/a.webp']) {
  assets = [];
  const response = await run('https://ozylix.com' + path);
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('Location'), 'https://www.ozylix.com' + path);
  assert.equal(assets.length, 0);
}
for (const path of ['/', '/download', '/download/', '/shop/', '/account', '/product/green-tea-effervescent-tablet']) {
  assets = [];
  const response = await run('https://www.ozylix.com' + path);
  assert.equal(response.status, 200);
  assert.deepEqual(assets, ['/']);
  assert.match(await response.text(), /current storefront shell/);
  assert.equal(response.headers.get('Content-Security-Policy'), PUBLIC_CSP);
  assert.equal(response.headers.get('Cache-Control'), 'no-cache');
  assert.equal(rewrittenPolicy, PUBLIC_CSP.replace(/frame-ancestors[^;]*;?/, '').trim());
}
for (const path of ['/admin', '/admin.html', '/ops-console-8f3d2c.html', '/worker/index.js', '/functions/_middleware.js', '/tools/test-public-domains.mjs', '/unknown-page']) {
  assert.equal((await run('https://www.ozylix.com' + path)).status, 404, path);
}
for (const path of ['/manifest.json', '/sw.js']) {
  const response = await run('https://www.ozylix.com' + path);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Security-Policy'), PUBLIC_CSP);
}
assert.match(PUBLIC_CSP, /manifest-src 'self';/);
assert.match(PUBLIC_CSP, /worker-src 'self';/);
assert.match(PUBLIC_CSP, /media-src 'self' blob:/);
assert.match(PUBLIC_CSP, /default-src 'none';/);
assert.match(PUBLIC_CSP, /object-src 'none';/);
assert.match(PUBLIC_CSP, /form-action 'self';/);
assert.ok(!PUBLIC_CSP.includes('unsafe-eval'));
assert.ok(!PUBLIC_CSP.includes('https:;'));

// Public media map uses a fixed backend URL and never forwards customer headers.
const originalFetch = globalThis.fetch;
let calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  return new Response(JSON.stringify({ data: { 'home.banner.1': '/cdn-storage/ozylix%20store/a.webp' } }), { headers: { 'Content-Type': 'application/json' } });
};
const media = await run('https://www.ozylix.com/api/site-media', { headers: { Authorization: 'Bearer customer-token', Cookie: 'customer=cookie' } });
assert.equal(media.status, 200);
assert.equal((await media.json()).data['home.banner.1'], '/cdn-storage/ozylix%20store/a.webp');
assert.equal(calls.length, 1);
assert.equal(calls[0].url, 'https://backend-s7ih.onrender.com/api/site-media');
assert.deepEqual(calls[0].options.headers, { Accept: 'application/json' });
assert.equal((await run('https://www.ozylix.com/api/site-media')).status, 200);
assert.equal(calls.length, 1, 'public map edge cache');
globalThis.fetch = originalFetch;

// An unavailable shell must not become a successful empty SPA page.
const failing = await onRequest({ request: new Request('https://www.ozylix.com/download'), env: { ASSETS: { fetch: async () => new Response('unavailable', { status: 503 }) } }, waitUntil() {} });
assert.equal(failing.status, 503);
assert.match(fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'), /"pattern": "back\.ozylix\.com"/);
console.log('Public domain routing, media map, CSP and admin isolation checks passed');
