const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'content/faq.json')));
assert.equal(new Set(data.map(f => f.q)).size, data.length);
assert.ok(data.length >= 25);
const source = fs.readFileSync(path.join(root,'scripts/auth-core.js'),'utf8');
const literal = source.slice(source.indexOf('const FAQS = '),source.indexOf('// ── APP STATE'));
const context = {};vm.runInNewContext(literal+'\nthis.data=FAQS;',context);
assert.deepEqual(JSON.parse(JSON.stringify(context.data)),data);
function shells(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()&&!e.name.startsWith('.')?shells(path.join(dir,e.name)):e.isFile()&&e.name.endsWith('.html')?[path.join(dir,e.name)]:[]);}
let count=0;
for(const file of shells(root)){
 const html=fs.readFileSync(file,'utf8');if(!html.includes('id="page-shop"'))continue;count++;
 assert.ok(!html.includes('class="shop-seo"'),file);
 const visible=[...html.matchAll(/<details class="faq-detail"><summary>(.*?)<\/summary>/g)];assert.equal(visible.length,data.length,file);
 const schemas=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].flatMap(m=>{const j=JSON.parse(m[1]);return Array.isArray(j)?j:[j]});
 const faq=schemas.filter(n=>n['@type']==='FAQPage');
 if(file===path.join(root,'faq/index.html')){
  assert.equal(faq.length,1);assert.deepEqual(faq[0].mainEntity.map(n=>[n.name,n.acceptedAnswer.text]),data.map(f=>[f.q,f.a]));
  assert.ok(html.includes('class="page active" id="page-faq"'));assert.ok(html.includes('<link rel="canonical" href="https://www.ozylix.com/faq"'));
 }else assert.equal(faq.length,0,file);
}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets.manifest.json')));
for(const file of ['scripts/auth-core.js','scripts/seo-core.js'])assert.equal(manifest[file],crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex').slice(0,16));
console.log(`PASS: ${data.length} matching FAQ answers, ${count} clean route shells, page-specific schema, no-JS FAQ and source hashes`);
