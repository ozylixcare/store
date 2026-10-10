import assert from 'node:assert/strict';
import storefront from '../worker/index.js';
const env={ASSETS:{fetch:()=>new Response('asset',{headers:{'Content-Type':'text/plain'}})}};
for(const host of ['www.ozylix.com','back.ozylix.com']){
 for(const path of ['/worker/api-proxy.js','/functions/_middleware.js','/.env','/docs/internal.md','/security/audit.sql','/package.json','/_headers','/scripts/main.js.map','/%77orker/index.js']){
  const response=await storefront.fetch(new Request('https://'+host+path),env,{});assert.equal(response.status,404,host+path);assert.equal(response.headers.get('Cache-Control'),'no-store');
 }
 for(const path of ['/scripts/security.js','/styles/store-responsive.css','/.well-known/security.txt','/assets/ozylix-logo.png'])assert.equal((await storefront.fetch(new Request('https://'+host+path),env,{})).status,200,path);
}
console.log('PASS: private deployment assets blocked on public/admin hosts; required storefront assets stay available');
