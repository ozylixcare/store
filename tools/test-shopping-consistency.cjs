const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const auth = fs.readFileSync(path.join(root, 'scripts/auth-core.js'), 'utf8');
const utils = fs.readFileSync(path.join(root, 'scripts/cart-utils.js'), 'utf8');
const nodes = Object.fromEntries(['scProdName','scProdPrice','scQtyVal','pQtyDisp','stickyCart','addCartBtn'].map(id => [id, {textContent:'',style:{}}]));
const observers = [];
const cart = [];
const context = vm.createContext({
  document: {getElementById:id=>nodes[id], querySelectorAll:()=>[]},
  IntersectionObserver: class { constructor(cb){this.cb=cb;observers.push(this);} observe(el){this.el=el;} disconnect(){this.disconnected=true;} },
  requestAnimationFrame:fn=>fn(), setTimeout:()=>{},
  PRODUCTS:[{id:38,name:'Glutathione',price:699,stock:82,_backendTiers:[{tabs:90,rate:2097,mrp:4194},{tabs:60,rate:1398,mrp:2796},{tabs:30,rate:1048,mrp:1398}]}],
  selectedTiers:{},pQty:1,currentPage:'product',
  STORE:{cart,save(){},addToCart(id,qty){cart.push({id,qty});}},
  showToast(){},showPtsToast(){},openSideCart(){},
});
vm.runInContext(auth.slice(auth.indexOf('function getProductTiers('),auth.indexOf('// "₹51.55"')),context);
vm.runInContext(auth.slice(auth.indexOf('function addToCartWithTier('),auth.indexOf('// ── 10-Media Gallery')),context);
vm.runInContext(auth.slice(auth.indexOf('let stickyQty='),auth.indexOf('// Nothing is earned by adding')),context);
context.initStickyCart(context.PRODUCTS[0]);
assert.equal(nodes.scProdPrice.textContent,'₹2,097','initial sticky price matches default 90-tab tier');
assert.match(nodes.scProdName.textContent,/90 tablets/);
context.selectedTiers[38]=2;context.refreshStickyCart();
assert.equal(nodes.scProdPrice.textContent,'₹1,048');
context.scQtyChange(2);context.scAddToCart();
assert.equal(cart[0].qty,3,'sticky quantity applies to bundles');
assert.equal(cart[0].tierTabs,30);assert.equal(cart[0].tierRate,1048);
context.addToCartWithTier(38,2);assert.equal(cart[0].qty,5,'existing tier lines accumulate quantity');
context.selectedTiers[38]=99;context.initStickyCart(context.PRODUCTS[0],true);
assert.equal(nodes.scProdPrice.textContent,'₹2,097','invalid persisted tier falls back like the main price');
assert.equal(nodes.scQtyVal.textContent,3,'review rebuild retains quantity');
assert.equal(observers[0].disconnected,true,'old purchase observer is released');
context.selectedTiers[38]=1;context.initStickyCart(context.PRODUCTS[0]);
assert.equal(nodes.scProdPrice.textContent,'₹1,398','saved tier initializes correctly on revisit');
assert.equal(nodes.scQtyVal.textContent,1);
context.PRODUCTS[0]._backendTiers=null;context.initStickyCart(context.PRODUCTS[0]);
assert.equal(nodes.scProdPrice.textContent,'₹699','untiered price remains supported');
context.scQtyChange(1);context.scAddToCart();assert.equal(cart.at(-1).qty,2);

const delivery = vm.createContext({document:{querySelectorAll:()=>[],dispatchEvent(){}},CustomEvent:class{},updateCodBtnNote(){}});
vm.runInContext(utils.slice(utils.indexOf('var SHIP_THRESHOLD'),utils.indexOf('function loadDeliveryPolicy')),delivery);
assert.equal(delivery.calcShipping(998,'prepaid'),69);assert.equal(delivery.calcShipping(999,'prepaid'),0);
assert.equal(delivery.calcShipping(2097,'cod'),69);
assert.match(delivery.deliveryCopy('short'),/₹999/);
delivery.applyDeliveryPolicy({shipping_fee:49,free_shipping_threshold:499,cod_enabled:true,cod_shipping_fee:79});
assert.match(delivery.deliveryCopy('short'),/₹499/);
assert.match(delivery.deliveryCopy('policy'),/₹49.*₹499.*COD delivery costs ₹79/);
delivery.applyDeliveryPolicy({shipping_mode:'free',cod_enabled:false});
assert.equal(delivery.calcShipping(100,'prepaid'),0);
assert.equal(delivery.deliveryCopy('short'),'Free prepaid delivery');
assert.doesNotMatch(delivery.deliveryCopy('policy'),/COD/);

const prompt = vm.createContext({currentPage:'product',Notification:{},ozylixNotifyPref:()=>'',document:{querySelector:()=>null,getElementById:()=>null,createElement(){throw Error('prompt should be blocked');}}});
vm.runInContext(auth.slice(auth.indexOf('function ozylixTransactional('),auth.indexOf('async function ozylixBrowserReminder')),prompt);
for (const page of ['product','cart','checkout','account','login','thankyou','shop']) {prompt.currentPage=page;prompt.showOzylixConsentBar();}
const store = fs.readFileSync(path.join(root,'scripts/store-core.js'),'utf8');
assert.ok(!store.includes("sessionStorage.getItem('wa_shown')"),'support no longer opens on a timer');
assert.ok(store.includes("['product', 'cart', 'checkout', 'thankyou', 'account', 'login']"));
for (const entry of fs.readdirSync(root,{recursive:true}).filter(p=>p==='index.html'||p.endsWith('/index.html'))) {
  const html=fs.readFileSync(path.join(root,entry),'utf8');
  if (!html.includes('id="page-shipping"')) continue;
  assert.ok(html.includes('data-delivery-copy="policy"'),entry);
  assert.ok(html.includes('/styles/store-refinements.css'),entry);
  assert.ok(!html.includes('an online brand of Ozylix'),entry);
  const aiMeta=html.match(/<meta name="ai-description"[^\n]*/)?.[0];
  assert.ok(aiMeta && /^<meta name="ai-description" content="[^"<>]*">$/.test(aiMeta),entry+' metadata must remain a plain-text attribute');
  for(const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(match[1]);
}
console.log('PASS: pack price initialization/revisit, quantity, observer cleanup, live delivery policy, purchase-page prompt blocking, route shells and structured data');
