// Anonymous marketing events. Customer identity and cart contents stay out.
(function () {
  'use strict';
  const allowed = new Set(['homepage_viewed','page_viewed','category_viewed','product_viewed','product_added_to_cart','checkout_started','order_completed']);
  const disabled = () => { try { return localStorage.getItem('ozy_optout') === '1'; } catch (_) { return true; } };
  const session = (function () { try { let id=sessionStorage.getItem('ozy_anonymous_visit'); if(!id){id=crypto.randomUUID();sessionStorage.setItem('ozy_anonymous_visit',id);}return id;}catch(_){return null;} })();
  function pageType() { const part=location.pathname.split('/').filter(Boolean)[0] || 'home'; return ['home','shop','product','cart','checkout','blog','about','contact','faq'].includes(part) ? '/' + part : '/other'; }
  function track(name) {
    if (!allowed.has(name) || disabled() || !session) return;
    // Explicit projection: no email, identity, URL query, product, order or cart data.
    const event={anonymous_id:session,session_id:session,event_name:name,page:pageType(),device_hint:matchMedia('(max-width:700px)').matches?'mobile':'desktop'};
    fetch('/telemetry/api/track',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:[event]}),keepalive:true}).catch(function(){});
  }
  function wrap(name,event) { const original=window[name];if(typeof original!=='function'||original._anonymousMarketing)return;const wrapped=function(){const result=original.apply(this,arguments);track(event);return result;};wrapped._anonymousMarketing=true;window[name]=wrapped; }
  window.ozyTrack={track:track,identify:function(){return false;}};
  let installed=false;
  function install(){if(installed)return;installed=true;wrap('showPage','page_viewed');wrap('openProduct','product_viewed');wrap('_trackAddToCart','product_added_to_cart');wrap('_trackBeginCheckout','checkout_started');wrap('_trackPurchase','order_completed');track('homepage_viewed');}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
