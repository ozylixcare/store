// Anonymous behaviour: public catalogue IDs and cart counts/totals only.
// Contact details, names, cart item lists and order references stay out.
(function () {
  'use strict';
  const allowed = new Set(['homepage_viewed','page_viewed','category_viewed','product_viewed','product_added_to_cart','cart_viewed','cart_snapshot','checkout_started','purchase_completed']);
  const disabled = () => { try { return localStorage.getItem('ozy_optout') === '1'; } catch (_) { return true; } };
  const session = (function () { try { let id=sessionStorage.getItem('ozy_anonymous_visit'); if(!id){id=crypto.randomUUID();sessionStorage.setItem('ozy_anonymous_visit',id);}return id;}catch(_){return null;} })();
  function pageType() { const part=location.pathname.split('/').filter(Boolean)[0] || 'home'; return ['home','shop','product','cart','checkout','blog','about','contact','faq'].includes(part) ? '/' + part : '/other'; }
  function boundedNumber(value, max) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null; }
  function productId(value) {
    const id = value && typeof value === 'object' ? value.id : value;
    return Number.isSafeInteger(id) && id > 0 && id <= 10000000 ? String(id) : null;
  }
  function cleanSummary(summary) {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return null;
    const count = boundedNumber(summary.item_count, 5000);
    const total = boundedNumber(summary.total_value, 10000000);
    return count !== null && Number.isInteger(count) && total !== null
      ? {item_count:count,total_value:count ? Math.round(total * 100) / 100 : 0} : null;
  }
  function cartSummary() {
    try {
      if (typeof STORE === 'undefined' || !Array.isArray(STORE.cart)) return null;
      let count=0, total=0;
      for (const item of STORE.cart.slice(0,50)) {
        const quantity=boundedNumber(item.qty,100);
        if (!Number.isInteger(quantity) || !quantity) continue;
        const product=typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)
          ? PRODUCTS.find(p=>p.id===item.id) : null;
        const price=boundedNumber(item.tierRate !== undefined ? item.tierRate
          : product ? (product.salePrice || product.price || 0) : 0,10000000);
        if (price === null) continue;
        count+=quantity; total+=quantity*price;
      }
      return cleanSummary({item_count:count,total_value:total});
    } catch (_) { return null; }
  }
  let summaryKey=null, lastNonEmptySummary=null;
  function track(name, data) {
    if (name === 'order_completed') name='purchase_completed';
    if (!allowed.has(name) || disabled() || !session) return;
    try {
      data=data && typeof data==='object' ? data : {};
      const event={event_name:name,page:pageType(),event_id:crypto.randomUUID()};
      if (name==='product_viewed' || name==='product_added_to_cart') {
        const id=productId(data.product_id);
        if (id) event.product_id=id;
      }
      if (['cart_viewed','cart_snapshot','checkout_started','purchase_completed'].includes(name)) {
        const summary=cleanSummary(data.cart_summary);
        if (summary) event.cart_summary=summary;
      }
      const body={anon_id:session,session_id:session,device_hint:matchMedia('(max-width:700px)').matches?'mobile':'desktop',events:[event]};
      Promise.resolve(fetch('/telemetry/api/track',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true})).catch(function(){});
    } catch (_) { /* Measurement must never break shopping. */ }
  }
  function snapshot() {
    const summary=cartSummary();
    if (!summary || disabled() || !session) return;
    const key=JSON.stringify(summary);
    if (key===summaryKey) return;
    summaryKey=key;
    if (summary.item_count) lastNonEmptySummary=summary;
    track('cart_snapshot',{cart_summary:summary});
  }
  function wrap(name,event,project) {
    const original=window[name];
    if(typeof original!=='function'||original._anonymousMarketing)return;
    const wrapped=function(){const result=original.apply(this,arguments);try{track(event,project ? project(arguments) : {});}catch(_){}return result;};
    wrapped._anonymousMarketing=true;window[name]=wrapped;
  }
  window.ozyTrack={track:track,identify:function(){return false;},setOptOut:function(value){try{localStorage.setItem('ozy_optout',value ? '1' : '0');return true;}catch(_){return false;}}};
  let installed=false;
  function install(){
    if(installed)return;installed=true;
    wrap('showPage','page_viewed');
    if (typeof window._trackViewItem === 'function') wrap('_trackViewItem','product_viewed',args=>({product_id:args[0] && args[0].id}));
    else wrap('openProduct','product_viewed',args=>({product_id:args[0]}));
    wrap('_trackAddToCart','product_added_to_cart',args=>({product_id:args[0] && args[0].id}));
    wrap('_trackViewCart','cart_viewed',()=>({cart_summary:cartSummary()}));
    wrap('_trackBeginCheckout','checkout_started',()=>({cart_summary:cartSummary()}));
    // Purchase is a browser completion signal. Paid order truth stays in the
    // store sync; never post the order ID, receipt, customer or item list.
    wrap('_trackPurchase','purchase_completed',()=>({cart_summary:lastNonEmptySummary}));
    if (typeof STORE !== 'undefined' && typeof STORE.save === 'function' && !STORE.save._anonymousMarketing) {
      const save=STORE.save;
      const wrapped=function(){const result=save.apply(this,arguments);try{snapshot();}catch(_){}return result;};
      wrapped._anonymousMarketing=true;STORE.save=wrapped;
    }
    track('homepage_viewed');
    const initial=cartSummary();
    if(initial && initial.item_count) snapshot();
    else if(initial) summaryKey=JSON.stringify(initial);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
