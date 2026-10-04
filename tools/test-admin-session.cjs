const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/../scripts/admin-core.js','utf8');
const fn=source.slice(source.indexOf('async function apiFetch('),source.indexOf('// ═══════════════════════════════════════════════\n// OPTIMISTIC',source.indexOf('async function apiFetch(')));
(async()=>{
 let calls=0,logouts=0;const storage=new Map();const ctx=vm.createContext({authToken:'old',API:'https://backend-s7ih.onrender.com',Response,AbortSignal,setTimeout,window:{},sessionStorage:{getItem:k=>storage.get(k)},localStorage:{getItem:()=>null,setItem(){}},tokenIsExpired:()=>false,doLogout:()=>{ctx.authToken='';logouts++},showLogoutReason(){},fetch:async()=>{calls++;return new Response(JSON.stringify({reason:'invalid-signature'}),{status:401,headers:{'content-type':'application/json'}})}});
 vm.runInContext(fn,ctx);await assert.rejects(ctx.apiFetch('/api/admin/me'));assert.equal(logouts,1);assert.equal(calls,1);await assert.rejects(ctx.apiFetch('/api/admin/stats'));assert.equal(calls,1);
 ctx.authToken='old';storage.set('ozylix_token','new');ctx.fetch=async(u,o)=>{calls++;if(o.headers.Authorization==='Bearer new')return new Response('{"role":"owner"}',{headers:{'content-type':'application/json'}});return new Response('{}',{status:401})};assert.equal((await (await ctx.apiFetch('/api/admin/me')).json()).role,'owner');assert.equal(logouts,1);
 assert.match(source,/if \(authToken\) startVerifiedAdminSession\(\)/);assert.doesNotMatch(fs.readFileSync(__dirname+'/../admin.html','utf8'),/frame-ancestors|frame-src[^;]*about:blank/);assert.match(fs.readFileSync(__dirname+'/../worker/index.js','utf8'),/frame-ancestors 'none'/);
 console.log('PASS: rejection logs out once, empty-token calls blocked, replacement token recovered, bootstrap verified, frame protection retained in headers');
})().catch(e=>{console.error(e);process.exitCode=1});
