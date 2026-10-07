const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const core = fs.readFileSync(__dirname + '/../scripts/store-core.js', 'utf8');
const auth = fs.readFileSync(__dirname + '/../scripts/auth-core.js', 'utf8');
const between = (s, a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));
const elements = {};
const ctx = vm.createContext({ console, PRODUCTS: [
  {id:14,name:'Active',price:100,category:'wellness',active:true},
  {id:3,name:'Inactive',price:100,category:'wellness',active:false},
  {id:10,name:'Hidden',price:100,category:'wellness',_hidden:true},
  {id:21,name:'Deleted',price:100,category:'wellness',deleted_at:'2026-01-01'}
], document:{getElementById:id=>elements[id] || null},STORE:{cart:[],addToCart(id){this.cart.push({id})}},
esc:String,getProductSurfaceImg:()=>'',updateSaleUIVisibility(){},syncProductStructuredData(){},
openSideCart(){},showPtsToast(){},showToast(){},VITA_MATCH_EXCLUDE:{},VITA_MATCH_RULES:{goal:[{any:['wellness'],w:1}]},vmHas:()=>true });
vm.runInContext(between(core,'function isStoreProductActive','// ═══════════════════════════════════════════════════════════════════\n// STRUCTURED DATA'),ctx);
vm.runInContext(between(auth,'const UPSELL_SUGGESTIONS','/* ── COMPETITOR FEATURES'),ctx);
vm.runInContext(between(auth,'var bundleQty = {}','let stickyQty='),ctx);
vm.runInContext(between(auth,'function vitaMatchScore','function vitaMatchInit'),ctx);
elements.bundleProdList={innerHTML:''}; elements.upsellBar={style:{}}; elements.upsellItems={innerHTML:''};
ctx.renderBundleBuilder();assert.match(elements.bundleProdList.innerHTML,/Active/);assert.doesNotMatch(elements.bundleProdList.innerHTML,/Inactive|Hidden|Deleted/);
ctx.renderUpsells();assert.match(elements.upsellItems.innerHTML,/Vitamin C/);assert.doesNotMatch(elements.upsellItems.innerHTML,/Biotin|Spirulina|L-Lysine/);
assert.deepEqual(Array.from(ctx.vitaMatchScore({x:'goal'}), x=>x.p.id),[14]);
ctx.bundleQtySet(3,2);assert.equal(ctx.bundleQty[3],undefined);
ctx.bundleQtySet(14,2);assert.equal(ctx.bundleQty[14],2);
ctx.mergeBackendProducts([], {fullSnapshot:true});ctx.updateBundleSummary();ctx.renderBundleBuilder();
assert.equal(ctx.bundleQty[14],undefined);assert.equal(elements.bundleProdList.innerHTML,'');
ctx.addBundleToCart();assert.equal(ctx.STORE.cart.length,0);
ctx.mergeBackendProducts([{id:14,name:'Active',active:true,price:100}], {fullSnapshot:true});ctx.renderBundleBuilder();
assert.match(elements.bundleProdList.innerHTML,/Active/);assert.deepEqual(Array.from(ctx.vitaMatchScore({x:'goal'}),x=>x.p.id),[14]);
console.log('PASS shop visibility in bundles/upsells/adviser, stale selection cleanup, deactivation and reactivation');
