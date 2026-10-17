/* Media navigation uses existing authenticated upload and placement handlers. */
(function () {
  'use strict';
  const placements = [
    ['home','Home & Shop hero','Top rotating banner on Home and Shop','2.33:1 · 1600 × 686','/','siteimg-home-banners','homeBannerManager'],
    ['shop','Shop promotion strips','Below the Shop product grid','11:1 · 2200 × 200','/shop','siteimg-shop-banners','shopBannerManager'],
    ['products','Product fallback images','Only when a product has no SKU photo','Square · 1400 × 1400','/shop','siteimg-products','fallbackManager'],
    ['education','Product education & brand','Know Your Product tabs, logo and About page','Choose the named slot','/about','siteimg-education','siteImagesGroups'],
    ['cards','Home product promos','Product promotion carousel between sections','Square · 1400 × 1400','/','siteimg-promo-cards','promoMediaGrid'],
    ['strip','Home scrolling strip','Optional scrolling cards below the hero','Square image or short video','/','siteimg-promo-strip','promoStripGrid']
  ];
  let selected = 'home', usage = new Map(), usageReady = false;
  const escape = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function canonical(value) {
    try { let p=decodeURIComponent(new URL(value,location.origin).pathname); return p.replace(/^.*\/(?:cdn-storage|storage\/v1\/object\/public)\//,'').replace(/^\//,''); } catch (_) {return '';}
  }
  window.selectMediaPlacement = function (name) {
    selected = placements.some(p=>p[0]===name) ? name : 'home';
    placements.forEach(p=>{const panel=document.getElementById('media-placement-'+p[0]);if(panel)panel.hidden=p[0]!==selected;});
    document.querySelectorAll('[data-media-placement]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.mediaPlacement===selected));});
    const p=placements.find(p=>p[0]===selected),preview=document.getElementById('mediaPlacementPreview');
    if(preview)preview.innerHTML='<div class="media-page-map"><span>Header</span><b>'+escape(p[1])+'</b><span>Store content</span></div><div><strong>'+escape(p[2])+'</strong><p>'+escape(p[3])+'. Images and videos up to 50 MB. Uploading saves to the media library; assigning it here publishes it in this location.</p><a class="btn btn-secondary" href="https://www.ozylix.com'+p[4]+'" target="_blank" rel="noopener">Open storefront page ↗</a></div>';
    const page=document.getElementById('page-siteimages');if(page)page.querySelectorAll('video').forEach(v=>{if(v.closest('[hidden]'))v.pause();});
  };
  window.openMediaPlacement = function(name){showPage('siteimages');selectMediaPlacement(name);};
  window.renderMediaBannerOverview = function(){
    const root=document.getElementById('bannerGrid');if(!root)return;
    root.innerHTML=placements.filter(p=>['home','shop','cards','strip'].includes(p[0])).map(p=>'<article class="media-location-card"><small>STOREFRONT LOCATION</small><h3>'+escape(p[1])+'</h3><p>'+escape(p[2])+'</p><div class="media-ratio '+(p[0]==='shop'?'wide':'')+'"><span>'+escape(p[3])+'</span></div><button class="btn btn-primary" onclick="openMediaPlacement(\''+p[0]+'\')">Manage this location →</button></article>').join('');
  };
  loadBanners=async function(){renderMediaBannerOverview();};
  window.setMediaUsageFilter=function(){renderPhotoGrid();};
  function addUsage(url,label){const k=canonical(url);if(k){const values=usage.get(k)||[];if(!values.includes(label))values.push(label);usage.set(k,values);}}
  async function loadUsage(){
    usageReady=false;
    try {
      const responses=await Promise.all(['/api/admin/site-media','/api/admin/promo-media','/api/products'].map(p=>apiFetch(p)));
      if(responses.some(r=>!r.ok))throw Error('Placement lookup unavailable');
      const [slots,promos,products]=await Promise.all(responses.map(r=>r.json()));usage=new Map();
      (slots.data||[]).forEach(row=>addUsage(row.url,row.key));
      (promos.data||[]).forEach(row=>addUsage(row.src,'Home scrolling strip'+(row.active?'':' (hidden)')));
      const productRows=Array.isArray(products)?products:(products.data||products.products||[]);
      productRows.forEach(p=>{[p.image,p.image_url,...(Array.isArray(p.images)?p.images:[])].forEach(u=>{if(typeof u==='string')addUsage(u,'Product: '+(p.name||p.id));});});
      usageReady=true;
    }catch(_){usageReady=false;}
    renderPhotoGrid();
  }
  const oldFilter=_mediaFiltered;
  _mediaFiltered=function(){const rows=oldFilter();const filter=document.getElementById('mediaUsageFilter')?.value||'all';return rows.filter(img=>{const refs=usage.get(canonical(img.url))||[];return filter==='all'||!usageReady||(usageReady&&(filter==='assigned'?refs.length>0:filter==='unassigned'?refs.length===0:refs.some(r=>filter==='products'?r.startsWith('Product:'):!r.startsWith('Product:'))));});};
  const oldRender=renderPhotoGrid;
  renderPhotoGrid=function(){oldRender();const rows=_mediaFiltered();document.querySelectorAll('#photoGrid .photo-item').forEach((card,i)=>{const refs=usage.get(canonical(rows[i]?.url))||[],label=document.createElement('div');label.className='media-usage-label';label.textContent=usageReady?(refs.length?'Used in: '+refs.join(' · '):'No placement found in products, site slots or promo strip'):'Placement status unavailable — refresh to check';card.appendChild(label);const video=card.querySelector('video');if(video){video.controls=true;video.style.pointerEvents='auto';}});};
  const oldLibrary=loadPhotoLibrary;
  loadPhotoLibrary=async function(){await oldLibrary();await loadUsage();};
  function init(){
    const page=document.getElementById('page-siteimages');if(!page)return;
    const guide=page.querySelector('.siteimg-start-card');
    const nav=document.createElement('div');nav.className='media-workspace-nav';nav.setAttribute('aria-label','Media placement categories');
    nav.innerHTML=placements.map(p=>'<button type="button" data-media-placement="'+p[0]+'" onclick="selectMediaPlacement(\''+p[0]+'\')" aria-pressed="false">'+escape(p[1])+'</button>').join('');
    const preview=document.createElement('div');preview.id='mediaPlacementPreview';preview.className='media-placement-preview';
    if(guide){guide.replaceWith(nav);nav.after(preview);}else page.prepend(nav,preview);
    page.querySelector('.siteimg-inline-note')?.remove();
    placements.forEach(p=>{const heading=document.getElementById(p[5]),manager=document.getElementById(p[6]);if(!heading||!manager)return;const panel=document.createElement('section');panel.id='media-placement-'+p[0];panel.className='media-placement-panel';heading.before(panel);panel.append(heading,manager);});
    const toolbar=document.querySelector('#page-photolibrary .media-tabs');
    if(toolbar){const filter=document.createElement('select');filter.id='mediaUsageFilter';filter.className='media-sort';filter.setAttribute('aria-label','Filter by storefront use');filter.onchange=window.setMediaUsageFilter;filter.innerHTML='<option value="all">All placements</option><option value="assigned">Assigned media</option><option value="products">Product photos</option><option value="website">Website & banners</option><option value="unassigned">No placement found</option>';toolbar.appendChild(filter);}
    selectMediaPlacement(selected);renderMediaBannerOverview();
    // Admin previews are controllable and never autoplay in hidden panels.
    const previews=new MutationObserver(()=>page.querySelectorAll('video[autoplay]').forEach(v=>{v.removeAttribute('autoplay');v.pause();v.controls=true;}));previews.observe(page,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
