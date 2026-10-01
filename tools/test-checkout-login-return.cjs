'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require.resolve('../scripts/auth-core.js'), 'utf8');
const slice = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const events = [];
const saved = new Map();
let signedIn = true;
const context = vm.createContext({
  Date, JSON, currentPage: 'checkout', currentProduct: null,
  sessionStorage: { setItem: (k, v) => saved.set(k, v) },
  getCurrentUser: () => signedIn ? { email: 'shopper@example.test' } : null,
  openProduct: id => events.push(['product', id]), refreshStickyCart() {},
  showPage: page => events.push(['page', page]),
  setTimeout: callback => callback(), openAuth: page => events.push(['auth', page]),
  autofillCheckoutFromGoogle() {},
  initiateCOD: () => events.push('cod'), initiatePayment: () => events.push('prepaid'),
  document: { getElementById: () => null },
});
vm.runInContext(slice('function resumeCheckoutAfterRedirect(', '// Called after a successful email-login'), context);
for (const page of ['product', 'checkout']) {
  for (const paymentMethod of ['cod', 'prepaid']) {
    events.length = 0;
    const state = { page, productId: page === 'product' ? 1 : null, intent: 'checkout_payment', paymentMethod };
    assert.equal(context.resumeCheckoutAfterRedirect(state), true);
    assert.ok(events.some(e => Array.isArray(e) && e[0] === 'page' && e[1] === 'checkout'));
    assert.ok(events.includes(paymentMethod));
    assert.ok(!events.includes(paymentMethod === 'cod' ? 'prepaid' : 'cod'));
  }
}
signedIn = false;
for (const paymentMethod of ['cod', 'prepaid']) {
  saved.clear(); events.length = 0;
  context.requireLoginForCheckout(() => {}, paymentMethod);
  const state = JSON.parse(saved.get('ozylix.login_return'));
  assert.equal(state.paymentMethod, paymentMethod);
  assert.equal(state.productId, null);
  context.resumeCheckoutAfterRedirect(state);
  assert.ok(!events.includes('cod') && !events.includes('prepaid'));
  assert.ok(events.some(e => e[0] === 'auth'));
}
events.length = 0;
assert.equal(context.resumeCheckoutAfterRedirect({ page: 'account', intent: 'checkout_payment', paymentMethod: 'cod' }), false);
assert.equal(context.resumeCheckoutAfterRedirect(null), false);
assert.deepEqual(events, []);
assert.ok(source.includes("requireLoginForCheckout(function(){ initiateCOD(); }, 'cod')"));
assert.ok(source.includes("requireLoginForCheckout(function(){ initiatePayment(); }, 'prepaid')"));
console.log('Checkout redirect: COD/prepaid selection, cart/product return and missing-session gate passed');
