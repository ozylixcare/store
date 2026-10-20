import assert from 'node:assert/strict';
import fs from 'node:fs';
import storefront from '../worker/index.js';
const html = fs.readFileSync(new URL('../faq/index.html', import.meta.url),'utf8');
const paths=[];
const env={ASSETS:{fetch:async input=>{const path=new URL(input.url||input).pathname;paths.push(path);return new Response(path==='/faq/'?html:'Home shell',{headers:{'Content-Type':'text/html'}});}}};
for(const path of ['/faq','/faq/']){
 paths.length=0;
 const response=await storefront.fetch(new Request('https://www.ozylix.com'+path),env,{});
 assert.equal(response.status,200);assert.deepEqual(paths,['/faq/']);const text=await response.text();assert.ok(text.includes('id="ozylix-faq-schema"'));assert.ok(text.includes('Who manufactures Ozylix supplements?'));
}
console.log('PASS: FAQ routes serve prerendered FAQ content instead of the home shell');
