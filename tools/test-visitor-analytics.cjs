const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function setup(optout=false){
 let now=Date.now(),counter=0;const calls=[],storage=new Map(),intervals=[],events={};if(optout)storage.set('ozy_optout','1');
 const storageAPI={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const date=class extends Date {static now(){return now;}};
 const context={Date:date,Math,Promise,JSON,URLSearchParams,AbortSignal,crypto:{randomUUID:()=>`uuid-fixture-${++counter}`},localStorage:storageAPI,sessionStorage:storageAPI,navigator:{userAgent:'Mozilla/5.0 Chrome',maxTouchPoints:0},location:{pathname:'/',hostname:'www.ozylix.com',hash:'',search:''},screen:{width:390,height:850},matchMedia:()=>({matches:false}),document:{referrer:'https://www.google.com/?q=private',hidden:false,addEventListener:(e,fn)=>events['doc:'+e]=fn},setInterval:fn=>intervals.push(fn),setTimeout:fn=>fn(),fetch:async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body),headers:opts.headers});return{ok:true};},_trackViewItem(){return'original-result';},_trackAddToCart(){},_trackBeginCheckout(){},_trackSearch(){},showPage(name){context.location.pathname='/'+name;},addEventListener:(e,fn)=>events[e]=fn};
 context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../scripts/visitor-analytics.js'),'utf8'),context);
 const analytics=context.createOzylixAnalytics('https://backend.example.test');
 const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};await flush();
 return {context,calls,analytics,flush,intervals,events,storage,advance:n=>now+=n};
}
(async()=>{
 const factory=fs.readFileSync(path.join(__dirname,'../scripts/visitor-analytics.js'),'utf8');
 const core=fs.readFileSync(path.join(__dirname,'../scripts/auth-core.js'),'utf8');
 assert.ok(core.includes(factory),'embedded first-party factory matches its tested source');
 const t=await setup();assert.equal(t.calls[0].body.kind,'pageview');assert.ok(t.calls[0].body.view_id);assert.equal('email' in t.calls[0].body,false);
 await t.analytics.ping(false);assert.equal(t.calls[1].body.kind,'heartbeat');assert.equal(t.calls[1].body.view_id,null);
 t.context.showPage('shop');await t.flush();assert.equal(t.calls[2].body.kind,'pageview');assert.equal(t.calls[2].body.page,'/shop');
 t.context.showPage('shop');t.context.showPage('shop');await t.flush();assert.equal(t.calls.filter(c=>c.body.kind==='pageview').length,2,'same-page route calls cannot inflate views');
 assert.equal(t.context._trackViewItem({email:'must-not-send'}),'original-result');await t.flush();const e=t.calls.find(c=>c.body.event_name==='product_view');assert.ok(e);assert.equal('email' in e.body,false);assert.equal('props' in e.body,false);
 const old=t.analytics.sessionId;t.advance(1800001);const count=t.calls.length;t.intervals[0]();await t.flush();assert.equal(t.calls.length,count,'idle heartbeats do not collect');
 t.context.showPage('cart');await t.flush();assert.notEqual(t.analytics.sessionId,old,'30 minute idle visit rotates');
 t.analytics.convert('order-1',999999,'cashfree','verified-proof');await t.flush();const conversion=t.calls.find(c=>c.url.endsWith('/convert'));assert.ok(conversion);assert.equal('order_value' in conversion.body,false);assert.equal(conversion.headers['X-Payment-Session'],'verified-proof');
 t.storage.set('ozy_optout','1');const before=t.calls.length;t.context._trackSearch('private search');await t.analytics.ping(true);await t.flush();assert.equal(t.calls.length,before);
 const disabled=await setup(true);assert.equal(disabled.calls.length,0);assert.equal(disabled.analytics.status,'disabled');
 console.log('Visitor client checks passed: distinct heartbeats, duplicate routes, action hooks, privacy, session rotation, payment proof and opt-out.');
})().catch(e=>{console.error(e);process.exitCode=1;});
