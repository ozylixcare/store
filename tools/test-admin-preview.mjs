import assert from 'node:assert/strict';
import storefront, { ADMIN_ENTRY } from '../worker/index.js';

const assets = new Map([
  ['/', 'Storefront preview'],
  ['/tools/store-preview.html', 'Device preview'],
  ['/admin.html', 'Admin panel'],
]);
const env = { ASSETS: { fetch: async request => {
  const path = new URL(typeof request === 'string' ? request : request.url || request.href).pathname;
  return new Response(assets.get(path) || 'Not found', {status:assets.has(path) ? 200 : 404,headers:{'Content-Type':'text/html'}});
} } };
for (const path of ['/store-preview','/?storePreview=1&preview=1','/shop?storePreview=1','/product/test?storePreview=1','/cart?storePreview=1']) {
  const response = await storefront.fetch(new Request('https://back.ozylix.com'+path),env,{});
  assert.equal(response.status,200,path);
  assert.equal(await response.text(),path === '/store-preview' ? 'Device preview' : 'Storefront preview');
  assert.equal(response.headers.get('X-Frame-Options'),'SAMEORIGIN');
  assert.ok(response.headers.get('Content-Security-Policy').includes("frame-ancestors 'self'"));
  assert.ok(response.headers.get('Cache-Control').includes('no-store'));
  assert.ok(response.headers.get('X-Robots-Tag').includes('noindex'));
}
const admin = await storefront.fetch(new Request('https://back.ozylix.com'+[...ADMIN_ENTRY][0]+'?storePreview=1'),env,{});
assert.equal(await admin.text(),'Admin panel');
assert.equal(admin.headers.get('X-Frame-Options'),'DENY');
assert.ok(admin.headers.get('Content-Security-Policy').includes("frame-ancestors 'none'"));
for (const url of ['https://back.ozylix.com/tools/store-preview.html','https://www.ozylix.com/tools/store-preview.html','https://www.ozylix.com/store-preview','https://back.ozylix.com/admin.html?storePreview=1']) {
  const response = await storefront.fetch(new Request(url),env,{});
  assert.equal(response.status,url.includes('/admin.html') ? 302 : 404,url);
}
console.log('PASS: admin device/storefront preview routes, same-origin framing, no caching/indexing, private assets blocked and admin framing denied');
