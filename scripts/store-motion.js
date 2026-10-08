/* Shared stable button lighting and bounded storefront entrance motion. */
(function(){
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const admin=document.body.classList.contains('admin-motion-ready') || !!document.getElementById('sidebar');
  const controls='button,a.btn,a.btn-primary,a.btn-outline,a.shader-btn-primary,a.shader-btn-ghost,a.nav-cta,a.promo-card-cta';
  const running=new Set();
  function off(){return reduced.matches || document.body.classList.contains('admin-motion-reduced');}
  function decorate(root){
    const nodes=root.matches?.(controls)?[root,...root.querySelectorAll(controls)]:[...root.querySelectorAll(controls)];
    nodes.forEach(button=>{
      if(button.classList.contains('oz-liquid'))return;
      button.classList.add('oz-liquid');
      if(/danger|delete|remove|cancel|logout/.test(button.className))button.dataset.liquidTone='rose';
      else if(/primary|buy|checkout|pay|gold/.test(button.className))button.dataset.liquidTone='gold';
      else if(/search|advisor|wishlist/.test(button.className+' '+button.getAttribute('aria-label')))button.dataset.liquidTone='violet';
    });
  }
  decorate(document);
  new MutationObserver(records=>{
    records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)decorate(node);}));
  }).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('pointermove',event=>{
    if(off() || event.pointerType!=='mouse')return;
    const b=event.target.closest('.oz-liquid');if(!b)return;
    const r=b.getBoundingClientRect();b.style.setProperty('--liquid-x',Math.round((event.clientX-r.left)/Math.max(r.width,1)*100)+'%');
  },{passive:true});
  document.addEventListener('pointerdown',event=>{
    const b=event.target.closest('.oz-liquid');if(!b || b.disabled || b.getAttribute('aria-disabled')==='true')return;
    b.dataset.liquidPressed='';
  },{passive:true});
  ['pointerup','pointercancel','blur'].forEach(type=>window.addEventListener(type,()=>document.querySelectorAll('[data-liquid-pressed]').forEach(b=>delete b.dataset.liquidPressed),{passive:true}));
  function stop(){running.forEach(a=>a.cancel());running.clear();}
  function play(el,frames,options){if(off())return;const a=el.animate(frames,options);running.add(a);a.finished.catch(()=>{}).finally(()=>running.delete(a));}
  if(!admin){
    let active=null;
    function enter(){
      const page=document.querySelector('.page.active,[id^="page-"].active');
      if(!page || page===active)return;
      active=page;stop();
      play(page,[{opacity:.4,clipPath:'inset(0 0 12px 0)'},{opacity:1,clipPath:'inset(0)'}],{duration:430,easing:'cubic-bezier(.22,1,.36,1)'});
      page.querySelectorAll('h1,.section-title').forEach((el,i)=>{if(i<4)play(el,[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:550,delay:i*70,easing:'cubic-bezier(.22,1,.36,1)'});});
    }
    new MutationObserver(enter).observe(document.body,{attributes:true,attributeFilter:['class'],subtree:true});
    enter();
    const seen=new WeakSet();
    const observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{
      if(!isIntersecting || target.closest('.page:not(.active)'))return;
      if(!seen.has(target)){seen.add(target);play(target,[{opacity:.25,clipPath:'inset(0 0 16% 0 round 12px)'},{opacity:1,clipPath:'inset(0 round 12px)'}],{duration:620,easing:'cubic-bezier(.22,1,.36,1)'});}
      observer.unobserve(target);
    }),{threshold:.12});
    document.querySelectorAll('.promo-card,.trust-grid,.section-hdr,.shader-content').forEach(el=>observer.observe(el));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  }
  reduced.addEventListener('change',()=>{if(off())stop();});
})();
