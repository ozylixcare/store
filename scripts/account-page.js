// Account panels and actions load on account entry or invoice action.
(()=>{
function loadAccountPage() {
  if (currentPage !== 'account') return;
  syncAccountSession();
  const user = getCurrentUser();
  if (!user) { openAuth('login'); return; }
  document.getElementById('accName')?.textContent != null && (document.getElementById('accName').textContent = user.name);
  document.getElementById('accEmail')?.textContent != null && (document.getElementById('accEmail').textContent = user.email);
  const parts = (user.name || 'Member').split(' ');
  const av=document.getElementById('accAvatar'); if(av) av.textContent = (parts[0][0] + (parts[1]?parts[1][0]:'')).toUpperCase();
  loadActiveAccountPanel();
  prefillProfile(user);
  // Refresh the top Account Hub identity and live summary on every account entry.
  try { if (typeof refreshAccountWelcome === 'function') refreshAccountWelcome(); } catch(e) {}

  // AUTO-REFRESH: the courier sync flips fulfillment (Shipped → Delivered)
  // server-side every 10 minutes. Without this loop the customer would have
  // to leave and return to see their order move, and the "Earns VitaPoints
  // once delivered" line would never update. Re-pull every 60 s while the
  // account page is visible — harmless repeat calls (authenticated, cheap).
  clearInterval(window._ordersRefreshTimer);
  window._ordersRefreshTimer = setInterval(() => {
    if (document.hidden || currentPage !== 'account') return;
    loadActiveAccountPanel();
    try { refreshAccountWelcome(); } catch(e) {}
  }, 60 * 1000);
}

// ══════════════════════════════════════════════════════════════
// RETURNS & REFUNDS (My Account)
// The returns panel is also usable on pages where invoice-template.js is not
// loaded. Keep a local global fallback so a missing optional template helper
// cannot leave the customer-facing panel on an infinite loading state.
var _esc = (typeof window !== 'undefined' && typeof window._esc === 'function')
  ? window._esc
  : function(v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
if (typeof window !== 'undefined') window._esc = _esc;

//
// Every rule that matters — 7-day window, ownership, item validity —
// is enforced server-side in returns-routes.js and SQL. This is the
// display layer; it never decides eligibility, it only renders what
// /api/returns/eligible reports.
// ══════════════════════════════════════════════════════════════
let RETURN_REASONS = [];

function _retJwt() { return localStorage.getItem('asc_jwt') || ''; }

async function renderReturnsPanel() {
  const el = document.getElementById('returnsPanelBody');
  if (!el) return;
  if (!_retJwt()) {
    el.innerHTML = '<div class="ret-empty">Please sign in to request a return.</div>';
    return;
  }
  el.innerHTML = '<div class="ret-empty">Loading your orders…</div>';

  try {
    const h = { 'Authorization': 'Bearer ' + _retJwt() };
    // Never leave the customer on an infinite spinner. The eligible-orders
    // request is the critical path; the request-history call is best effort,
    // because a temporary failure there must not hide returnable products.
    const results = await Promise.allSettled([
      fetchWithTimeout(API_BASE + '/api/returns/eligible', { headers: h }, 15000),
      fetchWithTimeout(API_BASE + '/api/returns/my', { headers: h }, 15000),
    ]);
    const eligibleResult = results[0];
    const historyResult = results[1];
    if (eligibleResult.status !== 'fulfilled') {
      throw new Error('The returns service took too long to respond. Please try again.');
    }
    const eR = eligibleResult.value;
    const eD = await eR.json().catch(() => ({}));
    if (!eR.ok) throw new Error(eD.error || 'Could not load your orders');

    let mD = {};
    if (historyResult.status === 'fulfilled' && historyResult.value.ok) {
      mD = await historyResult.value.json().catch(() => ({}));
    } else {
      console.warn('[renderReturnsPanel] request history unavailable; showing eligible orders');
    }
    if (!accountSessionMatches(h.Authorization.slice(7))) return;
    RETURN_REASONS = eD.reasons || [];

    const existing = (mD && mD.returns) || [];
    const orders   = (eD && eD.orders)  || [];

    let html = '';

    if (existing.length) {
      html += '<h4 style="font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--t-low);margin:2px 0 11px;font-weight:800">Your requests</h4>';
      html += existing.map(function(r){
        const items = (r.items || []).map(function(i){ return _esc(i.name || ('Item ' + i.id)) + ' × ' + i.qty; }).join(', ');
        // data-return-id lets cancelReturn grey this exact card out
        // immediately, and flash it back if the server refuses.
        return '<div class="ret-card" data-return-id="' + _esc(r.id) + '">'
          + '<div class="ret-head"><div><div class="ret-oid">' + _esc(r.order_id) + '</div>'
          + '<div class="ret-meta">' + new Date(r.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
          + ' · ' + _esc(r.reason) + '</div></div>'
          + '<span class="ret-badge rb-' + _esc(r.status) + '">' + _esc(String(r.status).replace('_',' ')) + '</span></div>'
          + '<div class="ret-items"><div class="ret-item" style="padding:0">' + _esc(items) + '</div>'
          + (r.points_reversed ? '<div class="ret-meta" style="margin-top:7px">💎 ' + r.points_reversed.toLocaleString('en-IN') + ' VitaPoints reversed</div>' : '')
          + (r.refund_amount ? '<div class="ret-meta">Refund ₹' + Number(r.refund_amount).toLocaleString('en-IN') + (r.refund_ref ? ' · ref ' + _esc(r.refund_ref) : '') + '</div>' : '')
          + (r.admin_note ? '<div class="ret-meta">Note: ' + _esc(r.admin_note) + '</div>' : '')
          + '</div>'
          + (r.status === 'requested'
              ? '<div class="ret-actions"><button class="btn-outline" onclick="cancelReturn(\'' + r.id + '\')">Cancel request</button></div>'
              : '')
          + '</div>';
      }).join('');
    }

    const eligible = orders.filter(function(o){ return o.eligible; });
    html += '<h4 style="font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--t-low);margin:20px 0 11px;font-weight:800">Eligible for return</h4>';

    if (!eligible.length) {
      html += '<div class="ret-empty">' + (orders.length
                ? 'None of your orders are open for return right now.'
                : 'You have no orders yet.') + '<br>'
            + '<span style="font-size:.78rem">Returns are open for <b>7 days</b> after delivery.</span></div>';
    } else {
      html += eligible.map(function(o){
        // items can arrive as a JSON string from an older backend build,
        // and as null on an order whose line items were never stored.
        // Both used to fall through as "no checkboxes", which produced a
        // form that could not possibly be submitted (see below).
        var rawItems = o.items;
        if (typeof rawItems === 'string') {
          try { rawItems = JSON.parse(rawItems); } catch (e) { rawItems = []; }
        }
        if (!Array.isArray(rawItems)) rawItems = [];

        // An order with ONE item has only one possible answer, and making
        // the customer find an invisible box to give it was the whole
        // failure. Pre-selected — they still choose a reason and press
        // Submit, so nothing is sent without an explicit action.
        const single = rawItems.length === 1;

        const items = rawItems.map(function(i, n){
          return '<label class="ret-item">'
            + '<input type="checkbox"' + (single ? ' checked' : '')
            + ' data-oid="' + _esc(o.order_id) + '" data-id="' + _esc(i.id) + '" data-max="' + (i.qty||1) + '">'
            + '<span>' + _esc(i.name || ('Item ' + i.id)) + '</span>'
            + '<span class="rq">qty ' + (i.qty || 1) + '</span></label>';
        }).join('');

        // Say a choice is needed BEFORE the button is pressed, rather
        // than only in an error afterwards.
        const pickHint = '<div class="ret-pick-hint">'
          + (single ? 'Item to return' : 'Select the item(s) to return')
          + '</div>';

        // AN ORDER WITH NO ITEMS MUST NOT SHOW A SUBMIT BUTTON.
        // Previously the item list rendered empty while the reason box
        // and "Submit return request" rendered anyway — so there was
        // nothing to tick, and every submit answered "Select at least
        // one item to return". The customer could try forever and never
        // succeed, with no way to tell why. Say what is wrong and give
        // them the route that does work.
        if (!rawItems.length) {
          return '<div class="ret-card" id="retcard-' + _esc(o.order_id) + '">'
            + '<div class="ret-head"><div><div class="ret-oid">' + _esc(o.order_id) + '</div>'
            + '<div class="ret-meta">₹' + Number(o.total||0).toLocaleString('en-IN')
            + ' · ' + new Date(o.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) + '</div></div>'
            + '<span class="ret-days">' + o.days_left + ' day' + (o.days_left === 1 ? '' : 's') + ' left</span></div>'
            + '<div class="ret-empty" style="margin:12px 0 0">'
            + 'We could not load the items for this order, so a return cannot be started here.<br>'
            + '<span style="font-size:.78rem">This order is still within its return window — '
            + 'message us on WhatsApp with order <b>' + _esc(o.order_id) + '</b> and we will raise it for you.</span>'
            + '</div></div>';
        }
        return '<div class="ret-card" id="retcard-' + _esc(o.order_id) + '">'
          + '<div class="ret-head"><div><div class="ret-oid">' + _esc(o.order_id) + '</div>'
          + '<div class="ret-meta">₹' + Number(o.total||0).toLocaleString('en-IN')
          + ' · ' + new Date(o.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) + '</div></div>'
          + '<span class="ret-days">' + o.days_left + ' day' + (o.days_left === 1 ? '' : 's') + ' left</span></div>'
          + '<div class="ret-items">' + pickHint + items + '</div>'
          + '<div class="ret-form">'
          + '<label>Reason for return</label>'
          + '<select id="retreason-' + _esc(o.order_id) + '">'
          + '<option value="">Select a reason…</option>'
          + RETURN_REASONS.map(function(r){ return '<option>' + _esc(r) + '</option>'; }).join('')
          + '</select>'
          + '<label>Anything else we should know? (optional)</label>'
          + '<textarea id="retnote-' + _esc(o.order_id) + '" placeholder="Tell us what went wrong…"></textarea>'
          + '</div>'
          + '<div class="ret-actions"><button class="btn-primary" onclick="submitReturn(\'' + _esc(o.order_id) + '\', this)">Submit return request</button></div>'
          + '<p class="ret-meta" style="margin-top:9px">Approved returns reverse the VitaPoints earned on this order.</p>'
          + '</div>';
      }).join('');
    }

    // Everything that is NOT open for return, with the server's reason
    // against it. This panel used to render nothing but "No orders are
    // currently eligible", which is the same message whether the window
    // has closed, the order was cancelled, a request is already open, or
    // — as was happening for every customer — the window was being
    // measured from the wrong date. A customer who cannot raise a refund
    // request should at least be told which of those it is.
    const blocked = orders.filter(function(o){ return !o.eligible; });
    if (blocked.length) {
      html += '<h4 style="font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--t-low);margin:22px 0 11px;font-weight:800">Not open for return</h4>';
      html += blocked.map(function(o){
        return '<div class="ret-card ret-card-muted">'
          + '<div class="ret-head"><div><div class="ret-oid">' + _esc(o.order_id) + '</div>'
          + '<div class="ret-meta">\u20b9' + Number(o.total||0).toLocaleString('en-IN')
          + ' \u00b7 ' + new Date(o.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
          + (o.fulfillment ? ' \u00b7 ' + _esc(o.fulfillment) : '') + '</div></div></div>'
          + '<div class="ret-meta" style="margin-top:8px">' + _esc(o.reason || 'Not eligible for return') + '</div>'
          + '</div>';
      }).join('');
    }

    html += '<p class="ret-meta" style="margin-top:18px">Something look wrong? '
          + '<a href="mailto:hi@ozylix.com">Email us</a> with your order number '
          + 'and we will raise the request for you.</p>';

    el.innerHTML = html;
  } catch (err) {
    console.error('[renderReturnsPanel]', err);
    el.innerHTML = '<div class="ret-empty">Could not load returns: ' + _esc(err.message) + '</div>';
  }
}

// _esc() is defined once, in invoice-template.js, which loads in <head>
// before any of this runs. The byte-identical copy that used to sit here
// shadowed it for no reason.

async function submitReturn(orderId, btn) {
  const boxes = Array.from(document.querySelectorAll('input[type=checkbox][data-oid="' + orderId + '"]:checked'));
  const reason = (document.getElementById('retreason-' + orderId) || {}).value || '';
  const note   = (document.getElementById('retnote-' + orderId) || {}).value || '';

  if (!boxes.length) {
    // A toast alone told the customer a rule existed but not where to
    // satisfy it — which, when the control was invisible, made the
    // button look broken. Point at the actual rows and flash them.
    showToast('Tick the item you want to return', 'error');
    var card = document.getElementById('retcard-' + orderId);
    var list = card && card.querySelector('.ret-items');
    if (list) {
      list.classList.remove('rollback-flash');
      void list.offsetWidth;
      list.classList.add('rollback-flash');
      setTimeout(function(){ list.classList.remove('rollback-flash'); }, 1600);
      list.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }
  if (!reason)       { showToast('Please choose a reason for the return', 'error'); return; }

  const jwt = _retJwt();
  if (!jwt) { showToast('Your session has expired. Please sign in again.', 'error'); return; }
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = 'Submitting…';
  try {
    const resp = await fetchWithTimeout(API_BASE + '/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt },
      body: JSON.stringify({
        order_id: orderId, reason: reason, comments: note,
        items: boxes.map(function(b){ return { id: b.dataset.id, qty: Number(b.dataset.max) || 1 }; }),
      }),
    }, 20000);
    const d = await resp.json().catch(function(){ return {}; });
    if (!resp.ok) {
      const message = d.error || d.message || (resp.status === 401 || resp.status === 403
        ? 'Your session has expired. Please sign in again.'
        : 'The returns service could not accept this request (HTTP ' + resp.status + '). Please try again or email support.');
      throw new Error(message);
    }
    showToast('↩️ Return request submitted');
    renderReturnsPanel();
  } catch (err) {
    const message = err && (err.name === 'AbortError' || err.name === 'TimeoutError')
      ? 'The request timed out. Check your connection and try again.'
      : (err && err.message ? err.message : 'Could not submit your return request. Please try again.');
    console.error('[submitReturn] request failed', { orderId: orderId, error: err });
    showToast('❌ ' + message, 'error');
    btn.disabled = false; btn.textContent = orig;
  }
}

async function cancelReturn(id) {
  // Optimistic: this is the customer's own pending request, so it
  // essentially always succeeds. Grey the card out and say so
  // immediately rather than leaving the button looking inert.
  const card = document.querySelector('[data-return-id="' + id + '"]');
  if (card) { card.style.opacity = '0.45'; card.style.pointerEvents = 'none'; }

  try {
    const resp = await fetch(API_BASE + '/api/returns/' + id + '/cancel', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + _retJwt() },
      signal: AbortSignal.timeout(15000),
    });
    const d = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(d.error || 'Could not cancel');
    showToast('Return request cancelled');
    renderReturnsPanel();
  } catch (err) {
    // Put the card back and make the undo visible, so nobody walks away
    // thinking a request was cancelled when it is still open.
    if (card) {
      card.style.opacity = '';
      card.style.pointerEvents = '';
      card.classList.add('rollback-flash');
      setTimeout(() => card.classList.remove('rollback-flash'), 1600);
    }
    showToast('↩️ Still open — ' + (err.message || 'could not cancel'), 'error');
  }
}

function switchAccountPanel(panel) {
  if (currentPage !== 'account') return;
  if (!getCurrentUser()) { openAuth('login'); return; }
  if (!document.getElementById('panel-' + panel)) return;
  document.querySelectorAll('.account-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.account-nav-item').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('panel-' + panel);
  if (el) el.classList.add('active');
  const navItems = document.querySelectorAll('.account-nav-item');
  const labels = ['orders','tracking','invoices','vita','returns','profile'];
  if (panel === 'returns') { try { renderReturnsPanel(); } catch(e) { console.error('[renderReturnsPanel]', e); } }
  if (panel === 'vita') { try { renderVitaPanel(); } catch(e) { console.error('[renderVitaPanel]', e); } }
  if (panel === 'orders') loadOrdersList();
  if (panel === 'invoices') loadInvoicesList();
  try { refreshAccountWelcome(); } catch(e) {}
  const idx = labels.indexOf(panel);
  if (idx >= 0 && navItems[idx]) navItems[idx].classList.add('active');
  navItems.forEach(b => b.setAttribute('aria-current', b.classList.contains('active') ? 'page' : 'false'));
  document.querySelector('#panel-' + panel + ' .account-panel-title')?.setAttribute('tabindex', '-1');
  document.querySelector('#panel-' + panel + ' .account-panel-title')?.focus({preventScroll:true});
}

function _renderOrderCards(orders, container) {
  if (orders.length === 0) {
    container.innerHTML = `<div class="no-orders"><div class="no-orders-ico">📦</div><h3 style="margin-bottom:8px">No orders yet</h3><p style="color:var(--gray);margin-bottom:20px">Your order history will appear here after your first purchase.</p><button class="btn-primary" onclick="showPage('shop')">Start Shopping →</button></div>`;
    return;
  }
  container.innerHTML = orders.map(o => {
    const orderId = o.orderId || o.id || '';
    const date    = o.date || (o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '');
    const status  = o.status || o.fulfillment || 'Processing';
    const total   = o.total || 0;
    let items = o.items || [];
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch(e) { items = []; } }
    const statusCls = status.toLowerCase().includes('dispatch')||status.toLowerCase().includes('confirm') ? 'confirmed'
      : status.toLowerCase().includes('ship') ? 'shipped'
      : status.toLowerCase().includes('deliver') ? 'delivered' : 'pending';

    // VitaPoints for this order, straight from the columns the server writes
    // when it awards/redeems against the ledger. Nothing is recomputed here —
    // if the order was returned, the points were reversed server-side, so the
    // card says so rather than still claiming they were earned.
    const isReturned  = /return/i.test(status);
    const isCancelled = /cancel/i.test(status);
    const earned   = Number(o.vita_points_earned || 0);
    const redeemed = Number(o.vita_points_redeemed || 0);
    let vitaLine = '';
    {
      const bits = [];
      if (earned > 0) {
        bits.push(isReturned
          ? `<span style="color:var(--clay-lo,#b4553f)">−${earned.toLocaleString('en-IN')} VitaPoints reversed</span>`
          : `<span style="color:var(--fern-lo,#2E7D32)">+${earned.toLocaleString('en-IN')} VitaPoints</span>`);
      } else if (!isCancelled && !isReturned) {
        // A cash-on-delivery order earns nothing until the courier hands it
        // over and the cash is collected — a refused parcel was never a sale.
        // With no line at all, an order that SPENT points looked like it gave
        // nothing back, which is what this reads as on the account page.
        // No number is shown: the rate is tier-based and decided server-side
        // by vita_earn_on_order, so quoting one here would be a guess.
        bits.push('<span style="color:var(--gray,#777)">Earns VitaPoints once delivered</span>');
      }
      if (redeemed > 0) bits.push(`<span style="color:var(--gray,#777)">${redeemed.toLocaleString('en-IN')} used</span>`);
      if (bits.length) {
        vitaLine = `<div style="font-size:.76rem;margin-top:6px;display:flex;gap:10px;flex-wrap:wrap">🌿 ${bits.join(' · ')}</div>`;
      }
    }
    const payStatus = o.payment_status ? `<div style="font-size:.72rem;color:var(--gray,#888);margin-top:4px">${o.payment_status}</div>` : '';
    // 2026-08: show WHICH payment method was used (COD vs Online) and every
    // discount that applied, so My Orders matches the invoice and the
    // VitaPoints ledger — same database row, same numbers.
    const PAY_METHOD_LABEL = {
      cod: '💵 COD', cashfree: '🔒 Online (Cashfree)', gokwik: '🔒 Online (GoKwik)',
      online: '🔒 Online', UPI: '🔒 UPI',
    };
    const payMethod = o.payment_method ? `<div style="font-size:.72rem;font-weight:600;color:var(--t-mid,#444);margin-top:3px">${PAY_METHOD_LABEL[String(o.payment_method).toLowerCase()] || '🔒 ' + o.payment_method}</div>` : '';
    const discBits = [];
    if (Number(o.tier_discount || 0) > 0) discBits.push(`Pack/tier −₹${Number(o.tier_discount).toLocaleString('en-IN')}`);
    if (Number(o.mix_match_discount || 0) > 0) discBits.push(`Mix&Match −₹${Number(o.mix_match_discount).toLocaleString('en-IN')}`);
    if (Number(o.coupon_discount || 0) > 0) discBits.push(`Promo ${o.coupon_code ? '(' + o.coupon_code + ')' : ''} −₹${Number(o.coupon_discount).toLocaleString('en-IN')}`);
    if (Number(o.vita_points_discount || 0) > 0) discBits.push(`VitaPoints −₹${Number(o.vita_points_discount).toLocaleString('en-IN')}`);
    const discLine = discBits.length ? `<div style="font-size:.72rem;color:var(--success,#2E7D32);margin-top:3px">🏷️ ${discBits.join(' · ')}</div>` : '';
    // REVIEW COLLECTION: delivered orders get a direct "Write a Review"
    // button — this is where reviews come from in the real world. It opens
    // the product page straight onto the review form, so the customer is
    // one tap from the stars. Only shown when the courier has confirmed
    // delivery (fulfillment === 'Delivered'), never before.
    const delivered = String(status).toLowerCase() === 'delivered';
    const productId = (() => { try { const it = items[0]; return Number(it && (it.product_id || it.id || 0)) || 0; } catch(_) { return 0; } })();
    const deliveredReviewCta = delivered && productId
      ? `<button class="order-track-btn" style="background:var(--fern-lo,#2E7D32);color:#fff" onclick="openProductReview(${productId})">⭐ Write a Review</button>`
      : '';

    return `<div class="order-card">
      <div class="order-header">
        <div>
          <div class="order-id">${orderId}</div>
          <div class="order-date">${date}</div>
        </div>
        <span class="order-status ${statusCls}">${status}</span>
      </div>
      <div class="order-items">${items.map(i => `${i.name||i.item_name||''} × ${i.qty||i.units||1}`).join(', ') || 'Order confirmed'}</div>
      ${vitaLine}
      ${payMethod}${discLine}
      <div class="order-footer">
        <div class="order-total">₹${parseFloat(total).toLocaleString('en-IN')}${payStatus}</div>
        <div style="display:flex;gap:8px">
          <button class="invoice-btn" onclick="downloadInvoice('${orderId}')">🧾 Updated Invoice</button>
          <button class="order-track-btn" onclick="openTracking('${orderId}')">🚚 Track</button>${deliveredReviewCta}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function loadOrdersList() {
  const container = document.getElementById('ordersList');
  if (!container) return;
  const user = getCurrentUser();
  if (!user) { container.innerHTML = '<p style="color:var(--gray);text-align:center;padding:30px">Please log in to view your orders.</p>'; return; }

  // Show loading state
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray)"><div style="font-size:1.5rem;margin-bottom:8px">⏳</div>Loading your orders…</div>';

  const jwt = localStorage.getItem('asc_jwt') || '';
  let backendOrders = [];
  let backendLoaded = false;

  try { backendOrders = await readAccountOrders(); backendLoaded = true; }
  catch(e) { console.warn('[Orders] Backend fetch failed:', e.message); }

  if (!accountSessionMatches(jwt)) return;
  const merged = backendOrders.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  // Keep the exact same order objects available to every invoice action,
  // including the Orders panel. Previously only the Invoices panel populated
  // __INVOICE_ORDERS, so Print/Invoice from My Account could fall back to an
  // incomplete local row and appear to use a different template.
  window.__INVOICE_ORDERS = merged;
  _renderOrderCards(merged, container);

  if (!backendLoaded) {
    container.innerHTML = '<div class="no-orders" role="status"><h3>Order history is unavailable</h3><p>Please retry to load your verified orders.</p><button class="btn-outline" onclick="loadOrdersList()">Retry</button></div>';
  }
}

async function loadInvoicesList() {
  const container = document.getElementById('invoicesList');
  if (!container) return;
  const user = getCurrentUser();
  if (!user) return;

  const jwt = localStorage.getItem('asc_jwt') || '';
  let orders = [];
  let invoicesLoaded = false;

  try { orders = await readAccountOrders(); invoicesLoaded = true; }
  catch(e) { console.warn('[Invoices] Backend fetch failed:', e.message); }

  if (!accountSessionMatches(jwt)) return;
  if (!invoicesLoaded) { container.innerHTML = '<div class="no-orders" role="status">Invoices are unavailable. <button class="btn-outline" onclick="loadInvoicesList()">Retry</button></div>'; return; }
  if (!orders.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gray)">No invoices yet. They'll appear here after you place an order.</div>`;
    return;
  }

  const sorted = orders.sort((a,b) => new Date(b.created_at||b.date||0) - new Date(a.created_at||a.date||0));
  window.__INVOICE_ORDERS = sorted;   // so downloadInvoice() can find backend-sourced orders
  container.innerHTML = `
    <div style="background:var(--sub-1);border-radius:var(--radius);border:1px solid rgba(0,0,0,0.08);overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:var(--off-white);font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--gray)">
          <th style="padding:12px 18px;text-align:left">Order ID</th>
          <th style="padding:12px 18px;text-align:left">Date</th>
          <th style="padding:12px 18px;text-align:left">Amount</th>
          <th style="padding:12px 18px;text-align:left">Status</th>
          <th style="padding:12px 18px;text-align:left">Invoice</th>
        </tr></thead>
        <tbody>${sorted.map(o => {
          const oid  = o.id || o.orderId || '';
          const date = o.date || (o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '');
          const paid = (o.payment_status||'').toLowerCase().includes('paid') || (o.payment_status||'').toLowerCase().includes('cod') ? o.payment_status : 'Paid';
          const paidColor = paid.toLowerCase().includes('cod') ? 'var(--st-warn-fg)' : 'var(--st-ok-fg)';
          const paidBg    = paid.toLowerCase().includes('cod') ? 'var(--st-warn-bg)' : 'var(--st-ok-bg)';
          return `<tr style="border-top:1px solid var(--light-gray);font-size:0.84rem">
            <td style="padding:14px 18px;font-weight:700;color:var(--green)">${oid}</td>
            <td style="padding:14px 18px;color:var(--gray)">${date}</td>
            <td style="padding:14px 18px;font-weight:600">₹${parseFloat(o.total||0).toLocaleString('en-IN')}</td>
            <td style="padding:14px 18px"><span style="background:${paidBg};color:${paidColor};padding:3px 10px;border-radius:100px;font-size:0.72rem;font-weight:700">${paid}</span></td>
            <td style="padding:14px 18px;white-space:nowrap"><button class="invoice-btn" onclick="downloadInvoice('${oid}')">⬇ Updated Invoice</button> <button class="invoice-btn" onclick="printInvoice('${oid}')">🖨️ Print</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
  `;
}

function openTracking(orderId) {
  switchAccountPanel('tracking');
  setTimeout(() => {
    const inp = document.getElementById('trackInput');
    if (inp) { inp.value = orderId; doTrackOrder(); }
  }, 100);
}

async function doTrackOrder() {
  const inp = document.getElementById('trackInput');
  const res = document.getElementById('trackResult');
  if (!inp || !res) return;
  const requested = inp.value.trim();
  if (!requested) { showToast('Please enter an Order ID', 'error'); return; }
  const normaliseId = value => String(value || '').trim().toUpperCase();
  const matchesId = value => {
    const a = normaliseId(value);
    const b = normaliseId(requested);
    return a === b || a.replace(/^AVC-/, '') === b.replace(/^AVC-/, '');
  };

  res.style.display = 'block';
  res.innerHTML = '<div style="padding:14px;color:var(--gray)">Loading order status…</div>';
  let order = Array.isArray(window.__INVOICE_ORDERS)
    ? window.__INVOICE_ORDERS.find(o => matchesId(o.id || o.orderId))
    : null;
  const user = getCurrentUser();
  const jwt = localStorage.getItem('asc_jwt') || localStorage.getItem('asc_token') || '';

  // The authenticated endpoint is the source of truth; it returns only the
  // current customer’s orders, so tracking works across devices and sessions.
  if (!order && jwt) {
    try {
      const r = await fetchWithTimeout(API_BASE + '/api/orders/my', {
        headers: { 'Authorization': 'Bearer ' + jwt, 'Accept': 'application/json' }
      }, 8000);
      if (r.ok) {
        const data = await r.json();
        const backendOrders = (data.data || data || []).filter(o =>
          !user?.email || (o.customer_email || '').toLowerCase().trim() === user.email.toLowerCase().trim()
        );
        order = backendOrders.find(o => matchesId(o.id || o.orderId));
      }
    } catch (e) { console.warn('[Tracking] backend lookup failed:', e && e.message); }
  }

  if (!accountSessionMatches(jwt)) return;
  if (!order) {
    res.innerHTML = '<div style="background:var(--st-danger-bg);border:1px solid var(--st-danger-bg);border-radius:var(--radius);padding:14px;font-size:0.84rem;color:var(--red)">We could not match that ID to an order on your account. Check the order number or enter the Shiprocket AWB number instead.</div>';
    return;
  }

  const foundId = order.id || order.orderId || requested;
  const address = order.address || order.shipping_address || [order.city, order.state, order.pincode || order.postal_code].filter(Boolean).join(', ');
  const status = order.fulfillment || order.status || order.order_status || 'Processing';
  const awb = String(order.awb_code || order.awb_number || order.awb || order.tracking_number || order.tracking_id || '').trim();
  const shiprocketUrl = awb ? 'https://shiprocket.co/tracking/' + encodeURIComponent(awb) : '';
  res.innerHTML = `
    <div style="background:var(--green-wash);border-radius:var(--radius);padding:18px">
      <div style="font-weight:700;margin-bottom:8px;color:var(--green)">📦 Order Found: ${esc(foundId)}</div>
      <div style="font-size:0.84rem;color:var(--gray);margin-bottom:12px">${esc(address)}</div>
      <div style="font-size:0.84rem;font-weight:700;color:var(--text)">Status: ${esc(status)}</div>
      <div style="margin-top:14px">
        ${shiprocketUrl
          ? `<a href="${esc(shiprocketUrl)}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="font-size:0.82rem;padding:10px 20px">Track shipment ${esc(awb)} on Shiprocket ↗</a>`
          : '<p style="font-size:0.8rem;color:var(--gray);margin:12px 0 0">Carrier tracking will appear here once your shipment has an AWB number.</p>'}
      </div>
    </div>
  `;
}

// The A4 GST tax invoice lives in invoice-template.js, loaded in <head>
// and shared with the admin panel so both print the same document.
// OZYLIX_LEGAL, IN_STATE_CODES, normaliseOrderForInvoice() and
// buildInvoiceHTML() all come from there.

// Download a printable A4 PDF tax invoice from the backend. The server
// authenticates the request and streams application/pdf; HTML is never used
// as a download fallback because browsers otherwise save the invoice source
// as an .html file.
function invoiceAuthHeaders() {
  var jwt = localStorage.getItem('asc_jwt') || localStorage.getItem('asc_token') || '';
  return jwt ? { 'Authorization': 'Bearer ' + jwt } : {};
}

function fetchInvoicePDF(orderId) {
  return fetchWithTimeout(API_BASE + '/api/orders/' + encodeURIComponent(orderId) + '/pdf', {
    headers: invoiceAuthHeaders()
  }, 15000).then(function(r) {
    var type = (r.headers.get('content-type') || '').toLowerCase();
    if (!r.ok) {
      return r.text().then(function(text) {
        var message = 'Invoice service returned ' + r.status;
        try { var body = JSON.parse(text); if (body && body.error) message = body.error; } catch (e) {}
        throw new Error(message);
      });
    }
    if (type.indexOf('application/pdf') === -1) {
      throw new Error('Invoice service did not return a PDF');
    }
    return r.blob();
  });
}

function findInvoiceOrder(orderId) {
  if (!getCurrentUser()) return null;
  var o = null;
  if (Array.isArray(window.__INVOICE_ORDERS)) {
    o = window.__INVOICE_ORDERS.find(function(x) {
      return String(x.id || x.orderId || x.order_id) === String(orderId);
    });
  }
  return o;
}

function downloadInvoice(orderId) {
  // Visible invoice controls download the authenticated PDF endpoint; do not
  // create an HTML attachment that opens as source in some mobile browsers.
  return downloadInvoicePDF(orderId);
}

function downloadInvoicePDF(orderId) {
  fetchInvoicePDF(orderId).then(function(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Ozylix-Tax-Invoice-' + orderId + '.pdf';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 4000);
    showToast('🧾 Updated PDF invoice downloaded');
  }).catch(function(e) {
    console.error('[downloadInvoicePDF]', e);
    showToast('Could not download the PDF invoice: ' + (e.message || 'please try again'), 'error');
  });
}

// Print is intentionally a print-ready document, not a file download. The
// browser print dialog can print to a physical printer or Save as PDF, while
// Download always uses the server-generated PDF above.
function printInvoice(orderId) {
  try {
    var o = findInvoiceOrder(orderId);
    if (!o) { showToast('Invoice not found for ' + orderId, 'error'); return; }
    var w = window.open('', '_blank', 'width=960,height=800,scrollbars=yes');
    if (!w) { showToast('Please allow pop-ups to print the invoice', 'error'); return; }
    w.document.open();
    w.document.write(buildInvoiceHTML(o));
    w.document.close();
    w.focus();
    setTimeout(function() { try { w.print(); } catch (e) {} }, 800);
  } catch (e) {
    console.error('[printInvoice]', e);
    showToast('Could not open invoice for printing', 'error');
  }
}

function prefillProfile(user) {
  const parts = user.name?.split(' ') || ['',''];
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('profileFirst', parts[0]);
  setVal('profileLast', parts.slice(1).join(' '));
  setVal('profileEmail', user.email);
  setVal('profilePhone', user.phone);
  {
    setVal('profileAddr1', user.address?.addr1);
    setVal('profileAddr2', user.address?.addr2);
    setVal('profileCity', user.address?.city);
    setVal('profileState', user.address?.state);
    setVal('profilePin', user.address?.pin);
  }
}

function saveProfile() {
  const user = getCurrentUser();
  if (!user) return;
  const getVal = id => document.getElementById(id)?.value?.trim() || '';
  user.name = (getVal('profileFirst') + ' ' + getVal('profileLast')).trim();
  user.phone = getVal('profilePhone');
  user.address = {
    addr1: getVal('profileAddr1'),
    addr2: getVal('profileAddr2'),
    city: getVal('profileCity'),
    state: getVal('profileState'),
    pin: getVal('profilePin'),
  };
  // Profile remains local to this signed-in account on this device.
  localStorage.setItem('asc_user', JSON.stringify(user));
  const an=document.getElementById('accName'); if(an) an.textContent = user.name;
  updateAccountNavBtn();
  showToast('✅ Profile & address saved!');
}

// ═══════════════════════════════════════════════════════
// CHECKOUT: PROMO CODES + SAVED ADDRESS AUTO-FILL
// ═══════════════════════════════════════════════════════

// ALL real codes are fetched live from backend (Supabase coupons table).
// No local test codes — admin creates all promo codes in the dashboard.
// Note: activePromoCode declared globally above (near appliedDiscount)


window.OzylixAccountPage = {loadAccountPage,_retJwt,renderReturnsPanel,submitReturn,cancelReturn,switchAccountPanel,_renderOrderCards,loadOrdersList,loadInvoicesList,openTracking,doTrackOrder,invoiceAuthHeaders,fetchInvoicePDF,findInvoiceOrder,downloadInvoice,downloadInvoicePDF,printInvoice,prefillProfile,saveProfile};
})();
