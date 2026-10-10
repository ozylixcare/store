import assert from 'node:assert/strict';
import storefront from '../worker/index.js';
const env={ASSETS:{fetch:()=>new Response('asset',{headers:{'Content-Type':'text/plain'}})}};
for(const host of ['www.ozylix.com','back.ozylix.com']){
 for(const path of ['/scripts/admin-core.js','/scripts/admin-api.min.js','/styles/admin-main.css','/scripts/%61dmin-ui.min.js']){
  const response=await storefront.fetch(new Request('https://'+host+path),env,{});
  assert.equal(response.status,host==='back.ozylix.com'?200:404,path);
 }
 for(const path of ['/worker/api-proxy.js','/functions/_middleware.js','/.env','/docs/internal.md','/security/audit.sql','/package.json','/_headers','/scripts/main.js.map','/%77orker/index.js','/scripts/store-core-20261007-hub.min.js','/scripts/store-core-20261001-cart.min.js','/scripts/auth-core-google-20260827.min.js']){
  const response=await storefront.fetch(new Request('https://'+host+path),env,{});assert.equal(response.status,404,host+path);assert.equal(response.headers.get('Cache-Control'),'no-store');
 }
 for(const path of ['/scripts/security.js','/styles/store-responsive.css','/.well-known/security.txt','/assets/ozylix-logo.png'])assert.equal((await storefront.fetch(new Request('https://'+host+path),env,{})).status,200,path);
}
console.log('PASS: private deployment assets blocked on public/admin hosts; required storefront assets stay available');
