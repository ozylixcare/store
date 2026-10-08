/* Ozylix Vita greeting: light, dependency-free and scoped to the auth modal. */
(function(){
  function init(){
    var overlay=document.getElementById('authOverlay'), box=overlay&&overlay.querySelector('.auth-box');
    if(!box||box.querySelector('.oz-vita-panel'))return;
    var panel=document.createElement('aside');
    panel.className='oz-vita-panel';
    panel.setAttribute('aria-label','Welcome to Ozylix');
    panel.innerHTML='<div class="oz-vita-mark"><img src="/assets/ozylix-logo.png" alt="Ozylix" loading="lazy" decoding="async"></div><div class="oz-vita-character"><img src="/assets/vita-waving.svg" alt="Vita, your Ozylix wellness guide, waving hello" loading="lazy" decoding="async"><span class="oz-vita-speech">Hi 👋</span></div><div class="oz-vita-hello">Hi! Welcome to Ozylix</div><p class="oz-vita-caption">Your wellness journey starts here.</p><div class="oz-vita-products" aria-label="Ozylix products"></div>';
    box.insertBefore(panel,box.firstChild);
    function products(){
      var holder=panel.querySelector('.oz-vita-products');
      if(holder.children.length)return;
      var imgs=Array.from(document.querySelectorAll('.product-card img, [data-product-id] img')).filter(function(img){return img.currentSrc||img.getAttribute('src');});
      var used={};
      imgs.slice(0,30).forEach(function(img){
        if(holder.children.length>=3)return;
        var src=img.currentSrc||img.getAttribute('src');
        if(!src||used[src]||src.indexOf('data:')===0)return;
        used[src]=true;
        var copy=document.createElement('img');copy.src=src;copy.alt=img.alt||'Ozylix product';copy.loading='lazy';copy.decoding='async';holder.appendChild(copy);
      });
    }
    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(entries){if(entries.some(function(e){return e.isIntersecting;})){products();io.disconnect();}},{rootMargin:'100px'});
      io.observe(overlay);
    }else products();
    overlay.addEventListener('transitionend',products,{passive:true});
    var mo=new MutationObserver(function(){if(overlay.classList.contains('active')||getComputedStyle(overlay).display!=='none')products();});
    mo.observe(overlay,{attributes:true,attributeFilter:['class','style']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();