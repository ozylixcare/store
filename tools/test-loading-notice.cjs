const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
function setup(){
 const timers=new Map(),events={},requests=[],classes=new Set();let clock=0,id=0;
 const net={className:'',textContent:'',setAttribute(){},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(){}}};
 const context={URL,Set,API_BASE:'',location:{href:'https://www.ozylix.com/product/bone-health'},navigator:{onLine:true},document:{body:{appendChild(){ }},createElement:()=>net,querySelectorAll:()=>[],addEventListener(){ }},matchMedia:()=>({matches:false}),MutationObserver:class{observe(){}},requestAnimationFrame(){},setInterval(){},setTimeout(fn,delay){timers.set(++id,{fn,at:clock+delay});return id;},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>events[name]=fn,fetch:(...args)=>new Promise((resolve,reject)=>requests.push({resolve,reject,args}))};
 context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../scripts/account-welcome.js'),'utf8'),context);
 function advance(ms){const end=clock+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;clock=next[1].at;timers.delete(next[0]);next[1].fn();}clock=end;}
 return {context,net,classes,advance,requests,events};
}
(async()=>{
 const background=setup();
 for(const [url,init] of [['/api/products'],['/api/orders/my'],['/telemetry/api/track',{method:'POST'}],['https://other.example/api/orders',{method:'POST'}]])background.context.fetch(url,init);
 background.advance(30000);assert.equal(background.classes.has('show'),false,'background and external requests never warn');
 const slow=setup(),request=slow.context.fetch('/api/orders',{method:'POST'});slow.advance(7000);assert.equal(slow.classes.has('show'),true);
 slow.advance(8000);assert.equal(slow.classes.has('show'),false,'slow notice expires even if fetch hangs');slow.requests[0].resolve({ok:true});await request;
 const overlapping=setup(),a=overlapping.context.fetch('/api/orders',{method:'POST'}),b=overlapping.context.fetch('/api/reviews',{method:'POST'});
 overlapping.advance(7000);overlapping.requests[0].resolve({ok:true});await a;assert.equal(overlapping.classes.has('show'),true);
 overlapping.requests[1].resolve({ok:true});await b;assert.equal(overlapping.classes.has('show'),false);
 const offline=setup(),p=offline.context.fetch('/api/orders',{method:'POST'});offline.context.navigator.onLine=false;offline.events.offline();offline.advance(7000);assert.equal(offline.net.textContent,'No internet connection');
 offline.requests[0].resolve({ok:true});await p;assert.equal(offline.classes.has('show'),true,'completion preserves offline notice');
 console.log('PASS loading notices: background exclusion, bounded duration, concurrent actions and offline status');
})().catch(e=>{console.error(e);process.exitCode=1;});
