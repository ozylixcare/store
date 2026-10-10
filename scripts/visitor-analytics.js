/* First-party analytics: page views and heartbeats are distinct; no form values or emails. */
(function () {
  'use strict';
  window.createOzylixAnalytics = function (API) {
    var sid, lastPage=null, lastActivity=Date.now(), status='starting', pending=Promise.resolve();
    function disabled() {
      try { return localStorage.getItem('ozy_optout')==='1' || navigator.doNotTrack==='1' || navigator.doNotTrack==='yes' || window.doNotTrack==='1'; } catch (_) { return navigator.doNotTrack==='1'; }
    }
    function uuid() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2); }
    function session(activity) {
      var now=Date.now(), record;
      try { record=JSON.parse(sessionStorage.getItem('ozy_analytics_session')||'null'); } catch (_) {}
      if(!sid) {sid=record && now-record.at<1800000 ? record.id : uuid();lastActivity=record && record.id===sid ? record.at : now;}
      if(activity) {
        if(now-lastActivity>=1800000) {sid=uuid();lastPage=null;}
        lastActivity=now;
        try {sessionStorage.setItem('ozy_analytics_session',JSON.stringify({id:sid,at:now}));} catch (_) {}
      }
      return sid;
    }
    function page() {
      var path=location.pathname.replace(/\/+$/,'')||'/';
      if(path==='/' && /^#[a-z-]+$/i.test(location.hash)) path='/'+location.hash.slice(1);
      return path.slice(0,200);
    }
    function send(path,body,auth,proof) {
      if(disabled() || typeof API !== 'string') {status='disabled';return Promise.resolve(false);}
      var headers={'Content-Type':'application/json'};
      if(auth) headers.Authorization='Bearer '+auth;
      if(proof) headers['X-Payment-Session']=proof;
      return fetch(API+path,{method:'POST',headers:headers,body:JSON.stringify(body),keepalive:true,signal:AbortSignal.timeout(10000)})
        .then(function(r){status=r.ok?'collecting':'unavailable';return r.ok;}).catch(function(){status='unavailable';return false;});
    }
    function ping(activity) {
      if(disabled()) return Promise.resolve(false);
      session(!!activity);
      if(!activity && Date.now()-lastActivity>=1800000) return Promise.resolve(false);
      var current=page();
      var ua=navigator.userAgent, hint=/iPad/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1)?'tablet':/Mobi|iPhone|Android/i.test(ua)?'mobile':'desktop';
      var utm={}, params=new URLSearchParams(location.search);
      ['source','medium','campaign'].forEach(function(k){var v=params.get('utm_'+k);if(v)utm[k]=v.slice(0,120);});
      var body={session_id:sid,kind:'heartbeat',view_id:null,site:location.hostname,page:current,referrer:document.referrer,device_hint:hint,screen_w:screen.width,screen_h:screen.height,is_pwa:matchMedia('(display-mode: standalone)').matches||!!navigator.standalone,utm:utm};
      // Serialize sends so a first page establishes the session before subsequent events.
      pending=pending.catch(function(){}).then(function(){var view=body.session_id!==sid || current!==lastPage;body.kind=view?'pageview':'heartbeat';body.view_id=view?uuid():null;return send('/api/visitors/ping',body).then(function(ok){if(ok && sid===body.session_id)lastPage=current;return ok;});});
      return pending;
    }
    function event(name) {
      if(disabled()) return;
      var rotated=session(true);
      var collected=lastPage===null?ping(true):pending;
      var body={session_id:rotated,event_id:uuid(),event_name:name,page:page()};
      collected.then(function(ok){if(ok!==false)return send('/api/visitors/event',body);}).catch(function(){});
    }
    function convert(orderId,value,gateway,proof) {
      var token;try{token=localStorage.getItem('asc_jwt');}catch(_){}
      if((!token && !proof) || !orderId || disabled()) return;
      pending.then(function(){return send('/api/visitors/convert',{session_id:session(true),order_id:String(orderId).slice(0,64),gateway:gateway},token,proof);}).catch(function(){});
    }
    // Hook store actions directly, independent of the marketing service.
    [['_trackViewItem','product_view'],['_trackAddToCart','cart_add'],['_trackBeginCheckout','checkout_start'],['_trackSearch','search']].forEach(function(pair){
      var original=window[pair[0]];
      if(typeof original!=='function')return;
      window[pair[0]]=function(){var result=original.apply(this,arguments);event(pair[1]);return result;};
    });
    session(true);ping(true);
    setInterval(function(){if(!document.hidden)ping(false);},45000);
    if(typeof window.showPage==='function') {
      var original=window.showPage;
      window.showPage=function(){var result=original.apply(this,arguments);setTimeout(function(){ping(true);},40);return result;};
    }
    window.addEventListener('popstate',function(){setTimeout(function(){ping(true);},40);});
    window.addEventListener('hashchange',function(){ping(true);});
    document.addEventListener('visibilitychange',function(){if(!document.hidden)ping(true);});
    document.addEventListener('pointerdown',function(){session(true);},{passive:true});
    document.addEventListener('keydown',function(){session(true);},{passive:true});
    return {ping:ping,event:event,convert:convert,get sessionId(){return sid;},get status(){return disabled()?'disabled':status;}};
  };
})();
