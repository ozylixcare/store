import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Exercise the actual recovery method, including its generated production sibling.
for (const file of ['store-core.js', 'store-core.min.js']) {
  const source = fs.readFileSync(new URL('../scripts/' + file, import.meta.url), 'utf8');
  const start = source.indexOf('normalizeCartTiers(){');
  const end = source.indexOf('updateQty(', start);
  assert.ok(start >= 0 && end > start);
  const products = [{id:34, tiers:[{rate:748,mrp:998,tabs:30},{rate:1497,mrp:2994,tabs:90}]}];
  const context = vm.createContext({PRODUCTS:products,getProductTiers:p=>p?.tiers});
  vm.runInContext('this.store = {' + source.slice(start,end) + 'save(){this.saved=true}}',context);
  const store = context.store;
  store.cart = [{id:34,qty:1,tierIdx:1,tierRate:1200},{id:34,qty:2},{id:999,qty:1,tierIdx:2,tierRate:42},{id:34,qty:1,isCustomPack:true,tierRate:500}];
  store.normalizeCartTiers();
  assert.equal(store.cart[0].tierIdx,1);
  assert.equal(store.cart[0].tierRate,1497);
  assert.equal(store.cart[0].tierTabs,90);
  assert.equal(store.cart[1].tierRate,748);
  assert.equal(store.cart[2].tierRate,42);
  assert.equal(store.cart[3].tierRate,500);
  assert.equal(store.saved,true);
  store.saved=false;
  store.normalizeCartTiers();
  assert.equal(store.saved,false);
  console.log(file + ': saved cart recovery and repeat normalization passed');
}
