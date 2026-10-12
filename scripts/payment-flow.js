// Checkout orchestration loads on checkout entry or payment return.
(()=>{
function initiatePayment() {
  if (DELIVERY_POLICY && DELIVERY_POLICY.store_online === false) {
    showToast('The store is temporarily unavailable for new orders. Please try again shortly.', 'error');
    return;
  }
  if (STORE.cart.length === 0) { showToast('🛒 Your cart is empty!', 'error'); return; }
  // 2026-08: never open a payment session for a PIN Delhivery cannot serve —
  // a courier failure discovered AFTER payment is India's #1 frustration.
  // Only blocks when the pin has actually been checked and failed; an unchecked
  // pin is tolerated (the server will re-check before creating the shipment).
  const pinEl = document.getElementById('ckPinInput');
  const clean = (pinEl?.value || '').replace(/\D/g, '');
  if (clean.length === 6) {
    const cached = window.__pinCache && window.__pinCache[clean];
    if (cached && !cached.serviceable) {
      showToast('⚠️ We cannot deliver to PIN ' + clean + '. Please change the delivery address first.', 'error');
      pinEl.focus();
      return;
    }
  }
  // LOGIN GATE: orders can only be placed by signed-in customers.
  if (!getCurrentUser()) { requireLoginForCheckout(function(){ initiatePayment(); }, 'prepaid'); return; }
  const formData = validateCheckoutForm();
  if (!formData) return;

  const { sub, disc, mixMatchDiscount, paidSubtotal, vitaOff } = getOrderTotal();
  const ship  = calcShipping(paidSubtotal);
  const total = Math.max(0, paidSubtotal + ship - vitaOff);
  const displayedDiscount = disc + mixMatchDiscount;

  const orderId = generateOrderId();
  const btn = document.getElementById('onlinePayBtn') || document.querySelector('#page-checkout .checkout-btn');
  const origText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Opening Secure Checkout...'; }

  // 2026-08: the compact gateway row lets the customer pick Cashfree or
  // GoKwik before paying — send each to its own processor. COD bypasses
  // the online modal entirely.
  const gw = getSelectedGateway();
  if (gw === 'cod') {
    initiateCOD();
    if (btn) { btn.disabled = false; btn.textContent = origText || '💳 Pay Online'; }
    return;
  }
  openPaymentGateway(orderId, total, sub, displayedDiscount, ship, formData, btn, origText, gw);
}

// ══════════════════════════════════════════════
// PAYMENT MODAL — GoKwik only
// ══════════════════════════════════════════════
function openPaymentGateway(orderId, total, sub, disc, ship, formData, btn, origText, gateway) {
  gateway = gateway === 'cashfree' ? 'cashfree' : 'gokwik';
  window._pendingPayment = { orderId, total, sub, disc, ship, formData, gateway };
  document.getElementById('cfPayModal')?.remove();

  const cartItems = STORE.cart.map(item => {
    const p = PRODUCTS.find(p => p.id === item.id);
    if (!p) return '';
    const price = item.tierRate !== undefined ? item.tierRate : (p.salePrice || p.price);
    const pack = item.tierTabs ? ` (${item.tierTabs} tabs)` : '';
    return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--st-muted-bg);font-size:.82rem">
      <span style="color:var(--t-mid)">${p.name}${pack} × ${item.qty}</span>
      <span style="font-weight:700;color:var(--f-mineral-d)">₹${(price * item.qty).toLocaleString('en-IN')}</span>
    </div>`;
  }).join('');

  const discHtml = disc > 0
    ? `<div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--f-mineral-d);margin-bottom:4px">
        <span>Discount</span><span>-₹${disc.toLocaleString('en-IN')}</span>
       </div>` : '';

  const modal = document.createElement('div');
  modal.id = 'cfPayModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';

  modal.innerHTML = `
    <div style="background:var(--sub-1);border-radius:20px;width:100%;max-width:420px;max-height:94vh;overflow-y:auto;box-shadow:0 25px 80px rgba(0,0,0,0.45)">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,var(--f-mineral-d),var(--f-mineral));padding:20px 24px;border-radius:20px 20px 0 0;color:var(--t-hi);display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:1.05rem;font-weight:800">🔒 Secure Checkout</div>
          <div style="font-size:.68rem;opacity:.8;margin-top:2px">PCI DSS Secured · 256-bit SSL</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.8rem;font-weight:900">₹${total.toLocaleString('en-IN')}</div>
          <div style="font-size:.62rem;opacity:.75">Total payable</div>
        </div>
      </div>
      <div style="padding:20px 22px">
        <!-- Order Summary -->
        <div style="background:var(--sub-1);border:1px solid var(--t-low);border-radius:12px;padding:14px;margin-bottom:16px">
          <div style="font-weight:700;font-size:.75rem;color:var(--f-mineral-d);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">📦 Order · ${orderId}</div>
          ${cartItems}
          <div style="margin-top:10px;padding-top:8px;border-top:1.5px solid var(--t-low)">
            <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--t-low);margin-bottom:3px"><span>Subtotal</span><span>₹${sub.toLocaleString('en-IN')}</span></div>
            ${discHtml}
            <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--t-low);margin-bottom:6px"><span>Shipping</span><span style="color:${ship===0?'var(--f-mineral-d)':'var(--t-hi)'}">${ship===0?'FREE':'₹'+ship}</span></div>
            <div style="display:flex;justify-content:space-between;font-weight:800;font-size:.95rem;color:var(--f-mineral-d)"><span>Total</span><span>₹${total.toLocaleString('en-IN')}</span></div>
          </div>
        </div>
        <!-- Delivery Info -->
        <div style="background:var(--st-muted-bg);border-radius:10px;padding:11px 14px;margin-bottom:16px;font-size:.78rem;color:var(--t-mid);line-height:1.6">
          <span style="font-weight:700;color:var(--t-mid)">👤 Ship to: </span>
          ${formData.firstName} ${formData.lastName} · ${formData.phone}<br>
          ${formData.addr1}, ${formData.city}, ${formData.state} – ${formData.pin}<br>
          <span style="color:var(--f-mineral-d)">✉ ${formData.email}</span>
        </div>
        <!-- Single Secure Pay Button (2026-08: one confident button per
             picked gateway — Cashfree or GoKwik, both kept visible in the
             compact selector above so the customer knows their choice) -->
        <button class="cfPayBtn ${gateway === 'cashfree' ? 'cashfree-pay-btn' : 'gk-pay-btn'}" onclick="startPayment('${gateway}')"
          style="width:100%;background:var(--face-warm);color:var(--st-danger-fg);box-shadow:inset 0 0 0 1.5px rgba(192,48,74,.34);border:none;border-radius:14px;padding:18px 20px;font-size:.95rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:14px;margin-bottom:10px;transition:opacity .15s">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;background:rgba(255,255,255,0.18);border-radius:10px;flex-shrink:0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </span>
          <div style="flex:1;text-align:left">
            <div style="font-size:1rem;font-weight:800">Pay ₹${total.toLocaleString('en-IN')} via ${gateway === 'cashfree' ? 'Cashfree' : 'GoKwik'}</div>
            <div style="font-size:.7rem;opacity:.85;margin-top:2px">UPI · GPay · PhonePe · BHIM · Card · Net Banking · EMI</div>
          </div>
          <span style="background:rgba(255,255,255,.22);padding:4px 10px;border-radius:100px;font-size:.6rem;font-weight:800;letter-spacing:.5px">SECURE →</span>
        </button>
        <!-- Trust Badges -->
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:14px;flex-wrap:wrap">
          <span style="font-size:.67rem;color:var(--t-low)">🔒 256-bit SSL</span>
          <span style="font-size:.67rem;color:var(--t-low)">✅ PCI DSS</span>
          <span style="font-size:.67rem;color:var(--t-low)">🛡️ ${gateway === 'cashfree' ? 'Cashfree' : 'GoKwik'} Secured</span>
        </div>
        <!-- Cancel -->
        <button onclick="closePaymentModal()" style="width:100%;background:var(--st-muted-bg);color:var(--t-low);border:none;border-radius:10px;padding:11px;font-size:.82rem;cursor:pointer">
          ✕ Cancel &amp; Go Back
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  if (btn) { btn.disabled = false; btn.textContent = origText || '💳 Pay Online'; }
}

function closePaymentModal() { document.getElementById('cfPayModal')?.remove(); }

// ══════════════════════════════════════════════
// startPayment — routes to GoKwik
// ══════════════════════════════════════════════
async function startPayment(method) {
  const pd = window._pendingPayment;
  if (!pd) { showToast('Payment session expired. Please try again.', 'error'); closePaymentModal(); return; }
  const { orderId, total, formData } = pd;
  const btn = document.getElementById('onlinePayBtn') || document.querySelector('#page-checkout .checkout-btn');
  const origText = btn ? btn.textContent : '💳 Pay Online';
  document.querySelectorAll('.cfPayBtn').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
  const activeBtn = method === 'cashfree'
    ? document.querySelector('.cashfree-pay-btn')
    : document.querySelector('.gk-pay-btn');
  const gatewayLabel = method === 'cashfree' ? 'Cashfree' : 'GoKwik';
  if (activeBtn) { activeBtn.style.opacity = '1'; activeBtn.innerHTML = `<span style="font-size:1.4rem">⏳</span> <span>Connecting to ${gatewayLabel}...</span>`; }
  await new Promise(r => setTimeout(r, 500));
  closePaymentModal();
  showProcessingScreen(orderId, total, method);
  return method === 'cashfree'
    ? startCashfreePayment(orderId, total, formData, btn, origText)
    : startGoKwikPayment(orderId, total, formData, btn, origText);
}

// ══════════════════════════════════════════════
// startGoKwikPayment
// STILL MISSING in the deployed file — it is CALLED at the end of the
// payment modal flow but defined nowhere, so every online payment
// throws "startGoKwikPayment is not defined" before it ever reaches
// the backend. Only COD works today. Implemented against the existing
// /api/create-gokwik-order endpoint.
//
// The server recomputes the amount from real product prices (and now also
// factors in any VitaPoints applied), so the `total` passed in is
// display-only — the customer is charged the server's figure, never the
// browser's.
// ══════════════════════════════════════════════
async function startGoKwikPayment(orderId, total, formData, btn, origText) {
  try {
    const resp = await fetch(API_BASE + '/api/create-gokwik-order', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        localStorage.getItem('asc_jwt') ? { 'Authorization': 'Bearer ' + localStorage.getItem('asc_jwt') } : {}),
      body: JSON.stringify({
        merchant_reference_id: orderId,
        amount: total,
        items: STORE.cart.map(function(i){
          var o = { id: i.id, qty: i.qty };
          if (i.tierTabs) { o.tierTabs = i.tierTabs; o.tierIdx = i.tierIdx; }
          return o;
        }),
        coupon_code: (typeof activePromoCode !== 'undefined' && activePromoCode) ? activePromoCode.code : null,
        vita_points: (typeof VITA_APPLIED !== 'undefined' && VITA_APPLIED > 0) ? VITA_APPLIED : 0,
        customer_name:  [formData.firstName, formData.lastName].filter(Boolean).join(' ') || formData.name || '',
        customer_email: formData.email,
        customer_phone: formData.phone,
        description: 'Ozylix order ' + orderId,
      }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.success || !data.short_url) {
      throw new Error(data.error || 'Could not start payment');
    }
    try {
      sessionStorage.setItem('asc_pending_gk', JSON.stringify({
        orderId: orderId, formData: formData, t: Date.now(),
        vitaApplied: (typeof VITA_APPLIED !== 'undefined' ? VITA_APPLIED : 0),
        promoCode: (typeof activePromoCode !== 'undefined' && activePromoCode) ? activePromoCode : null,
        paymentToken: data.payment_session_token,
      }));
    } catch (e) {}
    window.location.href = data.short_url;
  } catch (err) {
    console.error('[startGoKwikPayment]', err);
    if (typeof hideProcessingScreen === 'function') hideProcessingScreen();
    if (btn) { btn.disabled = false; btn.textContent = origText || '💳 Pay via GoKwik'; }
    document.querySelectorAll('.cfPayBtn').forEach(function(b){ b.disabled = false; b.style.opacity = '1'; });
    if (typeof showPaymentError === 'function') {
      showPaymentError('Payment could not be started: ' + err.message, orderId, formData, total, 'gokwik');
    } else if (typeof showToast === 'function') {
      showToast('❌ ' + err.message, 'error');
    }
  }
}

// ══════════════════════════════════════════════
// startCashfreePayment
//
// Same trust model as startGoKwikPayment: the amount passed here is
// display-only. /api/create-cashfree-order recomputes it from real
// product prices server-side, so a tampered request can't open a
// session for less than the cart is actually worth.
//
// Cashfree's JS SDK opens its hosted checkout with redirectTarget:"_self"
// — a full-page redirect, same shape as GoKwik's short_url flow, so the
// customer is returned to this site via order_meta.return_url and the
// same "resume on return" pattern (handleCashfreeReturn) picks it up.
// ══════════════════════════════════════════════
async function startCashfreePayment(orderId, total, formData, btn, origText) {
  try {
    const modules = await ensureOzylixModules();
    await modules.load('cashfree');
    if (typeof Cashfree === 'undefined') {
      throw new Error('Payment SDK failed to load — please check your connection and try again.');
    }
    const resp = await fetch(API_BASE + '/api/create-cashfree-order', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        localStorage.getItem('asc_jwt') ? { 'Authorization': 'Bearer ' + localStorage.getItem('asc_jwt') } : {}),
      body: JSON.stringify({
        merchant_reference_id: orderId,
        items: STORE.cart.map(function(i){
          var o = { id: i.id, qty: i.qty };
          if (i.tierTabs) { o.tierTabs = i.tierTabs; o.tierIdx = i.tierIdx; }
          return o;
        }),
        coupon_code: (typeof activePromoCode !== 'undefined' && activePromoCode) ? activePromoCode.code : null,
        vita_points: (typeof VITA_APPLIED !== 'undefined' && VITA_APPLIED > 0) ? VITA_APPLIED : 0,
        customer_name:  [formData.firstName, formData.lastName].filter(Boolean).join(' ') || formData.name || '',
        customer_email: formData.email,
        customer_phone: formData.phone,
        description: 'Ozylix order ' + orderId,
      }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.success || !data.payment_session_id) {
      throw new Error(data.error || 'Could not start payment');
    }
    try {
      sessionStorage.setItem('asc_pending_cf', JSON.stringify({
        orderId: orderId, formData: formData, t: Date.now(),
        vitaApplied: (typeof VITA_APPLIED !== 'undefined' ? VITA_APPLIED : 0),
        promoCode: (typeof activePromoCode !== 'undefined' && activePromoCode) ? activePromoCode : null,
        paymentToken: data.payment_session_token,
      }));
    } catch (e) {}

    // Use whichever mode the backend actually created this order under
    // (data.cf_env), so a sandbox session always opens in sandbox mode
    // and a production session always opens in production mode — this
    // can never drift out of sync with CASHFREE_ENV on Render, unlike a
    // hardcoded/manual frontend flag.
    const cashfree = Cashfree({ mode: (data.cf_env || window.CASHFREE_MODE || 'production') });
    cashfree.checkout({ paymentSessionId: data.payment_session_id, redirectTarget: '_self' });
  } catch (err) {
    console.error('[startCashfreePayment]', err);
    if (typeof hideProcessingScreen === 'function') hideProcessingScreen();
    if (btn) { btn.disabled = false; btn.textContent = origText || '💳 Pay Online'; }
    document.querySelectorAll('.cfPayBtn').forEach(function(b){ b.disabled = false; b.style.opacity = '1'; });
    if (typeof showPaymentError === 'function') {
      showPaymentError('Payment could not be started: ' + err.message, orderId, formData, total, 'cashfree');
    } else if (typeof showToast === 'function') {
      showToast('❌ ' + err.message, 'error');
    }
  }
}

// ══════════════════════════════════════════════
// PAYMENT RETURN HANDLERS
//
// handleGoKwikReturn was called from the boot sequence's "Handle GoKwik
// payment return" block but was never defined anywhere in this file — so
// every customer who completed an online GoKwik payment and was
// redirected back threw a ReferenceError right there, and the order was
// never confirmed: no thank-you page, no VitaPoints, nothing saved. COD
// was the only online-payment-adjacent path that actually worked.
//
// Both handlers here follow the same shape: restore the checkout state
// that was stashed in sessionStorage before the redirect away (cart
// itself survives via STORE's own localStorage persistence), verify
// payment directly with the gateway (never trust the return URL alone —
// it's just a hint to check, exactly like the GoKwik/Cashfree webhooks
// do), then run the SAME finalizeOrder() used by every other payment
// path so there is only one order-saving code path to trust.
// ══════════════════════════════════════════════
async function handleGoKwikReturn(merchantRefId) {
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem('asc_pending_gk') || 'null'); } catch (e) {}
  if (!pending || pending.orderId !== merchantRefId) {
    console.warn('[handleGoKwikReturn] No matching pending session for', merchantRefId);
    return;
  }
  sessionStorage.removeItem('asc_pending_gk');
  if (typeof VITA_APPLIED !== 'undefined') VITA_APPLIED = pending.vitaApplied || 0;
  if (typeof activePromoCode !== 'undefined') activePromoCode = pending.promoCode || null;

  showProcessingScreen(merchantRefId, 0, 'gokwik');
  try {
    const resp = await fetch(API_BASE + '/api/verify-gokwik-order/' + encodeURIComponent(merchantRefId), {
      headers: pending.paymentToken ? { 'X-Payment-Session': pending.paymentToken } : {},
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) throw new Error(data.error || 'Could not verify payment');
    if (!data.paid) {
      if (typeof hideProcessingScreen === 'function') hideProcessingScreen();
      showPaymentError('Payment was not completed. If money was deducted, it will be auto-refunded by GoKwik within 5-7 days.',
        merchantRefId, pending.formData, data.amount || 0, 'gokwik');
      return;
    }
    await finalizeOrder(merchantRefId, pending.formData, data.amount || 0, 'gokwik', 0, pending.paymentToken);
  } catch (err) {
    console.error('[handleGoKwikReturn]', err);
    if (typeof hideProcessingScreen === 'function') hideProcessingScreen();
    showPaymentError('We could not confirm your payment automatically. If money was deducted, contact +91 98985 82650 with Order ID: ' + merchantRefId + '. (' + err.message + ')',
      merchantRefId, pending.formData, 0, 'gokwik');
  }
}

async function handleCashfreeReturn(orderId) {
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem('asc_pending_cf') || 'null'); } catch (e) {}
  if (!pending || pending.orderId !== orderId) {
    console.warn('[handleCashfreeReturn] No matching pending session for', orderId);
    return;
  }
  sessionStorage.removeItem('asc_pending_cf');
  if (typeof VITA_APPLIED !== 'undefined') VITA_APPLIED = pending.vitaApplied || 0;
  if (typeof activePromoCode !== 'undefined') activePromoCode = pending.promoCode || null;

  showProcessingScreen(orderId, 0, 'cashfree');
  try {
    const resp = await fetch(API_BASE + '/api/verify-cashfree-order/' + encodeURIComponent(orderId), {
      headers: pending.paymentToken ? { 'X-Payment-Session': pending.paymentToken } : {},
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) throw new Error(data.error || 'Could not verify payment');
    if (!data.paid) {
      if (typeof hideProcessingScreen === 'function') hideProcessingScreen();
      showPaymentError('Payment was not completed. If money was deducted, it will be auto-refunded by Cashfree within 5-7 days.',
        orderId, pending.formData, data.order_amount || 0, 'cashfree');
      return;
    }
    await finalizeOrder(orderId, pending.formData, data.order_amount || 0, 'cashfree', 0, pending.paymentToken);
  } catch (err) {
    console.error('[handleCashfreeReturn]', err);
    if (typeof hideProcessingScreen === 'function') hideProcessingScreen();
    showPaymentError('We could not confirm your payment automatically. If money was deducted, contact +91 98985 82650 with Order ID: ' + orderId + '. (' + err.message + ')',
      orderId, pending.formData, 0, 'cashfree');
  }
}
function recoverCodSignIn() {
  localStorage.removeItem('asc_jwt');
  localStorage.removeItem('asc_user');
  updateAccountNavBtn();
  if (typeof hideProcessingScreen === 'function') hideProcessingScreen();
  requireLoginForCheckout(function () { initiateCOD(); }, 'cod');
  showAuthError('Your session is no longer valid on the store server. Sign in again to continue your COD order.');
}

var codOrderInFlight = false;
async function initiateCOD() {
  if (codOrderInFlight) return;
  if (DELIVERY_POLICY && DELIVERY_POLICY.store_online === false) {
    showToast('The store is temporarily unavailable for new orders. Please try again shortly.', 'error');
    return;
  }
  const codEnabled = DELIVERY_POLICY && (DELIVERY_POLICY.cod_enabled === true || DELIVERY_POLICY.cod_enabled === 'true');
  if (!codEnabled) { showToast('COD is currently unavailable. Please choose online payment.', 'error'); updateCodBtnNote(); return; }
  if (STORE.cart.length === 0) { showToast('🛒 Your cart is empty!', 'error'); return; }
  // 2026-08: PIN serviceability gate — see initiatePayment for the why.
  const pinEl = document.getElementById('ckPinInput');
  const clean = (pinEl?.value || '').replace(/\D/g, '');
  if (clean.length === 6) {
    const cached = window.__pinCache && window.__pinCache[clean];
    if (cached && !cached.serviceable) {
      showToast('⚠️ We cannot deliver to PIN ' + clean + '. Please change the delivery address first.', 'error');
      pinEl.focus();
      return;
    }
    if (cached && !cached.cod) {
      showToast('⚠️ COD is not available for PIN ' + clean + ' — please pay online instead.', 'error');
      return;
    }
  }
  // LOGIN GATE: orders can only be placed by signed-in customers.
  if (!getCurrentUser()) { requireLoginForCheckout(function(){ initiateCOD(); }, 'cod'); return; }
  const formData = validateCheckoutForm();
  if (!formData) return;

  const { paidSubtotal, vitaOff } = getOrderTotal();
  const orderId = generateOrderId();
  const netSub = paidSubtotal;
  const codCharge = calcShipping(netSub, 'cod');
  const codTotal = Math.max(0, netSub + codCharge - vitaOff);

  codOrderInFlight = true;
  // Disable button immediately to prevent double-tap
  const btn = document.getElementById('codBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.innerHTML = '<span>⏳</span> <span>Placing your order...</span>'; }

  try {
    await finalizeOrder(orderId, formData, codTotal, 'cod', codCharge);
    // On success finalizeOrder navigates to the thank-you page.
  } catch(err) {
    showToast('❌ Order failed: ' + err.message, 'error');
  } finally {
    codOrderInFlight = false;
    // MUST be `finally`, not `catch`. finalizeOrder RETURNS (it does not
    // throw) when the order fails to save, so a catch-only reset left the
    // button stuck on "Placing your order..." until a page refresh — and
    // the same stale state greeted the customer if they navigated back to
    // checkout after a successful order. Resetting unconditionally is
    // safe: on success the page has already moved to the thank-you view.
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.innerHTML = '<span style="font-size:1.2rem">💵</span><div style="text-align:left"><div>Confirm COD Order</div><div id="codBtnNote" style="font-size:.65rem;opacity:.8;font-weight:500;margin-top:1px">Free COD on your order</div></div>';
      try { updateCodBtnNote(); } catch(e) {}
    }
  }
}

async function confirmCODOrder(orderId, codTotal, codCharge) {
  const overlay = document.getElementById('codOverlay');
  if (overlay) overlay.innerHTML = `<div style="background:var(--sub-1);border-radius:20px;padding:32px 28px;text-align:center;max-width:340px;width:90%">
    <div style="font-size:2.5rem;margin-bottom:12px">⏳</div>
    <div style="font-weight:700;color:var(--f-mineral-d)">Placing your order...</div>
  </div>`;

  const pd = window._pendingPayment;
  if (!pd) { if(overlay) overlay.remove(); showToast('Session expired', 'error'); return; }

  try {
    await finalizeOrder(orderId, pd.formData, codTotal, 'cod', codCharge);
    if (overlay) overlay.remove();
    // finalizeOrder calls showPage('thankyou')
  } catch(err) {
    if (overlay) overlay.remove();
    showPaymentError('COD order failed: ' + err.message, orderId, pd.formData, codTotal, 'cod');
  }
}

// ══════════════════════════════════════════════
// COD PAYMENT FLOW (from modal — kept for compatibility)



// Helper to update the processing screen status bar

// ── PROCESSING OVERLAY ──
function showProcessingScreen(orderId, total, method) {
  document.getElementById('cfProcessing')?.remove();
  const methodIcons = { cod:'💵', upi:'📱', card:'💳', netbanking:'🏦', emi:'📊', gokwik:'🔴', cashfree:'🔵' };
  const methodNames = { cod:'Cash on Delivery', upi:'UPI', card:'Card', netbanking:'Net Banking', emi:'EMI', gokwik:'GoKwik', cashfree:'Cashfree' };

  const el = document.createElement('div');
  el.id = 'cfProcessing';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(10,20,10,0.92);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:system-ui;text-align:center;padding:32px';
  el.innerHTML = `
    <div style="font-size:3.5rem;margin-bottom:20px;animation:cfSpin 1.2s linear infinite">${methodIcons[method] || '💳'}</div>
    <div style="font-size:1.3rem;font-weight:800;margin-bottom:8px">${method === 'cod' ? 'Placing COD Order' : 'Processing Payment'}</div>
    <div style="font-size:.85rem;opacity:.7;margin-bottom:4px">₹${total.toLocaleString('en-IN')} via ${methodNames[method] || method}</div>
    <div style="font-size:.72rem;opacity:.5;margin-bottom:28px">Order: ${orderId}</div>
    <div style="width:240px;height:5px;background:rgba(255,255,255,.15);border-radius:100px;overflow:hidden">
      <div id="cfPBar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--st-ok-fg),var(--indigo));border-radius:100px;transition:width .4s ease"></div>
    </div>
    <div id="cfPStatus" style="font-size:.72rem;opacity:.5;margin-top:12px">${method === 'cod' ? 'Validating delivery, stock, and order details...' : 'Connecting to payment gateway...'}</div>
    <div style="font-size:.65rem;opacity:.35;margin-top:24px">${method === 'cod' ? '🔒 Secure COD order · No payment is being processed' : '🔒 256-bit SSL · Payment provider secured · PCI DSS'}</div>
    <style>@keyframes cfSpin{0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)}}</style>
  `;
  document.body.appendChild(el);
}

async function animateProcessing() {
  const steps = [
    [15, 'Connecting to GoKwik...'],
    [35, 'Authenticating...'],
    [55, 'Verifying order details...'],
    [75, 'Processing payment...'],
    [90, 'Confirming transaction...'],
    [100, '✅ Payment successful!'],
  ];
  for (const [pct, msg] of steps) {
    await new Promise(r => setTimeout(r, 480));
    const bar = document.getElementById('cfPBar');
    const status = document.getElementById('cfPStatus');
    if (bar) bar.style.width = pct + '%';
    if (status) status.textContent = msg;
  }
  await new Promise(r => setTimeout(r, 500));
}

function hideProcessingScreen() {
  document.getElementById('cfProcessing')?.remove();
}

/* ── Friendly copy for known backend/gateway errors so customers never
   see internal provider wording like "Merchant Data Not Found". ── */
const PAY_RESULT_ERROR_MAP = [
  { re: /merchant data not found/i, text: 'We could not reach our payment provider. Please wait a moment and try again.' },
  { re: /transactions are not enabled/i, text: 'Online payments are temporarily unavailable with our provider. Please try again shortly, or use Cash on Delivery.' },
  { re: /payment gateway account/i, text: 'Online payments are temporarily unavailable with our provider. Please try again shortly, or use Cash on Delivery.' },
  // COD orders mention no money at all (nothing was charged in the first
  // place); claiming an auto-refund on a COD failure confused customers.
  { re: /could not verify/i, codText: 'We could not place your order just now. Please check your details and try again in a moment — no money is involved with Cash on Delivery.' },
  { re: /could not verify/i, text: 'We could not confirm this payment automatically. If money was deducted, it will be auto-refunded within 5-7 days.' },
];
function friendlyPaymentError(raw, method) {
  for (const m of PAY_RESULT_ERROR_MAP) {
    if (!m.re.test(raw || '')) continue;
    // COD orders get the money-free variant (codText); prepaid flows use
    // the refund-safety wording (text). Entries may define only one of
    // the two — fall through to the next matching rule or the raw text.
    if (method === 'cod') {
      if (m.codText) return m.codText;
      if (m.text) return m.text;
      return raw;
    }
    if (m.text) return m.text;
    continue;
  }
  return raw;
}

// ── PAYMENT RESULT — success OR failure, centred in place ──
// Shows a real modal (dimmed backdrop, sticky pay bar hidden, page locked)
// so the outcome is obvious on phones, not floating at the bottom.
function closePaymentResult() {
  document.getElementById('payResultOverlay')?.remove();
  document.getElementById('payErrorOverlay')?.remove();
  document.body.classList.remove('oz-pay-result');
  if (!document.querySelector('.pay-result-overlay, #payErrorOverlay')) {
    document.body.style.overflow = '';
  }
}
function showPaymentResult(state, opts) {
  // state: 'ok' | 'fail'
  closePaymentResult();
  hideProcessingScreen();
  closePaymentModal();
  document.body.classList.add('oz-pay-result'); // hides #ozPayBar + locks scroll

  const ok = state === 'ok';
  const isCod = opts.method === 'cod';
  const el = document.createElement('div');
  el.className = 'pay-result-overlay';
  el.id = 'payResultOverlay';
  el.onclick = function (e) { if (e.target === el) closePaymentResult(); };

  const refHtml = opts.orderId ? `<div class="pay-result-ref">Order Ref: <strong>${opts.orderId}</strong></div>` : '';
  const amountHtml = opts.total ? `<span style="font-weight:800;font-variant-numeric:tabular-nums">₹${Number(opts.total).toLocaleString('en-IN')}</span>` : '';

  const iconHtml = ok
    ? `<div class="pay-result-icon ok"><svg width="44" height="44" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="none" stroke="#2f5d3a" stroke-width="2"/><path d="M14.1 27.2l7.1 7.2 16.7-16.8" fill="none" stroke="#2f5d3a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`
    : `<div class="pay-result-icon fail">✕</div>`;

  const title = ok
    ? (isCod ? 'COD Order Confirmed' : 'Payment Successful')
    : (isCod ? 'COD Order Not Placed' : 'Payment Failed');
  const msg = ok
    ? (opts.msg || (isCod ? 'Your Cash on Delivery order is confirmed.' : 'Your payment went through and your order is confirmed.'))
    : friendlyPaymentError(opts.msg || (isCod ? 'We could not place your COD order.' : 'Your payment could not be completed.'), opts.method);

  const noteHtml = ok
    ? (opts.note ? `<div class="pay-result-note">${opts.note}</div>` : '')
    : `<div class="pay-result-note">${isCod ? 'No payment was processed. Your cart is safe.' : (opts.refundNote || 'No money has been deducted from your account.')}</div>`;

  const supportWaNumber = (typeof window.getCustomerWhatsAppNumber === 'function')
    ? window.getCustomerWhatsAppNumber()
    : '919898582650';
  const actionsHtml = ok
    ? `<button class="pay-result-btn pay-result-primary ok" onclick="closePaymentResult(); showPage('thankyou');">Continue to Order Confirmation →</button>
       <button class="pay-result-btn pay-result-secondary" onclick="closePaymentResult(); showPage('home');">Back to Home</button>`
    : `${isCod
       ? `<button class="pay-result-btn pay-result-primary fail" onclick="closePaymentResult(); initiateCOD();">🔄 Retry COD Order</button>`
       : `<button class="pay-result-btn pay-result-primary fail" onclick="closePaymentResult(); initiatePayment();">🔄 Retry Payment</button>`}
       <button class="pay-result-btn pay-result-wa" onclick="window.open('https://wa.me/${supportWaNumber}?text=${encodeURIComponent((isCod ? 'COD order failed' : 'Payment failed') + ' for order ' + (opts.orderId || '') + (opts.total ? ' amount ₹' + opts.total : '') + ', please help')}', '_blank')">💬 WhatsApp Support</button>
       <button class="pay-result-btn pay-result-secondary" onclick="closePaymentResult(); showPage('cart');">← Back to Cart</button>
       <button class="pay-result-btn pay-result-secondary" onclick="closePaymentResult(); showPage('home');">Cancel & Continue Shopping</button>`;

  el.innerHTML = `<div class="pay-result-box">
    ${iconHtml}
    <div class="pay-result-title">${title}</div>
    ${amountHtml && ok ? `<div style="font-size:1.05rem;color:var(--t-hi);margin-bottom:12px">${amountHtml} paid</div>` : ''}
    ${refHtml}
    <p class="pay-result-msg">${msg}</p>
    ${noteHtml}
    <div class="pay-result-actions">${actionsHtml}</div>
  </div>`;

  document.body.appendChild(el);
  // Focus first button for accessibility after the pop animation.
  const firstBtn = el.querySelector('button');
  if (firstBtn) setTimeout(() => firstBtn.focus(), 320);
}

// ── Legacy helper used across the checkout paths — routes through the
// centred modal above so failures are never buried at the page bottom. ──
function showPaymentError(msg, orderId, formData, total, method) {
  showPaymentResult('fail', { orderId: orderId, total: total, msg: msg || '', method: method });
}

// ── FINALIZE ORDER AFTER SUCCESSFUL PAYMENT ──

window.OzylixPaymentFlow = {initiatePayment,openPaymentGateway,closePaymentModal,startPayment,startGoKwikPayment,startCashfreePayment,handleGoKwikReturn,handleCashfreeReturn,recoverCodSignIn,initiateCOD,confirmCODOrder,showProcessingScreen,animateProcessing,hideProcessingScreen,friendlyPaymentError,closePaymentResult,showPaymentResult,showPaymentError};
})();
