import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const listeners={}, writes=[], opened=[], deleted=[];
const cache={put:async(req,res)=>{writes.push([req.url,await res.text()]);}};
let cached;
let net=async()=>new Response('public');
const context=vm.createContext({URL,Response,console,fetch:(...args)=>net(...args),clients:{openWindow:async url=>opened.push(url)},
  self:{location:{origin:'https://www.ozylix.com'},addEventListener:(type,fn)=>listeners[type]=fn,clients:{claim:async()=>{}},skipWaiting(){}},
  caches:{open:async()=>cache,match:async()=>cached?.clone(),keys:async()=>['ozylix-pwa-v29','another-app'],delete:async k=>deleted.push(k)}});
vm.runInContext(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),context);
function dispatch(path,headers={},destination='document'){
  const tasks=[];let response;
  listeners.fetch({request:{url:'https://www.ozylix.com'+path,method:'GET',headers:new Headers(headers),mode:destination==='document'?'navigate':'cors',destination},waitUntil:p=>tasks.push(p),respondWith:p=>response=p});
  return{get response(){return response;},tasks};
}
for(const path of ['/api/orders/my','/account','/checkout','/orders/123','/admin.html','/cdn-storage/ozylix%20store/a.mp4'])assert.equal(dispatch(path).response,undefined,path);
assert.equal(dispatch('/shop',{Authorization:'Bearer session'}).response,undefined);
for(const cc of ['no-store','private, max-age=60']){net=async()=>new Response('private',{headers:{'Cache-Control':cc}});const e=dispatch('/shop');await e.response;await Promise.all(e.tasks);assert.equal(writes.length,0);}
net=async()=>new Response('public',{headers:{'Cache-Control':'public, max-age=30'}});const e=dispatch('/shop');assert.equal(await(await e.response).text(),'public');await Promise.all(e.tasks);assert.equal(writes.length,0);
net=async()=>{throw Error('offline');};const offline=dispatch('/shop');assert.equal((await offline.response).status,503);
const tasks=[];listeners.activate({waitUntil:p=>tasks.push(p)});await Promise.all(tasks);assert.deepEqual(deleted,['ozylix-pwa-v29']);
for(const url of ['https://evil.example/','javascript:alert(1)','/product/spirulina']){const tasks=[];listeners.notificationclick({notification:{data:{url},close(){}},waitUntil:p=>tasks.push(p)});await Promise.all(tasks);}
assert.deepEqual(opened,['https://www.ozylix.com/','https://www.ozylix.com/','https://www.ozylix.com/product/spirulina']);
console.log('Service worker checks passed: private/API/media bypass, cache directives, offline fallback, isolated cleanup and notification URLs');


// A stale script is never served, including old immutable browser responses.
cached = new Response('old script');
let policy;
net = async (request, options) => { policy = options.cache; return new Response('new script'); };
for (const [path, destination] of [['/scripts/auth-core.min.js?v=old','script'],['/styles/store-main.min.css','style']]) {
  const event = dispatch(path, {}, destination);
  assert.equal(await (await event.response).text(), 'new script');
  assert.equal(policy, 'no-cache');
}
net = async () => { throw Error('offline'); };
assert.equal((await dispatch('/scripts/auth-core.min.js', {}, 'script').response).type, 'error');
console.log('Release freshness checks passed: old code is not served on network failure');
