'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('scripts/img-hydrator.js','utf8');
let handler,timers=[];
vm.runInNewContext(source.slice(source.indexOf('(function installImageRecovery()')),{
 WeakMap,document:{addEventListener(type,fn,capture){assert.equal(type,'error');assert.equal(capture,true);handler=fn;}},setTimeout(fn,delay){timers.push({fn,delay});}
});
function image(src){return{tagName:'IMG',src,isConnected:true,getAttribute(){return this.src;}};}
const img=image('/cdn-storage/ozylix%20store/product.webp');
for(let i=1;i<=2;i++){
 handler({target:img});assert.equal(timers.length,1);assert.equal(timers[0].delay,i*1500);
 img.src='data:image/svg+xml,placeholder';timers.shift().fn();assert.equal(img.src,'/cdn-storage/ozylix%20store/product.webp');
}
handler({target:img});assert.equal(timers.length,0,'bounded retries');
const changed=image('/old.webp');handler({target:changed});changed.src='/new.webp';timers.shift().fn();assert.equal(changed.src,'/new.webp');
const removed=image('/removed.webp');handler({target:removed});removed.src='data:image/svg+xml,fallback';removed.isConnected=false;timers.shift().fn();assert.equal(removed.src,'data:image/svg+xml,fallback');
for(const source of ['data:image/svg+xml,fallback','blob:example','','javascript:bad'])handler({target:image(source)});
handler({target:{tagName:'VIDEO'}});assert.equal(timers.length,0);
console.log('Image recovery checks passed: capture before fallback, two retries, delay bounds, replaced/disconnected images and non-network sources');
