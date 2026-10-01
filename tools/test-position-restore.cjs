const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(path.join(__dirname,'../scripts/checkout-draft.js'),'utf8');
function run({interact=false,pathname='/',bfcache=false}={}){
 const handlers={},timers=[],calls=[];
 const state={page:'product',productId:1,scroll:200,at:Date.now()};
 const ctx={URLSearchParams,Date,console,STORE:{cart:[]},location:{pathname,search:'',hash:''},localStorage:{getItem:()=>JSON.stringify(state),setItem(){},removeItem(){}},setTimeout:f=>{timers.push(f);},document:{readyState:'loading',addEventListener:(k,f)=>{(handlers['doc:'+k]??=[]).push(f);},querySelector:()=>null,getElementById:()=>null},showPage:p=>calls.push(['page',p]),openProduct:p=>calls.push(['product',p])};
 ctx.window={location:ctx.location,showPage:ctx.showPage,addEventListener:(k,f)=>{(handlers[k]??=[]).push(f);},scrollTo:p=>calls.push(['scroll',p.top])};
 vm.runInNewContext(code,ctx);
 for(const f of handlers['doc:DOMContentLoaded']||[])f();
 if(interact)for(const f of handlers.pointerdown||[])f();
 if(bfcache)for(const f of handlers.pageshow||[])f({persisted:true});
 let count=0;while(timers.length){assert.ok(++count<30);timers.shift()();}
 return calls;
}
assert.equal(run().filter(x=>x[0]==='product').length,1);
assert.deepEqual(run({interact:true}),[]);
assert.deepEqual(run({pathname:'/product/another-product'}),[]);
assert.deepEqual(run({bfcache:true}),[]);
console.log('PASS: restore once, preserve explicit product links, cancel on interaction, leave bfcache untouched');
