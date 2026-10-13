import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(file, {optedOut=false,storageFails=false,calls=[]}={}) {
  const visit=new Map(); let uuid=0; let optout=optedOut;
  const context={
    location:{pathname:'/product/private-name',search:'?email=private@example.test'},
    localStorage:{getItem:()=>optout?'1':null,setItem:(key,value)=>{if(key==='ozy_optout')optout=value==='1';}},
    sessionStorage:{getItem(key){if(storageFails)throw new Error('blocked');return visit.get(key);},setItem:(key,value)=>visit.set(key,value)},
    crypto:{randomUUID:()=> 'fixture-random-'+(++uuid)},matchMedia:()=>({matches:true}),document:{readyState:'complete'},
    fetch:(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});return Promise.resolve();},
    PRODUCTS:[{id:7,name:'private product name',price:123}],
    STORE:{cart:[],save(){return 'saved';}},
    showPage:()=> 'page-result',
    _trackViewItem:()=> 'product-result',
    _trackAddToCart(product,qty){context.STORE.cart=[{id:product.id,qty}];context.STORE.save();return 'cart-result';},
    _trackBeginCheckout:()=> 'checkout-result',_trackPurchase:()=> 'purchase-result',
  };
  context.openProduct=id=>{context._trackViewItem(context.PRODUCTS.find(p=>p.id===id));return 'product-result';};
  context.window=context;
  vm.runInNewContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),context);
  return {context,calls};
}
for (const file of ['../scripts/ozy-track.js','../scripts/ozy-track.min.js']) {
  const {context,calls}=load(file);
  assert.equal(calls.length,1);
  const initial=calls[0];
  assert.equal(initial.url,'/telemetry/api/track');
  assert.equal(initial.options.credentials,'omit');
  assert.equal(initial.body.anon_id,initial.body.session_id);
  assert.ok(initial.body.anon_id);
  assert.equal(initial.body.events[0].event_name,'homepage_viewed');
  assert.equal(initial.body.events[0].page,'/product');
  assert.equal(context.showPage('shop'),'page-result');
  assert.equal(context.openProduct(7),'product-result');
  assert.equal(calls.at(-1).body.events[0].product_id,'7');
  const beforeView=calls.length;
  context.openProduct(7);
  assert.equal(calls.length,beforeView+1,'successful product hook avoids duplicate openProduct events');
  assert.equal(context._trackAddToCart({id:7,email:'private@example.test',name:'private name'},2),'cart-result');
  assert.equal(calls.at(-1).body.events[0].event_name,'product_added_to_cart');
  assert.equal(calls.at(-2).body.events[0].event_name,'cart_snapshot');
  assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-2).body.events[0].cart_summary)),{item_count:2,total_value:246});
  const beforeSave=calls.length;
  assert.equal(context.STORE.save(),'saved');
  assert.equal(calls.length,beforeSave,'unchanged saves emit no duplicate snapshot');
  context.STORE.cart[0].qty=3;
  context.STORE.save();
  assert.equal(calls.at(-1).body.events[0].cart_summary.total_value,369);
  assert.equal(context._trackBeginCheckout([{email:'private@example.test'}],369),'checkout-result');
  assert.equal(calls.at(-1).body.events[0].event_name,'checkout_started');
  assert.equal(calls.at(-1).body.events[0].cart_summary.item_count,3);
  context.STORE.cart=[];context.STORE.save();
  assert.equal(calls.at(-1).body.events[0].cart_summary.item_count,0);
  assert.equal(context._trackPurchase('private-order',369,[{name:'private health item'}]),'purchase-result');
  assert.equal(calls.at(-1).body.events[0].event_name,'purchase_completed');
  assert.equal(calls.at(-1).body.events[0].cart_summary.item_count,3,'completion retains the pre-clear summary');
  assert.equal(new Set(calls.map(c=>c.body.events[0].event_id)).size,calls.length);
  assert.ok(!JSON.stringify(calls).includes('private'),'no contacts, product names, order references, cart item lists or query strings');
  const before=calls.length;
  context.ozyTrack.track('unsupported_event');context.ozyTrack.identify('private@example.test');
  assert.equal(calls.length,before);
  context.ozyTrack.setOptOut(true);context.STORE.cart=[{id:7,qty:2}];context.STORE.save();context.showPage('home');
  assert.equal(calls.length,before,'opt-out covers both navigation and cart saves');
  assert.equal(load(file,{optedOut:true}).calls.length,0);
  assert.equal(load(file,{storageFails:true}).calls.length,0);
  const broken=load(file);broken.context.fetch=()=>{throw new Error('network failed');};
  assert.equal(broken.context._trackAddToCart({id:7},1),'cart-result','tracking failures do not break shopping callbacks');
}
console.log('PASS: shipped/source anonymous envelope, public catalogue IDs, count/total-only carts, canonical purchase, callback results, unique events, no PII and opt-out');
